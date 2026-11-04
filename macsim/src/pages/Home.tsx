import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRuns } from '../store/runs';
import { formatDate, formatNumber, formatProtocol } from '../utils/format';
import { NetworkIllustration } from '../components/NetworkIllustration';
import { ProtocolDiagram } from '../components/ProtocolDiagram';
import type { Protocol } from '../types';
import { getHealth, getProtocols } from '../api/protocols';
import { getSimulations } from '../api/simulations';

interface ProtocolInfo {
  id: Protocol;
  name: string;
  description: string;
}

const defaultProtocols: ProtocolInfo[] = [
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

interface RecentRunView {
  id: string;
  protocol: Protocol;
  stationCount: number;
  frameSizeBytes: number;
  dataRateBps: number;
  durationMs: number;
  trafficModel: string;
  trafficIntensity: number;
  successfulFrames: number;
  collisions: number;
  throughputBps: number;
  createdAt: string;
}

export default function Home() {
  const [protocols, setProtocols] = useState<ProtocolInfo[]>(defaultProtocols);
  const [backendHealth, setBackendHealth] = useState<{
    status: 'online' | 'offline' | 'checking';
    version?: string;
  }>({ status: 'checking' });
  const [recentRuns, setRecentRuns] = useState<RecentRunView[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);

  useEffect(() => {
    // 1. Check Backend Health
    getHealth()
      .then((health) => {
        setBackendHealth({
          status: 'online',
          version: health.engineVersion,
        });
      })
      .catch(() => {
        setBackendHealth({ status: 'offline' });
      });

    // 2. Fetch Protocols
    getProtocols()
      .then((res) => {
        if (Array.isArray(res.protocols) && res.protocols.length > 0) {
          const mapped: ProtocolInfo[] = res.protocols.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
          }));
          setProtocols(mapped);
        }
      })
      .catch(() => {
        // Fall back to default protocol descriptions
      });

    // 3. Fetch Recent Simulations (Server + Local)
    const loadRecent = async () => {
      setLoadingRuns(true);
      const items: RecentRunView[] = [];

      try {
        const serverSims = await getSimulations({ limit: 5 });
        for (const s of serverSims) {
          items.push({
            id: s.id,
            protocol: s.protocol,
            stationCount: s.configuration?.stationCount ?? s.configuration?.num_stations ?? 5,
            frameSizeBytes: s.configuration?.frameSizeBytes ?? s.configuration?.frame_size_bytes ?? 1500,
            dataRateBps: s.configuration?.dataRateBps ?? s.configuration?.channel_bandwidth_bps ?? 10_000_000,
            durationMs: s.configuration?.durationMs ?? (s.configuration?.simulation_time_us ? s.configuration.simulation_time_us / 1000 : 1000),
            trafficModel: s.configuration?.trafficModel ?? 'poisson',
            trafficIntensity: s.configuration?.trafficIntensity ?? 0.5,
            successfulFrames: s.metrics?.successfulFrames ?? 0,
            collisions: s.metrics?.collisions ?? 0,
            throughputBps: s.metrics?.throughputBps ?? 0,
            createdAt: s.createdAt,
          });
        }
      } catch {
        // Fallback to local
      }

      try {
        const local = getRuns();
        const serverIds = new Set(items.map((i) => i.id));
        for (const r of local) {
          if (!serverIds.has(r.id)) {
            items.push({
              id: r.id,
              protocol: r.config.protocol,
              stationCount: r.config.stationCount,
              frameSizeBytes: r.config.frameSizeBytes,
              dataRateBps: r.config.dataRateBps,
              durationMs: r.config.durationMs,
              trafficModel: r.config.trafficModel,
              trafficIntensity: r.config.trafficIntensity,
              successfulFrames: r.metrics.successfulFrames,
              collisions: r.metrics.collisions,
              throughputBps: r.metrics.throughputBps ?? 0,
              createdAt: r.createdAt,
            });
          }
        }
      } catch {
        // Ignore local error
      }

      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentRuns(items.slice(0, 5));
      setLoadingRuns(false);
    };

    loadRecent();
  }, []);

  return (
    <div className="home-workspace">
      {/* Hero Section */}
      <section className="hero-panel" aria-labelledby="hero-title">
        <div className="hero-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span className="hero-badge">SIMULATION WORKSPACE V3.0</span>
            <span
              className="mono"
              style={{
                fontSize: 11,
                padding: '2px 8px',
                border: '1px solid',
                borderColor:
                  backendHealth.status === 'online'
                    ? '#78B978'
                    : backendHealth.status === 'checking'
                      ? '#928A7F'
                      : '#D96A62',
                color:
                  backendHealth.status === 'online'
                    ? '#78B978'
                    : backendHealth.status === 'checking'
                      ? '#928A7F'
                      : '#D96A62',
              }}
            >
              {backendHealth.status === 'online'
                ? `BACKEND ONLINE (v${backendHealth.version || '1.0.0'})`
                : backendHealth.status === 'checking'
                  ? 'CHECKING ENGINE...'
                  : 'BACKEND OFFLINE'}
            </span>
          </div>
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
          {protocols.map((item) => (
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
            <p className="section-subtext">Experiments configured and recorded in the database or local storage.</p>
          </div>
          <Link className="btn" to="/history">
            View All History
          </Link>
        </div>

        {loadingRuns ? (
          <div className="panel" style={{ padding: 20, textAlign: 'center' }}>
            <p className="muted">Loading recent simulation runs...</p>
          </div>
        ) : recentRuns.length === 0 ? (
          <div className="empty-state">
            <h3>No Saved Simulations</h3>
            <p>Completed runs saved in the backend database or locally will appear here with measured metrics and parameters.</p>
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
                {recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {run.id.slice(0, 8)}...
                    </td>
                    <td>
                      <strong>{formatProtocol(run.protocol)}</strong>
                    </td>
                    <td className="numeric-cell">{run.stationCount}</td>
                    <td>
                      {run.frameSizeBytes} B @ {(run.dataRateBps / 1000).toLocaleString()} kbps
                      <br />
                      <span className="muted" style={{ fontSize: 11 }}>
                        {run.durationMs} ms, {run.trafficModel} ({run.trafficIntensity})
                      </span>
                    </td>
                    <td className="numeric-cell">{formatNumber(run.successfulFrames)}</td>
                    <td className="numeric-cell">{formatNumber(run.collisions)}</td>
                    <td className="numeric-cell mono">
                      {formatNumber(run.throughputBps, 1)} bps
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
