import 'dotenv/config';
import { fork, ChildProcess } from 'child_process';
import { sendEvent } from '../events';
import path from 'path';
import { fileURLToPath } from 'url';

// IPC Message types from child to parent
export interface IPCMessage {
  type: 'started' | 'progress' | 'job-progress' | 'done' | 'error';
  jobId: string;
  message?: string;
  itemId?: number;
  status?: 'completed' | 'failed';
  source?: string;
  error?: string;
}

// Narrow payload type for coalesced progress events
type ProgressEventPayload = {
  type: 'processing:progress';
  message: string;
};

// Child process info
interface ChildProcessInfo {
  process: ChildProcess;
  jobId: string;
  startTime: Date;
  retryCount: number;
}

/**
 * Manages child processes for batch job processing with capacity control
 */
class ChildProcessManager {
  private runningBatches = new Map<string, ChildProcessInfo>();
  private readonly MAX_ACTIVE_BATCHES: number;
  private readonly MAX_RETRIES = 1;
  private readonly SHUTDOWN_TIMEOUT = 10000; // 10 seconds
  private isShuttingDown = false;
  // Coalescing buffers to avoid flooding SSE on frequent progress
  private coalescedTimers = new Map<string, NodeJS.Timeout>();
  private coalescedPayloads = new Map<string, ProgressEventPayload>();

  constructor() {
    this.MAX_ACTIVE_BATCHES = process.env.MAX_ACTIVE_BATCHES
      ? parseInt(process.env.MAX_ACTIVE_BATCHES, 10)
      : 1;

    console.log(
      `ChildProcessManager initialized with MAX_ACTIVE_BATCHES=${this.MAX_ACTIVE_BATCHES}`,
    );
  }

  /**
   * Check if we can start a new batch
   */
  canStartBatch(jobId: string): { canStart: boolean; reason?: string } {
    if (this.isShuttingDown) {
      return { canStart: false, reason: 'System is shutting down' };
    }

    if (this.runningBatches.has(jobId)) {
      return { canStart: false, reason: 'Batch already running' };
    }

    if (this.runningBatches.size >= this.MAX_ACTIVE_BATCHES) {
      return { canStart: false, reason: 'Maximum capacity reached' };
    }

    return { canStart: true };
  }

  /**
   * Start processing a batch in a child process
   */
  async startBatch(
    jobId: string,
  ): Promise<{ success: boolean; message: string }> {
    const capacityCheck = this.canStartBatch(jobId);
    if (!capacityCheck.canStart) {
      return { success: false, message: capacityCheck.reason! };
    }

    try {
      const childProcess = await this.forkChildProcess(jobId);

      const childInfo: ChildProcessInfo = {
        process: childProcess,
        jobId,
        startTime: new Date(),
        retryCount: 0,
      };

      this.runningBatches.set(jobId, childInfo);

      // Set up IPC message handling
      this.setupIPCHandlers(childProcess, jobId);

      // Set up process exit handling
      this.setupExitHandlers(childProcess, jobId);

      console.log(
        `Started child process for batch ${jobId}, PID: ${childProcess.pid}`,
      );
      return {
        success: true,
        message: `Batch processing started for ${jobId}`,
      };
    } catch (error) {
      console.error(`Failed to start child process for batch ${jobId}:`, error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to start batch processing',
      };
    }
  }

  /**
   * Fork a child process for batch processing
   */
  private async forkChildProcess(jobId: string): Promise<ChildProcess> {
    // ESM-safe __dirname replacement
    const __filename = fileURLToPath(import.meta.url);
    const __dirnameSafe = path.dirname(__filename);
    const workerPath = path.resolve(__dirnameSafe, 'batchWorker.js');
    const isDev = process.env.NODE_ENV !== 'production';

    let childProcess: ChildProcess;

    if (isDev) {
      // Development: use tsx to run TypeScript directly
      childProcess = fork(
        path.resolve(__dirnameSafe, 'batchWorker.ts'),
        [jobId],
        {
          execArgv: ['-r', 'dotenv/config', '--import', 'tsx'],
          stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
          env: {
            ...process.env,
            EMBEDDING_CONCURRENCY: process.env.EMBEDDING_CONCURRENCY || '2',
            EMBEDDING_BATCH_SIZE: process.env.EMBEDDING_BATCH_SIZE || '5',
            EMBEDDING_RATE_LIMIT: process.env.EMBEDDING_RATE_LIMIT || '20',
          },
        },
      );
    } else {
      // Production: use compiled JavaScript
      childProcess = fork(workerPath, [jobId], {
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
        env: {
          ...process.env,
          EMBEDDING_CONCURRENCY: process.env.EMBEDDING_CONCURRENCY || '2',
          EMBEDDING_BATCH_SIZE: process.env.EMBEDDING_BATCH_SIZE || '5',
          EMBEDDING_RATE_LIMIT: process.env.EMBEDDING_RATE_LIMIT || '20',
        },
      });
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Child process failed to start within timeout'));
      }, 5000);

      childProcess.once('spawn', () => {
        clearTimeout(timeout);
        resolve(childProcess);
      });

      childProcess.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Set up IPC message handlers for child process
   */
  private setupIPCHandlers(childProcess: ChildProcess, jobId: string): void {
    childProcess.on('message', (message: IPCMessage) => {
      try {
        this.handleIPCMessage(message);
      } catch (error) {
        console.error(`Error handling IPC message from ${jobId}:`, error);
      }
    });
  }

  /**
   * Handle IPC messages from child processes and translate to SSE events
   */
  private handleIPCMessage(message: IPCMessage): void {
    const { type, jobId } = message;

    if (process.env.IPC_LOG === '1') {
      console.log(`[IPC ${jobId}] ${type}:`, message);
    }

    switch (type) {
      case 'started':
        sendEvent(jobId, {
          type: 'processing:started',
          message: 'Batch processing started',
        });
        break;

      case 'progress':
        this.enqueueCoalescedEvent(jobId, {
          type: 'processing:progress',
          message: message.message || 'Processing batch...',
        });
        break;

      case 'job-progress':
        sendEvent(jobId, {
          type: 'job:progress',
          itemId: message.itemId,
          status: message.status,
          source: message.source,
          error: message.error,
          message: message.message,
        });
        break;

      case 'done':
        sendEvent(jobId, {
          type: 'done',
          message: message.message || 'All jobs completed successfully',
        });
        break;

      case 'error':
        sendEvent(jobId, {
          type: 'error',
          message: message.message || 'Batch processing failed',
        });
        break;

      default:
        console.warn(`Unknown IPC message type: ${type}`);
    }
  }

  /**
   * Set up process exit handlers
   */
  private setupExitHandlers(childProcess: ChildProcess, jobId: string): void {
    childProcess.once('exit', (code, signal) => {
      console.log(
        `Child process for ${jobId} exited with code ${code}, signal ${signal}`,
      );

      const childInfo = this.runningBatches.get(jobId);
      if (!childInfo) return;

      // Remove from running batches
      this.runningBatches.delete(jobId);

      if (code === 0) {
        // Successful completion - final done event should have been sent by child
        console.log(`Batch ${jobId} completed successfully`);
      } else {
        // Non-zero exit - handle error and potential retry
        const shouldRetry =
          childInfo.retryCount < this.MAX_RETRIES && !this.isShuttingDown;

        if (shouldRetry) {
          console.log(
            `Retrying batch ${jobId} (attempt ${childInfo.retryCount + 1})`,
          );
          setTimeout(() => {
            this.retryBatch(jobId, childInfo.retryCount + 1);
          }, 1000);
        } else {
          console.error(
            `Batch ${jobId} failed after ${childInfo.retryCount} retries`,
          );
          sendEvent(jobId, {
            type: 'error',
            message: `Batch processing failed (exit code: ${code})`,
          });
        }
      }
    });
  }

  /**
   * Coalesce frequent events per jobId to reduce SSE fanout
   */
  private enqueueCoalescedEvent(
    jobId: string,
    payload: ProgressEventPayload,
    intervalMs = 150,
  ): void {
    // Merge latest payload for jobId
    this.coalescedPayloads.set(jobId, payload);
    // Schedule a send if not already scheduled
    if (!this.coalescedTimers.has(jobId)) {
      const timer = setTimeout(() => {
        const latest: ProgressEventPayload | undefined =
          this.coalescedPayloads.get(jobId);
        this.coalescedPayloads.delete(jobId);
        this.coalescedTimers.delete(jobId);
        if (latest) {
          sendEvent(jobId, latest);
        }
      }, intervalMs);
      this.coalescedTimers.set(jobId, timer);
    }
  }

  /**
   * Retry a failed batch
   */
  private async retryBatch(jobId: string, retryCount: number): Promise<void> {
    try {
      const childProcess = await this.forkChildProcess(jobId);

      const childInfo: ChildProcessInfo = {
        process: childProcess,
        jobId,
        startTime: new Date(),
        retryCount,
      };

      this.runningBatches.set(jobId, childInfo);
      this.setupIPCHandlers(childProcess, jobId);
      this.setupExitHandlers(childProcess, jobId);

      console.log(`Retried batch ${jobId} with PID: ${childProcess.pid}`);
    } catch (error) {
      console.error(`Failed to retry batch ${jobId}:`, error);
      sendEvent(jobId, {
        type: 'error',
        message: `Failed to retry batch processing: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Get status of running batches
   */
  getStatus() {
    return {
      runningBatches: Array.from(this.runningBatches.keys()),
      activeBatches: this.runningBatches.size,
      maxBatches: this.MAX_ACTIVE_BATCHES,
      isShuttingDown: this.isShuttingDown,
    };
  }

  /**
   * Gracefully shutdown all child processes
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    console.log('Shutting down ChildProcessManager...');

    if (this.runningBatches.size === 0) {
      console.log('No active child processes to shutdown');
      return;
    }

    // Send shutdown signal to all children
    const shutdownPromises: Promise<void>[] = [];

    for (const [jobId, childInfo] of this.runningBatches) {
      const shutdownPromise = new Promise<void>((resolve) => {
        const { process: childProcess } = childInfo;

        // Send shutdown message via IPC
        try {
          childProcess.send({ type: 'shutdown' });
        } catch (error) {
          console.error(`Failed to send shutdown message to ${jobId}:`, error);
        }

        // Set up timeout for forced termination
        const forceTimeout = setTimeout(() => {
          console.log(`Force terminating child process for ${jobId}`);
          // Try a graceful termination first
          try {
            childProcess.kill('SIGTERM');
          } catch {}
          // Ensure process is killed if it still hasn't exited
          setTimeout(() => {
            try {
              childProcess.kill('SIGKILL');
            } catch {}
          }, 3000);
          resolve();
        }, this.SHUTDOWN_TIMEOUT);

        // Wait for graceful exit
        childProcess.once('exit', () => {
          clearTimeout(forceTimeout);
          resolve();
        });
      });

      shutdownPromises.push(shutdownPromise);
    }

    // Wait for all children to exit
    await Promise.all(shutdownPromises);

    console.log('All child processes have been shutdown');
    this.runningBatches.clear();
  }
}

export const childProcessManager = new ChildProcessManager();
