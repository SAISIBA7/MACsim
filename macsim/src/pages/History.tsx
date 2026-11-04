import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteRun, getRuns } from '../store/runs';
import { formatDate, formatNumber, formatProtocol } from '../utils/format';
import { getSimulations, deleteSimulation } from '../api/simulations';
import type { Protocol } from '../types';

interface UnifiedRunItem {
  id: string;
  source: 'server' | 'local';
  protocol: Protocol;
  stationCount: number;
  durationMs: number;
  successfulFrames: number;
  collisions: number;
  throughputBps: number;
  createdAt: string;
  status?: string;
}

export default function History({ title }: { title: string }) {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<UnifiedRunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');

    let serverItems: UnifiedRunItem[] = [];
    try {
      const serverSims = await getSimulations({ limit: 50 });
      serverItems = serverSims.map((sim) => ({
        id: sim.id,
        source: 'server',
        protocol: sim.protocol,
        stationCount: sim.configuration?.stationCount ?? sim.configuration?.num_stations ?? 5,
        durationMs: sim.configuration?.durationMs ?? (sim.configuration?.simulation_time_us ? sim.configuration.simulation_time_us / 1000 : 1000),
        successfulFrames: sim.metrics?.successfulFrames ?? 0,
        collisions: sim.metrics?.collisions ?? 0,
        throughputBps: sim.metrics?.throughputBps ?? 0,
        createdAt: sim.createdAt,
        status: sim.status,
      }));
    } catch {
      // Backend may be offline or unreachable; proceed to load local runs
    }

    let localItems: UnifiedRunItem[] = [];
    try {
      const localRuns = getRuns();
      localItems = localRuns.map((r) => ({
        id: r.id,
        source: 'local',
        protocol: r.config.protocol,
        stationCount: r.config.stationCount,
        durationMs: r.config.durationMs,
        successfulFrames: r.metrics.successfulFrames,
        collisions: r.metrics.collisions,
        throughputBps: r.metrics.throughputBps ?? 0,
        createdAt: r.createdAt,
        status: 'Completed',
      }));
    } catch {
      // Ignore local storage error
    }

    const serverIds = new Set(serverItems.map((s) => s.id));
    const uniqueLocal = localItems.filter((l) => !serverIds.has(l.id));
    const combined = [...serverItems, ...uniqueLocal];

    // Sort by createdAt descending
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setRuns(combined);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const toggleSelect = (id: string) => {
    setSelectedIds((curr) =>
      curr.includes(id) ? curr.filter((item) => item !== id) : [...curr, id],
    );
  };

  const selectAll = () => {
    if (selectedIds.length === runs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(runs.map((r) => r.id));
    }
  };

  const handleDelete = async (item: UnifiedRunItem) => {
    const originLabel = item.source === 'server' ? 'database' : 'browser storage';
    if (!window.confirm(`Delete simulation ${item.id.slice(0, 8)} from ${originLabel}?`)) return;

    try {
      if (item.source === 'server') {
        await deleteSimulation(item.id);
      } else {
        deleteRun(item.id);
      }
      setSelectedIds((curr) => curr.filter((id) => id !== item.id));
      await loadHistory();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to delete simulation.');
    }
  };

  const handleCompareSelected = () => {
    if (selectedIds.length >= 2) {
      navigate(`/comparisons?ids=${selectedIds.join(',')}`);
    }
  };

  return (
    <div className="history-workspace">
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          <p>
            Authoritative simulation experiments stored in the backend database and local browser history.
          </p>
        </div>
        <div className="button-row">
          <button
            className="btn"
            type="button"
            disabled={selectedIds.length < 2}
            onClick={handleCompareSelected}
            style={{
              borderColor: selectedIds.length >= 2 ? '#DDB487' : undefined,
              color: selectedIds.length >= 2 ? '#DDB487' : undefined,
            }}
          >
            Compare Selected ({selectedIds.length})
          </button>
          <Link className="btn primary" to="/simulations/new">
            New Simulation
          </Link>
        </div>
      </header>

      {error && <div className="error-message" role="alert">{error}</div>}

      {loading ? (
        <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
          <p className="muted">Retrieving simulation records...</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="empty-state">
          <h2>No Saved Simulation Runs</h2>
          <p>
            When you complete a simulation, its full event log, configuration parameters, and measured metrics will appear here.
          </p>
          <Link className="btn primary" to="/simulations/new">
            Configure a Simulation
          </Link>
        </div>
      ) : (
        <div className="panel">
          <div className="table-toolbar">
            <span className="muted" style={{ fontSize: 13 }}>
              {runs.length} simulation run{runs.length === 1 ? '' : 's'} recorded.
            </span>
            <button
              className="btn"
              type="button"
              style={{ fontSize: 12, padding: '2px 8px', minHeight: 28 }}
              onClick={selectAll}
            >
              {selectedIds.length === runs.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col" style={{ width: 44 }}>Select</th>
                  <th scope="col">Run ID</th>
                  <th scope="col">Source</th>
                  <th scope="col">Protocol</th>
                  <th scope="col">Stations</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Delivered</th>
                  <th scope="col">Collisions</th>
                  <th scope="col">Throughput</th>
                  <th scope="col">Created Date</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const isChecked = selectedIds.includes(run.id);
                  return (
                    <tr key={run.id} style={{ background: isChecked ? '#252626' : undefined }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(run.id)}
                          aria-label={`Select ${run.id}`}
                        />
                      </td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        <Link to={`/simulations/${run.id}`}>{run.id.slice(0, 8)}</Link>
                      </td>
                      <td>
                        <span
                          className="mono"
                          style={{
                            fontSize: 10,
                            padding: '1px 5px',
                            border: '1px solid',
                            borderColor: run.source === 'server' ? '#78A9E8' : '#D5A45D',
                            color: run.source === 'server' ? '#78A9E8' : '#D5A45D',
                          }}
                        >
                          {run.source.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <strong>{formatProtocol(run.protocol)}</strong>
                      </td>
                      <td className="numeric-cell">{run.stationCount}</td>
                      <td className="numeric-cell">{run.durationMs} ms</td>
                      <td className="numeric-cell" style={{ color: '#78B978' }}>
                        {formatNumber(run.successfulFrames)}
                      </td>
                      <td className="numeric-cell" style={{ color: '#D96A62' }}>
                        {formatNumber(run.collisions)}
                      </td>
                      <td className="numeric-cell mono" style={{ color: '#DDB487' }}>
                        {formatNumber(run.throughputBps, 1)} bps
                      </td>
                      <td style={{ fontSize: 12 }}>{formatDate(run.createdAt)}</td>
                      <td>
                        <div className="button-row" style={{ gap: 4 }}>
                          <Link
                            className="btn"
                            to={`/simulations/${run.id}`}
                            style={{ minHeight: 24, padding: '2px 8px', fontSize: 11 }}
                          >
                            Open
                          </Link>
                          <button
                            className="btn danger"
                            type="button"
                            onClick={() => handleDelete(run)}
                            style={{ minHeight: 24, padding: '2px 8px', fontSize: 11 }}
                            aria-label={`Delete ${run.id}`}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
