# Child Process Worker System

## Overview

The child process worker system isolates heavy embedding job processing from the main HTTP server to ensure API responsiveness and SSE reliability. It uses Node.js child processes to handle batch processing while maintaining communication with the parent process via IPC (Inter-Process Communication).

## Architecture

### Parent Process (HTTP Server)
- Handles HTTP requests and SSE connections
- Manages capacity control (max concurrent batches)
- Forks child processes for batch processing
- Relays IPC messages to SSE events for frontend updates
- Handles graceful shutdown of child processes

### Child Process (Batch Worker)
- Processes embedding jobs in batches
- Uses PQueue for concurrency and rate limiting
- Communicates progress via IPC to parent
- Handles shutdown signals gracefully

## Environment Variables

### Capacity Control
- **`MAX_ACTIVE_BATCHES`** (default: `1`)
  - Maximum number of concurrent batch processing child processes
  - Prevents resource exhaustion by limiting parallel processing
  - Set to higher values on powerful servers

### Child Process Configuration
- **`EMBEDDING_CONCURRENCY`** (default: `2`)
  - Number of jobs processed concurrently within each batch
  - Higher values increase processing speed but use more resources
  - Should be tuned based on available CPU cores and memory

- **`EMBEDDING_BATCH_SIZE`** (default: `5`)
  - Number of jobs fetched from database in each batch
  - Larger batches reduce database queries but increase memory usage
  - Optimal size depends on job complexity and available memory

- **`EMBEDDING_RATE_LIMIT`** (default: `20`)
  - Maximum number of jobs processed per minute per batch
  - Prevents overwhelming external APIs (OpenAI, etc.)
  - Adjust based on API rate limits and quotas

## HTTP Status Codes

The `/api/jobs/process/all/:jobId` endpoint returns different status codes based on system state:

- **`200`** - Success: Batch processing started successfully
- **`202`** - Already Running: The specified batch is already being processed
- **`429`** - Capacity Reached: Maximum number of concurrent batches reached
- **`500`** - Server Error: Failed to start batch processing

## IPC Message Schema

### Child → Parent Messages

```typescript
interface IPCMessage {
  type: 'started' | 'progress' | 'job-progress' | 'done' | 'error';
  jobId: string;
  message?: string;
  itemId?: number;
  status?: 'completed' | 'failed';
  source?: string;
  error?: string;
}
```

### SSE Event Mapping

Child process IPC messages are translated to SSE events:

- `started` → `processing:started`
- `progress` → `processing:progress`
- `job-progress` → `job:progress`
- `done` → `done`
- `error` → `error`

## Frontend Integration

### UI Control Gating

Processing buttons are disabled when:
- Any jobs in the batch are currently processing
- HTTP requests return 202 (already running) or 429 (capacity reached)
- Mutations are pending in React Query

### SSE Event Handling

The frontend listens for SSE events and:
- Updates job status in real-time
- Invalidates React Query caches
- Shows progress indicators
- Displays error messages

## Error Handling & Retries

### Child Process Failures

- Non-zero exit codes trigger error handling
- Optional single retry attempt (configurable)
- Failed jobs remain in database for manual retry
- Parent process emits error SSE events

### Graceful Shutdown

1. Parent receives SIGINT/SIGTERM
2. Broadcasts shutdown message to all children via IPC
3. Children finish in-flight jobs and exit
4. Parent waits up to 10 seconds for graceful exit
5. Force termination with SIGKILL if needed

## Performance Tuning

### Development Environment
```bash
MAX_ACTIVE_BATCHES=1
EMBEDDING_CONCURRENCY=1
EMBEDDING_BATCH_SIZE=3
EMBEDDING_RATE_LIMIT=10
```

### Production Environment
```bash
MAX_ACTIVE_BATCHES=2
EMBEDDING_CONCURRENCY=3
EMBEDDING_BATCH_SIZE=10
EMBEDDING_RATE_LIMIT=30
```

### High-Performance Environment
```bash
MAX_ACTIVE_BATCHES=4
EMBEDDING_CONCURRENCY=5
EMBEDDING_BATCH_SIZE=20
EMBEDDING_RATE_LIMIT=60
```

## Monitoring & Debugging

### Logs

Child processes log to the parent's stdout/stderr, making debugging easier:

```bash
# View logs
tail -f logs/app.log

# Filter for child process logs
tail -f logs/app.log | grep "BatchWorker"
```

### Health Checks

Check system status via the child process manager:

```javascript
import { childProcessManager } from './lib/jobs/childProcessManager';

// Get current status
const status = childProcessManager.getStatus();
console.log(status);
// Output: { runningBatches: ['batch-123'], activeBatches: 1, maxBatches: 1, isShuttingDown: false }
```

## Troubleshooting

### Common Issues

1. **Child processes not starting**
   - Check that tsx is available in development
   - Verify compiled JavaScript exists in production
   - Check file permissions on worker scripts

2. **High memory usage**
   - Reduce `EMBEDDING_BATCH_SIZE`
   - Lower `EMBEDDING_CONCURRENCY`
   - Check for memory leaks in job processing

3. **Processing too slow**
   - Increase `EMBEDDING_CONCURRENCY` (within resource limits)
   - Increase `EMBEDDING_RATE_LIMIT` (within API limits)
   - Consider increasing `MAX_ACTIVE_BATCHES`

4. **API rate limiting**
   - Decrease `EMBEDDING_RATE_LIMIT`
   - Monitor external API usage
   - Implement exponential backoff in job processing

### Development vs Production

**Development:**
- Uses `tsx` to run TypeScript directly
- Lower concurrency to avoid overwhelming local resources
- More verbose logging for debugging

**Production:**
- Uses compiled JavaScript for better performance
- Higher concurrency for throughput
- Structured logging for monitoring

## Security Considerations

- Child processes inherit parent environment variables
- Database connections are established per child process
- API keys are shared across all processes
- No inter-batch data sharing (isolated processing)

## Future Enhancements

- [ ] Redis-based job queue for distributed processing
- [ ] Metrics collection and monitoring dashboard
- [ ] Dynamic scaling based on queue depth
- [ ] Job prioritization and scheduling
- [ ] Dead letter queue for failed jobs
