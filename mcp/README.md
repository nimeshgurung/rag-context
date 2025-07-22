# RAG Context MCP Servers

This directory contains thin Model Context Protocol (MCP) servers that provide AI agents with access to the RAG Context library search and documentation retrieval functionality.

## Architecture

The MCP servers are designed as **thin HTTP client layers** that call the backend's REST APIs:

```
AI Agent → MCP Server → HTTP API → Backend → Database
```

### Why This Approach?

- **Separation of Concerns**: MCP focuses only on AI tool integration
- **No Database Dependencies**: MCP doesn't need direct database access
- **Independent Deployment**: MCP can run separately from the backend
- **Simple & Lightweight**: Minimal dependencies and complexity

## Available Servers

### 1. Generic MCP Server (`generic-server.ts`)
Standard MCP server using `@modelcontextprotocol/sdk`

### 2. Mastra MCP Server (`mastra-server.ts`)  
MCP server using the Mastra framework with additional transport options

## Available Tools

Both servers provide the same two tools:

### `resolve-library-id`
- **Purpose**: Find library IDs based on natural language queries
- **Input**: `libraryName` (string) - Natural language description
- **Output**: Formatted list of matching libraries with IDs and similarity scores
- **Backend API**: `POST /api/libraries/search`

### `get-library-docs`
- **Purpose**: Retrieve documentation for a specific library
- **Input**: 
  - `libraryId` (string) - The library ID to fetch docs for
  - `topic` (optional string) - Specific topic to search within docs
  - `tokens` (optional number) - Max response length
- **Output**: Relevant documentation content
- **Backend API**: `POST /api/docs`

## Configuration

### Environment Variables
Create a `.env` file:
```bash
BACKEND_URL=http://localhost:3001
```

### Backend Dependency
The MCP servers require the backend to be running and accessible at the configured URL.

## Usage

### Start Generic MCP Server
```bash
npm run dev:generic
```

### Start Mastra MCP Server
```bash
# Default (stdio transport)
npm run dev:mastra

# HTTP transport
npm run dev:mastra -- --transport http --port 8080

# SSE transport
npm run dev:mastra -- --transport sse --port 8080
```

## File Structure

```
mcp/
├── src/
│   ├── generic-server.ts     # Standard MCP server
│   ├── mastra-server.ts      # Mastra MCP server
│   └── lib/
│       ├── backend-client.ts # HTTP client for backend APIs
│       └── utils.ts          # Response formatting utilities
├── package.json              # Minimal MCP dependencies
└── .env.example             # Configuration template
```

## Dependencies

The MCP servers have minimal dependencies:
- `@modelcontextprotocol/sdk` - Standard MCP functionality
- `@mastra/core` - Mastra MCP framework
- `commander` - CLI argument parsing
- `dotenv` - Environment configuration
- `zod` - Schema validation

**No database, AI, or heavy processing dependencies!**

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Lint
npm run lint

# Format
npm run format
```