export interface JobItem {
  id: number;
  source: string; // For 'web-scrape': URL; For 'gitlab-repo': markdown content; For 'api-spec': spec content
  sourceType: string; // 'web-scrape' | 'gitlab-repo' | 'api-spec'
  originUrl?: string | null; // Canonical trace URL (e.g., gitlab://... for GitLab repos)
  status: string;
  processedAt: string | null;
}

export interface JobSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface JobBatch {
  jobId: string;
  createdAt: string;
  summary: JobSummary;
  jobs: JobItem[];
}
