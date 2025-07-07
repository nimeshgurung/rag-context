# Custom Enrichment Prompts Feature Implementation

## Overview
This feature adds the ability for users to provide custom instructions that will be used during the AI-powered enrichment process when scraping code snippets. Users can now add specific guidance to help the AI better understand and synthesize the code examples according to their needs.

## Feature Description
When users select "Code-focused" scraping in the web scrape form, they now have access to an additional field called "Custom Enrichment Instructions" where they can provide specific instructions that will be appended to the AI prompt during the enrichment process.

### Use Cases
- **Framework-specific guidance**: "Focus on React hooks and their usage patterns"
- **Language features**: "Include TypeScript type definitions in the title"
- **Domain focus**: "Emphasize security considerations in the descriptions"
- **Performance**: "Highlight performance optimization techniques"
- **Best practices**: "Point out any anti-patterns or best practice violations"

## Technical Implementation

### Database Changes
The `custom_enrichment_prompt` column has been added to the `embedding_jobs` table in the main creation script:

```sql
-- In scripts/create_embedding_jobs_table.sql
CREATE TABLE embedding_jobs (
    -- ... other columns ...
    custom_enrichment_prompt TEXT,
    -- ... other columns ...
);

COMMENT ON COLUMN embedding_jobs.custom_enrichment_prompt IS 
  'Custom instructions to be used during the enrichment process for code snippets';
```

### Backend Changes

1. **Type Updates** (`src/lib/types.ts`):
   - Added `customEnrichmentPrompt?: string` to `WebScrapeSource.config`

2. **Job Storage** (`src/lib/jobs/storage.ts`):
   - Added `customEnrichmentPrompt?: string` to `EmbeddingJobPayload` interface
   - Updated `enqueueEmbeddingJobs` to save custom prompts
   - Updated `fetchPendingJobs` to retrieve custom prompts

3. **Enrichment Function** (`src/lib/embedding/enrichment.ts`):
   - Modified `getEnrichedDataFromLLM` to accept optional `customInstructions` parameter
   - Custom instructions are appended to the system prompt with header "Additional Instructions:"

4. **Job Processing**:
   - `src/lib/jobs/service.ts`: Updated to pass custom prompts through the pipeline
   - `src/lib/jobs/processQueue.ts`: Updated to use custom prompts during enrichment

5. **Crawler** (`src/lib/crawl/crawler.ts`):
   - Updated to include `customEnrichmentPrompt` in job payloads

6. **API Route** (`src/routes/crawl.ts`):
   - Added `customEnrichmentPrompt?: string` to `StartCrawlRequestBody`
   - Updated `startCrawlJob` call to include the custom prompt

### Frontend Changes

1. **Form State** (`frontend/src/hooks/useWebScrapeForm.ts`):
   - Added `customEnrichmentPrompt: string` to form state
   - Added `setCustomEnrichmentPrompt` setter function

2. **UI Component** (`frontend/src/components/forms/WebScrapeForm.tsx`):
   - Added conditional TextField that appears only when `scrapeType === 'code'`
   - Includes helpful placeholder text with examples

3. **API Integration**:
   - `frontend/src/services/api.ts`: Updated `startCrawl` to accept `customEnrichmentPrompt`
   - `frontend/src/hooks/useAddDocsModal.ts`: Updated to include custom prompt in API requests

4. **Backward Compatibility**:
   - `frontend/src/pages/AddSourcePage.tsx`: Fixed to include default `scrapeType`

## Deployment Instructions

1. **Database Setup**:
   ```bash
   # If creating the database for the first time:
   psql -U your_user -d your_database -f scripts/create_embedding_jobs_table.sql
   ```

2. **Backend**:
   ```bash
   npm install
   npm run build
   npm start
   ```

3. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run build
   ```

## Testing the Feature

1. Navigate to the "Add New Documentation" modal
2. Select the "Web Scrape" tab
3. Choose "Code-focused" as the Scrape Type
4. The "Custom Enrichment Instructions" field will appear
5. Enter custom instructions (e.g., "Focus on error handling patterns")
6. Submit the form and verify that code snippets are enriched according to your instructions

## Example Custom Instructions

- "Focus on React component lifecycle methods and hooks"
- "Include information about time complexity for algorithms"
- "Highlight any security vulnerabilities or best practices"
- "Emphasize TypeScript type definitions and generics"
- "Point out design patterns being used"
- "Include information about browser compatibility"

## Notes

- Custom instructions are only available for code-focused scraping
- The feature is backward compatible - existing jobs without custom prompts will work as before
- Custom prompts are stored with each job for audit trail purposes
- The prompts are appended to the system prompt, not replacing it