import { FastifyReply } from 'fastify';
import { SimulationEventModel } from '../types/event.types.js';

interface SSEClient {
  id: string;
  simulationId: string;
  reply: FastifyReply;
  lastEventId: number;
}

export class SSEManager {
  private static instance: SSEManager;
  private clients: Map<string, SSEClient> = new Map();
  private simulationClients: Map<string, Set<string>> = new Map();
  private heartbeatInterval?: NodeJS.Timeout;

  private constructor() {
    this.startHeartbeat();
  }

  public static getInstance(): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager();
    }
    return SSEManager.instance;
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients.values()) {
        try {
          client.reply.raw.write(': heartbeat\n\n');
        } catch {
          this.removeClient(client.id);
        }
      }
    }, 15000);
  }

  public addClient(
    clientId: string,
    simulationId: string,
    reply: FastifyReply,
    lastEventId: number = 0
  ): void {
    const client: SSEClient = {
      id: clientId,
      simulationId,
      reply,
      lastEventId,
    };

    this.clients.set(clientId, client);

    if (!this.simulationClients.has(simulationId)) {
      this.simulationClients.set(simulationId, new Set());
    }
    this.simulationClients.get(simulationId)!.add(clientId);

    // Clean up on client disconnect
    reply.raw.on('close', () => {
      this.removeClient(clientId);
    });
  }

  public removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      const set = this.simulationClients.get(client.simulationId);
      if (set) {
        set.delete(clientId);
        if (set.size === 0) {
          this.simulationClients.delete(client.simulationId);
        }
      }
      this.clients.delete(clientId);
    }
  }

  public broadcast(simulationId: string, event: SimulationEventModel): void {
    const clientIds = this.simulationClients.get(simulationId);
    if (!clientIds || clientIds.size === 0) return;

    const seq = event.sequenceNumber ?? event.sequence_number ?? 0;
    const type = event.eventType ?? event.event_type ?? 'message';

    // Send named event and standard data
    const payload = `id: ${seq}\nevent: ${type}\ndata: ${JSON.stringify(event)}\n\n`;

    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client) {
        try {
          client.reply.raw.write(payload);
          client.lastEventId = seq;
        } catch {
          this.removeClient(clientId);
        }
      }
    }
  }

  public broadcastSnapshot(simulationId: string, snapshot: any): void {
    const clientIds = this.simulationClients.get(simulationId);
    if (!clientIds || clientIds.size === 0) return;

    const payload = `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`;
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client) {
        try {
          client.reply.raw.write(payload);
        } catch {
          this.removeClient(clientId);
        }
      }
    }
  }

  public broadcastComplete(simulationId: string, metrics: any): void {
    const clientIds = this.simulationClients.get(simulationId);
    if (!clientIds || clientIds.size === 0) return;

    const payload = `event: complete\ndata: ${JSON.stringify(metrics)}\n\n`;
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client) {
        try {
          client.reply.raw.write(payload);
        } catch {
          this.removeClient(clientId);
        }
      }
    }
  }

  public destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.clients.clear();
    this.simulationClients.clear();
  }
}
