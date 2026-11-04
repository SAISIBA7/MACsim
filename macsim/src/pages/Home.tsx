import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getRuns, type RunRecord } from '../store/runs';
import { formatDate, formatNumber, formatProtocol } from '../utils/format';
import { NetworkIllustration } from '../components/NetworkIllustration';
import { ProtocolDiagram } from '../components/ProtocolDiagram';
import type { Protocol } from '../types';

interface ProtocolInfo {
  id: Protocol;
  name: string;
  description: string;
}

const protocols: ProtocolInfo[] = [
  {
    id: 'PURE_ALOHA',
    name: 'Pure ALOHA',
    description: 'Stations transmit as soon as a frame arrives. Overlapping transmissions collide over a 2T vulnerable interval.',
  },
  {
    id: 'SLOTTED_ALOHA',
    name: 'Slotted ALOHA',
    description: 'Time is divided into discrete slots. Transmissions are constrained to slot boundaries, halving vulnerable time to T.',
  },
  {
    id: 'CSMA',
    name: 'CSMA',
    description: 'Carrier Sense Multiple Access checks channel state prior to transmission, deferring if an active carrier is sensed.',
  },
  {
    id: 'CSMA_CD',
    name: 'CSMA/CD',
    description: 'Stations listen while transmitting, aborting immediately upon collision detection and rescheduling with exponential backoff.',
  },
];

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
    <div className="home-workspace">
      {/* Hero Section */}
      <section className="hero-panel" aria-labelledby="hero-title">
        <div className="hero-content">
          <div className="hero-badge">SIMULATION WORKSPACE V3.0</div>
          <h1 id="hero-title" className="hero-title">MACSim</h1>
          <p className="hero-subtitle">Medium Access Control Protocol Simulator</p>
          <p className="hero-description">
            An educational simulation environment for modeling, observing, and comparing how network stations
            contend for and share a common communication medium under varying loads and access policies.
          </p>
        </div>
        <div className="hero-illustration">
          <NetworkIllustration />
        </div>
      </section>

      {/* Available Protocols */}
      <section className="section" aria-labelledby="protocols-heading">
        <div className="section-header-row">
          <div>
            <h2 className="section-heading" id="protocols-heading">Available Protocols</h2>
            <p className="section-subtext">
              Select and configure standard contention-based medium access control protocols.
            </p>
          </div>
        </div>

        <div className="protocol-grid">
          {protocols.map(item => (
            <div className="protocol-card" key={item.id}>
              <div className="protocol-card-header">
                <div>
                  <h3 className="protocol-card-title">{item.name}</h3>
                  <span className="protocol-type-tag mono">{item.id}</span>
                </div>
                <Link
                  className="btn"
                  to={`/simulations/new?protocol=${item.id}`}
                  aria-label={`Configure ${item.name}`}
                >
                  Configure
                </Link>
              </div>

              <p className="protocol-card-desc">{item.description}</p>

              <div className="protocol-card-diagram">
                <ProtocolDiagram protocol={item.id} compact />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Simulations */}
      <section className="section" aria-labelledby="recent-heading">
        <div className="table-toolbar">
          <div>
            <h2 className="section-heading" id="recent-heading">Recent Simulations</h2>
            <p className="section-subtext">Experiments configured and completed in this browser session.</p>
          </div>
          <Link className="btn" to="/history">
            View All History
          </Link>
        </div>

        {error ? (
          <div className="error-message" role="alert">{error}</div>
        ) : runs.length === 0 ? (
          <div className="empty-state">
            <h3>No Saved Simulations</h3>
            <p>Completed runs saved locally will appear here with their measured metrics and configuration parameters.</p>
            <Link className="btn primary" to="/simulations/new">
              Create the First Simulation
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Run ID</th>
                  <th scope="col">Protocol</th>
                  <th scope="col">Stations</th>
                  <th scope="col">Workload</th>
                  <th scope="col">Successful</th>
                  <th scope="col">Collisions</th>
                  <th scope="col">Throughput</th>
                  <th scope="col">Created</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 5).map(run => (
                  <tr key={run.id}>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {run.id.slice(0, 8)}...
                    </td>
                    <td>
                      <strong>{formatProtocol(run.config.protocol)}</strong>
                    </td>
                    <td className="numeric-cell">{run.config.stationCount}</td>
                    <td>
                      {run.config.frameSizeBytes} B @ {(run.config.dataRateBps / 1000).toLocaleString()} kbps
                      <br />
                      <span className="muted" style={{ fontSize: 11 }}>
                        {run.config.durationMs} ms, {run.config.trafficModel} ({run.config.trafficIntensity})
                      </span>
                    </td>
                    <td className="numeric-cell">{formatNumber(run.metrics.successfulFrames)}</td>
                    <td className="numeric-cell">{formatNumber(run.metrics.collisions)}</td>
                    <td className="numeric-cell mono">
                      {formatNumber(run.metrics.throughputBps, 1)} bps
                    </td>
                    <td>{formatDate(run.createdAt)}</td>
                    <td>
                      <Link className="btn" to={`/simulations/${run.id}`} style={{ padding: '2px 8px', minHeight: 28 }}>
                        Open
                      </Link>
                    </td>
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
