import 'dotenv/config';
import { PgVector } from '@mastra/pg';
import { embed, embedMany } from 'ai';
import { openai } from '../ai/service';
import { EnrichedItem, LibrarySearchResult } from '../types';
import { getEnrichedDataFromLLM } from '../ai/enrichment';
import { EmbeddingJobPayload } from '../jobs/jobService';
import { createHash } from 'crypto';

if (!process.env.POSTGRES_CONNECTION_STRING) {
  throw new Error('POSTGRES_CONNECTION_STRING is not set');
}

/**
 * RAG Service for managing library documentation and code snippets.
 *
 * Workflow:
 * 1. Query submitted → searchLibraries() to find relevant libraries
 * 2. Library ID + topic → fetchLibraryDocumentation() to get specific docs
 * 3. Results returned to LLM for orchestration
 */
class RagService {
  private store: PgVector;

  /**
   * Initializes the RagService, setting up the connection to the PgVector store.
   */
  constructor() {
    this.store = new PgVector({
      connectionString: process.env.POSTGRES_CONNECTION_STRING as string,
    });
  }

  /**
   * Generates a deterministic ID for a content chunk based on library, source, and content.
   * @param libraryId - The ID of the library.
   * @param sourceUrl - The URL of the source document.
   * @param content - The content chunk.
   * @returns A SHA256 hash to be used as a deterministic ID.
   */
  private generateDeterministicId(
    libraryId: string,
    sourceUrl: string,
    content: string,
  ): string {
    const input = `${libraryId}-${sourceUrl}-${content}`;
    return createHash('sha256').update(input).digest('hex');
  }

  /**
   * Creates or updates a library's metadata in the 'libraries' index.
   * This involves creating an embedding for the library's name and description.
   * @param library - The library object containing id, name, and description.
   */
  async upsertLibrary(library: {
    id: string;
    name: string;
    description: string;
  }) {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: `${library.name}: ${library.description}`,
    });

    await this.store.upsert({
      indexName: 'libraries',
      vectors: [embedding],
      ids: [library.id],
      metadata: [
        {
          name: library.name,
          description: library.description,
        },
      ],
    });
  }

  /**
   * Ingests documentation chunks from a job.
   * It first ensures the library exists, then creates embeddings for each chunk
   * and upserts them into the 'embeddings' index.
   * @param job - The embedding job containing documentation data.
   */
  async ingestDocumentation(job: EmbeddingJobPayload) {
    if (!job.rawSnippets || job.rawSnippets.length === 0) {
      console.log('No documentation chunks to ingest');
      return;
    }

    await this.upsertLibrary({
      id: job.libraryId,
      name: job.libraryName,
      description: job.libraryDescription,
    });

    const { embeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: job.rawSnippets,
    });

    const vectors = [];
    const ids = [];
    const metadata = [];

    for (let i = 0; i < job.rawSnippets.length; i++) {
      const chunk = job.rawSnippets[i];
      const embedding = embeddings[i];
      const vectorId = this.generateDeterministicId(
        job.libraryId,
        job.sourceUrl,
        chunk,
      );

      ids.push(vectorId);
      vectors.push(embedding);
      metadata.push({
        library_id: job.libraryId,
        original_text: chunk,
        content_type: 'documentation',
        source: job.sourceUrl,
      });
    }

    await this.store.upsert({
      indexName: 'embeddings',
      vectors,
      ids,
      metadata,
    });
  }

  /**
   * Ingests code snippets from a job by enriching them with LLM.
   * It first ensures the library exists, then enriches raw snippets with LLM,
   * creates embeddings for each code snippet and upserts them into the 'embeddings' index.
   * @param job - The embedding job containing code snippets data.
   */
  async ingestCodeSnippets(job: EmbeddingJobPayload) {
    if (!job.rawSnippets || job.rawSnippets.length === 0) {
      console.log('No code snippets to ingest');
      return;
    }

    // Enrich raw snippets with LLM
    const enrichedItems: EnrichedItem[] = [];
    for (const snippet of job.rawSnippets) {
      const enrichedData = await getEnrichedDataFromLLM(
        snippet,
        job.contextMarkdown || '',
        job.customEnrichmentPrompt,
      );
      if (enrichedData) {
        enrichedItems.push(enrichedData);
      }
    }

    if (enrichedItems.length === 0) {
      console.log('No enriched items to ingest');
      return;
    }
    await this.upsertLibrary({
      id: job.libraryId,
      name: job.libraryName,
      description: job.libraryDescription,
    });

    const { embeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: enrichedItems.map((item) => item.code),
    });

    const vectors = [];
    const ids = [];
    const metadata = [];

    for (let i = 0; i < enrichedItems.length; i++) {
      const item = enrichedItems[i];
      const embedding = embeddings[i];
      const vectorId = this.generateDeterministicId(
        job.libraryId,
        job.sourceUrl,
        item.code,
      );

      ids.push(vectorId);
      vectors.push(embedding);

      metadata.push({
        library_id: job.libraryId,
        original_text: item.code,
        content_type: 'code-example',
        title: item.title,
        description: item.description,
        source: job.sourceUrl,
        language: item.language,
      });
    }

    await this.store.upsert({
      indexName: 'embeddings',
      vectors,
      ids,
      metadata,
    });
  }

  /**
   * Ingests structured API specification data for a specific library.
   * This method is specifically designed for handling parsed API specifications
   * that have been converted to structured chunks with metadata.
   * @param libraryInfo - Information about the library.
   * @param items - An array of structured items with id, text, and metadata.
   * @param sourceUrl - The source URL of the API specification.
   */
  async ingestApiSpec(
    libraryInfo: {
      libraryId: string;
      libraryName: string;
      libraryDescription: string;
    },
    items: { id: string; text: string; metadata: Record<string, unknown> }[],
    sourceUrl: string,
  ) {
    await this.upsertLibrary({
      id: libraryInfo.libraryId,
      name: libraryInfo.libraryName,
      description: libraryInfo.libraryDescription,
    });

    const texts = items.map((item) => item.text);
    const { embeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: texts,
    });

    const vectors = [];
    const ids = [];
    const metadatas = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const embedding = embeddings[i];

      ids.push(item.id);
      vectors.push(embedding);
      metadatas.push({
        ...item.metadata,
        source: sourceUrl,
      });
    }

    await this.store.upsert({
      indexName: 'embeddings',
      vectors,
      ids,
      metadata: metadatas,
    });
  }

  /**
   * Searches for libraries based on a query string.
   * This is the first step in the RAG workflow - finding relevant libraries.
   * @param query - The search query.
   * @returns A promise that resolves to an array of library search results.
   */
  async searchLibraries(query: string): Promise<LibrarySearchResult[]> {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: query,
    });

    const results = await this.store.query({
      indexName: 'libraries',
      queryVector: embedding,
      topK: 5,
      includeVector: false,
    });

    return (
      results.map((r) => ({
        libraryId: r.id,
        name: r.metadata?.name as string,
        description: r.metadata?.description as string,
        similarityScore: r.score,
        keywordScore: 0, // Mastra RAG does not provide a separate keyword score.
        hybridScore: r.score,
      })) ?? []
    );
  }

  /**
   * Fetches documentation for a given library, optionally filtered by a topic.
   * This is the second step in the RAG workflow - getting specific documentation
   * from a library that was identified in the first step.
   *
   * The method filters the vector space by libraryId to ensure only relevant
   * documentation is returned.
   *
   * @param libraryId - The ID of the library to fetch documentation for.
   * @param options - Options including a search topic and token limit.
   * @returns A promise that resolves to an array of documentation metadata objects.
   */
  async fetchLibraryDocumentation(
    libraryId: string,
    options: { topic?: string; tokens?: number },
  ): Promise<Record<string, unknown>[]> {
    let queryVector: number[];

    if (options.topic) {
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: options.topic,
      });
      queryVector = embedding;
    } else {
      // If no topic, we can't do a vector search. We'll just fetch all.
      // This is a limitation compared to the old implementation which could fetch all without a query vector.
      // The store.query requires a vector. A possible workaround is to query with a zero vector or random vector,
      // but that feels wrong. For now, let's assume a topic is always preferred for searching.
      // A better implementation would be a separate method for fetching all documents for a library without vector search.
      // For now, returning empty if no topic.
      // Or, let's just create a dummy embedding for the libraryId itself.
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: libraryId, // Use libraryId as a proxy for the general topic
      });
      queryVector = embedding;
    }

    const results = await this.store.query({
      indexName: 'embeddings',
      queryVector: queryVector,
      topK: 5,
      filter: { library_id: { $eq: libraryId } }, // This filters the vector space by library
      includeVector: false,
    });

    return results
      .map((r) => r.metadata)
      .filter((m): m is Record<string, unknown> => m != null);
  }

  /**
   * Processes a job by determining its type and calling the appropriate ingestion method.
   * This method encapsulates all the business logic for handling different job types.
   * @param job - The embedding job to process
   */
  async processJob(job: EmbeddingJobPayload): Promise<void> {
    if (!job.rawSnippets || job.rawSnippets.length === 0) {
      console.log(`Job has no snippets, skipping processing.`);
      return;
    }

    switch (job.scrapeType) {
      case 'documentation':
        await this.ingestDocumentation(job);
        break;
      default:
        await this.ingestCodeSnippets(job);
    }
  }
}

export const ragService = new RagService();
