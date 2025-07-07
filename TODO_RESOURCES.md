# TODO: Multiple Resources per Library Implementation

## Phase 1: Database Schema (Backend)

### 1.1 Create Migration Files
- [ ] Create `scripts/migrations/001_create_library_resources_table.sql`
  - Define library_resources table
  - Add indexes for performance
- [ ] Create `scripts/migrations/002_update_embedding_jobs_constraints.sql`
  - Add resource_id column to embedding_jobs
  - Update or remove UNIQUE constraint
  - Add foreign key to library_resources

### 1.2 Update Database Connection
- [ ] Create migration runner script if not exists
- [ ] Run migrations in development environment

## Phase 2: Backend API Refactoring

### 2.1 Update Types
- [ ] Add new types to `src/lib/types.ts`:
  ```typescript
  interface LibraryResource {
    id: number;
    libraryId: string;
    resourceType: 'web-scrape' | 'api-spec';
    resourceUrl?: string;
    resourceName: string;
    resourceConfig: any;
    createdAt: Date;
  }
  ```

### 2.2 Create Library Resource Service
- [ ] Create `src/lib/libraries/resources.ts`:
  - `addResource(libraryId, resource)`
  - `getResourcesByLibrary(libraryId)`
  - `deleteResource(resourceId)`
  - `getResource(resourceId)`

### 2.3 Update Library Routes
- [ ] Update `src/routes/libraries.ts`:
  - Keep POST `/add-source` for backward compatibility (mark deprecated)
  - Add POST `/create` - creates library without source
  - Add POST `/:libraryId/resources` - adds resource to library
  - Add GET `/:libraryId/resources` - lists library resources
  - Add DELETE `/:libraryId/resources/:resourceId`

### 2.4 Update Ingestion Logic
- [ ] Update `src/lib/ingestion/index.ts`:
  - Accept resourceId in addition to source
  - Update job creation to include resourceId
- [ ] Update `src/lib/ingestion/webScrape.ts`:
  - Separate library creation from crawling
  - Accept existing libraryId
- [ ] Update `src/lib/ingestion/apiSpec.ts`:
  - Separate library creation from spec processing
  - Accept existing libraryId

### 2.5 Update Job Storage
- [ ] Update `src/lib/jobs/storage.ts`:
  - Add resourceId to EmbeddingJobPayload interface
  - Update enqueueEmbeddingJobs to handle resourceId
  - Update SQL queries to include resource_id

## Phase 3: Frontend Implementation

### 3.1 Update API Client
- [ ] Update `frontend/src/services/api.ts`:
  - Add `createLibrary(name, description)`
  - Add `addLibraryResource(libraryId, resource)`
  - Add `getLibraryResources(libraryId)`
  - Add `deleteLibraryResource(libraryId, resourceId)`

### 3.2 Update Types
- [ ] Update `frontend/src/types/index.ts`:
  - Add LibraryResource interface
  - Update related types

### 3.3 Update HomePage
- [ ] Modify `frontend/src/pages/HomePage.tsx`:
  - Add "Add Resource" button in Actions column
  - Handle click to open modal or navigate

### 3.4 Create Add Resource Component
- [ ] Create `frontend/src/components/AddResourceModal.tsx`:
  - Accept libraryId prop
  - Form for URL or API spec
  - Similar to AddSourcePage but for existing library
  - Emit event or callback on success

### 3.5 Update Library Detail Page
- [ ] Update `frontend/src/pages/LibraryDetailPage.tsx`:
  - Fetch and display library resources
  - Add/remove resource functionality
  - Show resource status/jobs

### 3.6 Update Add Source Page
- [ ] Update `frontend/src/pages/AddSourcePage.tsx`:
  - Option 1: Redirect to use new flow
  - Option 2: Update to create library first, then add resource

## Phase 4: Testing & Migration

### 4.1 Create Test Data
- [ ] Create test libraries with multiple resources
- [ ] Test different resource types (URL, spec)
- [ ] Test constraint handling

### 4.2 Migration Script
- [ ] Create `scripts/migrate_existing_data.sql`:
  - Migrate existing library sources to resources table
  - Update embedding_jobs to reference resources

### 4.3 Testing Checklist
- [ ] Can create library without source
- [ ] Can add multiple URLs to same library
- [ ] Can add multiple specs to same library
- [ ] Can mix URLs and specs in same library
- [ ] Jobs are created correctly with resource reference
- [ ] Existing libraries still work
- [ ] Delete cascade works properly

## Phase 5: Cleanup

### 5.1 Remove Deprecated Code
- [ ] Remove old `/add-source` endpoint (after migration period)
- [ ] Clean up unused functions
- [ ] Update documentation

### 5.2 Performance Optimization
- [ ] Add database indexes where needed
- [ ] Optimize queries for resource listing
- [ ] Consider pagination for resources

## Quick Start Commands

```bash
# 1. Run database migrations
psql -U postgres -d your_db -f scripts/migrations/001_create_library_resources_table.sql
psql -U postgres -d your_db -f scripts/migrations/002_update_embedding_jobs_constraints.sql

# 2. Start backend development
npm run dev

# 3. Start frontend development
cd frontend && npm run dev

# 4. Run tests
npm test
```

## Notes

- Start with backend changes first (database, API)
- Keep backward compatibility during transition
- Test thoroughly before removing old code
- Consider feature flags for gradual rollout