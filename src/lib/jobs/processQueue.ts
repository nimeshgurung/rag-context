import { jobService } from './jobService';

export async function processQueue(jobId: string) {
  await jobService.processQueue(jobId);
}
