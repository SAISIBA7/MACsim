import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getRuns, type RunRecord } from '../store/runs';
import { formatNumber, formatProtocol } from '../utils/format';
import type { Protocol } from '../types';
import { getSimulations, getSimulation } from '../api/simulations';
import { runSweep } from '../api/comparisons';

type MetricKey =
  | 'throughputBps'
  | 'collisions'
  | 'retransmissions'
  | 'channelUtilization'
  | 'averageDelayMs'
  | 'successfulFrames';

interface MetricMeta {
  key: MetricKey;
  label: string;
  unit: string;
  fractionDigits: number;
}

const metricsList: MetricMeta[] = [
  { key: 'throughputBps', label: 'Throughput', unit: 'bps', fractionDigits: 1 },
  { key: 'collisions', label: 'Collision Incidents', unit: 'events', fractionDigits: 0 },
  { key: 'retransmissions', label: 'Retransmissions', unit: 'frames', fractionDigits: 0 },
  { key: 'channelUtilization', label: 'Channel Utilization', unit: '%', fractionDigits: 1 },
  { key: 'averageDelayMs', label: 'Average Delay', unit: 'ms', fractionDigits: 2 },
  { key: 'successfulFrames', label: 'Successful Frames', unit: 'frames', fractionDigits: 0 },
];

const protocolColors: Record<Protocol, string> = {
  PURE_ALOHA: '#DDB487',
  SLOTTED_ALOHA: '#78A9E8',
  CSMA: '#78B978',
  CSMA_CD: '#D5A45D',
};

function checkMatchingConditions(runs: RunRecord[]): {
  isFair: boolean;
  differences: string[];
} {
  if (runs.length < 2) return { isFair: true, differences: [] };
  const first = runs[0].config;
  const differences: string[] = [];

  const diffStations = runs.some(r => r.config.stationCount !== first.stationCount);
  const diffFrame = runs.some(r => r.config.frameSizeBytes !== first.frameSizeBytes);
  const diffRate = runs.some(r => r.config.dataRateBps !== first.dataRateBps);
  const diffDuration = runs.some(r => r.config.durationMs !== first.durationMs);
  const diffModel = runs.some(r => r.config.trafficModel !== first.trafficModel);
  const diffIntensity = runs.some(r => r.config.trafficIntensity !== first.trafficIntensity);
  const diffSeed = runs.some(r => r.config.randomSeed !== first.randomSeed);

  if (diffStations) differences.push('Station count');
  if (diffFrame) differences.push('Frame size');
  if (diffRate) differences.push('Data rate');
  if (diffDuration) differences.push('Duration');
  if (diffModel) differences.push('Traffic model');
  if (diffIntensity) differences.push('Traffic intensity');
  if (diffSeed) differences.push('Random seed');

  return {
    isFair: differences.length === 0,
    differences,
  };
}

function generateKeyInsight(selectedRuns: RunRecord[], activeMetric: MetricKey): string {
  if (selectedRuns.length < 2) {
    return 'Select at least two simulation runs to generate comparative protocol insights.';
  }

  const { isFair, differences } = checkMatchingConditions(selectedRuns);
  if (!isFair) {
    return `Caution: The compared experiments vary in ${differences.join(', ')}. Outcome variances reflect different experimental workloads rather than protocol mechanisms alone.`;
  }

  const pureAloha = selectedRuns.find(r => r.config.protocol === 'PURE_ALOHA');
  const slottedAloha = selectedRuns.find(r => r.config.protocol === 'SLOTTED_ALOHA');
  const csma = selectedRuns.find(r => r.config.protocol === 'CSMA');
  const csmaCd = selectedRuns.find(r => r.config.protocol === 'CSMA_CD');

  if (activeMetric === 'throughputBps' && pureAloha && slottedAloha) {
    const s1 = pureAloha.metrics.throughputBps ?? 0;
    const s2 = slottedAloha.metrics.throughputBps ?? 0;
    if (s1 > 0) {
      const pct = (((s2 - s1) / s1) * 100).toFixed(1);
      return `Under matching workload, Slotted ALOHA achieved a throughput difference of ${pct}% relative to Pure ALOHA due to slot boundary synchronization halving the vulnerable interval from 2T to T.`;
    }
  }

  if (activeMetric === 'collisions' && (pureAloha || slottedAloha) && csma) {
    const alohaCol = (slottedAloha ?? pureAloha)!.metrics.collisions;
    const csmaCol = csma.metrics.collisions;
    return `Carrier sensing reduced collision incidents from ${alohaCol} in ALOHA to ${csmaCol} in CSMA by verifying channel idle state before attempting transmission.`;
  }

  if (activeMetric === 'averageDelayMs' && csmaCd && csma) {
    const cdDelay = csmaCd.metrics.averageDelayMs;
    const csDelay = csma.metrics.averageDelayMs;
    if (cdDelay !== undefined && csDelay !== undefined) {
      return `CSMA/CD recorded an average frame delivery delay of ${cdDelay.toFixed(2)} ms versus ${csDelay.toFixed(2)} ms for CSMA as collision aborting expedited queue re-arbitration.`;
    }
  }

  const sorted = [...selectedRuns].sort((a, b) => {
    const va = (a.metrics[activeMetric] as number | undefined) ?? 0;
    const vb = (b.metrics[activeMetric] as number | undefined) ?? 0;
    return vb - va;
  });

  const best = sorted[0];
  const lowest = sorted[sorted.length - 1];
  const bestVal = (best.metrics[activeMetric] as number | undefined) ?? 0;
  const lowestVal = (lowest.metrics[activeMetric] as number | undefined) ?? 0;

  return `Across the ${selectedRuns.length} matching runs, ${formatProtocol(best.config.protocol)} recorded the highest ${activeMetric} (${formatNumber(bestVal, 1)}), compared to ${formatProtocol(lowest.config.protocol)} (${formatNumber(lowestVal, 1)}).`;
}

export default function Comparisons() {
  const [searchParams] = useSearchParams();
  const requestedIds = searchParams.get('ids')?.split(',').filter(Boolean);

  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeMetricKey, setActiveMetricKey] = useState<MetricKey>('throughputBps');
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepMessage, setSweepMessage] = useState('');

  const loadComparisonRuns = useCallback(async () => {
    setLoading(true);
    setError('');

    const records: RunRecord[] = [];

    // 1. Fetch server simulations
    try {
      const serverSims = await getSimulations({ limit: 50 });
      for (const sim of serverSims) {
        records.push({
          id: sim.id,
          config: {
            protocol: sim.protocol,
            stationCount: sim.configuration?.stationCount ?? sim.configuration?.num_stations ?? 5,
            frameSizeBytes: sim.configuration?.frameSizeBytes ?? sim.configuration?.frame_size_bytes ?? 1500,
            dataRateBps: sim.configuration?.dataRateBps ?? sim.configuration?.channel_bandwidth_bps ?? 10_000_000,
            durationMs: sim.configuration?.durationMs ?? (sim.configuration?.simulation_time_us ? sim.configuration.simulation_time_us / 1000 : 1000),
            trafficModel: sim.configuration?.trafficModel ?? 'poisson',
            trafficIntensity: sim.configuration?.trafficIntensity ?? 0.5,
            randomSeed: sim.configuration?.randomSeed ?? sim.configuration?.random_seed ?? 42,
          },
          metrics: sim.metrics || {
            successfulFrames: 0,
            collisions: 0,
            retransmissions: 0,
            elapsedMs: 0,
          },
          createdAt: sim.createdAt,
          events: [],
          stations: [],
        });
      }
    } catch {
      // Server may be offline
    }

    // 2. Load any local runs
    try {
      const local = getRuns();
      const existingIds = new Set(records.map(r => r.id));
      for (const l of local) {
        if (!existingIds.has(l.id)) {
          records.push(l);
        }
      }
    } catch {
      // Ignore local storage error
    }

    // 3. If specific requested IDs are passed, make sure they are included
    if (requestedIds && requestedIds.length > 0) {
      for (const id of requestedIds) {
        if (!records.some(r => r.id === id)) {
          try {
            const snap = await getSimulation(id);
            records.push({
              id: snap.id,
              config: snap.configuration,
              metrics: snap.metrics,
              createdAt: snap.createdAt,
              events: [],
              stations: snap.stations,
            });
          } catch {
            // Not found on server
          }
        }
      }
    }

    setRuns(records);

    // Set initial selection
    if (requestedIds && requestedIds.length > 0) {
      setSelectedIds(requestedIds.filter(id => records.some(r => r.id === id)));
    } else {
      setSelectedIds(records.slice(0, 2).map(r => r.id));
    }

    setLoading(false);
  }, [requestedIds]);

  useEffect(() => {
    loadComparisonRuns();
  }, [loadComparisonRuns]);

  const handleRunSweep = async () => {
    setIsSweeping(true);
    setSweepMessage('Executing backend multi-protocol parameter sweep...');
    setError('');

    try {
      const result = await runSweep({
        protocols: ['PURE_ALOHA', 'SLOTTED_ALOHA', 'CSMA', 'CSMA_CD'],
        startLambda: 20,
        endLambda: 150,
        steps: 3,
        numStations: 5,
        simulationTimeUs: 200_000,
        frameSizeBytes: 1500,
        bandwidthBps: 10_000_000,
        name: `Automated_Sweep_${new Date().toLocaleTimeString()}`,
      });

      setSweepMessage(
        `Sweep completed successfully! Generated ${result.runs.length} comparative benchmark runs across 4 protocols.`,
      );

      // Refresh list to include new benchmark runs
      await loadComparisonRuns();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Parameter sweep benchmark failed.');
      setSweepMessage('');
    } finally {
      setIsSweeping(false);
    }
  };

  const selectedRuns = useMemo(
    () => runs.filter(run => selectedIds.includes(run.id)),
    [runs, selectedIds],
  );

  const { isFair, differences } = checkMatchingConditions(selectedRuns);
  const activeMetricMeta = metricsList.find(m => m.key === activeMetricKey)!;
  const keyInsight = useMemo(
    () => generateKeyInsight(selectedRuns, activeMetricKey),
    [selectedRuns, activeMetricKey],
  );

  const toggleRun = (id: string) => {
    setSelectedIds(curr =>
      curr.includes(id) ? curr.filter(item => item !== id) : [...curr, id],
    );
  };

  const metricValues = selectedRuns.map(r => {
    let raw = r.metrics[activeMetricKey] as number | undefined;
    if (activeMetricKey === 'channelUtilization' && raw !== undefined) {
      raw = raw * 100;
    }
    return raw ?? 0;
  });
  const maxChartValue = Math.max(1, ...metricValues);
  const chartTrackWidth = 480;

  return (
    <div className="comparisons-workspace">
      <header className="page-header">
        <div>
          <h1>Protocol Comparison</h1>
          <p>
            Evaluate protocol efficiency, collision rates, and delay characteristics across experimental runs.
          </p>
        </div>
        <div className="button-row">
          <button
            className="btn"
            type="button"
            disabled={isSweeping}
            onClick={handleRunSweep}
            style={{ borderColor: '#DDB487', color: '#DDB487' }}
          >
            {isSweeping ? 'Running Sweep Benchmark...' : 'Run Parameter Sweep Benchmark'}
          </button>
          <Link className="btn primary" to="/simulations/new">
            New Simulation
          </Link>
        </div>
      </header>

      {sweepMessage && (
        <div className="comparison-fair-note" role="status" style={{ marginBottom: 16 }}>
          <strong style={{ color: '#78B978' }}>Sweep Status: </strong>{sweepMessage}
        </div>
      )}

      {error && <div className="error-message" role="alert">{error}</div>}

      {loading ? (
        <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
          <p className="muted">Loading simulation comparison data...</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="empty-state">
          <h2>No Experiments to Compare</h2>
          <p>
            Configure at least two simulations or run a parameter sweep benchmark to perform comparative analysis.
          </p>
          <div className="button-row" style={{ justifyContent: 'center', marginTop: 12 }}>
            <button
              className="btn"
              type="button"
              disabled={isSweeping}
              onClick={handleRunSweep}
              style={{ borderColor: '#DDB487', color: '#DDB487' }}
            >
              {isSweeping ? 'Running Sweep...' : 'Run Parameter Sweep Benchmark'}
            </button>
            <Link className="btn primary" to="/simulations/new">
              Configure a Simulation
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Saved Experiments Selection Table */}
          <section className="panel" aria-labelledby="select-runs-heading" style={{ marginBottom: 20 }}>
            <div className="table-toolbar">
              <div>
                <h2 id="select-runs-heading" style={{ fontSize: 16, margin: 0 }}>
                  Select Experiments to Compare
                </h2>
                <span className="muted" style={{ fontSize: 12 }}>
                  Check two or more runs to plot side-by-side performance metrics.
                </span>
              </div>
              <span className="mono" style={{ fontSize: 12, color: '#DDB487' }}>
                {selectedRuns.length} selected
              </span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 44 }}>Select</th>
                    <th scope="col">Protocol</th>
                    <th scope="col">Stations</th>
                    <th scope="col">Frame Size</th>
                    <th scope="col">Data Rate</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Intensity</th>
                    <th scope="col">Throughput</th>
                    <th scope="col">Collisions</th>
                    <th scope="col">Run ID</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(run => {
                    const isChecked = selectedIds.includes(run.id);
                    return (
                      <tr key={run.id} style={{ background: isChecked ? '#252626' : undefined }}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRun(run.id)}
                            aria-label={`Select ${formatProtocol(run.config.protocol)} run ${run.id}`}
                          />
                        </td>
                        <td>
                          <strong style={{ color: protocolColors[run.config.protocol] }}>
                            {formatProtocol(run.config.protocol)}
                          </strong>
                        </td>
                        <td className="numeric-cell">{run.config.stationCount}</td>
                        <td className="numeric-cell">{run.config.frameSizeBytes} B</td>
                        <td className="numeric-cell">
                          {(run.config.dataRateBps / 1000).toLocaleString()} kbps
                        </td>
                        <td className="numeric-cell">{run.config.durationMs} ms</td>
                        <td className="numeric-cell">{run.config.trafficIntensity}</td>
                        <td className="numeric-cell mono">
                          {formatNumber(run.metrics.throughputBps, 1)} bps
                        </td>
                        <td className="numeric-cell">{formatNumber(run.metrics.collisions)}</td>
                        <td className="mono" style={{ fontSize: 11 }}>
                          <Link to={`/simulations/${run.id}`}>{run.id.slice(0, 8)}</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Comparability Notice */}
          {selectedRuns.length >= 2 && (
            <div
              className={isFair ? 'comparison-fair-note' : 'comparison-caution-note'}
              role={isFair ? 'status' : 'alert'}
              style={{ marginBottom: 20 }}
            >
              {isFair ? (
                <>
                  <strong style={{ color: '#78B978' }}>Controlled Experiment:</strong> All {selectedRuns.length} selected runs share identical station count, frame size, data rate, duration, traffic model, intensity, and random seed.
                </>
              ) : (
                <>
                  <strong style={{ color: '#D5A45D' }}>Varying Parameters Detected:</strong> Experiments differ in: {differences.join(', ')}. Differences in measured output cannot be attributed solely to protocol rules.
                </>
              )}
            </div>
          )}

          {selectedRuns.length < 2 ? (
            <div className="empty-state">
              <h3>Select At Least Two Experiments</h3>
              <p>Choose two or more simulation runs in the table above to view comparative charts and insights.</p>
            </div>
          ) : (
            <>
              {/* Metric Selector Tabs */}
              <div className="metric-selector-bar" role="tablist" aria-label="Select comparison metric">
                {metricsList.map(m => (
                  <button
                    key={m.key}
                    type="button"
                    role="tab"
                    aria-selected={activeMetricKey === m.key}
                    className={`metric-tab${activeMetricKey === m.key ? ' active' : ''}`}
                    onClick={() => setActiveMetricKey(m.key)}
                  >
                    {m.label} ({m.unit})
                  </button>
                ))}
              </div>

              {/* Main SVG Comparison Chart */}
              <section className="panel chart-panel" aria-labelledby="chart-heading" style={{ marginBottom: 20 }}>
                <div className="chart-header">
                  <div>
                    <h2 id="chart-heading" style={{ fontSize: 16, margin: 0 }}>
                      {activeMetricMeta.label} by Protocol
                    </h2>
                    <span className="muted" style={{ fontSize: 12 }}>
                      Measured values in {activeMetricMeta.unit} across selected simulation runs
                    </span>
                  </div>

                  {/* Legend */}
                  <div className="chart-legend" aria-hidden="true">
                    {selectedRuns.map(r => (
                      <span className="legend-item" key={r.id}>
                        <span
                          className="legend-color"
                          style={{ background: protocolColors[r.config.protocol] }}
                        />
                        {formatProtocol(r.config.protocol)} ({r.id.slice(0, 6)})
                      </span>
                    ))}
                  </div>
                </div>

                {/* SVG Technical Bar Chart */}
                <div className="svg-chart-container" tabIndex={0} aria-label={`${activeMetricMeta.label} comparison chart`}>
                  <svg
                    viewBox={`0 0 820 ${80 + selectedRuns.length * 36}`}
                    width="100%"
                    height={80 + selectedRuns.length * 36}
                    style={{ display: 'block', background: '#191A1A' }}
                    aria-hidden="true"
                  >
                    {/* Ticks & Gridlines */}
                    {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                      const x = 160 + ratio * chartTrackWidth;
                      const tickVal = maxChartValue * ratio;
                      return (
                        <g key={ratio}>
                          <line x1={x} y1="25" x2={x} y2={45 + selectedRuns.length * 36} stroke="#252626" strokeWidth="1" />
                          <text x={x} y="18" fill="#928A7F" fontSize="9" fontFamily="IBM Plex Mono" textAnchor="middle">
                            {formatNumber(tickVal, activeMetricMeta.fractionDigits)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Bars */}
                    {selectedRuns.map((run, idx) => {
                      let raw = run.metrics[activeMetricKey] as number | undefined;
                      if (activeMetricKey === 'channelUtilization' && raw !== undefined) {
                        raw = raw * 100;
                      }
                      const val = raw ?? 0;
                      const width = maxChartValue > 0 ? (val / maxChartValue) * chartTrackWidth : 0;
                      const y = 32 + idx * 36;
                      const color = protocolColors[run.config.protocol];

                      return (
                        <g key={run.id}>
                          {/* Protocol Label */}
                          <text
                            x="150"
                            y={y + 16}
                            fill="#F3EDE4"
                            fontSize="11"
                            fontFamily="IBM Plex Mono"
                            textAnchor="end"
                          >
                            {formatProtocol(run.config.protocol)}
                          </text>

                          {/* Track */}
                          <line x1="160" y1={y + 11} x2={160 + chartTrackWidth} y2={y + 11} stroke="#403C36" strokeWidth="1" />

                          {/* Data Bar */}
                          <rect
                            x="160"
                            y={y + 2}
                            width={Math.max(2, width)}
                            height="18"
                            fill={color}
                            stroke="#141515"
                            strokeWidth="0.5"
                          />

                          {/* Value Label */}
                          <text
                            x={168 + Math.max(2, width)}
                            y={y + 15}
                            fill="#F3EDE4"
                            fontSize="10"
                            fontFamily="IBM Plex Mono"
                          >
                            {formatNumber(val, activeMetricMeta.fractionDigits)} {activeMetricMeta.unit}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </section>

              {/* Key Insight Panel */}
              <section className="panel key-insight-panel" aria-labelledby="insight-heading" style={{ marginBottom: 20 }}>
                <div className="insight-header">
                  <h2 id="insight-heading" style={{ fontSize: 15, margin: 0, color: '#DDB487' }}>
                    Key Simulation Insight
                  </h2>
                  <span className="mono" style={{ fontSize: 11, color: '#928A7F' }}>
                    DATA-DRIVEN FACTUAL DEDUCTION
                  </span>
                </div>
                <p className="insight-text">{keyInsight}</p>
              </section>

              {/* Results Summary Table */}
              <section className="panel" aria-labelledby="results-summary-heading">
                <h2 id="results-summary-heading" style={{ fontSize: 16, marginBottom: 12 }}>
                  Comparative Experiment Metrics
                </h2>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Parameter / Metric</th>
                        {selectedRuns.map(run => (
                          <th scope="col" key={run.id} style={{ color: protocolColors[run.config.protocol] }}>
                            {formatProtocol(run.config.protocol)}
                            <br />
                            <span className="mono" style={{ fontSize: 10, color: '#928A7F' }}>
                              ({run.id.slice(0, 6)})
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">Station Count</th>
                        {selectedRuns.map(r => (
                          <td className="numeric-cell" key={r.id}>{r.config.stationCount}</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Frame Size</th>
                        {selectedRuns.map(r => (
                          <td className="numeric-cell" key={r.id}>{r.config.frameSizeBytes} bytes</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Data Rate</th>
                        {selectedRuns.map(r => (
                          <td className="numeric-cell" key={r.id}>{(r.config.dataRateBps / 1000).toLocaleString()} kbps</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Duration</th>
                        {selectedRuns.map(r => (
                          <td className="numeric-cell" key={r.id}>{r.config.durationMs} ms</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Traffic Intensity G</th>
                        {selectedRuns.map(r => (
                          <td className="numeric-cell" key={r.id}>{r.config.trafficIntensity}</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Random Seed</th>
                        {selectedRuns.map(r => (
                          <td className="numeric-cell mono" key={r.id}>{r.config.randomSeed ?? 'Not recorded'}</td>
                        ))}
                      </tr>
                      <tr style={{ background: '#252626' }}>
                        <th scope="row">Delivered Frames</th>
                        {selectedRuns.map(r => (
                          <td className="numeric-cell mono" key={r.id} style={{ color: '#78B978' }}>
                            {formatNumber(r.metrics.successfulFrames)}
                          </td>
                        ))}
                      </tr>
                      <tr style={{ background: '#252626' }}>
                        <th scope="row">Collision Incidents</th>
                        {selectedRuns.map(r => (
                          <td className="numeric-cell mono" key={r.id} style={{ color: '#D96A62' }}>
                            {formatNumber(r.metrics.collisions)}
                          </td>
                        ))}
                      </tr>
                      <tr style={{ background: '#252626' }}>
                        <th scope="row">Retransmissions</th>
                        {selectedRuns.map(r => (
                          <td className="numeric-cell mono" key={r.id} style={{ color: '#D5A45D' }}>
                            {formatNumber(r.metrics.retransmissions)}
                          </td>
                        ))}
                      </tr>
                      <tr style={{ background: '#252626' }}>
                        <th scope="row">Throughput (bps)</th>
                        {selectedRuns.map(r => (
                          <td className="numeric-cell mono" key={r.id} style={{ color: '#DDB487', fontWeight: 600 }}>
                            {formatNumber(r.metrics.throughputBps, 1)}
                          </td>
                        ))}
                      </tr>
                      <tr style={{ background: '#252626' }}>
                        <th scope="row">Channel Utilization (%)</th>
                        {selectedRuns.map(r => (
                          <td className="numeric-cell mono" key={r.id}>
                            {r.metrics.channelUtilization !== undefined
                              ? `${formatNumber(r.metrics.channelUtilization * 100, 1)}%`
                              : 'Not available'}
                          </td>
                        ))}
                      </tr>
                      <tr style={{ background: '#252626' }}>
                        <th scope="row">Average Delay (ms)</th>
                        {selectedRuns.map(r => (
                          <td className="numeric-cell mono" key={r.id}>
                            {formatNumber(r.metrics.averageDelayMs, 2)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
