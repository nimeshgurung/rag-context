import { Response } from 'express';

// This is a simple in-memory store for active SSE clients.
// It is not suitable for a multi-server deployment but is perfect for our needs.
const clients = new Map<string, Response>();

export function addClient(jobId: string, client: Response) {
  clients.set(jobId, client);
}

export function removeClient(jobId: string) {
  clients.delete(jobId);
}

export function sendEvent(jobId: string, data: object) {
  const client = clients.get(jobId);
  if (client) {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

export function closeConnection(jobId: string, finalData: object) {
  const client = clients.get(jobId);
  if (client) {
    client.write(`data: ${JSON.stringify(finalData)}\n\n`);
    client.end();
    removeClient(jobId);
  }
}
