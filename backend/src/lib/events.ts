import { Response } from 'express';

// Store for active SSE clients - supports multiple clients per resource
const clients = new Map<string, Set<Response>>();

export function addClient(resourceId: string, client: Response) {
  if (!clients.has(resourceId)) {
    clients.set(resourceId, new Set());
  }
  clients.get(resourceId)!.add(client);
}

export function removeClient(resourceId: string, client: Response) {
  const clientSet = clients.get(resourceId);
  if (clientSet) {
    clientSet.delete(client);
    if (clientSet.size === 0) {
      clients.delete(resourceId);
    }
  }
}

export function sendEvent(resourceId: string, data: object) {
  console.log(`[Event ${resourceId}]:`, data);

  const clientSet = clients.get(resourceId);
  if (clientSet) {
    const eventData = `data: ${JSON.stringify(data)}\n\n`;
    clientSet.forEach((client) => {
      try {
        client.write(eventData);
      } catch (error) {
        console.error(
          `Failed to send event to client for ${resourceId}:`,
          error,
        );
        removeClient(resourceId, client);
      }
    });
  }
}

// Send event to multiple resources (e.g., both job and library)
export function sendMultiEvent(resourceIds: string[], data: object) {
  resourceIds.forEach((id) => sendEvent(id, data));
}
