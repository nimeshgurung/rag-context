import 'dotenv/config';
import { Agent } from '@mastra/core';
import { MCPClient } from '@mastra/mcp';
import { openai } from '@ai-sdk/openai';
import * as readline from 'readline';

const safeEnv = Object.entries(process.env).reduce(
  (acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  },
  {} as Record<string, string>,
);

const mcpClient = new MCPClient({
  servers: {
    'rag-context': {
      command: 'npx',
      args: ['tsx', 'src/server.ts'],
      env: safeEnv,
    },
  },
});

const agent = new Agent({
  name: 'API Documentation Agent',
  instructions:
    'You are an agent that answers questions about internal API documentation. Use the tools to find libraries and get their documentation.',
  description:
    'An agent that can answer questions about internal API documentation.',
  model: openai('gpt-4o-mini'),
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  console.log('Connecting to MCP server...');
  const toolsets = await mcpClient.getToolsets();
  console.log('Connection successful. Ask a question or type "exit" to quit.');

  rl.prompt();

  rl.on('line', async (line) => {
    if (line.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    const { text } = await agent.generate(line, { toolsets });
    console.log(`\nAgent: ${text}\n`);
    rl.prompt();
  }).on('close', () => {
    mcpClient.disconnect();
    process.exit(0);
  });
}

main();
