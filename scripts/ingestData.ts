import 'dotenv/config';
import { createOpenAI } from '@ai-sdk/openai';
import { Pool } from 'pg';
import { convertToSlopChunks } from '../src/slop/converter';
import SwaggerParser from '@apidevtools/swagger-parser';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { embedMany } from 'ai';
import { OpenAPIV3 } from 'openapi-types';

async function main() {
  // 1. Initialize Clients
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not defined in environment variables.');
  }
  const openai = createOpenAI({
    apiKey: openaiApiKey,
  });

  const postgresConnectionString = process.env.POSTGRES_CONNECTION_STRING;
  if (!postgresConnectionString) {
    throw new Error(
      'POSTGRES_CONNECTION_STRING is not defined in environment variables.',
    );
  }
  const pool = new Pool({
    connectionString: postgresConnectionString,
  });

  // 2. Define API Sources
  const internalApiSources: Record<string, { url: string; description: string }> = {
    'billing-api-v1': {
      url: './sample-specs/billing-api-v1.yaml',
      description: 'Manages customer billing and invoices.',
    },
    'user-profile-api-v2': {
      url: './sample-specs/user-profile-api-v2.json',
      description: 'Provides user profile management.',
    },
    'petstore-api-v3': {
      url: './sample-specs/petstore.json',
      description: 'A sample API for managing a pet store.',
    },
  };

  // 3. Process each API source
  for (const libraryId in internalApiSources) {
    const apiInfo = internalApiSources[libraryId];
    console.log(`Processing ${libraryId} from ${apiInfo.url}...`);

    try {
      const spec = (await SwaggerParser.bundle(
        apiInfo.url,
      )) as OpenAPIV3.Document;

      const chunks = convertToSlopChunks(libraryId, spec);
      if (chunks.length === 0) {
        console.warn(`No chunks generated for ${libraryId}. Skipping.`);
        continue;
      }

      console.log(`Generated ${chunks.length} chunks for ${libraryId}.`);

      const { embeddings } = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
        values: chunks.map((chunk) => chunk.originalText),
      });

      // Use a single client for the transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = embeddings[i];

          const query = `
            INSERT INTO slop_embeddings (vector_id, library_id, content_type, original_text, embedding, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (vector_id) DO UPDATE SET
              library_id = EXCLUDED.library_id,
              content_type = EXCLUDED.content_type,
              original_text = EXCLUDED.original_text,
              embedding = EXCLUDED.embedding,
              metadata = EXCLUDED.metadata;
          `;

          const values = [
            chunk.id,
            chunk.libraryId,
            chunk.contentType,
            chunk.originalText,
            `[${embedding.join(',')}]`, // Format embedding for pgvector
            chunk.metadata,
          ];

          await client.query(query, values);
        }

        await client.query('COMMIT');
        console.log(`Successfully embedded and stored ${chunks.length} vectors for ${libraryId}.`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e; // Re-throw the error to be caught by the outer catch block
      } finally {
        client.release(); // Release the client back to the pool
      }

    } catch (error) {
      console.error(`Failed to process ${libraryId}:`, error);
    }
  }

  await pool.end(); // Close the pool
  console.log('Data ingestion complete.');
}

main().catch(console.error);