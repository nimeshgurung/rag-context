import 'dotenv/config';
import { embed, embedMany } from 'ai';
import { models } from '../ai/models';
import { EnrichedItem } from '../types';
import { getEnrichedDataFromLLM } from '../ai/enrichment';
import { EmbeddingJobPayload } from '../jobs/jobService';
import { createHash } from 'crypto';
import { db } from '../db';
import { libraries, embeddings } from '../schema.js';
import { sql, and, eq } from 'drizzle-orm';
import { analyzeMarkdownHeaders } from '../ai/service';

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
   * Deletes all existing embeddings for a specific source URL in a library.
   * This prevents duplicates when reprocessing the same URL with new content.
   * @param libraryId - The ID of the library.
   * @param sourceUrl - The URL of the source document.
   */
  private async deleteExistingEmbeddings(
    libraryId: string,
    sourceUrl: string,
  ): Promise<void> {
    const result = await db
      .delete(embeddings)
      .where(
        and(
          eq(embeddings.libraryId, libraryId),
          eq(embeddings.sourceUrl, sourceUrl),
        ),
      );

    const deletedCount = result.rowCount || 0;
    if (deletedCount > 0) {
      console.log(
        `Cleaned up ${deletedCount} existing embeddings for ${sourceUrl}`,
      );
    } else {
      console.log(
        `No existing embeddings found for ${sourceUrl} (first time processing)`,
      );
    }
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
      model: models['text-embedding-3-small'],
      value: `${library.name}: ${library.description}`,
    });

    // Use Drizzle's upsert with proper vector handling
    await db
      .insert(libraries)
      .values({
        id: library.id,
        name: library.name,
        description: library.description,
        embedding: embedding, // Drizzle handles vector serialization
      })
      .onConflictDoUpdate({
        target: libraries.id,
        set: {
          name: library.name,
          description: library.description,
          embedding: embedding,
        },
      });
  }

  /**
   * Ingests documentation chunks from a job.
   * Phase 2: Process raw markdown stored during crawling into semantic chunks and embeddings.
   * @param job - The embedding job containing raw markdown data.
   */
  async ingestDocumentation(job: EmbeddingJobPayload) {
    // Phase 2: Process raw markdown into semantic chunks
    if (!job.contextMarkdown || job.contextMarkdown.trim().length === 0) {
      console.log('No raw markdown to process');
      return;
    }

    // Clean up existing embeddings for this URL to prevent duplicates
    await this.deleteExistingEmbeddings(job.libraryId, job.sourceUrl);

    // Import the processing modules here (lazy loading)
    const { extractSemanticChunksFromMarkdown } = await import(
      '../ai/extraction'
    );
    const { MarkdownHeaderTextSplitter } = await import(
      '../crawl/MarkdownHeaderTextSplitter'
    );

    await this.upsertLibrary({
      id: job.libraryId,
      name: job.libraryName,
      description: job.libraryDescription,
    });

    console.log(
      `Processing ${job.contextMarkdown.length} characters of markdown for ${job.sourceUrl}`,
    );

    // Analyze markdown structure with AI to determine optimal header levels
    const headerAnalysis = await analyzeMarkdownHeaders(job.contextMarkdown);

    const headerSplitter = new MarkdownHeaderTextSplitter(
      headerAnalysis.recommendedHeaderLevels.map((h) => [
        h.symbol,
        `h${h.level}`,
      ]),
      {
        returnEachLine: false,
        stripHeaders: false,
      },
    );

    console.log(
      `Using AI-recommended headers: ${headerAnalysis.recommendedHeaderLevels.map((h) => h.symbol).join(', ')} (confidence: ${headerAnalysis.confidence})`,
    );

    const sections = headerSplitter.splitText(job.contextMarkdown);
    let allChunks: string[] = [];

    // Process each section with LLM to extract semantic chunks
    for (const section of sections) {
      try {
        const semanticChunks = await extractSemanticChunksFromMarkdown(
          section.pageContent,
        );
        const formattedChunks = semanticChunks.map((chunk) => {
          const snippetsFormatted = chunk.snippets
            .map((s) => {
              if (s.language === 'text') {
                return `${s.code}\n`;
              } else {
                return `Language: ${s.language}\nCode:\n\`\`\`${s.code}\`\`\``;
              }
            })
            .join('\n\n');
          return `Title: ${chunk.title}\nDescription: ${chunk.description}\n\n${snippetsFormatted}`;
        });
        allChunks = allChunks.concat(formattedChunks);
      } catch (error) {
        console.error(`Error processing section from ${job.sourceUrl}:`, error);
        // Continue with other sections instead of failing completely
      }
    }

    if (allChunks.length === 0) {
      console.log('No semantic chunks extracted from markdown');
      return;
    }

    console.log(
      `Extracted ${allChunks.length} semantic chunks, creating embeddings...`,
    );

    // Create embeddings for the processed chunks
    const { embeddings: embeddingVectors } = await embedMany({
      model: models['text-embedding-3-small'],
      values: allChunks,
    });

    // Prepare batch data for efficient insert
    const embeddingData = allChunks.map((chunk, i) => ({
      vectorId: this.generateDeterministicId(
        job.libraryId,
        job.sourceUrl,
        chunk,
      ),
      libraryId: job.libraryId,
      jobId: job.id, // Link to the embedding job record
      contentType: 'documentation' as const,
      title: null,
      originalText: chunk,
      sourceUrl: job.sourceUrl,
      embedding: embeddingVectors[i],
    }));

    // Batch upsert - much more efficient than individual inserts
    await db
      .insert(embeddings)
      .values(embeddingData)
      .onConflictDoUpdate({
        target: embeddings.vectorId,
        set: {
          originalText: sql.raw(`excluded.${embeddings.originalText.name}`),
          embedding: sql.raw(`excluded.${embeddings.embedding.name}`),
        },
      });

    console.log(
      `Successfully ingested ${allChunks.length} documentation chunks for ${job.sourceUrl}`,
    );
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

    // Clean up existing embeddings for this URL to prevent duplicates
    await this.deleteExistingEmbeddings(job.libraryId, job.sourceUrl);

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

    const { embeddings: embeddingVectors } = await embedMany({
      model: models['text-embedding-3-small'],
      values: enrichedItems.map((item) => item.code),
    });

    // Prepare batch data for efficient insert
    const embeddingData = enrichedItems.map((item, i) => ({
      vectorId: this.generateDeterministicId(
        job.libraryId,
        job.sourceUrl,
        item.code,
      ),
      libraryId: job.libraryId,
      jobId: job.id, // Link to the embedding job record
      contentType: 'code-example' as const,
      title: item.title,
      originalText: item.code,
      sourceUrl: job.sourceUrl,
      embedding: embeddingVectors[i],
    }));

    // Batch upsert - much more efficient than individual inserts
    await db
      .insert(embeddings)
      .values(embeddingData)
      .onConflictDoUpdate({
        target: embeddings.vectorId,
        set: {
          title: sql.raw(`excluded.${embeddings.title.name}`),
          originalText: sql.raw(`excluded.${embeddings.originalText.name}`),
          embedding: sql.raw(`excluded.${embeddings.embedding.name}`),
        },
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
    // Clean up existing embeddings for this URL to prevent duplicates
    await this.deleteExistingEmbeddings(libraryInfo.libraryId, sourceUrl);

    await this.upsertLibrary({
      id: libraryInfo.libraryId,
      name: libraryInfo.libraryName,
      description: libraryInfo.libraryDescription,
    });

    const texts = items.map((item) => item.text);
    const { embeddings: embeddingVectors } = await embedMany({
      model: models['text-embedding-3-small'],
      values: texts,
    });

    // Prepare batch data for efficient insert
    const embeddingData = items.map((item, i) => ({
      vectorId: item.id,
      libraryId: libraryInfo.libraryId,
      contentType: 'api-spec' as const,
      title: (item.metadata.title as string) || null,
      originalText: item.text,
      sourceUrl: sourceUrl,
      embedding: embeddingVectors[i],
    }));

    // Batch upsert - much more efficient than individual inserts
    await db
      .insert(embeddings)
      .values(embeddingData)
      .onConflictDoUpdate({
        target: embeddings.vectorId,
        set: {
          title: sql.raw(`excluded.${embeddings.title.name}`),
          originalText: sql.raw(`excluded.${embeddings.originalText.name}`),
          embedding: sql.raw(`excluded.${embeddings.embedding.name}`),
        },
      });
  }

  /**
   * Extracts code snippets from markdown content.
   * Used for code-type jobs where we fetch markdown and need to extract code blocks.
   */
  private extractCodeSnippetsFromMarkdown(markdown: string): string[] {
    const codeBlockRegex = /```[\s\S]*?```/g;
    const matches = markdown.match(codeBlockRegex) || [];

    return matches
      .map((block) => {
        // Remove the ``` markers and language identifier
        const lines = block.split('\n');
        // Remove first line (```language) and last line (```)
        return lines.slice(1, -1).join('\n');
      })
      .filter((snippet) => snippet.trim().length > 0);
  }

  /**
   * Process an embedding job. Routes to appropriate handler based on scrapeType.
   * Now handles both documentation and code jobs with markdown content.
   */
  async processJob(job: EmbeddingJobPayload): Promise<void> {
    console.log(`Processing ${job.scrapeType} job for ${job.sourceUrl}`);

    // Ensure we have markdown content for both job types
    if (!job.contextMarkdown || job.contextMarkdown.trim().length === 0) {
      console.log(`Job has no markdown content, skipping processing.`);
      return;
    }

    switch (job.scrapeType) {
      case 'documentation':
        // Documentation jobs process markdown directly
        await this.ingestDocumentation(job);
        break;

      case 'code':
        // Code jobs need to extract snippets from markdown first
        const codeSnippets = this.extractCodeSnippetsFromMarkdown(
          job.contextMarkdown,
        );

        if (codeSnippets.length === 0) {
          console.log(
            `No code snippets found in markdown, skipping processing.`,
          );
          return;
        }

        // Update job with extracted snippets
        const codeJob = {
          ...job,
          rawSnippets: codeSnippets,
        };

        await this.ingestCodeSnippets(codeJob);
        break;

      default:
        console.warn(`Unknown scrape type: ${job.scrapeType}`);
    }
  }
}

export const ragService = new RagService();
