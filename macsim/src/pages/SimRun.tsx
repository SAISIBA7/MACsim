import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getRun, type RunRecord } from '../store/runs';
import type {
  SimulationConfig,
  SimulationMetrics,
  SimulationRunStatus,
  StationSnapshot,
  SimulationEvent,
  MediumSnapshot,
} from '../types';
import { formatNumber, formatProtocol, formatStatus } from '../utils/format';
import { SimulationTimeline } from '../components/SimulationTimeline';
import { PauseIcon, PlayIcon, ResetIcon, StepIcon } from '../components/Icons';
import {
  getSimulation,
  startSimulation,
  pauseSimulation,
  resumeSimulation,
  stepSimulation,
  resetSimulation,
} from '../api/simulations';
import { subscribeToSimulationStream, getSimulationEvents } from '../api/events';
import { HttpResponseError, NetworkError } from '../api/client';

const initialMetrics: SimulationMetrics = {
  successfulFrames: 0,
  collisions: 0,
  retransmissions: 0,
  channelUtilization: 0,
  elapsedMs: 0,
};

const initialMedium: MediumSnapshot = {
  status: 'IDLE',
  activeFrameIds: [],
  activeStations: [],
  inCollision: false,
};

function statusColor(status: SimulationRunStatus): string {
  switch (status) {
    case 'Running':
      return '#78A9E8';
    case 'Paused':
      return '#D5A45D';
    case 'Completed':
      return '#78B978';
    case 'Error':
      return '#D96A62';
    default:
      return '#928A7F';
  }
}

type TabType = 'events' | 'timeline' | 'stations' | 'metrics';

export default function SimRun({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionPending, setActionPending] = useState(false);

  const [config, setConfig] = useState<SimulationConfig | null>(null);
  const [stations, setStations] = useState<StationSnapshot[]>([]);
  const [metrics, setMetrics] = useState<SimulationMetrics>(initialMetrics);
  const [status, setStatus] = useState<SimulationRunStatus>('Ready');
  const [medium, setMedium] = useState<MediumSnapshot>(initialMedium);
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [sseConnected, setSseConnected] = useState(false);

  // Inspection & UI state
  const [speed, setSpeed] = useState(1);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('events');
  const [autoScroll, setAutoScroll] = useState(true);
  const eventListRef = useRef<HTMLDivElement>(null);
  const lastSequenceRef = useRef<number>(0);
  const unsubscribeStreamRef = useRef<(() => void) | null>(null);

  // Load authoritative simulation from backend
  const loadAuthoritativeSimulation = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setActionError('');

    try {
      const snapshot = await getSimulation(runId);
      setConfig(snapshot.configuration);
      setStations(snapshot.stations || []);
      setMetrics(snapshot.metrics || initialMetrics);
      setStatus(snapshot.status || 'Ready');
      if (snapshot.medium) {
        setMedium(snapshot.medium);
      }

      // Fetch any past events already recorded on backend
      try {
        const pastEvents = await getSimulationEvents(runId, { limit: 500 });
        if (Array.isArray(pastEvents) && pastEvents.length > 0) {
          setEvents(pastEvents);
          const maxSeq = pastEvents.reduce(
            (max, e) => Math.max(max, e.sequenceNumber ?? e.sequence_number ?? 0),
            0,
          );
          lastSequenceRef.current = maxSeq;
        }
      } catch {
        // Non-fatal, live stream will catch up
      }

      setLoading(false);
    } catch (err: unknown) {
      // Check if it exists in local storage (backward compatibility for previously saved runs)
      const localRun: RunRecord | undefined = getRun(runId);
      if (localRun) {
        setConfig(localRun.config);
        setStations(localRun.stations || []);
        setMetrics(localRun.metrics || initialMetrics);
        setStatus('Completed');
        setEvents(localRun.events || []);
        setLoading(false);
        return;
      }

      if (err instanceof HttpResponseError && err.statusCode === 404) {
        setLoadError(
          `Simulation "${runId}" was not found on the server. Configure a new simulation or select a saved run from History.`,
        );
      } else if (err instanceof NetworkError) {
        setLoadError(err.message);
      } else {
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Unable to load simulation from backend server.',
        );
      }
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    loadAuthoritativeSimulation();
  }, [loadAuthoritativeSimulation]);

  // Connect Server-Sent Events stream
  useEffect(() => {
    if (loading || loadError) return;

    const cleanup = subscribeToSimulationStream(
      runId,
      {
        onOpen: () => {
          setSseConnected(true);
        },
        onError: () => {
          setSseConnected(false);
        },
        onSnapshot: (snapshot) => {
          if (snapshot.status) setStatus(snapshot.status);
          if (snapshot.stations) setStations(snapshot.stations);
          if (snapshot.metrics) setMetrics(snapshot.metrics);
          if (snapshot.medium) setMedium(snapshot.medium);
        },
        onEvent: (event) => {
          const seq = event.sequenceNumber ?? event.sequence_number ?? 0;
          if (seq > 0 && seq <= lastSequenceRef.current) {
            // Duplicate event, skip
            return;
          }
          if (seq > 0) {
            lastSequenceRef.current = seq;
          }

          setEvents((prev) => {
            // Prevent duplicate event IDs
            if (prev.some((e) => e.eventId === event.eventId)) return prev;
            return [...prev, event];
          });

          // Update real-time station & channel state from authoritative events
          const payload = event.payload || {};
          const eventType = event.eventType;

          if (eventType === 'SIMULATION_STARTED') {
            setStatus('Running');
          } else if (eventType === 'SIMULATION_PAUSED') {
            setStatus('Paused');
          } else if (eventType === 'SIMULATION_RESUMED') {
            setStatus('Running');
          } else if (eventType === 'SIMULATION_COMPLETED') {
            setStatus('Completed');
            setMedium({
              status: 'IDLE',
              activeFrameIds: [],
              activeStations: [],
              inCollision: false,
            });
          } else if (eventType === 'SIMULATION_RESET') {
            setStatus('Ready');
            setEvents([]);
            lastSequenceRef.current = 0;
            setMedium(initialMedium);
          } else if (eventType === 'METRICS_UPDATED' && payload.metrics) {
            setMetrics(payload.metrics as SimulationMetrics);
          } else if (eventType === 'TRANSMISSION_STARTED') {
            const stId = event.stationIds?.[0];
            if (stId) {
              setStations((prev) =>
                prev.map((s) =>
                  s.stationId === stId
                    ? { ...s, status: 'TRANSMITTING', currentFrameId: event.frameId ?? s.currentFrameId }
                    : s,
                ),
              );
              setMedium((prev) => ({
                status: prev.status === 'COLLISION' ? 'COLLISION' : 'BUSY',
                activeStations: Array.from(new Set([...prev.activeStations, stId])),
                activeFrameIds: event.frameId
                  ? Array.from(new Set([...prev.activeFrameIds, event.frameId]))
                  : prev.activeFrameIds,
                inCollision: prev.inCollision,
              }));
            }
          } else if (eventType === 'COLLISION_DETECTED') {
            const affectedStations = event.stationIds || [];
            setStations((prev) =>
              prev.map((s) =>
                affectedStations.includes(s.stationId)
                  ? { ...s, status: 'COLLISION' }
                  : s,
              ),
            );
            setMedium((prev) => ({
              ...prev,
              status: 'COLLISION',
              inCollision: true,
            }));
          } else if (eventType === 'BACKOFF_STARTED') {
            const stId = event.stationIds?.[0];
            const delayUs = Number((payload as Record<string, unknown>).delayUs ?? 0);
            if (stId) {
              setStations((prev) =>
                prev.map((s) =>
                  s.stationId === stId
                    ? { ...s, status: 'BACKOFF', backoffRemaining: delayUs / 1000 }
                    : s,
                ),
              );
            }
          } else if (eventType === 'TRANSMISSION_COMPLETED' || eventType === 'FRAME_DELIVERED') {
            const stId = event.stationIds?.[0];
            if (stId) {
              setStations((prev) =>
                prev.map((s) =>
                  s.stationId === stId
                    ? { ...s, status: 'IDLE', currentFrameId: undefined }
                    : s,
                ),
              );
            }
          } else if (eventType === 'STATION_STATE_CHANGED' && payload.state) {
            const stId = event.stationIds?.[0];
            if (stId) {
              setStations((prev) =>
                prev.map((s) =>
                  s.stationId === stId
                    ? { ...s, status: payload.state as StationSnapshot['status'] }
                    : s,
                ),
              );
            }
          } else if (eventType === 'MEDIUM_STATE_CHANGED' && payload.status) {
            const medStatus = String(payload.status).toUpperCase();
            setMedium((prev) => ({
              ...prev,
              status: medStatus === 'COLLISION' ? 'COLLISION' : medStatus === 'BUSY' ? 'BUSY' : 'IDLE',
              inCollision: medStatus === 'COLLISION',
            }));
          }
        },
      },
      { afterSequence: lastSequenceRef.current },
    );

    unsubscribeStreamRef.current = cleanup;

    return () => {
      cleanup();
      unsubscribeStreamRef.current = null;
    };
  }, [runId, loading, loadError]);

  // Auto-scroll event log
  useEffect(() => {
    if (autoScroll && eventListRef.current) {
      eventListRef.current.scrollTop = eventListRef.current.scrollHeight;
    }
  }, [events.length, autoScroll]);

  // Simulation Control Handlers
  const handleStart = async () => {
    if (actionPending) return;
    setActionPending(true);
    setActionError('');
    try {
      const updated = await startSimulation(runId);
      setStatus(updated.status);
      if (updated.stations) setStations(updated.stations);
      if (updated.metrics) setMetrics(updated.metrics);
      if (updated.medium) setMedium(updated.medium);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to start simulation',
      );
    } finally {
      setActionPending(false);
    }
  };

  const handlePause = async () => {
    if (actionPending) return;
    setActionPending(true);
    setActionError('');
    try {
      const updated = await pauseSimulation(runId);
      setStatus(updated.status);
      if (updated.stations) setStations(updated.stations);
      if (updated.metrics) setMetrics(updated.metrics);
      if (updated.medium) setMedium(updated.medium);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to pause simulation',
      );
    } finally {
      setActionPending(false);
    }
  };

  const handleResume = async () => {
    if (actionPending) return;
    setActionPending(true);
    setActionError('');
    try {
      const updated = await resumeSimulation(runId);
      setStatus(updated.status);
      if (updated.stations) setStations(updated.stations);
      if (updated.metrics) setMetrics(updated.metrics);
      if (updated.medium) setMedium(updated.medium);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to resume simulation',
      );
    } finally {
      setActionPending(false);
    }
  };

  const handleStep = async () => {
    if (actionPending) return;
    setActionPending(true);
    setActionError('');
    try {
      const updated = await stepSimulation(runId, 1);
      setStatus(updated.status);
      if (updated.stations) setStations(updated.stations);
      if (updated.metrics) setMetrics(updated.metrics);
      if (updated.medium) setMedium(updated.medium);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to step simulation',
      );
    } finally {
      setActionPending(false);
    }
  };

  const handleReset = async () => {
    if (actionPending) return;
    setActionPending(true);
    setActionError('');
    try {
      const updated = await resetSimulation(runId);
      setStatus(updated.status);
      if (updated.stations) setStations(updated.stations);
      if (updated.metrics) setMetrics(updated.metrics);
      if (updated.medium) setMedium(updated.medium);
      setEvents([]);
      lastSequenceRef.current = 0;
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to reset simulation',
      );
    } finally {
      setActionPending(false);
    }
  };

  if (loading) {
    return (
      <div className="sim-run-workspace">
        <header className="page-header">
          <div>
            <h1>Loading Simulation Workspace...</h1>
            <p className="mono">ID: {runId}</p>
          </div>
        </header>
        <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
          <p className="muted">Connecting to backend simulation authority...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <header className="page-header">
          <div>
            <h1>Simulation Unavailable</h1>
          </div>
        </header>
        <div className="error-message" role="alert">{loadError}</div>
        <p style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          <button className="btn" type="button" onClick={loadAuthoritativeSimulation}>
            Retry Connection
          </button>
          <Link className="btn primary" to="/simulations/new">
            Configure a New Simulation
          </Link>
        </p>
      </div>
    );
  }

  if (!config) return <p role="status">Loading simulation configuration...</p>;

  const activeStation = selectedStationId
    ? stations.find((s) => s.stationId === selectedStationId)
    : undefined;

  const isCollisionOnChannel =
    medium.status === 'COLLISION' ||
    stations.some((s) => s.status === 'COLLISION');

  const isTransmittingOnChannel =
    medium.status === 'BUSY' ||
    stations.some((s) => s.status === 'TRANSMITTING' || s.status === 'COLLISION');

  return (
    <div className="sim-run-workspace">
      {/* Top Header & Simulation Identity */}
      <header className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>
              {status === 'Completed' ? 'Simulation Results' : 'Live Simulation'}
            </h1>
            <span className="mono" style={{ color: '#928A7F', fontSize: 13 }}>
              {runId.slice(0, 8)}
            </span>
            <span
              className="status-pill"
              style={{
                borderColor: statusColor(status),
                color: statusColor(status),
              }}
              aria-live="polite"
            >
              {status.toUpperCase()}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: sseConnected ? '#78B978' : '#928A7F',
                border: '1px solid currentColor',
                padding: '2px 6px',
              }}
              title={sseConnected ? 'Real-time Server-Sent Events connected' : 'Connecting stream...'}
            >
              {sseConnected ? 'LIVE STREAM' : 'OFFLINE'}
            </span>
          </div>
          <p style={{ margin: 0 }}>
            <strong>{formatProtocol(config.protocol)}</strong> · {config.stationCount} Stations ·{' '}
            {config.durationMs.toLocaleString()} ms limit · {(config.dataRateBps / 1000).toLocaleString()} kbps
          </p>
        </div>

        {/* Big Simulation Clock */}
        <div className="sim-clock-display" aria-label="Simulation elapsed time">
          <span className="clock-label">SIMULATION TIME</span>
          <span className="clock-value mono">
            {formatNumber(metrics.elapsedMs, 1)} <span className="clock-unit">/ {config.durationMs} ms</span>
          </span>
        </div>
      </header>

      {/* Control Toolbar */}
      <section className="simulation-toolbar" aria-label="Simulation controls">
        <div className="button-row">
          {status === 'Running' ? (
            <button
              className="btn"
              type="button"
              disabled={actionPending}
              onClick={handlePause}
            >
              <PauseIcon />
              Pause
            </button>
          ) : status === 'Paused' ? (
            <button
              className="btn primary"
              type="button"
              disabled={actionPending}
              onClick={handleResume}
            >
              <PlayIcon />
              Resume
            </button>
          ) : (
            <button
              className="btn primary"
              type="button"
              disabled={actionPending || status === 'Completed'}
              onClick={handleStart}
            >
              <PlayIcon />
              Start
            </button>
          )}

          <button
            className="btn"
            type="button"
            disabled={actionPending || status === 'Running' || status === 'Completed'}
            onClick={handleStep}
          >
            <StepIcon />
            Step
          </button>

          <button
            className="btn"
            type="button"
            disabled={actionPending}
            onClick={handleReset}
          >
            <ResetIcon />
            Reset
          </button>
        </div>

        <div className="toolbar-controls-right">
          <div className="speed-selector-group">
            <label htmlFor="playback-speed" style={{ fontSize: 12 }}>
              Playback Speed:
            </label>
            <select
              id="playback-speed"
              value={speed}
              disabled={status === 'Completed'}
              onChange={(event) => setSpeed(Number(event.target.value))}
              style={{ width: 'auto', minHeight: 30, padding: '2px 8px' }}
            >
              <option value="0.25">0.25x</option>
              <option value="0.5">0.5x</option>
              <option value="1">1.0x (Normal)</option>
              <option value="2">2.0x (Fast)</option>
              <option value="4">4.0x (Max)</option>
            </select>
          </div>
        </div>
      </section>

      {actionError && <div className="error-message" role="alert">{actionError}</div>}

      {/* Main Simulation Layout: Topology + Details */}
      <div className="simulation-layout">
        <div className="simulation-main">
          {/* NETWORK TOPOLOGY VISUALIZATION */}
          <section className="panel" aria-labelledby="topology-heading">
            <div className="topology-header">
              <h2 id="topology-heading" style={{ fontSize: 15, margin: 0 }}>
                Shared Medium Topology
              </h2>
              <span className="channel-activity-indicator mono" style={{ fontSize: 12 }}>
                Medium Status:{' '}
                {isCollisionOnChannel ? (
                  <strong style={{ color: '#D96A62' }}>COLLISION DETECTED</strong>
                ) : isTransmittingOnChannel ? (
                  <strong style={{ color: '#78A9E8' }}>BUSY (TRANSMITTING)</strong>
                ) : (
                  <span style={{ color: '#78B978' }}>IDLE</span>
                )}
              </span>
            </div>

            {/* Topology Shared Bus Visualizer */}
            <div className="topology-scroll" tabIndex={0} aria-label="Shared bus medium and connected station nodes">
              <div className="bus-visualizer">
                {/* Horizontal Shared Bus Backbone */}
                <div
                  className={`bus-channel-bar${isCollisionOnChannel ? ' collision' : isTransmittingOnChannel ? ' active' : ''}`}
                >
                  <span className="bus-terminator left">50Ω</span>
                  <span className="bus-title-text mono">SHARED TRANSMISSION MEDIUM</span>
                  <span className="bus-terminator right">50Ω</span>
                </div>

                {/* Stations Grid with Tap Lines */}
                <div className="station-tap-grid">
                  {stations.map((station) => {
                    const isSelected = selectedStationId === station.stationId;
                    const isTx = station.status === 'TRANSMITTING';
                    const isColl = station.status === 'COLLISION';
                    const isBackoff = station.status === 'BACKOFF';
                    const isSensing = station.status === 'SENSING';

                    let statusClassStr = 'status-idle';
                    if (isTx) statusClassStr = 'status-transmitting';
                    else if (isColl) statusClassStr = 'status-collision';
                    else if (isBackoff) statusClassStr = 'status-backoff';
                    else if (isSensing) statusClassStr = 'status-sensing';
                    else if (station.status === 'SUCCESSFUL') statusClassStr = 'status-successful';

                    return (
                      <div className="station-column" key={station.stationId}>
                        {/* Vertical Drop Tap Line */}
                        <div
                          className={`tap-line${isColl ? ' collision' : isTx ? ' transmitting' : isSensing ? ' sensing' : ''}`}
                        />
                        <div className="tap-junction" />

                        {/* Station Node Button */}
                        <button
                          type="button"
                          className={`station-node${isSelected ? ' selected' : ''} ${statusClassStr}`}
                          onClick={() => setSelectedStationId(station.stationId)}
                          aria-pressed={isSelected}
                          aria-label={`${station.stationId}: ${formatStatus(station.status)}`}
                        >
                          <div className="station-node-header">
                            <span className="station-name mono">{station.stationId}</span>
                            <span className={`station-badge ${statusClassStr}`}>
                              {formatStatus(station.status)}
                            </span>
                          </div>

                          <div className="station-node-stats mono">
                            <span>Q: {station.queueLength ?? 0}</span>
                            <span>R: {station.retryCount ?? 0}</span>
                          </div>

                          {isBackoff && (
                            <div className="station-backoff-timer mono">
                              Wait: {formatNumber(station.backoffRemaining, 1)}ms
                            </div>
                          )}

                          {station.currentFrameId && (
                            <div className="station-frame-tag mono">
                              {station.currentFrameId}
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected Station Inspection Detail */}
            {activeStation && (
              <div className="station-inspector-banner" aria-live="polite">
                <div className="inspector-item">
                  <span className="inspector-label">INSPECTED STATION</span>
                  <strong className="mono">{activeStation.stationId}</strong>
                </div>
                <div className="inspector-item">
                  <span className="inspector-label">STATUS</span>
                  <strong className="mono">{formatStatus(activeStation.status)}</strong>
                </div>
                <div className="inspector-item">
                  <span className="inspector-label">ACTIVE FRAME</span>
                  <strong className="mono">{activeStation.currentFrameId ?? 'None'}</strong>
                </div>
                <div className="inspector-item">
                  <span className="inspector-label">QUEUE LENGTH</span>
                  <strong className="mono">{activeStation.queueLength ?? 0} frames</strong>
                </div>
                <div className="inspector-item">
                  <span className="inspector-label">RETRY COUNT</span>
                  <strong className="mono">{activeStation.retryCount ?? 0}</strong>
                </div>
                <div className="inspector-item">
                  <span className="inspector-label">BACKOFF REMAINING</span>
                  <strong className="mono">{formatNumber(activeStation.backoffRemaining, 1)} ms</strong>
                </div>
                <button
                  type="button"
                  className="btn"
                  style={{ minHeight: 24, padding: '2px 8px', fontSize: 11 }}
                  onClick={() => setSelectedStationId(null)}
                >
                  Close
                </button>
              </div>
            )}
          </section>

          {/* TABBED DETAILS / EVENT / TIMELINE PANEL */}
          <section className="panel" aria-labelledby="tabs-heading">
            <h2 id="tabs-heading" className="sr-only">Detailed Inspection Tabs</h2>
            <div className="tab-bar" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'events'}
                className={`tab-btn${activeTab === 'events' ? ' active' : ''}`}
                onClick={() => setActiveTab('events')}
              >
                Event Log ({events.length.toLocaleString()})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'timeline'}
                className={`tab-btn${activeTab === 'timeline' ? ' active' : ''}`}
                onClick={() => setActiveTab('timeline')}
              >
                Activity Timeline
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'stations'}
                className={`tab-btn${activeTab === 'stations' ? ' active' : ''}`}
                onClick={() => setActiveTab('stations')}
              >
                Station Details
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'metrics'}
                className={`tab-btn${activeTab === 'metrics' ? ' active' : ''}`}
                onClick={() => setActiveTab('metrics')}
              >
                Metric Definitions
              </button>
            </div>

            {/* TAB 1: EVENT LOG */}
            {activeTab === 'events' && (
              <div className="tab-pane">
                <div className="event-controls-row">
                  <span className="muted" style={{ fontSize: 12 }}>
                    Authoritative discrete events ordered by sequence number and virtual timestamp.
                  </span>
                  <label className="checkbox-label" style={{ fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={autoScroll}
                      onChange={(e) => setAutoScroll(e.target.checked)}
                    />
                    Auto-scroll to latest
                  </label>
                </div>

                {events.length === 0 ? (
                  <p className="muted" style={{ padding: 16 }}>
                    No events generated yet. Start or step the simulation to observe frame arrivals and transmissions.
                  </p>
                ) : (
                  <div
                    className="event-list"
                    ref={eventListRef}
                    role="log"
                    aria-label="Simulation event stream"
                    tabIndex={0}
                  >
                    {events.map((ev) => {
                      let tagColor = '#928A7F';
                      const typeStr = ev.eventType.toUpperCase();
                      if (typeStr.includes('COLLISION')) tagColor = '#D96A62';
                      else if (typeStr.includes('DELIVERED') || typeStr.includes('COMPLETED')) tagColor = '#78B978';
                      else if (typeStr.includes('TRANSMISSION') || typeStr.includes('RETRANSMISSION'))
                        tagColor = '#78A9E8';
                      else if (typeStr.includes('BACKOFF') || typeStr.includes('BUSY'))
                        tagColor = '#D5A45D';

                      return (
                        <article className="event-row" key={ev.eventId}>
                          <time className="event-time mono">
                            {formatNumber(ev.simulationTimeMs, 2)} ms
                          </time>
                          <div>
                            <span
                              className="event-type mono"
                              style={{ color: tagColor, fontWeight: 600 }}
                            >
                              [{typeStr}]
                              {ev.frameId ? ` · ${ev.frameId}` : ''}
                            </span>
                            <p className="event-message">{ev.message}</p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TIMELINE */}
            {activeTab === 'timeline' && (
              <div className="tab-pane">
                <SimulationTimeline
                  events={events}
                  durationMs={config.durationMs}
                  currentTimeMs={metrics.elapsedMs}
                  stationIds={stations.map((s) => s.stationId)}
                />
              </div>
            )}

            {/* TAB 3: STATION DETAILS */}
            {activeTab === 'stations' && (
              <div className="tab-pane">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Station</th>
                        <th scope="col">Status</th>
                        <th scope="col">Queue Length</th>
                        <th scope="col">Current Frame</th>
                        <th scope="col">Retry Count</th>
                        <th scope="col">Backoff Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stations.map((station) => (
                        <tr key={station.stationId}>
                          <td className="mono"><strong>{station.stationId}</strong></td>
                          <td>
                            <span className="mono" style={{ fontSize: 12 }}>
                              {formatStatus(station.status)}
                            </span>
                          </td>
                          <td className="numeric-cell">{station.queueLength ?? 0}</td>
                          <td className="mono">{station.currentFrameId ?? '-'}</td>
                          <td className="numeric-cell">{station.retryCount ?? 0}</td>
                          <td className="numeric-cell mono">
                            {formatNumber(station.backoffRemaining, 1)} ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: METRIC DEFINITIONS */}
            {activeTab === 'metrics' && (
              <div className="tab-pane">
                <dl className="definition-list">
                  <dt>Successful Frames</dt>
                  <dd>Total number of frames completely delivered across the channel without collision overlap.</dd>

                  <dt>Collision Incidents</dt>
                  <dd>
                    Distinct collision events that occurred on the medium when transmissions overlapped.
                  </dd>

                  <dt>Collided Attempts</dt>
                  <dd>
                    Total count of individual station transmission attempts ruined by collision overlap.
                  </dd>

                  <dt>Retransmissions</dt>
                  <dd>Total repeat transmission attempts initiated after collision backoff periods.</dd>

                  <dt>Throughput (bps)</dt>
                  <dd>
                    Delivered data bits divided by elapsed simulation time in seconds.
                  </dd>

                  <dt>Channel Utilization</dt>
                  <dd>
                    Ratio of active channel transmission time to total elapsed simulation time.
                  </dd>

                  <dt>Average Delay (ms)</dt>
                  <dd>
                    Mean time duration from initial frame generation timestamp to successful channel delivery.
                  </dd>
                </dl>
              </div>
            )}
          </section>
        </div>

        {/* Aside: Metrics & Parameters */}
        <aside className="simulation-aside">
          {/* Key Measured Performance Metrics */}
          <section className="panel" aria-labelledby="metrics-heading">
            <h2 id="metrics-heading" style={{ fontSize: 15, marginBottom: 12 }}>
              Performance Metrics
            </h2>

            <div className="metric-grid">
              <div className="metric">
                <span className="metric-label">Delivered Frames</span>
                <strong className="metric-value" style={{ color: '#78B978' }}>
                  {formatNumber(metrics.successfulFrames)}
                </strong>
              </div>

              <div className="metric">
                <span className="metric-label">Collision Incidents</span>
                <strong className="metric-value" style={{ color: '#D96A62' }}>
                  {formatNumber(metrics.collisions)}
                </strong>
              </div>

              <div className="metric">
                <span className="metric-label">Retransmissions</span>
                <strong className="metric-value" style={{ color: '#D5A45D' }}>
                  {formatNumber(metrics.retransmissions)}
                </strong>
              </div>

              <div className="metric">
                <span className="metric-label">Throughput</span>
                <strong className="metric-value" style={{ color: '#DDB487' }}>
                  {formatNumber(metrics.throughputBps, 1)}
                  <span className="metric-unit">bps</span>
                </strong>
              </div>

              <div className="metric">
                <span className="metric-label">Channel Utilization</span>
                <strong className="metric-value">
                  {metrics.channelUtilization !== undefined
                    ? formatNumber(metrics.channelUtilization * 100, 1)
                    : '0.0'}
                  <span className="metric-unit">%</span>
                </strong>
              </div>

              <div className="metric">
                <span className="metric-label">Average Delay</span>
                <strong className="metric-value">
                  {metrics.averageDelayMs !== undefined
                    ? formatNumber(metrics.averageDelayMs, 2)
                    : '-'}
                  <span className="metric-unit">ms</span>
                </strong>
              </div>
            </div>
          </section>

          {/* Configuration Summary Card */}
          <section className="panel" aria-labelledby="config-summary-heading">
            <h2 id="config-summary-heading" style={{ fontSize: 15, marginBottom: 12 }}>
              Active Configuration
            </h2>

            <dl className="summary-list">
              <dt>Protocol</dt>
              <dd><strong>{formatProtocol(config.protocol)}</strong></dd>

              <dt>Station Count</dt>
              <dd>{config.stationCount}</dd>

              <dt>Frame Size</dt>
              <dd>{config.frameSizeBytes.toLocaleString()} bytes</dd>

              <dt>Data Rate</dt>
              <dd>{(config.dataRateBps / 1000).toLocaleString()} kbps</dd>

              <dt>Duration</dt>
              <dd>{config.durationMs.toLocaleString()} ms</dd>

              <dt>Traffic Model</dt>
              <dd>{config.trafficModel === 'poisson' ? 'Poisson arrivals' : 'Uniform intervals'}</dd>

              <dt>Intensity G</dt>
              <dd>{config.trafficIntensity}</dd>

              <dt>Random Seed</dt>
              <dd className="mono">{config.randomSeed ?? 'Not recorded'}</dd>
            </dl>
          </section>

          {/* Action Links */}
          <div className="button-row">
            <Link className="btn" to="/simulations/new">
              New Simulation
            </Link>
            <Link className="btn" to="/comparisons">
              Compare Results
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
