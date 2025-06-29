# Backend and Frontend Refactor for Unique Libraries

This checklist outlines the tasks required to refactor the database schema and application logic to support a unique, queryable list of libraries for the frontend, without disrupting the existing MCP server's semantic search capabilities.

## Phase 1: Database and Data Ingestion

- [x] **Create SQL Migration Script:** Write a SQL script to create the new `libraries` table. The table will include `id` (primary key), `name`, and `description` columns. It will also add a foreign key constraint to `slop_embeddings.library_id` that references `libraries.id`.
- [x] **Update Ingestion Script:** Modify the `scripts/ingestData.ts` script to populate the new `libraries` table. Before processing and embedding chunks for an API, the script will first insert the library's metadata (`id`, `name`, `description`) into the `libraries` table.

## Phase 2: Backend API Expansion

- [x] **Create New API Function:** Add a new function `getUniqueLibraries` to `src/lib/api.ts`. This function will perform a simple SQL query to select all entries from the new `libraries` table.
- [x] **Expose New API Endpoint:** In `src/express-server.ts`, create a new GET endpoint at `/api/libraries` that calls the `getUniqueLibraries` function and returns the list of libraries.

## Phase 3: Frontend Integration

- [x] **Update Frontend API Service:** Add a new function to `frontend/src/services/api.ts` that makes a GET request to the new `/api/libraries` endpoint.
- [x] **Refactor HomePage Component:** Update the `frontend/src/pages/HomePage.tsx` component to use the new service function to fetch and display the unique list of popular libraries, replacing the previous `searchLibraries` call.

## Phase 4: Finalization

- [x] **Review and Cleanup:** Perform a final review of all changes, remove any unused code or console logs, and ensure both the frontend UI and the MCP server flow are working as expected.