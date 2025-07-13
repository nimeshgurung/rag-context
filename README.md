# RAG Context System

A comprehensive documentation and code snippet management system that crawls, processes, and stores library documentation for RAG (Retrieval Augmented Generation) applications.

## Data Flow Architecture

### 1. Job Creation & Initialization

**Entry Point**: `src/lib/jobs/service.ts::startCrawlJob()`
- Creates a unique job ID (UUID)
- Generates library ID from library name (slugified)
- Initializes library metadata in PgVector `libraries` index
- Starts background crawling process

### 2. URL Crawling & Content Extraction

**Crawling Logic**: `src/lib/crawl/`
- **Documentation Crawling** (`documentationCrawler.ts`):
  - Uses Playwright to crawl documentation pages
  - Extracts readable content using Mozilla Readability
  - Converts HTML to Markdown using Turndown
  - Splits content using MarkdownHeaderTextSplitter
  - Raw snippets = markdown chunks

- **Code Crawling** (`crawler.ts`):
  - Uses Playwright to crawl code example pages
  - Extracts code snippets using CSS selectors (`pre > code` by default)
  - Captures surrounding context as markdown
  - Raw snippets = code blocks

### 3. Temporary Storage (Job Queue)

**Storage Location**: PostgreSQL `embedding_jobs` table
- Raw snippets stored in `raw_snippets` JSONB column
- Each job contains:
  - `job_id`: Batch identifier
  - `library_id`: Target library
  - `source_url`: Original URL
  - `raw_snippets`: Array of extracted content
  - `context_markdown`: Surrounding context (for code)
  - `scrape_type`: 'documentation' or 'code'
  - `status`: 'pending', 'processing', 'completed', 'failed'

### 4. Job Processing & Enrichment

**Worker Process**: `src/lib/jobs/processQueue.ts`
- Fetches pending jobs from queue
- Processes jobs through `ragService.processJob()`
- **For Documentation**: Direct processing of markdown chunks
- **For Code**: LLM enrichment via `getEnrichedDataFromLLM()`
  - Adds titles, descriptions, language detection
  - Enhances raw code with context and metadata

### 5. Final Storage (Vector Embeddings)

**Storage Location**: PgVector `embeddings` index
- **Libraries Index**:
  - Stores library metadata with embeddings
  - Used for initial library search
- **Embeddings Index**:
  - Stores processed snippets as vector embeddings
  - Each embedding contains:
    - `library_id`: Source library
    - `original_text`: The actual content
    - `content_type`: 'documentation', 'code-example', etc.
    - `source`: Original URL
    - Additional metadata (title, description, language)

### 6. Retrieval & Search

**Search Process**: `src/lib/rag/service.ts`
1. **Library Search**: `searchLibraries()` - Find relevant libraries
2. **Documentation Retrieval**: `fetchLibraryDocumentation()` - Get specific content
3. Vector similarity search within library context
4. Returns formatted results for LLM consumption

## Key Components

### Database Schema
```sql
-- Job queue storage
embedding_jobs (
  id SERIAL PRIMARY KEY,
  job_id UUID,
  library_id TEXT,
  source_url TEXT,
  raw_snippets JSONB,  -- Raw extracted content
  scrape_type TEXT,
  status VARCHAR(20),
  context_markdown TEXT
)

-- Vector storage (PgVector)
libraries index     -- Library metadata embeddings
embeddings index    -- Content embeddings with metadata
```

### Processing Flow
```
URL → Crawl → Extract → Store in Jobs Table → Process → Enrich → Embed → Store in Vector DB
```

### API Endpoints
- `POST /api/libraries` - Create new library and start crawling
- `GET /api/libraries` - List all libraries
- `GET /api/libraries/:id/documentation` - Retrieve library documentation
- `DELETE /api/libraries/:id` - Delete library and all associated data

## Development

### Setup
```bash
npm install
npm run db:setup  # Creates tables and indexes
npm run dev       # Starts development server
```

### Environment Variables
```bash
POSTGRES_CONNECTION_STRING=postgresql://...
OPENAI_API_KEY=sk-...
```

### Processing Jobs
```bash
# Process all pending jobs
npm run process-all

# Process specific job batch
npm run process-all <job-id>
```

## Architecture Benefits

1. **Scalable Processing**: Jobs are queued and processed asynchronously
2. **Content Deduplication**: Deterministic IDs prevent duplicate content
3. **Flexible Enrichment**: Custom prompts for different content types
4. **Efficient Search**: Vector similarity search with library filtering
5. **Robust Error Handling**: Failed jobs are tracked and can be retried