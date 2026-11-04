import { useMemo, useState } from 'react';
import type { SimulationEvent } from '../types';
import { formatNumber } from '../utils/format';

interface TimelineProps {
  events: SimulationEvent[];
  durationMs: number;
  currentTimeMs: number;
  stationIds: string[];
}

interface TimelineInterval {
  id: string;
  stationId: string;
  type: 'TRANSMISSION' | 'COLLISION' | 'DELIVERY' | 'BACKOFF';
  startMs: number;
  endMs: number;
  frameId?: string;
  message: string;
}

export function SimulationTimeline({
  events,
  durationMs,
  currentTimeMs,
  stationIds,
}: TimelineProps) {
  const [showTable, setShowTable] = useState(false);

  // Derive timeline intervals from chronological events
  const intervals = useMemo(() => {
    const list: TimelineInterval[] = [];
    // Track open transmissions per station: stationId -> { startMs, frameId }
    const openTx = new Map<string, { startMs: number; frameId?: string }>();

    for (const ev of events) {
      if (ev.eventType === 'Transmission started' || ev.eventType === 'Retransmission attempted') {
        const sid = ev.stationIds[0];
        if (sid) {
          openTx.set(sid, { startMs: ev.simulationTimeMs, frameId: ev.frameId });
        }
      } else if (ev.eventType === 'Frame delivered') {
        const sid = ev.stationIds[0];
        const started = sid ? openTx.get(sid) : undefined;
        const startMs = started ? started.startMs : Math.max(0, ev.simulationTimeMs - 8);
        list.push({
          id: ev.eventId,
          stationId: sid ?? 'Channel',
          type: 'DELIVERY',
          startMs,
          endMs: ev.simulationTimeMs,
          frameId: ev.frameId,
          message: ev.message,
        });
        if (sid) openTx.delete(sid);
      } else if (ev.eventType === 'Collision detected') {
        for (const sid of ev.stationIds) {
          const started = openTx.get(sid);
          const startMs = started ? started.startMs : Math.max(0, ev.simulationTimeMs - 8);
          list.push({
            id: `${ev.eventId}-${sid}`,
            stationId: sid,
            type: 'COLLISION',
            startMs,
            endMs: ev.simulationTimeMs,
            frameId: ev.frameId,
            message: ev.message,
          });
          openTx.delete(sid);
        }
      } else if (ev.eventType === 'Backoff started') {
        const sid = ev.stationIds[0];
        list.push({
          id: ev.eventId,
          stationId: sid ?? 'Channel',
          type: 'BACKOFF',
          startMs: ev.simulationTimeMs,
          endMs: Math.min(durationMs, ev.simulationTimeMs + 15),
          frameId: ev.frameId,
          message: ev.message,
        });
      }
    }

    // Add any ongoing active transmissions up to currentTimeMs
    for (const [sid, info] of openTx.entries()) {
      list.push({
        id: `ongoing-${sid}-${info.startMs}`,
        stationId: sid,
        type: 'TRANSMISSION',
        startMs: info.startMs,
        endMs: Math.max(info.startMs + 0.1, currentTimeMs),
        frameId: info.frameId,
        message: `${sid} transmitting ${info.frameId ?? ''}`,
      });
    }

    return list;
  }, [events, durationMs, currentTimeMs]);

  // Display top stations (up to 6) for layout cleanliness
  const visibleStations = stationIds.slice(0, 8);
  const effectiveMaxTime = Math.max(durationMs, 10);
  const timeProgress = Math.min(100, (currentTimeMs / effectiveMaxTime) * 100);

  // Time ticks
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => ({
    ratio: i / tickCount,
    timeMs: (effectiveMaxTime * i) / tickCount,
  }));

  const colorForType = (type: TimelineInterval['type']) => {
    switch (type) {
      case 'TRANSMISSION':
        return '#78A9E8';
      case 'COLLISION':
        return '#D96A62';
      case 'DELIVERY':
        return '#78B978';
      case 'BACKOFF':
        return '#D5A45D';
    }
  };

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <div>
          <h3 style={{ margin: 0, fontSize: 14 }}>Simulation Timeline</h3>
          <span className="muted" style={{ fontSize: 12 }}>
            Activity intervals across simulation duration ({formatNumber(currentTimeMs, 1)} ms / {formatNumber(durationMs, 0)} ms)
          </span>
        </div>
        <div className="button-row">
          <button
            className="btn"
            type="button"
            style={{ fontSize: 12, padding: '3px 8px', minHeight: 28 }}
            onClick={() => setShowTable(val => !val)}
          >
            {showTable ? 'View Chart' : 'View Tabular Log'}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="timeline-legend" aria-hidden="true">
        <span className="legend-item">
          <span className="legend-color" style={{ background: '#78A9E8' }} /> Transmitting
        </span>
        <span className="legend-item">
          <span className="legend-color" style={{ background: '#D96A62' }} /> Collision
        </span>
        <span className="legend-item">
          <span className="legend-color" style={{ background: '#78B978' }} /> Delivered
        </span>
        <span className="legend-item">
          <span className="legend-color" style={{ background: '#D5A45D' }} /> Backoff
        </span>
      </div>

      {!showTable ? (
        <div className="timeline-chart-wrap" tabIndex={0} aria-label="Visual simulation timeline diagram">
          <svg
            viewBox={`0 0 780 ${40 + visibleStations.length * 24}`}
            width="100%"
            height={40 + visibleStations.length * 24}
            style={{ display: 'block', background: '#191A1A' }}
            aria-hidden="true"
          >
            {/* Background gridlines for ticks */}
            {ticks.map(tick => {
              const x = 70 + tick.ratio * 660;
              return (
                <g key={tick.timeMs}>
                  <line x1={x} y1="20" x2={x} y2={25 + visibleStations.length * 24} stroke="#252626" strokeWidth="1" />
                  <text x={x} y="15" fill="#928A7F" fontSize="9" fontFamily="IBM Plex Mono" textAnchor="middle">
                    {formatNumber(tick.timeMs, 0)} ms
                  </text>
                </g>
              );
            })}

            {/* Time progress bar */}
            <line
              x1={70 + (timeProgress / 100) * 660}
              y1="20"
              x2={70 + (timeProgress / 100) * 660}
              y2={25 + visibleStations.length * 24}
              stroke="#DDB487"
              strokeWidth="1.5"
            />

            {/* Station lanes */}
            {visibleStations.map((sid, idx) => {
              const y = 28 + idx * 24;
              return (
                <g key={sid}>
                  {/* Station label */}
                  <rect x="2" y={y} width="62" height="18" fill="#202222" stroke="#403C36" strokeWidth="1" />
                  <text x="33" y={y + 12} fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="middle">
                    {sid}
                  </text>

                  {/* Lane track */}
                  <line x1="70" y1={y + 9} x2="730" y2={y + 9} stroke="#403C36" strokeWidth="1" />

                  {/* Intervals on this lane */}
                  {intervals
                    .filter(item => item.stationId === sid)
                    .map(item => {
                      const startX = 70 + (Math.max(0, item.startMs) / effectiveMaxTime) * 660;
                      const endX = 70 + (Math.min(effectiveMaxTime, item.endMs) / effectiveMaxTime) * 660;
                      const width = Math.max(3, endX - startX);
                      return (
                        <rect
                          key={item.id}
                          x={startX}
                          y={y + 2}
                          width={width}
                          height="14"
                          fill={colorForType(item.type)}
                          stroke="#141515"
                          strokeWidth="0.5"
                        >
                          <title>{`${sid} [${item.type}] ${formatNumber(item.startMs, 1)}ms - ${formatNumber(item.endMs, 1)}ms: ${item.message}`}</title>
                        </rect>
                      );
                    })}
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="table-wrap" style={{ maxHeight: 240 }}>
          <table>
            <thead>
              <tr>
                <th scope="col">Time Range (ms)</th>
                <th scope="col">Station</th>
                <th scope="col">State</th>
                <th scope="col">Frame</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {intervals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: 'center' }}>
                    No timeline intervals recorded yet.
                  </td>
                </tr>
              ) : (
                intervals.slice(-30).map(item => (
                  <tr key={item.id}>
                    <td className="numeric-cell">
                      {formatNumber(item.startMs, 1)} - {formatNumber(item.endMs, 1)}
                    </td>
                    <td>{item.stationId}</td>
                    <td>
                      <span
                        style={{
                          color: colorForType(item.type),
                          fontWeight: 600,
                          fontSize: 11,
                          fontFamily: 'IBM Plex Mono',
                        }}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td className="mono">{item.frameId ?? '-'}</td>
                    <td>{item.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

