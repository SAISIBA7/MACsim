import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getRuns, type RunRecord } from '../store/runs';
import { formatDate, formatNumber, formatProtocol } from '../utils/format';

export default function History({ title }: { title: string }) {
  const [{ runs, error }] = useState(() => {
    try {
      return { runs: getRuns(), error: '' };
    } catch (reason) {
      return {
        runs: [] as RunRecord[],
        error: reason instanceof Error ? reason.message : 'Saved simulations could not be read.',
      };
    }
  });

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          <p>Saved runs are stored in this browser only. They are not uploaded or synchronized.</p>
        </div>
        <div className="button-row">
          <Link className="btn" to="/comparisons">Compare runs</Link>
          <Link className="btn primary" to="/simulations/new">New simulation</Link>
        </div>
      </header>

      {error ? (
        <div className="error-message" role="alert">{error}</div>
      ) : runs.length === 0 ? (
        <div className="empty-state">
          <h2>No saved runs</h2>
          <p>Finish a simulation and save it to review its configuration and measured results here.</p>
          <Link className="btn primary" to="/simulations/new">Configure a simulation</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Created</th>
                <th scope="col">Protocol</th>
                <th scope="col">Stations</th>
                <th scope="col">Duration</th>
                <th scope="col">Successful frames</th>
                <th scope="col">Collisions</th>
                <th scope="col">Throughput (bps)</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr key={run.id}>
                  <td>{formatDate(run.createdAt)}</td>
                  <td>{formatProtocol(run.config.protocol)}</td>
                  <td className="numeric-cell">{run.config.stationCount}</td>
                  <td className="numeric-cell">{formatNumber(run.config.durationMs)} ms</td>
                  <td className="numeric-cell">{formatNumber(run.metrics.successfulFrames)}</td>
                  <td className="numeric-cell">{formatNumber(run.metrics.collisions)}</td>
                  <td className="numeric-cell">{formatNumber(run.metrics.throughputBps, 1)}</td>
                  <td><Link to={`/simulations/${run.id}`}>Open results</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
