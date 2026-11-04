import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SimulationEngine } from '../engine/SimulationEngine';
import { getRun, saveRun, type RunRecord } from '../store/runs';
import type {
  SimulationConfig,
  SimulationMetrics,
  SimulationRunStatus,
  StationSnapshot,
} from '../types';
import { formatNumber, formatProtocol, formatStatus } from '../utils/format';
import { SimulationTimeline } from '../components/SimulationTimeline';
import { PauseIcon, PlayIcon, ResetIcon, SaveIcon, StepIcon } from '../components/Icons';

const initialMetrics: SimulationMetrics = {
  successfulFrames: 0,
  collisions: 0,
  retransmissions: 0,
  channelUtilization: 0,
  elapsedMs: 0,
};

function isSimulationConfig(value: unknown): value is SimulationConfig {
  if (typeof value !== 'object' || value === null) return false;
  const config = value as Partial<SimulationConfig>;
  return (
    typeof config.protocol === 'string' &&
    typeof config.stationCount === 'number' &&
    typeof config.frameSizeBytes === 'number' &&
    typeof config.dataRateBps === 'number' &&
    typeof config.durationMs === 'number' &&
    typeof config.trafficModel === 'string'
  );
}

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

interface InitialSimulation {
  engine: SimulationEngine | null;
  savedRun: RunRecord | null;
  config: SimulationConfig | null;
  stations: StationSnapshot[];
  metrics: SimulationMetrics;
  status: SimulationRunStatus;
  loadError: string;
  isSaved: boolean;
}

function loadSimulation(id: string): InitialSimulation {
  try {
    const savedRun = getRun(id);
    if (savedRun) {
      return {
        engine: null,
        savedRun,
        config: savedRun.config,
        stations: savedRun.stations,
        metrics: savedRun.metrics,
        status: 'Completed',
        loadError: '',
        isSaved: true,
      };
    }

    const rawConfig = sessionStorage.getItem(`macsim_pending_${id}`);
    if (!rawConfig) {
      return {
        engine: null,
        savedRun: null,
        config: null,
        stations: [],
        metrics: initialMetrics,
        status: 'Ready',
        loadError: 'This simulation is unavailable. Configure a new simulation or open a saved run from History.',
        isSaved: false,
      };
    }
    const parsedConfig: unknown = JSON.parse(rawConfig);
    if (!isSimulationConfig(parsedConfig)) {
      return {
        engine: null,
        savedRun: null,
        config: null,
        stations: [],
        metrics: initialMetrics,
        status: 'Ready',
        loadError: 'The simulation configuration is incomplete. Return to New Simulation and configure again.',
        isSaved: false,
      };
    }

    const engine = new SimulationEngine(parsedConfig);
    return {
      engine,
      savedRun: null,
      config: engine.config,
      stations: engine.stations.map(station => ({ ...station })),
      metrics: { ...engine.metrics },
      status: 'Ready',
      loadError: '',
      isSaved: false,
    };
  } catch (reason) {
    return {
      engine: null,
      savedRun: null,
      config: null,
      stations: [],
      metrics: initialMetrics,
      status: 'Error',
      loadError: reason instanceof Error ? reason.message : 'The simulation could not be loaded.',
      isSaved: false,
    };
  }
}

type TabType = 'events' | 'timeline' | 'stations' | 'metrics';

export default function SimRun({ runId }: { runId: string }) {
  const [initial] = useState(() => loadSimulation(runId));
  const [engine] = useState(initial.engine);
  const [savedRun, setSavedRun] = useState(initial.savedRun);
  const [config] = useState(initial.config);
  const [stations, setStations] = useState(initial.stations);
  const [metrics, setMetrics] = useState(initial.metrics);
  const [status, setStatus] = useState<SimulationRunStatus>(initial.status);
  const loadError = initial.loadError;
  const [saveError, setSaveError] = useState('');
  const [isSaved, setIsSaved] = useState(initial.isSaved);
  const [speed, setSpeed] = useState(1);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('events');
  const [autoScroll, setAutoScroll] = useState(true);
  const eventListRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!engine) return;
    const unsubscribe = engine.subscribe(current => {
      setStations(current.stations.map(station => ({ ...station })));
      setMetrics({ ...current.metrics });
      setStatus(
        current.completed
          ? 'Completed'
          : current.running
            ? 'Running'
            : hasStarted.current
              ? 'Paused'
              : 'Ready',
      );
    });
    hasStarted.current = true;
    engine.start();
    return () => {
      unsubscribe();
      engine.destroy();
    };
  }, [engine]);

  useEffect(() => {
    if (autoScroll && eventListRef.current) {
      eventListRef.current.scrollTop = eventListRef.current.scrollHeight;
    }
  }, [metrics.elapsedMs, autoScroll]);

  const runEngineAction = (action: () => void) => {
    try {
      action();
      setSaveError('');
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'The simulation action could not be completed.');
    }
  };

  const saveCompletedRun = () => {
    if (!engine || !config || !engine.completed) return;
    try {
      const record: RunRecord = {
        id: runId,
        config: engine.config,
        metrics: { ...engine.metrics },
        createdAt: new Date().toISOString(),
        events: [...engine.events],
        stations: engine.stations.map(station => ({ ...station })),
      };
      saveRun(record);
      setSavedRun(record);
      setIsSaved(true);
      setSaveError('');
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'The completed run could not be saved.');
    }
  };

  if (loadError) {
    return (
      <div>
        <header className="page-header">
          <div>
            <h1>Simulation Unavailable</h1>
          </div>
        </header>
        <div className="error-message" role="alert">{loadError}</div>
        <p style={{ marginTop: 16 }}>
          <Link className="btn primary" to="/simulations/new">
            Configure a New Simulation
          </Link>
        </p>
      </div>
    );
  }

  if (!config) return <p role="status">Loading simulation configuration...</p>;

  const events = savedRun?.events ?? engine?.events ?? [];
  const activeStation = selectedStationId
    ? stations.find(s => s.stationId === selectedStationId)
    : undefined;
  const isTransmittingOnChannel = stations.some(
    s => s.status === 'TRANSMITTING' || s.status === 'COLLISION',
  );
  const isCollisionOnChannel = stations.some(s => s.status === 'COLLISION');

  return (
    <div className="sim-run-workspace">
      {/* Top Header & Simulation Identity */}
      <header className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>
              {savedRun ? 'Simulation Results' : 'Live Simulation'}
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
              disabled={!engine}
              onClick={() => {
                if (!engine) return;
                runEngineAction(() => engine.pause());
              }}
            >
              <PauseIcon />
              Pause
            </button>
          ) : (
            <button
              className="btn primary"
              type="button"
              disabled={!engine || status === 'Completed'}
              onClick={() => {
                if (!engine) return;
                hasStarted.current = true;
                runEngineAction(() => engine.start());
              }}
            >
              <PlayIcon />
              {status === 'Paused' ? 'Resume' : 'Start'}
            </button>
          )}

          <button
            className="btn"
            type="button"
            disabled={!engine || status === 'Running' || status === 'Completed'}
            onClick={() => {
              if (!engine) return;
              hasStarted.current = true;
              runEngineAction(() => engine.step());
            }}
          >
            <StepIcon />
            Step ({engine ? formatNumber(engine.tickDurationMs, 2) : '0.1'} ms)
          </button>

          <button
            className="btn"
            type="button"
            disabled={!engine}
            onClick={() => {
              if (!engine) return;
              hasStarted.current = false;
              runEngineAction(() => engine.reset());
              setStatus('Ready');
              setIsSaved(false);
            }}
          >
            <ResetIcon />
            Reset
          </button>

          {status === 'Completed' && (
            <button
              className="btn"
              type="button"
              disabled={isSaved}
              onClick={saveCompletedRun}
              style={{ borderColor: '#DDB487', color: isSaved ? '#928A7F' : '#DDB487' }}
            >
              <SaveIcon />
              {isSaved ? 'Run Saved Locally' : 'Save Completed Run'}
            </button>
          )}
        </div>

        <div className="toolbar-controls-right">
          <div className="speed-selector-group">
            <label htmlFor="playback-speed" style={{ fontSize: 12 }}>
              Playback Speed:
            </label>
            <select
              id="playback-speed"
              value={speed}
              disabled={!engine || status === 'Completed'}
              onChange={event => {
                const nextSpeed = Number(event.target.value);
                setSpeed(nextSpeed);
                if (engine) runEngineAction(() => engine.setPlaybackSpeed(nextSpeed));
              }}
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

      {saveError && <div className="error-message" role="alert">{saveError}</div>}

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
                <div className={`bus-channel-bar${isCollisionOnChannel ? ' collision' : isTransmittingOnChannel ? ' active' : ''}`}>
                  <span className="bus-terminator left">50Ω</span>
                  <span className="bus-title-text mono">SHARED TRANSMISSION MEDIUM</span>
                  <span className="bus-terminator right">50Ω</span>
                </div>

                {/* Stations Grid with Tap Lines */}
                <div className="station-tap-grid">
                  {stations.map(station => {
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
                    Sequential simulation events ordered by virtual timestamp.
                  </span>
                  <label className="checkbox-label" style={{ fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={autoScroll}
                      onChange={e => setAutoScroll(e.target.checked)}
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
                    {events.map(ev => {
                      let tagColor = '#928A7F';
                      if (ev.eventType.includes('Collision')) tagColor = '#D96A62';
                      else if (ev.eventType.includes('delivered')) tagColor = '#78B978';
                      else if (ev.eventType.includes('Transmission') || ev.eventType.includes('Retransmission'))
                        tagColor = '#78A9E8';
                      else if (ev.eventType.includes('Backoff') || ev.eventType.includes('busy'))
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
                              [{ev.eventType.toUpperCase()}]
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
                  stationIds={stations.map(s => s.stationId)}
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
                      {stations.map(station => (
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
                    Total collision events detected when two or more transmissions overlapped on the shared medium.
                  </dd>

                  <dt>Retransmissions</dt>
                  <dd>Total repeat transmission attempts initiated after collision-induced backoff periods.</dd>

                  <dt>Throughput (bps)</dt>
                  <dd>
                    Gross delivered payload data bits divided by total elapsed simulation time (bits/sec).
                  </dd>

                  <dt>Channel Utilization</dt>
                  <dd>
                    Ratio of active channel transmission ticks to total elapsed ticks. Indicates efficiency of medium usage.
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
