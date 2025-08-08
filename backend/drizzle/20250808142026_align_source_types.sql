-- Custom SQL migration to align sourceType with DocumentationSource types
-- Migrates from generic types ('url', 'documentation') to specific types ('web-scrape', 'gitlab-repo', 'api-spec')

-- Update existing 'url' sourceType to 'web-scrape'
UPDATE embedding_jobs
SET source_type = 'web-scrape'
WHERE source_type = 'url';

-- Update existing 'documentation' sourceType to 'gitlab-repo'
-- (since GitLab was the only source using 'documentation' type)
UPDATE embedding_jobs
SET source_type = 'gitlab-repo'
WHERE source_type = 'documentation';

-- Note: 'api-spec' type doesn't currently use embedding_jobs table,
-- but the schema now supports it for future use