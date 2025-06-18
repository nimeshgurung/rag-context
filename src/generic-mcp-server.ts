import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { searchLibraries, fetchLibraryDocumentation } from './lib/api';
import { formatSearchResults } from './lib/utils';

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

async function main() {
  const server = new McpServer({
    name: 'rag-context-generic-server',
    version: '0.1.0',
    description:
      'A generic server to answer questions about internal libraries.',
  });

  server.registerTool(
    'resolve-library-id',
    {
      description:
        'Find internal API library IDs based on a natural language query.',
      inputSchema: resolveLibraryIdInput.shape,
    },
    async ({ libraryName }) => {
      const results = await searchLibraries(libraryName);
      return {
        content: [{ type: 'text', text: formatSearchResults({ results }) }],
      };
    },
  );

  server.registerTool(
    'get-library-docs',
    {
      description:
        'Retrieve documentation for a specific API library ID and an optional topic.',
      inputSchema: getLibraryDocsInput.shape,
    },
    async ({ libraryId, topic, tokens }) => {
      const docs = await fetchLibraryDocumentation(libraryId, {
        topic,
        tokens,
      });
      return { content: [{ type: 'text', text: docs }] };
    },
  );

  await server.connect(new StdioServerTransport());
}

await main();
