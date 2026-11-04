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

  // Filter state for each activity type (toggleable by clicking legend items)
  const [activeFilters, setActiveFilters] = useState<Record<TimelineInterval['type'], boolean>>({
    TRANSMISSION: true,
    COLLISION: true,
    DELIVERY: true,
    BACKOFF: true,
  });

  const toggleFilter = (type: TimelineInterval['type']) => {
    setActiveFilters((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  // Derive timeline intervals from chronological events
  const intervals = useMemo(() => {
    const list: TimelineInterval[] = [];
    const frameToStation = new Map<string, string>();
    // Track open transmissions per station: stationId -> { startMs, frameId, durationMs }
    const openTx = new Map<string, { startMs: number; frameId?: string; durationMs: number }>();
    // Track open backoffs per station: stationId -> { startMs, expectedEndMs, frameId, message }
    const openBackoff = new Map<string, { startMs: number; expectedEndMs: number; frameId?: string; message: string }>();

    for (const ev of events) {
      const rawType = (ev.eventType || (ev as unknown as Record<string, unknown>).event_type || '') as string;
      const eventType = rawType.toUpperCase().replace(/[\s-]/g, '_');
      const timeMs = ev.simulationTimeMs ?? (ev.timestamp ? ev.timestamp / 1000 : 0);
      const rawSid =
        (ev.stationIds && ev.stationIds[0]) ||
        ((ev as unknown as Record<string, unknown>).station_id as string) ||
        ((ev.payload as unknown as Record<string, unknown>)?.stationId as string);
      const frameId =
        ev.frameId ||
        ((ev as unknown as Record<string, unknown>).frame_id as string) ||
        ((ev.payload as unknown as Record<string, unknown>)?.frameId as string);
      const payload = (ev.payload || (ev as unknown as Record<string, unknown>).details || {}) as unknown as Record<string, unknown>;

      // Track frame-to-station mapping
      if (rawSid && !rawSid.startsWith('frame_') && frameId) {
        frameToStation.set(frameId, rawSid);
      }
      const sid = (rawSid && !rawSid.startsWith('frame_')) ? rawSid : (frameId ? frameToStation.get(frameId) : undefined);

      if (eventType === 'TRANSMISSION_STARTED' || eventType === 'RETRANSMISSION_ATTEMPTED') {
        if (sid) {
          const durationMsEst = Number(payload.durationUs ? Number(payload.durationUs) / 1000 : (payload.durationMs ?? 8.192));
          openTx.set(sid, { startMs: timeMs, frameId, durationMs: durationMsEst });
        }
      } else if (eventType === 'TRANSMISSION_COMPLETED' || eventType === 'FRAME_DELIVERED') {
        if (sid) {
          const started = openTx.get(sid);
          const startMs = started ? started.startMs : Math.max(0, timeMs - 8.192);
          const endMs = Math.max(timeMs, startMs + 0.1);
          const span = endMs - startMs;
          const splitMs = startMs + span * 0.55;

          // 1. Transmitting interval (Blue)
          list.push({
            id: `tx-${ev.eventId || ev.id || `${sid}-${startMs}`}`,
            stationId: sid,
            type: 'TRANSMISSION',
            startMs,
            endMs: splitMs,
            frameId: frameId || started?.frameId,
            message: `${sid} transmitting ${frameId || started?.frameId || 'frame'}`,
          });

          // 2. Delivered interval (Green)
          list.push({
            id: `del-${ev.eventId || ev.id || `${sid}-${endMs}`}`,
            stationId: sid,
            type: 'DELIVERY',
            startMs: splitMs,
            endMs,
            frameId: frameId || started?.frameId,
            message: ev.message || `${sid} delivered ${frameId || started?.frameId || 'frame'} successfully`,
          });

          openTx.delete(sid);
        }
      } else if (eventType === 'COLLISION_DETECTED') {
        const affected = new Set<string>();
        if (sid) affected.add(sid);

        // Safely resolve colliding station IDs from payload
        if (Array.isArray(payload.collidedWith)) {
          for (const item of payload.collidedWith) {
            if (typeof item === 'string') {
              if (item.startsWith('frame_')) {
                const s = frameToStation.get(item);
                if (s) affected.add(s);
              } else if (!item.startsWith('frame_')) {
                affected.add(item);
              }
            }
          }
        } else if (typeof payload.collidedWith === 'string') {
          for (const item of payload.collidedWith.split(/\s+/)) {
            if (item.startsWith('frame_')) {
              const s = frameToStation.get(item);
              if (s) affected.add(s);
            } else if (item && !item.startsWith('frame_')) {
              affected.add(item);
            }
          }
        }

        for (const st of affected) {
          const started = openTx.get(st);
          const startMs = started ? started.startMs : Math.max(0, timeMs - 8.192);
          const endMs = Math.max(timeMs, startMs + 1);

          // Transmission phase before collision occurred
          if (timeMs > startMs + 0.5) {
            list.push({
              id: `tx-col-${ev.eventId || startMs}-${st}`,
              stationId: st,
              type: 'TRANSMISSION',
              startMs,
              endMs: timeMs,
              frameId: started?.frameId || frameId,
              message: `${st} transmitted ${started?.frameId || frameId || 'frame'} before collision`,
            });
          }

          // Collision interval
          list.push({
            id: `col-${ev.eventId || ev.id || `${st}-${timeMs}`}-${st}`,
            stationId: st,
            type: 'COLLISION',
            startMs: timeMs,
            endMs: endMs + 2,
            frameId: started?.frameId || frameId,
            message: ev.message || `Collision detected on ${st} (${frameId || started?.frameId || 'frame'})`,
          });
          openTx.delete(st);
        }
      } else if (eventType === 'BACKOFF_STARTED') {
        if (sid) {
          const delayMs = Number(
            payload.delayMs ?? (payload.delayUs ? Number(payload.delayUs) / 1000 : 8.192),
          );
          openBackoff.set(sid, {
            startMs: timeMs,
            expectedEndMs: timeMs + Math.max(0.5, delayMs),
            frameId,
            message: ev.message || `${sid} entered backoff for ${delayMs.toFixed(1)}ms`,
          });
        }
      } else if (eventType === 'BACKOFF_COMPLETED') {
        if (sid) {
          const b = openBackoff.get(sid);
          const startMs = b ? b.startMs : Math.max(0, timeMs - 8.192);
          const endMs = Math.max(timeMs, startMs + 0.5);

          list.push({
            id: `bo-${ev.eventId || ev.id || `${sid}-${timeMs}`}`,
            stationId: sid,
            type: 'BACKOFF',
            startMs,
            endMs,
            frameId: frameId || b?.frameId,
            message: b?.message || `${sid} completed backoff delay (${(endMs - startMs).toFixed(1)}ms)`,
          });
          openBackoff.delete(sid);
        }
      }
    }

    // Add any ongoing/unclosed backoffs
    for (const [sid, b] of openBackoff.entries()) {
      list.push({
        id: `ongoing-bo-${sid}-${b.startMs}`,
        stationId: sid,
        type: 'BACKOFF',
        startMs: b.startMs,
        endMs: Math.min(durationMs, Math.max(b.startMs + 0.5, b.expectedEndMs)),
        frameId: b.frameId,
        message: b.message,
      });
    }

    // Add any ongoing active transmissions up to currentTimeMs
    for (const [sid, info] of openTx.entries()) {
      list.push({
        id: `ongoing-tx-${sid}-${info.startMs}`,
        stationId: sid,
        type: 'TRANSMISSION',
        startMs: info.startMs,
        endMs: Math.min(durationMs, Math.max(info.startMs + 0.1, currentTimeMs)),
        frameId: info.frameId,
        message: `${sid} transmitting ${info.frameId ?? ''}`,
      });
    }

    return list.sort((a, b) => a.startMs - b.startMs);
  }, [events, durationMs, currentTimeMs]);

  // Clean station list strictly (stations only, never frames)
  const visibleStations = useMemo(() => {
    const raw = stationIds && stationIds.length > 0 ? stationIds : [];
    const validProps = raw.filter((s) => typeof s === 'string' && !s.startsWith('frame_'));
    if (validProps.length > 0) return validProps;

    const set = new Set<string>();
    for (const ev of events) {
      if (ev.stationIds) {
        for (const sid of ev.stationIds) {
          if (sid && !sid.startsWith('frame_')) set.add(sid);
        }
      }
      const rawSid = (ev as unknown as Record<string, unknown>).station_id as string;
      if (rawSid && !rawSid.startsWith('frame_')) set.add(rawSid);
    }
    const arr = Array.from(set).sort();
    return arr.length > 0 ? arr : ['station_1', 'station_2', 'station_3', 'station_4'];
  }, [stationIds, events]);

  const effectiveMaxTime = Math.max(durationMs, 10);
  const timeProgress = Math.min(100, (currentTimeMs / effectiveMaxTime) * 100);

  // Time ticks across timeline
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => ({
    ratio: i / tickCount,
    timeMs: (effectiveMaxTime * i) / tickCount,
  }));

  // Counts of each activity type
  const counts = useMemo(() => ({
    TRANSMISSION: intervals.filter((i) => i.type === 'TRANSMISSION').length,
    COLLISION: intervals.filter((i) => i.type === 'COLLISION').length,
    DELIVERY: intervals.filter((i) => i.type === 'DELIVERY').length,
    BACKOFF: intervals.filter((i) => i.type === 'BACKOFF').length,
  }), [intervals]);

  const colorForType = (type: TimelineInterval['type']) => {
    switch (type) {
      case 'TRANSMISSION':
        return '#4D9FFF'; // Bright Electric Blue
      case 'COLLISION':
        return '#FF4D4D'; // Vivid Crimson Red
      case 'DELIVERY':
        return '#2ECC71'; // Crisp Emerald Green
      case 'BACKOFF':
        return '#E5A93C'; // Subtle Amber Gold
    }
  };

  const laneHeight = 32;
  const topOffset = 30;
  const svgHeight = topOffset + visibleStations.length * laneHeight + 16;

  // Filtered intervals to display based on active legend toggles
  const filteredIntervals = useMemo(
    () => intervals.filter((i) => activeFilters[i.type]),
    [intervals, activeFilters]
  );

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
            onClick={() => setShowTable((val) => !val)}
          >
            {showTable ? 'View Chart' : 'View Tabular Log'}
          </button>
        </div>
      </div>

      {/* Interactive Legend with toggleable filter pills */}
      <div
        className="timeline-legend"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
          padding: '6px 10px',
          background: '#161717',
          borderRadius: '6px',
          border: '1px solid #2B2D2D',
        }}
      >
        <span style={{ fontSize: '11px', color: '#928A7F', marginRight: '4px' }}>
          Filters (click to toggle):
        </span>

        {/* Transmitting Pill */}
        <button
          type="button"
          onClick={() => toggleFilter('TRANSMISSION')}
          style={{
            background: activeFilters.TRANSMISSION ? 'rgba(77, 159, 255, 0.15)' : '#1F2020',
            border: `1px solid ${activeFilters.TRANSMISSION ? '#4D9FFF' : '#333'}`,
            borderRadius: '4px',
            padding: '3px 9px',
            cursor: 'pointer',
            opacity: activeFilters.TRANSMISSION ? 1 : 0.45,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontFamily: 'IBM Plex Mono, monospace',
            color: activeFilters.TRANSMISSION ? '#F3EDE4' : '#777',
            transition: 'all 0.15s ease',
          }}
          title="Toggle Transmitting intervals on/off"
        >
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#4D9FFF', display: 'inline-block' }} />
          <span>Transmitting</span>
          <span style={{ fontSize: '10px', color: '#4D9FFF', fontWeight: 600 }}>({counts.TRANSMISSION})</span>
        </button>

        {/* Collision Pill */}
        <button
          type="button"
          onClick={() => toggleFilter('COLLISION')}
          style={{
            background: activeFilters.COLLISION ? 'rgba(255, 77, 77, 0.15)' : '#1F2020',
            border: `1px solid ${activeFilters.COLLISION ? '#FF4D4D' : '#333'}`,
            borderRadius: '4px',
            padding: '3px 9px',
            cursor: 'pointer',
            opacity: activeFilters.COLLISION ? 1 : 0.45,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontFamily: 'IBM Plex Mono, monospace',
            color: activeFilters.COLLISION ? '#F3EDE4' : '#777',
            transition: 'all 0.15s ease',
          }}
          title="Toggle Collision intervals on/off"
        >
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FF4D4D', display: 'inline-block' }} />
          <span>Collision</span>
          <span style={{ fontSize: '10px', color: '#FF4D4D', fontWeight: 600 }}>({counts.COLLISION})</span>
        </button>

        {/* Delivered Pill */}
        <button
          type="button"
          onClick={() => toggleFilter('DELIVERY')}
          style={{
            background: activeFilters.DELIVERY ? 'rgba(46, 204, 113, 0.15)' : '#1F2020',
            border: `1px solid ${activeFilters.DELIVERY ? '#2ECC71' : '#333'}`,
            borderRadius: '4px',
            padding: '3px 9px',
            cursor: 'pointer',
            opacity: activeFilters.DELIVERY ? 1 : 0.45,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontFamily: 'IBM Plex Mono, monospace',
            color: activeFilters.DELIVERY ? '#F3EDE4' : '#777',
            transition: 'all 0.15s ease',
          }}
          title="Toggle Delivered intervals on/off"
        >
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#2ECC71', display: 'inline-block' }} />
          <span>Delivered</span>
          <span style={{ fontSize: '10px', color: '#2ECC71', fontWeight: 600 }}>({counts.DELIVERY})</span>
        </button>

        {/* Backoff Pill (Can be easily toggled off to remove yellow dominance) */}
        <button
          type="button"
          onClick={() => toggleFilter('BACKOFF')}
          style={{
            background: activeFilters.BACKOFF ? 'rgba(229, 169, 60, 0.15)' : '#1F2020',
            border: `1px solid ${activeFilters.BACKOFF ? '#E5A93C' : '#333'}`,
            borderRadius: '4px',
            padding: '3px 9px',
            cursor: 'pointer',
            opacity: activeFilters.BACKOFF ? 1 : 0.45,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontFamily: 'IBM Plex Mono, monospace',
            color: activeFilters.BACKOFF ? '#F3EDE4' : '#777',
            transition: 'all 0.15s ease',
          }}
          title="Toggle Backoff intervals on/off"
        >
          <span style={{ width: 8, height: 4, borderRadius: 1, background: '#E5A93C', display: 'inline-block' }} />
          <span>Backoff (Sub-Track)</span>
          <span style={{ fontSize: '10px', color: '#E5A93C', fontWeight: 600 }}>({counts.BACKOFF})</span>
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
            {ticks.map((tick) => {
              const x = 70 + tick.ratio * 660;
              return (
                <g key={tick.timeMs}>
                  <line
                    x1={x}
                    y1="22"
                    x2={x}
                    y2={topOffset + visibleStations.length * laneHeight}
                    stroke="#262727"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                  <text
                    x={x}
                    y="16"
                    fill="#928A7F"
                    fontSize="9"
                    fontFamily="IBM Plex Mono"
                    textAnchor="middle"
                  >
                    {formatNumber(tick.timeMs, 0)} ms
                  </text>
                </g>
              );
            })}

            {/* Time progress bar */}
            <line
              x1={70 + (timeProgress / 100) * 660}
              y1="22"
              x2={70 + (timeProgress / 100) * 660}
              y2={topOffset + visibleStations.length * laneHeight}
              stroke="#DDB487"
              strokeWidth="1.5"
            />

            {/* Station lanes */}
            {visibleStations.map((sid, idx) => {
              const y = topOffset + idx * laneHeight;
              const stationIntervals = filteredIntervals.filter((item) => item.stationId === sid);

              // Separate backoff (rendered as sleek background sub-track) from active foreground events
              const backoffIntervals = stationIntervals.filter((i) => i.type === 'BACKOFF');
              const activeEvents = stationIntervals.filter((i) => i.type !== 'BACKOFF');

              return (
                <g key={sid}>
                  {/* Station label */}
                  <rect
                    x="2"
                    y={y + 3}
                    width="62"
                    height="24"
                    rx="4"
                    fill="#202222"
                    stroke="#3E3A34"
                    strokeWidth="1"
                  />
                  <text
                    x="33"
                    y={y + 19}
                    fill="#F3EDE4"
                    fontSize="10"
                    fontFamily="IBM Plex Mono"
                    textAnchor="middle"
                    fontWeight="500"
                  >
                    {sid}
                  </text>

                  {/* Lane track baseline */}
                  <line
                    x1="70"
                    y1={y + 15}
                    x2="730"
                    y2={y + 15}
                    stroke="#2D2B28"
                    strokeWidth="1"
                  />

                  {/* 1. LAYER 1 (Background): Backoff rendered as a sleek, non-intrusive 6px sub-track */}
                  {backoffIntervals.map((item) => {
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

                  {/* 2. LAYER 2 (Foreground): Active on-medium events (Transmitting, Delivered, Collision) */}
                  {/* Rendered at full 18px height so they tower crisply over the backoff track */}
                  {activeEvents.map((item) => {
                    const startX = 70 + (Math.max(0, item.startMs) / effectiveMaxTime) * 660;
                    const endX = 70 + (Math.min(effectiveMaxTime, item.endMs) / effectiveMaxTime) * 660;
                    const width = Math.max(4, endX - startX);

                    return (
                      <rect
                        key={item.id}
                        x={startX}
                        y={y + 6}
                        width={width}
                        height="18"
                        rx="2.5"
                        fill={colorForType(item.type)}
                        stroke="#101111"
                        strokeWidth="0.75"
                        style={{ filter: item.type === 'DELIVERY' ? 'drop-shadow(0 0 2px rgba(46,204,113,0.4))' : undefined }}
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
        <div className="table-wrap" style={{ maxHeight: 280 }}>
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
                    No timeline intervals match current filters.
                  </td>
                </tr>
              ) : (
                filteredIntervals.map((item) => (
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
