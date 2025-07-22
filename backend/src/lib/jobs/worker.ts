import 'dotenv/config';
import { jobService } from './jobService';

const main = async () => {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error('Please provide a jobId.');
    process.exit(1);
  }

  console.log(`Starting scoped embedding worker for jobId: ${jobId}`);
  try {
    await jobService.processQueue(jobId);
    console.log(`Scoped worker finished processing for jobId: ${jobId}`);
    process.exit(0);
  } catch (error) {
    console.error(`Worker process failed for jobId: ${jobId}`, error);
    process.exit(1);
  }
};

main();
