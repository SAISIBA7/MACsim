import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getRuns, type RunRecord } from '../store/runs';
import { formatNumber, formatProtocol } from '../utils/format';
import type { Protocol } from '../types';
import { getSimulations } from '../api/simulations';
import { runSweep } from '../api/comparisons';
import { ArrowRightIcon } from '../components/Icons';

const protocolColors: Record<Protocol, string> = {
  PURE_ALOHA: '#DDB487',
  SLOTTED_ALOHA: '#78A9E8',
  CSMA: '#78B978',
  CSMA_CD: '#D5A45D',
};

type SortField = 'date' | 'throughput' | 'collisions' | 'stations' | 'duration';
type SortOrder = 'asc' | 'desc';

export default function Comparisons() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedIds = searchParams.get('ids')?.split(',').filter(Boolean);

  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectionWarning, setSelectionWarning] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [protocolFilter, setProtocolFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepMessage, setSweepMessage] = useState('');

  const loadRuns = useCallback(async () => {
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

    setRuns(records);

    // Initialize selection: prefer requestedIds (clamped to 2) or first 2
    if (requestedIds && requestedIds.length > 0) {
      setSelectedIds(requestedIds.filter(id => records.some(r => r.id === id)).slice(0, 2));
    } else {
      setSelectedIds(records.slice(0, 2).map(r => r.id));
    }

    setLoading(false);
  }, [requestedIds]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

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

      await loadRuns();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Parameter sweep benchmark failed.');
      setSweepMessage('');
    } finally {
      setIsSweeping(false);
    }
  };

  const toggleRun = (id: string) => {
    setSelectionWarning('');

    if (selectedIds.includes(id)) {
      // Deselect
      setSelectedIds(curr => curr.filter(item => item !== id));
      return;
    }

    if (selectedIds.length < 2) {
      // Add
      setSelectedIds(curr => [...curr, id]);
    } else {
      // Prevent 3rd selection
      setSelectionWarning(
        'Comparison requires exactly two experiments. Deselect an experiment first to choose another.',
      );
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
    setSelectionWarning('');
  };

  const handleCompareClick = () => {
    if (selectedIds.length !== 2) return;
    navigate(`/comparisons/analysis?a=${encodeURIComponent(selectedIds[0])}&b=${encodeURIComponent(selectedIds[1])}`);
  };

  // Filter & sort
  const filteredRuns = useMemo(() => {
    let result = [...runs];

    if (protocolFilter !== 'ALL') {
      result = result.filter(r => r.config.protocol === protocolFilter);
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        r =>
          r.id.toLowerCase().includes(q) ||
          r.config.protocol.toLowerCase().includes(q) ||
          formatProtocol(r.config.protocol).toLowerCase().includes(q),
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'throughput':
          comparison = (b.metrics.throughputBps ?? 0) - (a.metrics.throughputBps ?? 0);
          break;
        case 'collisions':
          comparison = (b.metrics.collisions ?? 0) - (a.metrics.collisions ?? 0);
          break;
        case 'stations':
          comparison = b.config.stationCount - a.config.stationCount;
          break;
        case 'duration':
          comparison = b.config.durationMs - a.config.durationMs;
          break;
        case 'date':
        default:
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? -comparison : comparison;
    });

    return result;
  }, [runs, protocolFilter, searchQuery, sortField, sortOrder]);

  const selectedRunA = runs.find(r => r.id === selectedIds[0]);
  const selectedRunB = runs.find(r => r.id === selectedIds[1]);

  return (
    <div className="comparisons-workspace">
      {/* Header */}
      <header className="page-header">
        <div>
          <h1>Protocol Comparison</h1>
          <p>
            Select two simulation experiments to perform a comparative performance and protocol analysis.
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
          <strong style={{ color: '#78B978' }}>Sweep Status: </strong>
          {sweepMessage}
        </div>
      )}

      {error && <div className="error-message" role="alert">{error}</div>}

      {/* Prominent Compare Action Bar */}
      <section
        className="panel"
        style={{
          marginBottom: 20,
          background: 'var(--color-surface)',
          borderColor: selectedIds.length === 2 ? 'var(--color-accent)' : 'var(--color-border)',
          borderWidth: 1,
        }}
        aria-label="Experiment comparison action toolbar"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-accent)' }}>
                EXPERIMENT SELECTION
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  border: '1px solid',
                  borderColor: selectedIds.length === 2 ? '#78B978' : '#D5A45D',
                  color: selectedIds.length === 2 ? '#78B978' : '#D5A45D',
                }}
              >
                {selectedIds.length} / 2 SELECTED
              </span>
            </div>

            {selectedIds.length === 0 && (
              <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
                Select two experiments from the table below to compare protocols and metrics side by side.
              </p>
            )}

            {selectedIds.length === 1 && selectedRunA && (
              <p style={{ margin: 0, fontSize: 12.5 }}>
                <strong>Experiment A: </strong>
                <span className="mono" style={{ color: protocolColors[selectedRunA.config.protocol] }}>
                  {formatProtocol(selectedRunA.config.protocol)} ({selectedRunA.id.slice(0, 8)})
                </span>
                <span className="muted"> · Select 1 more experiment below to proceed.</span>
              </p>
            )}

            {selectedIds.length === 2 && selectedRunA && selectedRunB && (
              <p style={{ margin: 0, fontSize: 12.5 }}>
                <strong>Experiment A: </strong>
                <span className="mono" style={{ color: protocolColors[selectedRunA.config.protocol] }}>
                  {formatProtocol(selectedRunA.config.protocol)} ({selectedRunA.id.slice(0, 8)})
                </span>
                <span className="muted" style={{ margin: '0 8px' }}>vs</span>
                <strong>Experiment B: </strong>
                <span className="mono" style={{ color: protocolColors[selectedRunB.config.protocol] }}>
                  {formatProtocol(selectedRunB.config.protocol)} ({selectedRunB.id.slice(0, 8)})
                </span>
              </p>
            )}
          </div>

          <div className="button-row" style={{ alignItems: 'center', gap: 8 }}>
            {selectedIds.length > 0 && (
              <button
                className="btn"
                type="button"
                onClick={handleClearSelection}
                style={{ fontSize: 12, minHeight: 32 }}
              >
                Clear Selection
              </button>
            )}

            <button
              className="btn primary"
              type="button"
              disabled={selectedIds.length !== 2}
              onClick={handleCompareClick}
              style={{
                minHeight: 32,
                padding: '4px 16px',
                fontWeight: 600,
                opacity: selectedIds.length === 2 ? 1 : 0.5,
              }}
              title={selectedIds.length === 2 ? 'Navigate to comparison analysis' : 'Select exactly 2 experiments to compare'}
            >
              Compare Experiments
              <ArrowRightIcon />
            </button>
          </div>
        </div>

        {selectionWarning && (
          <div
            style={{
              marginTop: 12,
              padding: '6px 10px',
              border: '1px solid #D5A45D',
              background: '#242017',
              fontSize: 12,
              color: '#F3EDE4',
            }}
            role="status"
          >
            {selectionWarning}
          </div>
        )}
      </section>

      {/* Filter and Search Bar */}
      <div
        className="panel"
        style={{
          marginBottom: 16,
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label htmlFor="search-input" className="mono" style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            FILTER:
          </label>
          <input
            id="search-input"
            type="text"
            placeholder="Search run ID or protocol..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: 220,
              minHeight: 30,
              padding: '4px 8px',
              fontSize: 12,
              background: 'var(--color-input)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />

          <span className="muted" style={{ margin: '0 4px' }}>|</span>

          <span className="mono" style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            PROTOCOL:
          </span>
          {(['ALL', 'PURE_ALOHA', 'SLOTTED_ALOHA', 'CSMA', 'CSMA_CD'] as const).map(p => (
            <button
              key={p}
              type="button"
              className="btn"
              onClick={() => setProtocolFilter(p)}
              style={{
                minHeight: 28,
                padding: '2px 8px',
                fontSize: 11,
                borderColor: protocolFilter === p ? 'var(--color-accent)' : 'var(--color-border)',
                background: protocolFilter === p ? 'var(--color-surface-raised)' : 'transparent',
                color: protocolFilter === p ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}
            >
              {p === 'ALL' ? 'All' : formatProtocol(p)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="sort-field" className="mono" style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            SORT:
          </label>
          <select
            id="sort-field"
            value={sortField}
            onChange={e => setSortField(e.target.value as SortField)}
            style={{ minHeight: 30, padding: '2px 8px', fontSize: 12 }}
          >
            <option value="date">Date Created</option>
            <option value="throughput">Throughput (bps)</option>
            <option value="collisions">Collisions</option>
            <option value="stations">Stations</option>
            <option value="duration">Duration</option>
          </select>
          <button
            type="button"
            className="btn"
            onClick={() => setSortOrder(curr => (curr === 'asc' ? 'desc' : 'asc'))}
            style={{ minHeight: 30, padding: '2px 8px', fontSize: 11 }}
            title="Toggle sort direction"
          >
            {sortOrder === 'asc' ? '▲ ASC' : '▼ DESC'}
          </button>
        </div>
      </div>

      {/* Experiment Selection Table */}
      {loading ? (
        <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
          <p className="muted">Loading simulation experiments...</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="empty-state">
          <h2>No Simulation Experiments Found</h2>
          <p>
            Run a parameter sweep benchmark or configure simulations to populate the comparison workspace.
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
        <section className="panel" aria-labelledby="select-runs-heading">
          <div className="table-toolbar">
            <div>
              <h2 id="select-runs-heading" style={{ fontSize: 15, margin: 0 }}>
                Eligible Simulation Experiments ({filteredRuns.length})
              </h2>
              <span className="muted" style={{ fontSize: 12 }}>
                Check exactly two experiments to enable the comparison analysis.
              </span>
            </div>
            <span className="mono" style={{ fontSize: 12, color: '#DDB487' }}>
              {selectedIds.length} of 2 selected
            </span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col" style={{ width: 44, textAlign: 'center' }}>Select</th>
                  <th scope="col">Protocol</th>
                  <th scope="col" className="numeric-cell">Stations</th>
                  <th scope="col" className="numeric-cell">Frame Size</th>
                  <th scope="col" className="numeric-cell">Data Rate</th>
                  <th scope="col" className="numeric-cell">Duration</th>
                  <th scope="col" className="numeric-cell">Intensity</th>
                  <th scope="col" className="numeric-cell">Throughput</th>
                  <th scope="col" className="numeric-cell">Collisions</th>
                  <th scope="col">Run ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map(run => {
                  const isChecked = selectedIds.includes(run.id);
                  const isA = selectedIds[0] === run.id;
                  const isB = selectedIds[1] === run.id;

                  return (
                    <tr
                      key={run.id}
                      style={{
                        background: isChecked ? 'var(--color-surface-raised)' : undefined,
                        borderLeft: isChecked
                          ? `3px solid ${isA ? '#78A9E8' : '#78B978'}`
                          : undefined,
                      }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRun(run.id)}
                          aria-label={`Select ${formatProtocol(run.config.protocol)} run ${run.id}`}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <strong style={{ color: protocolColors[run.config.protocol] }}>
                            {formatProtocol(run.config.protocol)}
                          </strong>
                          {isA && (
                            <span
                              className="mono"
                              style={{
                                fontSize: 10,
                                background: '#78A9E8',
                                color: '#141515',
                                padding: '1px 4px',
                                fontWeight: 700,
                              }}
                            >
                              EXP A
                            </span>
                          )}
                          {isB && (
                            <span
                              className="mono"
                              style={{
                                fontSize: 10,
                                background: '#78B978',
                                color: '#141515',
                                padding: '1px 4px',
                                fontWeight: 700,
                              }}
                            >
                              EXP B
                            </span>
                          )}
                        </div>
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
                        <Link to={`/simulations/${run.id}`} title="Inspect simulation workspace">
                          {run.id.slice(0, 8)}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
