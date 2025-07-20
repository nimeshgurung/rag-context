import { MCPServer } from '@mastra/mcp';
import 'dotenv/config';
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { backendClient } from './lib/backend-client.js';
import { formatSearchResults } from './lib/utils.js';
import { program } from 'commander';
import http from 'http';

const resolveLibraryIdInput = z.object({
  libraryName: z
    .string()
    .describe('The natural language name of the library to search for.'),
});

const getLibraryDocsInput = z.object({
  libraryId: z.string().describe('The unique ID of the library.'),
  topic: z
    .string()
    .optional()
    .describe('A specific topic to search for within the documentation.'),
  tokens: z
    .number()
    .optional()
    .describe('The maximum number of tokens for the response.'),
});

const server = new MCPServer({
  name: 'rag-context-server',
  version: '0.1.0',
  description: 'A server to answer questions about internal libraries.',
  tools: {
    'resolve-library-id': createTool({
      id: 'resolve-library-id',
      description:
        'Find internal API library IDs based on a natural language query.',
      inputSchema: resolveLibraryIdInput,
      outputSchema: z
        .string()
        .describe('A formatted string of search results.'),
      execute: async ({ context }) => {
        const results = await backendClient.searchLibraries(context.libraryName);
        return formatSearchResults(results);
      },
    }),
    'get-library-docs': createTool({
      id: 'get-library-docs',
      description:
        'Retrieve documentation for a specific API library ID and an optional topic.',
      inputSchema: getLibraryDocsInput,
      outputSchema: z
        .string()
        .describe(
          'The relevant documentation chunks, concatenated into a single string.',
        ),
      execute: async ({ context }) => {
        const { libraryId, topic, tokens } = context;
        return backendClient.fetchLibraryDocumentation(libraryId, {
          topic,
          tokens,
        });
      },
    }),
  },
});

program
  .option('--transport <type>', 'Transport type (stdio, http, sse)', 'stdio')
  .option('--port <number>', 'Port for http/sse transport', '8080')
  .parse(process.argv);

const options = program.opts();

async function main() {
  const port = parseInt(options.port, 10);

  if (options.transport === 'stdio') {
    console.log('Using stdio transport');
    await server.startStdio();
  } else if (options.transport === 'http') {
    console.log(`Using http transport on port ${port}`);
    const httpServer = http.createServer(async (req, res) => {
      await server.startHTTP({
        url: new URL(req.url || '', `http://localhost:${port}`),
        httpPath: '/mcp',
        req,
        res,
      });
    });
    httpServer.listen(port, () => {
      console.log(`HTTP server listening on port ${port}`);
    });
  } else if (options.transport === 'sse') {
    console.log(`Using sse transport on port ${port}`);
    const httpServer = http.createServer(async (req, res) => {
      await server.startSSE({
        url: new URL(req.url || '', `http://localhost:${port}`),
        ssePath: '/sse',
        messagePath: '/message',
        req,
        res,
      });
    });
    httpServer.listen(port, () => {
      console.log(`SSE server listening on port ${port}`);
    });
  }
}

main();
