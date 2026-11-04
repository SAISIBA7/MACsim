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

function statusClass(status: string): string {
  return `status-${status.toLowerCase()}`;
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
        loadError: 'This simulation is unavailable. Start a new simulation or open a saved run from History.',
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
        loadError: 'The saved configuration is incomplete. Return to New Simulation and submit it again.',
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

function SimulationMetricsView({ metrics }: { metrics: SimulationMetrics }) {
  const values = [
    { label: 'Successful frames', value: formatNumber(metrics.successfulFrames), unit: '' },
    { label: 'Collision incidents', value: formatNumber(metrics.collisions), unit: '' },
    { label: 'Retransmissions', value: formatNumber(metrics.retransmissions), unit: '' },
    { label: 'Throughput', value: formatNumber(metrics.throughputBps, 1), unit: 'bps' },
    { label: 'Goodput', value: formatNumber(metrics.goodputBps, 1), unit: 'bps' },
    {
      label: 'Channel utilization',
      value: metrics.channelUtilization === undefined ? 'Not available' : formatNumber(metrics.channelUtilization * 100, 1),
      unit: metrics.channelUtilization === undefined ? '' : '%',
    },
    { label: 'Average delay', value: formatNumber(metrics.averageDelayMs, 2), unit: metrics.averageDelayMs === undefined ? '' : 'ms' },
    { label: 'Elapsed time', value: formatNumber(metrics.elapsedMs, 1), unit: 'ms' },
  ];

  return (
    <>
      <div className="metric-grid">
        {values.map(metric => (
          <div className="metric" key={metric.label} title={metric.label}>
            <span className="metric-label">{metric.label}</span>
            <strong className="metric-value">
              {metric.value}
              {metric.unit && <span className="metric-unit">{metric.unit}</span>}
            </strong>
          </div>
        ))}
      </div>
      <details className="metric-definitions">
        <summary>Metric definitions</summary>
        <dl className="definition-list">
          <dt>Throughput</dt><dd>Successfully delivered frame bits divided by elapsed simulation time.</dd>
          <dt>Goodput</dt><dd>Delivered payload bits divided by elapsed simulation time. This model has no headers, so it matches throughput.</dd>
          <dt>Channel utilization</dt><dd>Fraction of elapsed time during which at least one frame occupied the shared medium.</dd>
          <dt>Average delay</dt><dd>Mean time from frame generation to successful delivery. Unavailable until a frame is delivered.</dd>
        </dl>
      </details>
    </>
  );
}

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
  const [eventLimit, setEventLimit] = useState(100);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!engine) return;
    const unsubscribe = engine.subscribe(current => {
        setStations(current.stations.map(station => ({ ...station })));
        setMetrics({ ...current.metrics });
        setStatus(
          current.completed ? 'Completed' :
            current.running ? 'Running' :
              hasStarted.current ? 'Paused' : 'Ready',
        );
    });
    hasStarted.current = true;
    engine.start();
    return () => {
      unsubscribe();
      engine.destroy();
    };
  }, [engine]);

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
        <header className="page-header"><div><h1>Simulation unavailable</h1></div></header>
        <div className="error-message" role="alert">{loadError}</div>
        <p><Link to="/simulations/new">Configure a new simulation</Link></p>
      </div>
    );
  }
  if (!config) return <p role="status">Loading simulation configuration…</p>;

  const events = savedRun?.events ?? engine?.events ?? [];
  const activeStation = selectedStationId ? stations.find(station => station.stationId === selectedStationId) : undefined;
  const visibleEvents = events.slice(Math.max(0, events.length - eventLimit));

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>{savedRun ? 'Completed simulation' : 'Live simulation'}</h1>
          <p>{formatProtocol(config.protocol)} · {config.stationCount} stations · {config.durationMs.toLocaleString()} ms configured duration</p>
        </div>
        <span className={`run-status ${statusClass(status)}`} aria-live="polite">{status}</span>
      </header>

      <section className="simulation-toolbar" aria-label="Simulation controls">
        <div className="button-row">
          <button className="btn primary" type="button" disabled={!engine || status === 'Running' || status === 'Completed'} onClick={() => {
            if (!engine) return;
            hasStarted.current = true;
            runEngineAction(() => engine.start());
          }}>Start</button>
          <button className="btn" type="button" disabled={!engine || status !== 'Running'} onClick={() => {
            if (!engine) return;
            hasStarted.current = true;
            runEngineAction(() => engine.pause());
          }}>Pause</button>
          <button className="btn" type="button" disabled={!engine || status !== 'Paused'} onClick={() => {
            if (!engine) return;
            hasStarted.current = true;
            runEngineAction(() => engine.resume());
          }}>Resume</button>
          <button className="btn" type="button" disabled={!engine || status === 'Running' || status === 'Completed'} onClick={() => {
            if (!engine) return;
            hasStarted.current = true;
            runEngineAction(() => engine.step());
          }}>Step one time increment</button>
          <button className="btn" type="button" disabled={!engine} onClick={() => {
            if (!engine) return;
            hasStarted.current = false;
            runEngineAction(() => engine.reset());
            setStatus('Ready');
            setIsSaved(false);
          }}>Reset</button>
          {status === 'Completed' && (
            <button className="btn" type="button" disabled={isSaved} onClick={saveCompletedRun}>
              {isSaved ? 'Run saved' : 'Save completed run'}
            </button>
          )}
        </div>
        <div className="field speed-control">
          <label htmlFor="playback-speed">Playback speed</label>
          <select id="playback-speed" value={speed} disabled={!engine || status === 'Completed'} onChange={event => {
            const nextSpeed = Number(event.target.value);
            setSpeed(nextSpeed);
            if (engine) runEngineAction(() => engine.setPlaybackSpeed(nextSpeed));
          }}>
            <option value="0.25">0.25×</option>
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="2">2×</option>
            <option value="4">4×</option>
          </select>
        </div>
      </section>

      {saveError && <p className="error-message" role="alert">{saveError}</p>}
      <p className="help-text">
        Step advances one simulation time increment
        {engine ? ` (${formatNumber(engine.tickDurationMs, 3)} ms)` : ''}. Playback speed changes only how quickly increments are displayed.
      </p>

      <div className="simulation-layout">
        <div className="simulation-main">
          <section className="panel" aria-labelledby="topology-heading">
            <h2 id="topology-heading">Network topology</h2>
            <p className="help-text">Select a station to inspect its current state and recent activity.</p>
            <div className="topology-scroll" tabIndex={0} aria-label="Scrollable shared-medium topology">
              <div className="medium-line">
                {stations.map(station => (
                  <div className="medium-track" key={`${station.stationId}-link`} aria-hidden="true" />
                ))}
                <div className="medium-label">
                  Shared communication channel
                  <div className="help-text">
                    {stations.some(station => station.status === 'TRANSMITTING' || station.status === 'COLLISION')
                      ? 'Frame activity observed'
                      : 'No active frame'}
                  </div>
                </div>
              </div>
              <div className="station-grid">
                {stations.map(station => (
                  <button
                    className={`station${selectedStationId === station.stationId ? ' selected' : ''}`}
                    type="button"
                    key={station.stationId}
                    aria-pressed={selectedStationId === station.stationId}
                    onClick={() => setSelectedStationId(station.stationId)}
                  >
                    <span className="station-topline">
                      <strong>{station.stationId}</strong>
                      <span className={`station-state ${statusClass(formatStatus(station.status))}`}>
                        {formatStatus(station.status)}
                      </span>
                    </span>
                    <span className="station-meta">
                      <span>Queue {station.queueLength ?? 0}</span>
                      <span>Retries {station.retryCount ?? 0}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {activeStation && (
              <div className="station-details" aria-live="polite">
                <div className="station-detail"><span>Selected station</span><strong>{activeStation.stationId}</strong></div>
                <div className="station-detail"><span>Current frame</span><strong>{activeStation.currentFrameId ?? 'None'}</strong></div>
                <div className="station-detail"><span>Backoff remaining</span><strong>{formatNumber(activeStation.backoffRemaining, 1)} ms</strong></div>
              </div>
            )}
          </section>

          <section className="panel" aria-labelledby="event-heading">
            <div className="table-toolbar">
              <h2 id="event-heading">Event history</h2>
              <span className="muted">{events.length.toLocaleString()} events</span>
            </div>
            {events.length === 0 ? (
              <p className="muted">No events yet. Generated frames and channel activity will appear here in simulation-time order.</p>
            ) : (
              <>
                {events.length > eventLimit && (
                  <button className="btn" type="button" onClick={() => setEventLimit(limit => limit + 100)}>
                    Show earlier events
                  </button>
                )}
                <div className="event-list" role="log" aria-label="Simulation events in chronological order" aria-live="off">
                  {visibleEvents.map(event => (
                    <article className="event-row" key={event.eventId}>
                      <time className="event-time">{formatNumber(event.simulationTimeMs, 2)} ms</time>
                      <div>
                        <span className="event-type">{event.eventType}{event.frameId ? ` · ${event.frameId}` : ''}</span>
                        <p className="event-message">{event.message}</p>
                      </div>
                    </article>
                  ))}
                </div>
                <p className="sr-only" aria-live="polite">{events.at(-1)?.message ?? ''}</p>
              </>
            )}
          </section>
        </div>

        <aside className="simulation-aside">
          <section className="panel" aria-labelledby="config-heading">
            <h2 id="config-heading">Run configuration</h2>
            <dl className="summary-list">
              <dt>Protocol</dt><dd>{formatProtocol(config.protocol)}</dd>
              <dt>Stations</dt><dd>{config.stationCount}</dd>
              <dt>Frame size</dt><dd>{config.frameSizeBytes.toLocaleString()} bytes</dd>
              <dt>Data rate</dt><dd>{config.dataRateBps.toLocaleString()} bps</dd>
              <dt>Duration</dt><dd>{config.durationMs.toLocaleString()} ms</dd>
              <dt>Traffic model</dt><dd>{config.trafficModel === 'poisson' ? 'Poisson arrivals' : 'Uniform intervals'}</dd>
              <dt>Seed</dt><dd className="mono">{config.randomSeed ?? 'Not recorded'}</dd>
            </dl>
          </section>
          <section className="panel" aria-labelledby="metrics-heading">
            <h2 id="metrics-heading">Measured metrics</h2>
            <SimulationMetricsView metrics={metrics} />
          </section>
          {savedRun && (
            <p className="help-text">Saved locally in this browser. Created {new Date(savedRun.createdAt).toLocaleString()}.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
