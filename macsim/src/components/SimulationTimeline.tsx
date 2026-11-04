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
  const [filterTypes, setFilterTypes] = useState<Record<TimelineInterval['type'], boolean>>({
    TRANSMISSION: true,
    COLLISION: true,
    DELIVERY: true,
    BACKOFF: true,
  });

  const toggleFilter = (type: TimelineInterval['type']) => {
    setFilterTypes(curr => ({ ...curr, [type]: !curr[type] }));
  };

  // 3.1 Station-Only Lane Architecture
  const visibleStations = useMemo(() => {
    const raw = stationIds && stationIds.length > 0 ? stationIds : [];
    const validProps = raw.filter(s => typeof s === 'string' && !s.startsWith('frame_'));
    if (validProps.length > 0) return validProps.slice(0, 8);

    const set = new Set<string>();
    for (const ev of events) {
      if (ev.stationIds) {
        for (const sid of ev.stationIds) {
          if (sid && typeof sid === 'string' && !sid.startsWith('frame_')) set.add(sid);
        }
      }
      const rawSid = (ev as unknown as Record<string, unknown>).station_id as string;
      if (rawSid && typeof rawSid === 'string' && !rawSid.startsWith('frame_')) set.add(rawSid);
    }
    const arr = Array.from(set).sort();
    return arr.length > 0 ? arr.slice(0, 8) : ['station_1', 'station_2', 'station_3', 'station_4'];
  }, [stationIds, events]);

  // 3.3 Event Interval Resolution Engine
  const intervals = useMemo(() => {
    const list: TimelineInterval[] = [];

    // Frame ID -> Station ID resolution map
    const frameToStation = new Map<string, string>();
    for (const ev of events) {
      const sid = ev.stationIds?.find(s => typeof s === 'string' && !s.startsWith('frame_'));
      if (ev.frameId && sid) {
        frameToStation.set(ev.frameId, sid);
      }
    }

    // Track open transmissions: stationId -> { startMs, frameId, durationMs }
    const openTx = new Map<string, { startMs: number; frameId?: string; durationMs?: number }>();
    // Track open backoffs: stationId -> { startMs, expectedEndMs, frameId, message }
    const openBackoff = new Map<string, { startMs: number; expectedEndMs: number; frameId?: string; message: string }>();

    for (const ev of events) {
      const rawType = ev.eventType || (ev as unknown as Record<string, unknown>).event_type || '';
      const typeStr = String(rawType).trim().toUpperCase().replace(/\s+/g, '_');

      const isTxStart =
        typeStr === 'TRANSMISSION_STARTED' ||
        typeStr === 'RETRANSMISSION_ATTEMPTED';

      const isDelivered =
        typeStr === 'TRANSMISSION_COMPLETED' ||
        typeStr === 'FRAME_DELIVERED' ||
        typeStr === 'FRAME_TRANSMITTED' ||
        typeStr === 'SUCCESSFUL';

      const isCollision =
        typeStr === 'COLLISION_DETECTED' ||
        typeStr === 'COLLISION';

      const isBackoffStart =
        typeStr === 'BACKOFF_STARTED';

      const isBackoffEnd =
        typeStr === 'BACKOFF_COMPLETED' ||
        typeStr === 'BACKOFF_END';

      // Resolve primary station
      let sid = ev.stationIds?.find(s => typeof s === 'string' && !s.startsWith('frame_'));
      if (!sid && ev.frameId) {
        sid = frameToStation.get(ev.frameId);
      }

      if (isTxStart && sid) {
        const p = (ev.payload || (ev as unknown as Record<string, unknown>).details || {}) as Record<string, unknown>;
        const durationMs = typeof p.durationUs === 'number'
          ? p.durationUs / 1000
          : typeof p.durationMs === 'number'
            ? p.durationMs
            : 8.192;
        openTx.set(sid, { startMs: ev.simulationTimeMs, frameId: ev.frameId || undefined, durationMs });
      } else if (isDelivered && sid) {
        const started = openTx.get(sid);
        const dur = started?.durationMs ?? 8.192;
        const startMs = started ? started.startMs : Math.max(0, ev.simulationTimeMs - dur);
        const endMs = ev.simulationTimeMs;
        const frameId = ev.frameId || started?.frameId;

        // 1. Physical channel transmission interval (transit airtime)
        list.push({
          id: `${ev.eventId || ev.id || 'tx'}-${sid}-tx`,
          stationId: sid,
          type: 'TRANSMISSION',
          startMs,
          endMs,
          frameId,
          message: ev.message || `${sid} transmitted frame ${frameId ?? ''}`,
        });

        // 2. Verified clean frame delivery endpoint
        list.push({
          id: `${ev.eventId || ev.id || 'del'}-${sid}-del`,
          stationId: sid,
          type: 'DELIVERY',
          startMs,
          endMs,
          frameId,
          message: ev.message || `${sid} successfully delivered frame ${frameId ?? ''}`,
        });

        openTx.delete(sid);
      } else if (isCollision) {
        // Collect all colliding stations
        const colliding = new Set<string>();
        if (ev.stationIds) {
          for (const s of ev.stationIds) {
            if (typeof s === 'string' && !s.startsWith('frame_')) colliding.add(s);
          }
        }
        // Check payload for frame references or station references
        if (ev.payload) {
          const p = ev.payload as Record<string, unknown>;
          const collidedWith = (p.collidedWith || p.collidingFrames || p.collidingStations) as string[] | undefined;
          if (Array.isArray(collidedWith)) {
            for (const item of collidedWith) {
              if (typeof item === 'string') {
                const resolved = frameToStation.get(item) || (!item.startsWith('frame_') ? item : undefined);
                if (resolved) colliding.add(resolved);
              }
            }
          }
        }
        if (sid) colliding.add(sid);

        for (const targetSid of colliding) {
          const started = openTx.get(targetSid);
          const dur = started?.durationMs ?? 8.192;
          const txStart = started ? started.startMs : Math.max(0, ev.simulationTimeMs - dur);
          const colTime = ev.simulationTimeMs;

          // If station was transmitting cleanly prior to the collision event, record transmission phase
          if (colTime > txStart + 0.5) {
            list.push({
              id: `${ev.eventId || ev.id || 'precol'}-${targetSid}-tx`,
              stationId: targetSid,
              type: 'TRANSMISSION',
              startMs: txStart,
              endMs: colTime,
              frameId: ev.frameId || started?.frameId,
              message: `${targetSid} transmitting prior to collision`,
            });
          }

          // Emit collision event interval
          const colEnd = Math.max(colTime + 2, txStart + dur);
          list.push({
            id: `${ev.eventId || ev.id || 'col'}-${targetSid}`,
            stationId: targetSid,
            type: 'COLLISION',
            startMs: colTime > txStart + 0.5 ? colTime : txStart,
            endMs: Math.min(durationMs, colEnd),
            frameId: ev.frameId || started?.frameId,
            message: ev.message || `${targetSid} frame collided on shared medium`,
          });
          openTx.delete(targetSid);
        }
      } else if (isBackoffStart && sid) {
        const p = (ev.payload || (ev as unknown as Record<string, unknown>).details || {}) as Record<string, unknown>;
        const delayEstimate = Number(p.delayMs) || (Number(p.delayUs) ? Number(p.delayUs) / 1000 : 15);
        openBackoff.set(sid, {
          startMs: ev.simulationTimeMs,
          expectedEndMs: Math.min(durationMs, ev.simulationTimeMs + delayEstimate),
          frameId: ev.frameId || undefined,
          message: ev.message || `${sid} in backoff (${delayEstimate.toFixed(1)}ms)`,
        });
      } else if (isBackoffEnd && sid) {
        const started = openBackoff.get(sid);
        const startMs = started ? started.startMs : Math.max(0, ev.simulationTimeMs - 15);
        list.push({
          id: `${ev.eventId || ev.id || 'backoff'}-${sid}`,
          stationId: sid,
          type: 'BACKOFF',
          startMs,
          endMs: ev.simulationTimeMs,
          frameId: ev.frameId || started?.frameId,
          message: ev.message || started?.message || `${sid} backoff completed`,
        });
        openBackoff.delete(sid);
      }
    }

    // Resolve uncompleted open backoffs up to currentTimeMs
    for (const [s, info] of openBackoff.entries()) {
      list.push({
        id: `ongoing-backoff-${s}-${info.startMs}`,
        stationId: s,
        type: 'BACKOFF',
        startMs: info.startMs,
        endMs: Math.min(info.expectedEndMs, Math.max(info.startMs + 0.1, currentTimeMs)),
        frameId: info.frameId,
        message: info.message,
      });
    }

    // Resolve uncompleted open transmissions up to currentTimeMs
    for (const [s, info] of openTx.entries()) {
      list.push({
        id: `ongoing-tx-${s}-${info.startMs}`,
        stationId: s,
        type: 'TRANSMISSION',
        startMs: info.startMs,
        endMs: Math.max(info.startMs + 0.1, currentTimeMs),
        frameId: info.frameId,
        message: `${s} transmitting ${info.frameId ?? ''}`,
      });
    }

    return list;
  }, [events, durationMs, currentTimeMs]);

  // Live count per interval type
  const counts = useMemo(() => {
    const c = { TRANSMISSION: 0, COLLISION: 0, DELIVERY: 0, BACKOFF: 0 };
    for (const item of intervals) {
      c[item.type] = (c[item.type] || 0) + 1;
    }
    return c;
  }, [intervals]);

  const effectiveMaxTime = Math.max(durationMs, 10);
  const timeProgress = Math.min(100, (currentTimeMs / effectiveMaxTime) * 100);

  // Time axis ticks
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => ({
    ratio: i / tickCount,
    timeMs: (effectiveMaxTime * i) / tickCount,
  }));

  const colorForType = (type: TimelineInterval['type']) => {
    switch (type) {
      case 'TRANSMISSION':
        return '#4D9FFF'; // Electric Blue
      case 'COLLISION':
        return '#FF4D4D'; // Crimson Red
      case 'DELIVERY':
        return '#2ECC71'; // Emerald Green
      case 'BACKOFF':
        return '#E5A93C'; // Translucent Sub-Track
    }
  };

  const laneHeight = 32;
  const topOffset = 28;
  const svgHeight = topOffset + visibleStations.length * laneHeight + 16;

  const filteredIntervals = useMemo(() => {
    return intervals.filter(item => filterTypes[item.type]);
  }, [intervals, filterTypes]);

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

      {/* 3.4 Interactive One-Click Legend Filter Pills */}
      <div
        className="timeline-legend"
        role="toolbar"
        aria-label="Toggle timeline event visibility"
        style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, margin: '8px 0 12px' }}
      >
        <span className="legend-label" style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginRight: 4 }}>
          Filters (click to toggle):
        </span>

        {/* Transmitting Pill */}
        <button
          type="button"
          className="btn"
          onClick={() => toggleFilter('TRANSMISSION')}
          style={{
            minHeight: 26,
            padding: '2px 8px',
            fontSize: 11,
            opacity: filterTypes.TRANSMISSION ? 1 : 0.45,
            borderColor: filterTypes.TRANSMISSION ? '#4D9FFF' : 'var(--color-border)',
            background: filterTypes.TRANSMISSION ? 'rgba(77, 159, 255, 0.12)' : 'transparent',
            color: 'var(--color-text-primary)',
          }}
          title="Click to toggle Transmitting bars"
        >
          <span style={{ width: 8, height: 8, background: '#4D9FFF', display: 'inline-block', marginRight: 6 }} />
          Transmitting ({counts.TRANSMISSION})
        </button>

        {/* Collision Pill */}
        <button
          type="button"
          className="btn"
          onClick={() => toggleFilter('COLLISION')}
          style={{
            minHeight: 26,
            padding: '2px 8px',
            fontSize: 11,
            opacity: filterTypes.COLLISION ? 1 : 0.45,
            borderColor: filterTypes.COLLISION ? '#FF4D4D' : 'var(--color-border)',
            background: filterTypes.COLLISION ? 'rgba(255, 77, 77, 0.12)' : 'transparent',
            color: 'var(--color-text-primary)',
          }}
          title="Click to toggle Collision bars"
        >
          <span style={{ width: 8, height: 8, background: '#FF4D4D', display: 'inline-block', marginRight: 6 }} />
          Collision ({counts.COLLISION})
        </button>

        {/* Delivered Pill */}
        <button
          type="button"
          className="btn"
          onClick={() => toggleFilter('DELIVERY')}
          style={{
            minHeight: 26,
            padding: '2px 8px',
            fontSize: 11,
            opacity: filterTypes.DELIVERY ? 1 : 0.45,
            borderColor: filterTypes.DELIVERY ? '#2ECC71' : 'var(--color-border)',
            background: filterTypes.DELIVERY ? 'rgba(46, 204, 113, 0.12)' : 'transparent',
            color: 'var(--color-text-primary)',
          }}
          title="Click to toggle Delivered bars"
        >
          <span style={{ width: 8, height: 8, background: '#2ECC71', display: 'inline-block', marginRight: 6 }} />
          Delivered ({counts.DELIVERY})
        </button>

        {/* Backoff Sub-Track Pill */}
        <button
          type="button"
          className="btn"
          onClick={() => toggleFilter('BACKOFF')}
          style={{
            minHeight: 26,
            padding: '2px 8px',
            fontSize: 11,
            opacity: filterTypes.BACKOFF ? 1 : 0.45,
            borderColor: filterTypes.BACKOFF ? '#E5A93C' : 'var(--color-border)',
            background: filterTypes.BACKOFF ? 'rgba(229, 169, 60, 0.12)' : 'transparent',
            color: 'var(--color-text-primary)',
          }}
          title="Click to toggle Backoff sub-tracks"
        >
          <span style={{ width: 8, height: 4, background: '#E5A93C', display: 'inline-block', marginRight: 6, opacity: 0.7 }} />
          Backoff (Sub-Track) ({counts.BACKOFF})
        </button>
      </div>

      {!showTable ? (
        <div className="timeline-chart-wrap" tabIndex={0} aria-label="Visual simulation timeline diagram">
          <svg
            viewBox={`0 0 780 ${svgHeight}`}
            width="100%"
            height={svgHeight}
            style={{ display: 'block', background: '#191A1A' }}
            aria-hidden="true"
          >
            {/* Background gridlines for ticks */}
            {ticks.map(tick => {
              const x = 70 + tick.ratio * 660;
              return (
                <g key={tick.timeMs}>
                  <line
                    x1={x}
                    y1="20"
                    x2={x}
                    y2={topOffset + visibleStations.length * laneHeight}
                    stroke="#262727"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                  <text x={x} y="15" fill="#928A7F" fontSize="9" fontFamily="IBM Plex Mono" textAnchor="middle">
                    {formatNumber(tick.timeMs, 0)} ms
                  </text>
                </g>
              );
            })}

            {/* Live Time Progress line */}
            <line
              x1={70 + (timeProgress / 100) * 660}
              y1="20"
              x2={70 + (timeProgress / 100) * 660}
              y2={topOffset + visibleStations.length * laneHeight}
              stroke="#DDB487"
              strokeWidth="1.5"
            />

            {/* Station lanes */}
            {visibleStations.map((sid, idx) => {
              const y = topOffset + idx * laneHeight;
              const stationIntervals = filteredIntervals.filter(item => item.stationId === sid);
              const backoffIntervals = stationIntervals.filter(i => i.type === 'BACKOFF');
              const activeEvents = stationIntervals.filter(i => i.type !== 'BACKOFF');

              return (
                <g key={sid}>
                  {/* Station Identifier Label */}
                  <rect x="2" y={y + 3} width="62" height="24" rx="4" fill="#202222" stroke="#3E3A34" strokeWidth="1" />
                  <text x="33" y={y + 19} fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="middle">
                    {sid}
                  </text>

                  {/* Lane Track Baseline */}
                  <line x1="70" y1={y + 15} x2="730" y2={y + 15} stroke="#2D2B28" strokeWidth="1" />

                  {/* LAYER 1: Background Backoff Sub-Track (6px) */}
                  {backoffIntervals.map(item => {
                    const startX = 70 + (Math.max(0, item.startMs) / effectiveMaxTime) * 660;
                    const endX = 70 + (Math.min(effectiveMaxTime, item.endMs) / effectiveMaxTime) * 660;
                    const width = Math.max(3.5, endX - startX);

                    return (
                      <rect
                        key={item.id}
                        x={startX}
                        y={y + 12}
                        width={width}
                        height="6"
                        rx="3"
                        fill="#E5A93C"
                        opacity="0.45"
                        stroke="#B88628"
                        strokeWidth="0.5"
                      >
                        <title>{`${sid} [BACKOFF] ${formatNumber(item.startMs, 1)}ms - ${formatNumber(item.endMs, 1)}ms: ${item.message}`}</title>
                      </rect>
                    );
                  })}

                  {/* LAYER 2: Foreground Active Events (18px) */}
                  {activeEvents.map(item => {
                    const startX = 70 + (Math.max(0, item.startMs) / effectiveMaxTime) * 660;
                    const endX = 70 + (Math.min(effectiveMaxTime, item.endMs) / effectiveMaxTime) * 660;
                    const totalWidth = Math.max(4, endX - startX);

                    let renderX = startX;
                    let renderWidth = totalWidth;

                    // When both Transmitting and Delivered are active, delivered frames visually display both:
                    // Electric Blue transit body + Emerald Green delivery badge at endpoint
                    const isDeliveredFrame = !item.id.startsWith('ongoing-tx') && !item.id.includes('precol') && item.type !== 'COLLISION';
                    if (filterTypes.TRANSMISSION && filterTypes.DELIVERY && isDeliveredFrame) {
                      const capWidth = Math.max(4, Math.min(14, totalWidth * 0.35));
                      if (item.type === 'TRANSMISSION') {
                        renderWidth = Math.max(3, totalWidth - capWidth);
                      } else if (item.type === 'DELIVERY') {
                        renderX = Math.max(startX, endX - capWidth);
                        renderWidth = capWidth;
                      }
                    }

                    return (
                      <rect
                        key={item.id}
                        x={renderX}
                        y={y + 6}
                        width={renderWidth}
                        height="18"
                        rx="2"
                        fill={colorForType(item.type)}
                        stroke="#101111"
                        strokeWidth="0.75"
                        style={{
                          filter: item.type === 'DELIVERY' ? 'drop-shadow(0 0 3px rgba(46, 204, 113, 0.5))' : undefined,
                        }}
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
        /* 3.5 Synchronized Tabular Inspection Mode */
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
              {filteredIntervals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: 'center' }}>
                    No timeline intervals match the current filters.
                  </td>
                </tr>
              ) : (
                filteredIntervals.slice(-30).map(item => (
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
