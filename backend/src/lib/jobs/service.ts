import { jobService, EmbeddingJobInput } from './jobService';
import { EmbeddingJobPayload } from './jobService';

export async function startCrawlJob(
  libraryName: string,
  libraryDescription: string,
  startUrl: string,
  customEnrichmentPrompt?: string,
) {
  return await jobService.startCrawlJob(
    libraryName,
    libraryDescription,
    startUrl,
    customEnrichmentPrompt,
  );
}

export async function getCrawlJobStatus(jobId: string) {
  return await jobService.getCrawlJobStatus(jobId);
}

export async function deleteJob(jobItemId: number) {
  return await jobService.deleteJob(jobItemId);
}

export async function processSingleJob(jobItemId: number) {
  return await jobService.processSingleJob(jobItemId);
}

export async function processAllJobs(jobId: string) {
  return await jobService.processAllJobs(jobId);
}

export async function getLatestJobForLibrary(libraryId: string) {
  return await jobService.getLatestJobForLibrary(libraryId);
}

export async function getAllJobsForLibrary(libraryId: string) {
  return await jobService.getAllJobsForLibrary(libraryId);
}

export async function enqueueEmbeddingJobs(jobs: EmbeddingJobInput[]) {
  return await jobService.enqueueEmbeddingJobs(jobs);
}
