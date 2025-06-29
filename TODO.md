# TODO: Implement "Add Documentation" Feature

## Phase 1: Frontend UI

- [x] Create a modal that opens when "Add Docs" is clicked on the HomePage.
- [x] Inside the modal, add tabs for "API Specification" and "Web Scrape".
- [x] **API Specification Tab:**
    - [x] Add an input field for a "Library Name".
    - [x] Add an input field for "Description".
    - [x] Provide options to either upload a file (`.json`, `.yaml`, `.yml`) or paste raw text content.
    - [x] Add a "Submit" button.
- [x] **Web Scrape Tab:**
    - [x] Add an input field for a "Library Name".
    - [x] Add an input field for "Description".
    - [x] Add an input field for the "Start URL".
    - [x] (Optional) Add advanced fields for scraping configuration:
        - [x] `Content CSS Selector` (e.g., `main .content`)
        - [x] `Navigation Link Selector` (e.g., `.sidebar a`)
        - [x] `Max Crawl Depth`
    - [x] Add a "Submit" button.

## Phase 2: Backend API

- [x] Create a new API endpoint, e.g., `POST /api/libraries/add-source`.
- [x] The endpoint should handle two types of sources: `api-spec` and `web-scrape`.
- [x] **`api-spec` payload:**
    - `name: string`
    - `description: string`
    - `sourceType: 'file' | 'text'`
    - `content: string` (the raw YAML/JSON content)
- [x] **`web-scrape` payload:**
    - `name: string`
    - `description: string`
    - `startUrl: string`
    - `config: { contentSelector?: string, linkSelector?: string, maxDepth?: number }`

## Phase 3: Backend Processing

- [x] **API Spec Handler:**
    - [x] When `POST /api/libraries/add-source` receives an `api-spec` payload:
    - [x] Create a new library entry in the database with the given name and description.
    - [x] Parse the provided JSON/YAML content.
    - [x] Extract endpoints, descriptions, and schemas.
    - [x] Store the extracted data in a structured format, linked to the new library.
    - [x] The raw spec file should be stored in the `storage/` directory for future reference.
- [x] **Web Scrape Handler:**
    - [x] When `POST /api/libraries/add-source` receives a `web-scrape` payload:
    - [x] Create a new library entry in the database with the given name and description.
    - [x] Trigger the existing web crawler (`run-crawler.ts`) with the provided URL and configuration.
    - [x] Ensure the crawler ingests data and associates it with the newly created library ID.

## Phase 4: Integration & Testing

- [x] Connect the frontend form to the new backend API endpoint.
- [ ] Test file uploads for both JSON and YAML specs.
- [ ] Test pasting content for both JSON and YAML specs.
- [ ] Test the web scraping with a sample documentation site.
- [ ] Ensure the new library appears on the HomePage after being added.
- [ ] Ensure clicking the new library takes you to a detail page showing the ingested documentation.