## PRD: Internal GitLab Repo Ingestion (Markdown-as-Source-of-Truth) + Web-Scrape Parity

### Objective
Enable users to add internal GitLab repositories as documentation sources. The system downloads the repo, extracts Markdown files, stores content in the database as the source of truth, enqueues embedding jobs, and lets users process them later. The UX mirrors current web-scrape jobs while using a different ingestion flow.

### Goals
- Support `gitlab-repo` sources alongside existing `web-scrape` and `api-spec`.
- Persist markdown in DB and process from DB content when available.
- Maintain existing Jobs UI and processing UX.
- Emit granular progress via SSE events.

### Non-Goals
- GitHub support.
- Pre-processing preview/selection of files.
- Per-user GitLab OAuth (use server PAT for v1).

### User Stories
- As a user, I can add a GitLab repository to create or enrich a library.
- As a user, I can see a new ingestion job and later process all or selected items into embeddings.
- As a user, I can provide include/exclude globs and an optional branch/ref.

### High-Level Flow
- Frontend: New “GitLab Repo” tab in `AddDocsModal` with fields → POST to existing endpoints.
- Backend: Ingestion handler downloads repo, extracts `*.md(x)`, stores markdown rows in DB, enqueues jobs with `documentId`.
- Processing: Worker loads markdown from DB (preferred), or falls back to HTTP when `documentId` is absent.
- SSE: Progress events for download, extract counts, enqueue counts, and completion.

### Data Model
- Simplify `embedding_jobs` to carry the content or the URL directly:
  - Rename `source_url` → `source` (TEXT)
  - Add `source_type` (VARCHAR): `'url' | 'documentation'`
    - `'url'`: `source` holds the URL to fetch
    - `'documentation'`: `source` holds raw markdown to process
  - Add `origin_url` (TEXT): canonical trace for both types
    - URL jobs: `origin_url = source`
    - Documentation jobs: `origin_url = gitlab://<host>/<group>/<project>@<ref>/<path.md>` (or similar)
  - Keep: `id`, `job_id` (UUID), `library_id`, `additional_instructions`, `pre_execution_steps`, `status`, timestamps
  - Indexes: `status`, `job_id`, `library_id`, optional `(library_id, source)` and `(library_id, origin_url)`

### Backend Changes
- Types (`backend/src/lib/types.ts`)
  - Add `GitlabRepoSource` and extend `DocumentationSource` union
- Ingestion switch (`backend/src/lib/ingestion/index.ts`)
  - Add `case 'gitlab-repo'` → `handleGitlabRepoSource(jobId, source, existingLibraryId?)`
- New ingestion module (`backend/src/lib/ingestion/gitlabRepo.ts`)
  - Resolve project and ref (default `default_branch`)
  - Download archive via GitLab API using `GITLAB_BASE_URL`, `GITLAB_TOKEN`
  - Extract archive to temp dir
  - Collect `*.md`, `*.mdx` (apply include/exclude globs, size cap)
  - For each markdown file, enqueue `embedding_jobs` with:
    - `source_type='documentation'`
    - `source=<raw markdown>`
    - `origin_url=<canonical gitlab://... string>`
    - plus `job_id`, `library_id`, `additional_instructions`
  - Emit SSE events throughout
  - Library handling mirrors `handleWebScrapeSource` (create-or-use existing)
- Processing (`backend/src/lib/jobs/jobService.ts`)
  - If `source_type='documentation'`: pass `job.source` as markdown to processing
  - If `source_type='url'`: call `fetchMarkdownForUrl(job.source)`
  - For embeddings, pass `origin_url` as the `sourceUrl` to the embedding pipeline (traceability and dedupe)
  - No change to queue controls and events
- Content fetcher (`backend/src/lib/crawl/utils/contentFetcher.ts`)
  - Unchanged; used only for `source_type='url'`
- Config/Env
  - `GITLAB_BASE_URL`, `GITLAB_TOKEN` (server PAT)
- Retention (optional)
  - TTL cleanup job to prune old `stored_documents` with no referencing jobs

### Frontend Changes
- Forms
  - `GitlabRepoForm.tsx`: Library Name, Description (hidden for existing library), Repo URL, Ref/Branch (optional), Include/Exclude globs, Additional instructions (advanced section)
  - `GitlabRepoFormBody.tsx`: Wrapper like `WebScrapeFormBody`
- Hooks
  - `useGitlabRepoForm.ts`: state, setters, `reset`, `validate`
  - `useGitlabRepoSubmit.ts`: builds `GitlabRepoSource`; uses `useAddDocumentationSource` or `useAddLibraryResource`
- Modal
  - `AddDocsModal.tsx`: Add a third tab “GitLab Repo”; wire `handleSubmit` and `isProcessing`
- Jobs UI (optional polish)
  - Show a chip with `source_type` (URL vs Documentation)
  - Truncate long `source` when type is Documentation
- No endpoint changes; reuse existing routes and mutations

### Security/Compliance
- Server-side PAT only (no token in browser)
- Validate `repoUrl` host against allowed internal domain(s)
- Don’t log tokens or file contents
- Limit max file size and number of files per job; ignore binary/large files

### Observability
- Granular SSE events:
  - resolving repo/ref → downloading → extracting → discovered N docs → enqueued M jobs → done or error

### Acceptance Criteria
- Users can add a GitLab repo (new library or existing) and see a job start with SSE progress
- Markdown files are stored in DB and linked to jobs
- Processing loads markdown from DB (no HTTP) and completes, producing embeddings
- Jobs UI shows batches and allows Process All/Selected as today
- Feature works with private/internal GitLab repos configured via env

### Rollout
- Behind config flag (optional): `ENABLE_GITLAB_INGESTION=true`
- Backward compatible with existing web-scrape/API-spec

### Testing
- Unit: GitLab archive downloader, extractor, globs, DB insert/upsert, `storage://` reader
- Integration: End-to-end ingestion → jobs enqueued → processing → embeddings created
- E2E: Frontend form submission flows (new vs existing library), SSE progress
- Load: Large repos within limits; timeout/error paths

### Open Questions
- Max repo size/files? Defaults: 10k files / 50MB total?
- Should we dedupe per `(library_id, source_key)` ignoring content hash?
- Retention policy for `stored_documents`?

### To-Do Checklist

#### Backend
- [ ] Alter `embedding_jobs`: rename `source_url` → `source` (TEXT)
- [ ] Add `source_type` to `embedding_jobs` (`url` | `documentation`)
- [ ] Add `origin_url` to `embedding_jobs` (TEXT) and populate in ingestion
- [ ] Update enqueue flows:
  - Web-scrape → `source_type='url'`, `source=<url>`
  - GitLab → `source_type='documentation'`, `source=<markdown>` per file, `origin_url=gitlab://...`
- [ ] Update processing to branch on `source_type`
  - Ensure embeddings receive `origin_url` as `sourceUrl`
- [ ] Env config: `GITLAB_BASE_URL`, `GITLAB_TOKEN`
- [ ] Tests (unit, integration)

#### Frontend
- [ ] Create `GitlabRepoForm.tsx` and `GitlabRepoFormBody.tsx`
- [ ] Create `useGitlabRepoForm.ts` + `useGitlabRepoSubmit.ts`
- [ ] Wire a “GitLab Repo” tab in `AddDocsModal.tsx` with submit and loading states
- [ ] Optional: chip in `JobRow` when `sourceUrl` is `storage://gitlab/...`
- [ ] Docs update in `frontend/README.md`

#### Ops
- [ ] Set `GITLAB_BASE_URL`, `GITLAB_TOKEN` in deployment
- [ ] Migrate DB schema
- [ ] Feature flag toggle (optional)

#### Documentation
- [ ] README (backend) section for GitLab ingestion + env setup + limits
- [ ] UX notes (frontend) describing fields and examples for globs

#### QA
- [ ] Test with small internal repo
- [ ] Test with large repo hitting limits
- [ ] Test add-to-existing library path
- [ ] Verify SSE messaging and Jobs UI state transitions

#### Future (optional)
- [ ] Per-user GitLab OAuth
- [ ] File selection/preview before enqueue
- [ ] Github provider parity

#### Dependencies
- [ ] Confirm Playwright/Crawlee versions unaffected
- [ ] Ensure archiver extraction (zip/tar.gz) utilities installed or node modules used

#### Risks/Mitigations
- [ ] Large repo size → enforce caps and timeouts
- [ ] PAT scope → use read-only; lock to internal domain
- [ ] DB growth → implement TTL and dedupe

### Timeline (suggested)
- Day 1–2: Schema + backend ingestion + storage fetch support
- Day 3: Processing integration + tests
- Day 4: Frontend forms/hooks/modal wiring
- Day 5: QA, docs, rollout

### Success Metrics
- ≥ 95% ingestion success rate for allowed repos
- Processing time parity with similarly sized web-scrape jobs
- Zero token exposure in logs/clients

### Out of Scope
- Non-markdown files
- Monorepo code semantic extraction (future)

### Exit Criteria
- All acceptance criteria pass in staging
- Documentation and env set up
- Feature enabled in production

### Rollback Plan
- Disable feature flag; revert to previous build
- DB changes are additive and non-breaking; safe to keep

### Monitoring
- Log repo download time, file counts, sizes, enqueue counts
- Alert on ingestion failures > threshold

### Accessibility
- New form fields match existing UI patterns and validations

### Localization
- Follows current app language; no extra locales needed

### Legal
- Validate storage of internal docs in DB is allowed under company policy

### Performance
- Rate-limit downloads; cap concurrency; enforce size limits

### Data Retention
- TTL for `stored_documents` configurable; default 30–90 days (TBD)

### Backup/Restore
- Included with normal DB backups

### Disaster Recovery
- No special handling beyond DB recovery

### Privacy
- Treat internal docs as confidential; ensure RBAC elsewhere if applicable


