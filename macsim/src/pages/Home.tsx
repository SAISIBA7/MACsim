import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getRuns, type RunRecord } from '../store/runs';
import { formatDate, formatNumber, formatProtocol } from '../utils/format';

const protocols = [
  {
    id: 'PURE_ALOHA',
    name: 'Pure ALOHA',
    description: 'Stations transmit when a frame is ready. Overlapping frames collide.',
  },
  {
    id: 'SLOTTED_ALOHA',
    name: 'Slotted ALOHA',
    description: 'Stations may begin transmissions only at configured slot boundaries.',
  },
  {
    id: 'CSMA',
    name: 'CSMA',
    description: 'Stations sense the shared medium and wait when another frame is active.',
  },
  {
    id: 'CSMA_CD',
    name: 'CSMA/CD',
    description: 'Stations sense the medium, detect collisions, and retry after backoff.',
  },
] as const;

export default function Home() {
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
          <h1>Medium Access Control Protocol Simulator</h1>
          <p>Configure a repeatable experiment and observe how stations share a communication channel.</p>
        </div>
        <Link className="btn primary" to="/simulations/new">Create Simulation</Link>
      </header>

      <section className="section" aria-labelledby="protocols-heading">
        <h2 className="section-heading" id="protocols-heading">Available protocols</h2>
        <div className="protocol-list">
          {protocols.map(protocol => (
            <div className="protocol-row" key={protocol.id}>
              <strong>{protocol.name}</strong>
              <p>{protocol.description}</p>
              <Link to={`/simulations/new?protocol=${protocol.id}`}>Configure</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="recent-heading">
        <div className="table-toolbar">
          <h2 id="recent-heading">Recent simulations</h2>
          <Link to="/history">View History</Link>
        </div>
        {error ? (
          <div className="error-message" role="alert">{error}</div>
        ) : runs.length === 0 ? (
          <div className="empty-state">
            <h3>No saved simulations</h3>
            <p>Completed runs you save will appear here with their configuration and measured results.</p>
            <Link className="btn primary" to="/simulations/new">Create the First Simulation</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Created</th>
                  <th scope="col">Protocol</th>
                  <th scope="col">Configuration</th>
                  <th scope="col">Results</th>
                  <th scope="col"><span className="sr-only">Open run</span></th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 5).map(run => (
                  <tr key={run.id}>
                    <td>{formatDate(run.createdAt)}</td>
                    <td>{formatProtocol(run.config.protocol)}</td>
                    <td>
                      {run.config.stationCount} stations, {run.config.frameSizeBytes.toLocaleString()} bytes
                      <br />
                      {run.config.dataRateBps.toLocaleString()} bps, {run.config.durationMs.toLocaleString()} ms
                      <br />
                      {run.config.trafficModel === 'poisson' ? 'Poisson' : 'Uniform'} traffic, intensity {formatNumber(run.config.trafficIntensity, 2)}, seed {run.config.randomSeed ?? 'not recorded'}
                    </td>
                    <td>
                      {formatNumber(run.metrics.successfulFrames)} successful frames
                      <br />
                      {formatNumber(run.metrics.collisions)} collisions
                      <br />
                      {formatNumber(run.metrics.throughputBps, 1)} bps throughput
                    </td>
                    <td><Link to={`/simulations/${run.id}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
