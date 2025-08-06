export interface JobItem {
  id: number;
  sourceUrl: string;
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
