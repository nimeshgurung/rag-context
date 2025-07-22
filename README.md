# RAG Context - Documentation Processing System

A full-stack application for processing and searching documentation using RAG (Retrieval-Augmented Generation) techniques.

## Quick Start

### Prerequisites
- Node.js >= 20.9.0
- PostgreSQL database

### Setup
1. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

2. **Set up environment variables:**
   - Copy `backend/.env.example` to `backend/.env`
   - Configure your database and API keys

3. **Set up database:**
   ```bash
   cd backend
   npm run db:migrate
   ```

4. **Install Playwright browsers (for web scraping):**
   ```bash
   npm run playwright:setup
   ```
   > Note: This happens automatically during `npm install` in the backend, but run manually if needed.

### Development
```bash
# Start both backend and frontend in development mode
npm run dev

# Or run individually:
npm run backend:dev
npm run frontend:dev
npm run mcp:dev:mastra  # MCP server for Mastra integration
npm run mcp:dev:generic # Generic MCP server
```

### Production Build
```bash
npm run build
```

## Architecture

This is a monorepo with three main packages:

- **`backend/`** - Express.js API server with document processing
- **`frontend/`** - React/TypeScript UI for managing documentation
- **`mcp/`** - MCP (Model Context Protocol) servers for AI integrations

## Features

- **Document Ingestion**: Process API specs and web content
- **Web Scraping**: Extract documentation from websites using Playwright
- **Job Processing**: Queue-based background processing
- **Library Management**: Organize documentation into searchable libraries
- **MCP Integration**: AI assistant integrations via Model Context Protocol

## Troubleshooting

### Playwright Browser Issues
If you get browser launch errors:
```bash
npm run playwright:setup
```

### Type Import Errors
The frontend imports types from the backend package. If you get import errors, ensure dependencies are properly installed:
```bash
npm run install:all
```

### Database Issues
Reset and recreate the database:
```bash
cd backend
npm run db:clear
npm run db:migrate
```