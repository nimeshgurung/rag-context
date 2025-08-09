import 'dotenv/config';
import { embed, embedMany } from 'ai';
import { models } from '../ai/models';

import { EmbeddingJobPayload } from '../jobs/jobService';
import { createHash } from 'crypto';
import { db } from '../db';
import { libraries, embeddings } from '../schema.js';
import { sql, and, eq } from 'drizzle-orm';
import { analyzeMarkdownHeaders } from '../ai/service';
import { tokenizeText } from '../tokenizer';

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
    // Validate required fields
    if (!library.name || library.name.trim() === '') {
      throw new Error('Library name is required and cannot be empty.');
    }
    if (!library.description || library.description.trim() === '') {
      throw new Error('Library description is required and cannot be empty.');
    }

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
   * @param job - The embedding job containing metadata.
   * @param markdown - The markdown content to process.
   */
  async ingestDocumentation(job: EmbeddingJobPayload, markdown: string) {
    // Phase 2: Process raw markdown into semantic chunks
    if (!markdown || markdown.trim().length === 0) {
      console.log('No raw markdown to process');
      return;
    }

    // Clean up existing embeddings for this URL to prevent duplicates
    await this.deleteExistingEmbeddings(job.libraryId, job.source);

    // Import the processing modules here (lazy loading)
    const { extractSemanticChunksFromMarkdown } = await import(
      '../ai/extraction'
    );
    const { MarkdownHeaderTextSplitter } = await import(
      '../crawl/utils/MarkdownHeaderTextSplitter'
    );

    await this.upsertLibrary({
      id: job.libraryId,
      name: job.libraryName,
      description: job.libraryDescription,
    });

    console.log(
      `Processing ${markdown.length} characters of markdown for ${job.source}`,
    );

    // Analyze markdown structure with AI to determine optimal header levels
    const headerAnalysis = await analyzeMarkdownHeaders(markdown);

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

    const sections = headerSplitter.splitText(markdown);
    const allChunks: Array<{
      content: string;
      metadata: Record<string, unknown>;
    }> = [];

    // Process each section with LLM to extract semantic chunks
    for (const section of sections) {
      try {
        const semanticChunks = await extractSemanticChunksFromMarkdown(
          section.pageContent,
          job.additionalInstructions, // additional instructions
        );

        for (const chunk of semanticChunks) {
          const snippetsFormatted = chunk.snippets
            .map((s) => {
              if (s.language === 'text') {
                return `${s.code}\n`;
              } else {
                return `Language: ${s.language}\nCode:\n\`\`\`${s.code}\`\`\``;
              }
            })
            .join('\n\n');

          const formattedContent = `Title: ${chunk.title}\nDescription: ${chunk.description}\n\n${snippetsFormatted}`;

          allChunks.push({
            content: formattedContent,
            metadata: {
              title: chunk.title,
              description: chunk.description,
              snippetCount: chunk.snippets.length,
              languages: [...new Set(chunk.snippets.map((s) => s.language))],
            },
          });
        }
      } catch (error) {
        console.error(`Error processing section from ${job.source}:`, error);
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
      values: allChunks.map((c) => c.content),
    });

    // Prepare batch data for efficient insert
    const embeddingData = allChunks.map((chunk, i) => ({
      vectorId: this.generateDeterministicId(
        job.libraryId,
        job.source,
        chunk.content,
      ),
      libraryId: job.libraryId,
      jobId: job.id, // Link to the embedding job record
      contentType: 'documentation' as const,
      content: chunk.content,
      sourceUrl: job.source,
      embedding: embeddingVectors[i],
      metadata: chunk.metadata,
      tokenCount: tokenizeText(chunk.content), // Compute token count locally
    }));

    // Batch upsert - much more efficient than individual inserts
    await db
      .insert(embeddings)
      .values(embeddingData)
      .onConflictDoUpdate({
        target: embeddings.vectorId,
        set: {
          content: sql.raw(`excluded.${embeddings.content.name}`),
          embedding: sql.raw(`excluded.${embeddings.embedding.name}`),
          metadata: sql.raw(`excluded.${embeddings.metadata.name}`),
          tokenCount: sql.raw(`excluded.${embeddings.tokenCount.name}`),
        },
      });

    console.log(
      `Successfully ingested ${allChunks.length} documentation chunks for ${job.source}`,
    );
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
      content: item.text,
      sourceUrl: sourceUrl,
      embedding: embeddingVectors[i],
      metadata: item.metadata, // Store metadata including title if available
      tokenCount: 0, // API specs are excluded from token stats, set to 0
    }));

    // Batch upsert - much more efficient than individual inserts
    await db
      .insert(embeddings)
      .values(embeddingData)
      .onConflictDoUpdate({
        target: embeddings.vectorId,
        set: {
          content: sql.raw(`excluded.${embeddings.content.name}`),
          embedding: sql.raw(`excluded.${embeddings.embedding.name}`),
          metadata: sql.raw(`excluded.${embeddings.metadata.name}`),
          tokenCount: sql.raw(`excluded.${embeddings.tokenCount.name}`),
        },
      });
  }

  /**
   * Process an embedding job with content.
   * All web scraping is now documentation-based with LLM code extraction.
   */
  async processJob(job: EmbeddingJobPayload, content: string): Promise<void> {
    console.log(`Processing documentation job for ${job.source}`);

    // Ensure we have content
    if (!content || content.trim().length === 0) {
      console.log(`Job has no content, skipping processing.`);
      return;
    }

    // All web scraping is now documentation-based
    // The LLM will extract code snippets during processing
    await this.ingestDocumentation(job, content);
  }
}

export const ragService = new RagService();
