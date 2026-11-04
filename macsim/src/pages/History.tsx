import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteRun, getRuns, type RunRecord } from '../store/runs';
import { formatDate, formatNumber, formatProtocol } from '../utils/format';

export default function History({ title }: { title: string }) {
  const navigate = useNavigate();
  const [{ runs, error }, setRunsState] = useState(() => {
    try {
      return { runs: getRuns(), error: '' };
    } catch (reason) {
      return {
        runs: [] as RunRecord[],
        error: reason instanceof Error ? reason.message : 'Saved simulations could not be read.',
      };
    }
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds(curr =>
      curr.includes(id) ? curr.filter(item => item !== id) : [...curr, id],
    );
  };

  const selectAll = () => {
    if (selectedIds.length === runs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(runs.map(r => r.id));
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this simulation run from browser history?')) return;
    try {
      deleteRun(id);
      setRunsState({ runs: getRuns(), error: '' });
      setSelectedIds(curr => curr.filter(item => item !== id));
    } catch (reason) {
      setRunsState(curr => ({
        ...curr,
        error: reason instanceof Error ? reason.message : 'Failed to delete simulation.',
      }));
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
            Saved simulation experiments stored in local browser storage. Results are preserved for retrospective inspection and protocol comparison.
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

      {error ? (
        <div className="error-message" role="alert">{error}</div>
      ) : runs.length === 0 ? (
        <div className="empty-state">
          <h2>No Saved Simulation Runs</h2>
          <p>
            When you complete a simulation and choose to save it, its full event log, configuration parameters, and measured metrics will appear here.
          </p>
          <Link className="btn primary" to="/simulations/new">
            Configure a Simulation
          </Link>
        </div>
      ) : (
        <div className="panel">
          <div className="table-toolbar">
            <span className="muted" style={{ fontSize: 13 }}>
              {runs.length} simulation run{runs.length === 1 ? '' : 's'} recorded locally.
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
                {runs.map(run => {
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
                        <strong>{formatProtocol(run.config.protocol)}</strong>
                      </td>
                      <td className="numeric-cell">{run.config.stationCount}</td>
                      <td className="numeric-cell">{run.config.durationMs} ms</td>
                      <td className="numeric-cell" style={{ color: '#78B978' }}>
                        {formatNumber(run.metrics.successfulFrames)}
                      </td>
                      <td className="numeric-cell" style={{ color: '#D96A62' }}>
                        {formatNumber(run.metrics.collisions)}
                      </td>
                      <td className="numeric-cell mono" style={{ color: '#DDB487' }}>
                        {formatNumber(run.metrics.throughputBps, 1)} bps
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
                            onClick={() => handleDelete(run.id)}
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
