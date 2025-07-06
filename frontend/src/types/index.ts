export interface Job {
  id: number;
  sourceUrl: string;
  status: string;
}

export interface JobSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface JobStatus {
  summary: JobSummary;
  jobs: Job[];
}
