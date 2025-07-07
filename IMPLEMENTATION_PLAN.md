# Implementation Plan: Multiple Resources per Library

## Overview
Transform the current one-to-one library-to-source mapping into a one-to-many relationship where each library can have multiple resources (URLs or API specs).

## Current State Analysis

### Data Model
- **Libraries Table**: Basic library info (id, name, description)
- **Embedding Jobs**: Has UNIQUE constraint on (source_url, library_id) 
- **Processing**: Libraries are created with an initial source that's immediately processed

### Issues to Address
1. UNIQUE constraint on (source_url, library_id) prevents adding same URL to library
2. Library creation is tightly coupled with source ingestion
3. No UI to add additional resources to existing libraries

## Implementation Steps

### Phase 1: Database Schema Updates

1. **Create new resources table** (migration needed):
   ```sql
   CREATE TABLE library_resources (
     id SERIAL PRIMARY KEY,
     library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
     resource_type VARCHAR(50) NOT NULL, -- 'web-scrape' or 'api-spec'
     resource_url TEXT, -- For web scraping
     resource_name TEXT, -- For API specs or display name
     resource_config JSONB, -- Store scraping config or spec content
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT unique_library_resource UNIQUE(library_id, resource_type, resource_url)
   );
   ```

2. **Update embedding_jobs table**:
   - Add `resource_id` column referencing library_resources(id)
   - Remove or update the UNIQUE constraint to allow multiple jobs per URL
   - Consider: UNIQUE(library_id, resource_id, source_url) or remove entirely

### Phase 2: Backend Refactoring

1. **Separate library creation from source ingestion**:
   - `/libraries/add-source` → `/libraries/create` (just creates library)
   - New endpoint: `/libraries/:libraryId/resources` (adds resources)

2. **Update ingestion flow**:
   ```
   Old: Create Library → Process Source
   New: Create Library → Add Resource → Process Resource
   ```

3. **New API endpoints**:
   - `POST /libraries/:libraryId/resources` - Add resource to library
   - `GET /libraries/:libraryId/resources` - List resources for library
   - `DELETE /libraries/:libraryId/resources/:resourceId` - Remove resource

### Phase 3: Frontend Updates

1. **HomePage.tsx changes**:
   - Add "Add Resource" button in the Actions column
   - Button opens modal or navigates to add resource page

2. **Create AddResourceModal/Page**:
   - Similar to current AddSourcePage but for existing library
   - Pass libraryId as parameter
   - Support both URL and API spec resource types

3. **Update LibraryDetailPage**:
   - Show list of resources for the library
   - Allow managing resources from detail page

### Phase 4: Job Management Updates

1. **Update job tracking**:
   - Jobs should reference both library_id and resource_id
   - Allow re-crawling/re-processing of individual resources

2. **Update enqueueEmbeddingJobs**:
   - Include resource_id in job payload
   - Update constraint handling

## Implementation Order

1. **Database migrations** (create tables, update constraints)
2. **Backend API refactoring** (new endpoints, separate concerns)
3. **Frontend UI updates** (add resource button, forms)
4. **Testing and migration of existing data**

## Technical Considerations

1. **Backward Compatibility**:
   - Existing libraries should work with new model
   - Migration script to move existing sources to resources table

2. **Constraint Strategy**:
   - Option A: Keep constraints but make them more flexible
   - Option B: Remove constraints and handle duplicates in application logic
   - Recommendation: Option A with UNIQUE(library_id, resource_id, source_url)

3. **Resource Types**:
   - Web scraping: Store URL and config in resource_config
   - API spec: Store spec content or file path in resource_config

## Migration Strategy

1. Create new tables without dropping old functionality
2. Implement new endpoints alongside old ones
3. Update frontend to use new endpoints
4. Migrate existing data
5. Remove old endpoints and constraints

## Future Enhancements

1. Resource versioning (track changes to specs/URLs)
2. Resource scheduling (periodic re-crawling)
3. Resource dependencies (order of processing)
4. Resource tags/categories within libraries