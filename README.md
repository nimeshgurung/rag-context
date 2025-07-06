# rag-context

Internal OpenAPI Documentation Server. An MCP server for intelligent access to internal API documentation.

## Useful Commands

### Access Database
To connect to the PostgreSQL database inside the Docker container, run:
`docker exec -it slop_db psql -U slop_user -d slop_db`

## Data Ingestion Workflow

Ingesting documentation into the server is a two-step process designed to be robust and to handle API rate limits gracefully.

### Step 1: Crawl and Scrape

The first step is to crawl the web sources defined in `config/docs-sources.json`. This process scrapes code snippets and their surrounding context from the configured URLs. Instead of processing and embedding them immediately, it adds them to a job queue in the database.

To run the crawler:

```bash
npm run crawl
```

### Step 2: Process the Embedding Queue

The second step is to process the jobs that were enqueued by the crawler. A dedicated worker script fetches these jobs, sends them to the OpenAI API to get embeddings, and then saves the resulting vectors back into the database.

This worker is rate-limited to avoid hitting API limits. You can configure the rate limit by setting the `EMBEDDING_RATE_LIMIT` environment variable (requests per minute).

To run the embedding worker:

```bash
npm run process-embeddings
```

This command will run continuously, processing jobs as they appear in the queue. You can leave it running in the background.