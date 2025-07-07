# Simplified Approach: Add Resources to Existing Libraries

## Overview
This is a minimal implementation to add the ability to enqueue additional jobs/specs for existing libraries without major refactoring.

## Key Decisions for Simplified Approach

### 1. Database Changes (Minimal)
- **Remove the UNIQUE constraint** on (source_url, library_id) in embedding_jobs table
- This allows multiple jobs with the same URL for a library
- No new tables needed initially

### 2. Backend Changes (Minimal)
- Add new endpoint: `POST /libraries/:libraryId/add-resource`
- Reuse existing ingestion logic but skip library creation
- Pass existing libraryId to ingestion functions

### 3. Frontend Changes (Minimal)
- Add "Add Resource" button to library list table
- Create simple modal/form to add URL or spec
- Reuse existing AddSourcePage components

## Implementation Steps (Quick Start)

### Step 1: Database Migration
```sql
-- Remove the unique constraint
ALTER TABLE embedding_jobs 
DROP CONSTRAINT IF EXISTS embedding_jobs_source_url_library_id_key;

-- Add a regular index for performance
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_source_library 
ON embedding_jobs(source_url, library_id);
```

### Step 2: Backend - Add New Endpoint
In `src/routes/libraries.ts`, add:
```typescript
// Add resource to existing library
router.post('/:libraryId/add-resource', async (req, res) => {
  const { libraryId } = req.params;
  const source = req.body as DocumentationSource;
  
  // Validate library exists
  // Process source with existing libraryId
  // Return jobId
});
```

### Step 3: Frontend - Add Button
In `HomePage.tsx`, add button to Actions column:
```typescript
<Button
  variant="outlined"
  size="small"
  onClick={() => handleAddResource(row.libraryId)}
  sx={{ ml: 1 }}
>
  Add Resource
</Button>
```

### Step 4: Frontend - Add Resource Modal
Create simple modal that:
- Takes libraryId as prop
- Shows form for URL or API spec
- Calls new endpoint on submit

## Benefits of This Approach

1. **Minimal Breaking Changes**: Existing functionality continues to work
2. **Quick Implementation**: Can be done in a day
3. **Easy Rollback**: If issues arise, just add constraint back
4. **Future-Proof**: Can evolve into full resource management later

## Limitations to Accept (For Now)

1. No tracking of individual resources (just jobs)
2. Can't list all resources for a library easily
3. Duplicate URLs can be added (handle in UI if needed)
4. No resource management (edit/delete individual resources)

## Next Steps After This

Once this is working and tested:
1. Add resource tracking table
2. Add resource management UI
3. Improve constraint handling
4. Add resource metadata

This approach gets the core functionality working quickly while leaving room for future improvements.