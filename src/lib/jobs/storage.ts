import pool from '../db';

export interface EmbeddingJobPayload {
  jobId?: string;
  libraryId: string;
  libraryName: string;
  libraryDescription: string;
  sourceUrl: string;
  rawSnippets: string[];
  contextMarkdown?: string;
  scrapeType: 'code' | 'documentation';
}

export async function enqueueEmbeddingJobs(jobs: EmbeddingJobPayload[]) {
  if (jobs.length === 0) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const query = `
      INSERT INTO embedding_jobs (job_id, library_id, library_name, library_description, source_url, raw_snippets, context_markdown, scrape_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    for (const job of jobs) {
      const values = [
        job.jobId,
        job.libraryId,
        job.libraryName,
        job.libraryDescription,
        job.sourceUrl,
        JSON.stringify(job.rawSnippets),
        job.contextMarkdown,
        job.scrapeType,
      ];
      await client.query(query, values);
    }

    await client.query('COMMIT');
    console.log(`Enqueued ${jobs.length} embedding jobs.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error enqueuing embedding jobs:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function fetchPendingJobs(
  limit: number,
  jobId?: string,
): Promise<(EmbeddingJobPayload & { id: number })[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const params: (string | number)[] = [];
    let query = `
      SELECT *
      FROM embedding_jobs
      WHERE status = 'pending'
    `;

    if (jobId) {
      params.push(jobId);
      query += ` AND job_id = $${params.length}`;
    }

    params.push(limit);
    query += ` ORDER BY created_at ASC LIMIT $${params.length} FOR UPDATE SKIP LOCKED`;

    const res = await client.query(query, params);
    const jobs = res.rows.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      libraryId: row.library_id,
      libraryName: row.library_name,
      libraryDescription: row.library_description,
      sourceUrl: row.source_url,
      rawSnippets: row.raw_snippets,
      contextMarkdown: row.context_markdown,
      scrapeType: row.scrape_type,
    }));

    if (jobs.length > 0) {
      const jobIds = jobs.map((j) => j.id);
      await client.query(
        `UPDATE embedding_jobs SET status = 'processing', processed_at = NOW() WHERE id = ANY($1::int[])`,
        [jobIds],
      );
    }

    await client.query('COMMIT');
    return jobs;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error fetching pending jobs:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function markJobAsCompleted(jobId: number) {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE embedding_jobs SET status = 'completed' WHERE id = $1`,
      [jobId],
    );
  } finally {
    client.release();
  }
}

export async function markJobAsFailed(jobId: number, errorMessage: string) {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE embedding_jobs SET status = 'failed', error_message = $1 WHERE id = $2`,
      [errorMessage, jobId],
    );
  } finally {
    client.release();
  }
}
