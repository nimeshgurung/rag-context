# GitLab Repository Ingestion

This feature enables ingestion of documentation from internal GitLab repositories into the RAG Context system.

## Overview

The GitLab ingestion feature allows you to:
- Add GitLab repositories as documentation sources
- Extract and process Markdown files from repositories
- Store documentation content in the database for efficient processing
- Process documentation through the same embedding pipeline as web-scraped content

## Setup

### Environment Variables

Configure the following environment variables in your backend `.env` file:

```bash
# Required
GITLAB_TOKEN=your_gitlab_personal_access_token
GITLAB_BASE_URL=https://gitlab.com/api/v4  # Or your GitLab instance URL

# Optional
ENABLE_GITLAB_INGESTION=true  # Feature flag (defaults to true)
GITLAB_MAX_FILE_SIZE=10485760  # Max file size in bytes (default: 10MB)
GITLAB_MAX_FILES=10000  # Max number of files per repo (default: 10000)
GITLAB_ALLOWED_HOSTS=gitlab.com,git.company.com  # Comma-separated allowed hosts
```

### Personal Access Token Setup

1. Log into your GitLab instance
2. Go to Settings → Access Tokens
3. Create a new token with `read_api` and `read_repository` scopes
4. Copy the token and add it to your `.env` file

## Usage

### Adding a GitLab Repository

1. Open the "Add New Documentation" modal
2. Select the "GitLab Repo" tab
3. Fill in the required fields:
   - **Library Name**: Name for your documentation library
   - **Description**: Brief description of the documentation
   - **Repository URL**: Full GitLab repository URL (e.g., `https://gitlab.com/group/project`)
   - **Branch/Tag/Ref** (optional): Specific branch, tag, or commit SHA (defaults to default branch)

4. Configure advanced options (optional):
   - **Include Globs**: File patterns to include (e.g., `docs/**/*.md, README.md`)
   - **Exclude Globs**: File patterns to exclude (e.g., `test/**/*.md, **/draft-*.md`)
   - **Additional Instructions**: Instructions for AI processing

5. Click "Submit" to start the ingestion process

### Processing Flow

1. **Repository Download**: The system downloads the repository archive from GitLab
2. **File Extraction**: Markdown files (`.md`, `.mdx`) are extracted based on glob patterns
3. **Content Storage**: Markdown content is stored directly in the database
4. **Job Enqueueing**: Individual embedding jobs are created for each file
5. **Processing**: Jobs can be processed individually or in batch through the Jobs UI

### Jobs UI Enhancements

The Jobs UI has been enhanced to support GitLab ingestion:
- **Source Type Indicator**: Shows whether a job is from a URL or documentation source
- **Smart Display**: For documentation sources, shows the origin file path instead of raw content
- **Truncation**: Long content is automatically truncated with tooltips for full view

## Technical Details

### Database Schema

The system uses an enhanced `embedding_jobs` table:

```sql
-- Core fields
source TEXT NOT NULL           -- URL or raw markdown content
source_type VARCHAR(20)         -- 'url' | 'documentation'
origin_url TEXT                 -- Canonical source (e.g., gitlab://...)
```

### Source Type Handling

- **URL Sources**: Content is fetched from the URL during processing
- **Documentation Sources**: Content is read directly from the database

### Origin URL Format

GitLab documentation sources use a special URL format for tracking:
```
gitlab://<host>/<project>@<ref>/<path/to/file.md>
```

Example:
```
gitlab://gitlab.com/mygroup/myproject@main/docs/api.md
```

## Security Considerations

### Server-Side Authentication
- GitLab API authentication uses server-side Personal Access Tokens only
- Tokens are never exposed to the frontend or client applications

### Domain Validation
- Repository URLs are validated against an allowed hosts list
- Configure `GITLAB_ALLOWED_HOSTS` to restrict access to specific GitLab instances

### Resource Limits
- File size limits prevent processing of excessively large files
- File count limits prevent resource exhaustion from large repositories

### Sensitive Data Protection
- PATs and repository contents are never logged
- All sensitive configuration is stored in environment variables

## Glob Patterns

### Include Patterns Examples
- `**/*.md` - All markdown files
- `docs/**/*.md` - All markdown in docs directory
- `README.md` - Specific file
- `{docs,guides}/**/*.md` - Multiple directories

### Exclude Patterns Examples
- `**/node_modules/**` - Exclude node_modules
- `**/*.test.md` - Exclude test files
- `**/draft-*.md` - Exclude draft files
- `.github/**` - Exclude GitHub-specific files

## Troubleshooting

### Common Issues

1. **"GitLab ingestion is not enabled"**
   - Set `ENABLE_GITLAB_INGESTION=true` in your `.env` file

2. **"GITLAB_TOKEN is required"**
   - Add your GitLab Personal Access Token to the `.env` file

3. **"Repository host is not allowed"**
   - Add the GitLab host to `GITLAB_ALLOWED_HOSTS` environment variable

4. **"Invalid GitLab repository URL format"**
   - Ensure the URL follows the format: `https://gitlab.com/group/project`

5. **No markdown files found**
   - Check your include/exclude glob patterns
   - Verify the repository contains `.md` or `.mdx` files

### Performance Optimization

- Use specific include globs to reduce processing time
- Set appropriate file size and count limits
- Process jobs in batches during off-peak hours

## API Reference

### Backend Endpoints

The feature uses existing documentation source endpoints:

```typescript
POST /api/documentation-sources
{
  type: 'gitlab-repo',
  name: 'Library Name',
  description: 'Description',
  repoUrl: 'https://gitlab.com/group/project',
  ref?: 'main',
  config: {
    includeGlobs?: ['docs/**/*.md'],
    excludeGlobs?: ['test/**/*.md'],
    additionalInstructions?: 'Focus on API documentation'
  }
}
```

### SSE Events

The ingestion process emits real-time progress events:

```javascript
// Event types
{ type: 'status', message: 'Starting GitLab repository ingestion...' }
{ type: 'status', message: 'Downloading repository archive...' }
{ type: 'status', message: 'Found 42 markdown files to process' }
{ type: 'progress', data: { current: 10, total: 42 } }
{ type: 'complete', data: { libraryId: '...', filesProcessed: 42 } }
{ type: 'error', message: 'Failed to download repository' }
```

## Future Enhancements

- GitHub repository support
- File preview before ingestion
- Per-user OAuth authentication
- Support for other documentation formats (RST, AsciiDoc)
- Incremental updates (process only changed files)
- Webhook integration for automatic updates
