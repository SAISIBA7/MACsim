import { PrismaClient } from '@prisma/client';
import { SimulationEventModel } from '../types/event.types.js';

export class EventRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  public async saveBatch(events: SimulationEventModel[]): Promise<void> {
    if (events.length === 0) return;

    // Use upsert or try-catch createMany to prevent unique constraint failures on multiple saves
    for (const e of events) {
      const id = e.eventId || e.id!;
      const simId = e.simulationId || e.simulation_id!;
      const seq = e.sequenceNumber ?? e.sequence_number ?? 0;
      const timestamp = e.timestamp ?? (e.simulationTimeMs ? e.simulationTimeMs * 1000 : 0);
      const eventType = (e.eventType || e.event_type || 'EVENT') as string;
      const stationId = (e.stationIds && e.stationIds[0]) || e.station_id || null;
      const frameId = e.frameId || e.frame_id || null;
      const details = JSON.stringify({
        ...(e.payload || e.details || {}),
        message: e.message,
      });

      try {
        await this.prisma.simulationEvent.upsert({
          where: { id },
          create: {
            id,
            simulation_id: simId,
            sequence_number: seq,
            timestamp,
            event_type: eventType,
            station_id: stationId,
            frame_id: frameId,
            details,
          },
          update: {
            timestamp,
            event_type: eventType,
            station_id: stationId,
            frame_id: frameId,
            details,
          },
        });
      } catch {
        // Safe skip on duplicate
      }
    }
  }

  public async findBySimulation(
    simulationId: string,
    sinceSequence: number = 0,
    limit: number = 500
  ): Promise<SimulationEventModel[]> {
    const records = await this.prisma.simulationEvent.findMany({
      where: {
        simulation_id: simulationId,
        sequence_number: { gt: sinceSequence },
      },
      orderBy: { sequence_number: 'asc' },
      take: limit,
    });

    return records.map((r) => {
      let details: any = {};
      try {
        details = JSON.parse(r.details);
      } catch {
        details = {};
      }
      const timeMs = Number((r.timestamp / 1000).toFixed(3));
      const message = details?.message || `${r.event_type} at ${timeMs.toFixed(2)}ms`;

      return {
        eventId: r.id,
        simulationId: r.simulation_id,
        sequenceNumber: r.sequence_number,
        simulationTimeMs: timeMs,
        eventType: r.event_type,
        stationIds: r.station_id ? [r.station_id] : [],
        frameId: r.frame_id,
        message,
        payload: details,
        id: r.id,
        simulation_id: r.simulation_id,
        sequence_number: r.sequence_number,
        timestamp: r.timestamp,
        event_type: r.event_type,
        station_id: r.station_id,
        frame_id: r.frame_id,
        details,
      };
    });
  }
}
