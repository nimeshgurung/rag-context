import { Response } from 'express';

// Simple in-memory store for active SSE clients (kept for potential future use)
// Note: SSE is currently disabled in favor of polling
const clients = new Map<string, Response>();

export function addClient(jobId: string, client: Response) {
  clients.set(jobId, client);
}

export function removeClient(jobId: string) {
  clients.delete(jobId);
}

export function sendEvent(jobId: string, data: object) {
  // Log events for debugging even though SSE is disabled
  console.log(`[Event ${jobId}]:`, data);

  const client = clients.get(jobId);
  if (client) {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

export function closeConnection(jobId: string, finalData: object) {
  console.log(`[Event ${jobId} - Final]:`, finalData);

  const client = clients.get(jobId);
  if (client) {
    client.write(`data: ${JSON.stringify(finalData)}\n\n`);
    client.end();
    removeClient(jobId);
  }
}

// Removed EventManager class and all complex buffering/reconnection logic
