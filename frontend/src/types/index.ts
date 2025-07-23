export interface JobItem {
  id: number;
  sourceUrl: string;
  status: string;
  processedAt: string | null;
  errorMessage: string | null;
  scrapeType: string;
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
