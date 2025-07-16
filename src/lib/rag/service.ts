import 'dotenv/config';
import { embed, embedMany } from 'ai';
import { openai } from '../ai/service';
import { EnrichedItem } from '../types';
import { getEnrichedDataFromLLM } from '../ai/enrichment';
import { EmbeddingJobPayload } from '../jobs/jobService';
import { createHash } from 'crypto';
import pool from '../db';

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

    // Use direct SQL query instead of PgVector upsert
    await pool.query(
      `INSERT INTO libraries (id, name, description, embedding)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id)
       DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         embedding = EXCLUDED.embedding`,
      [
        library.id,
        library.name,
        library.description,
        JSON.stringify(embedding),
      ],
    );
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

    // Insert embeddings using direct SQL
    for (let i = 0; i < job.rawSnippets.length; i++) {
      const chunk = job.rawSnippets[i];
      const embedding = embeddings[i];
      const vectorId = this.generateDeterministicId(
        job.libraryId,
        job.sourceUrl,
        chunk,
      );

      await pool.query(
        `INSERT INTO embeddings (vector_id, library_id, content_type, title, original_text, source_url, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (vector_id)
         DO UPDATE SET
           original_text = EXCLUDED.original_text,
           embedding = EXCLUDED.embedding`,
        [
          vectorId,
          job.libraryId,
          'documentation',
          null, // title
          chunk,
          job.sourceUrl,
          JSON.stringify(embedding),
        ],
      );
    }
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

    // Insert embeddings using direct SQL
    for (let i = 0; i < enrichedItems.length; i++) {
      const item = enrichedItems[i];
      const embedding = embeddings[i];
      const vectorId = this.generateDeterministicId(
        job.libraryId,
        job.sourceUrl,
        item.code,
      );

      await pool.query(
        `INSERT INTO embeddings (vector_id, library_id, content_type, title, original_text, source_url, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (vector_id)
         DO UPDATE SET
           title = EXCLUDED.title,
           original_text = EXCLUDED.original_text,
           embedding = EXCLUDED.embedding`,
        [
          vectorId,
          job.libraryId,
          'code-example',
          item.title,
          item.code,
          job.sourceUrl,
          JSON.stringify(embedding),
        ],
      );
    }
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

    // Insert embeddings using direct SQL
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const embedding = embeddings[i];

      await pool.query(
        `INSERT INTO embeddings (vector_id, library_id, content_type, title, original_text, source_url, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (vector_id)
         DO UPDATE SET
           title = EXCLUDED.title,
           original_text = EXCLUDED.original_text,
           embedding = EXCLUDED.embedding`,
        [
          item.id,
          libraryInfo.libraryId,
          'api-spec',
          item.metadata.title || null,
          item.text,
          sourceUrl,
          JSON.stringify(embedding),
        ],
      );
    }
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
