import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRuns, type RunRecord } from '../store/runs';
import { formatNumber, formatProtocol } from '../utils/format';

function sameConditions(runs: RunRecord[]): boolean {
  if (runs.length < 2) return false;
  const first = runs[0].config;
  return runs.slice(1).every(({ config }) =>
    config.stationCount === first.stationCount &&
    config.frameSizeBytes === first.frameSizeBytes &&
    config.dataRateBps === first.dataRateBps &&
    config.durationMs === first.durationMs &&
    config.trafficModel === first.trafficModel &&
    config.trafficIntensity === first.trafficIntensity &&
    config.randomSeed === first.randomSeed,
  );
}

export default function Comparisons() {
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
  const [chosenIds, setChosenIds] = useState<string[] | null>(null);
  const selectedIds = chosenIds ?? runs.slice(0, 2).map(run => run.id);

  const selectedRuns = useMemo(
    () => runs.filter(run => selectedIds.includes(run.id)),
    [runs, selectedIds],
  );
  const comparable = sameConditions(selectedRuns);
  const maxThroughput = Math.max(0, ...selectedRuns.map(run => run.metrics.throughputBps ?? 0));

  const toggleRun = (id: string) => {
    setChosenIds(current => (current ?? selectedIds).includes(id)
      ? (current ?? selectedIds).filter(selected => selected !== id)
      : [...(current ?? selectedIds), id]);
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Protocol comparisons</h1>
          <p>Select saved experiments to compare measured results and their shared conditions.</p>
        </div>
        <Link className="btn" to="/simulations/new">Create experiment</Link>
      </header>

      {error ? (
        <div className="error-message" role="alert">{error}</div>
      ) : runs.length === 0 ? (
        <div className="empty-state">
          <h2>No experiments to compare</h2>
          <p>Save completed simulations first. Results are not fabricated or generated for this view.</p>
          <Link className="btn primary" to="/simulations/new">Configure a simulation</Link>
        </div>
      ) : (
        <>
          <section className="panel" aria-labelledby="select-runs-heading">
            <h2 id="select-runs-heading">Experiments</h2>
            <p className="help-text">Choose at least two completed runs. Only common conditions are used to assess comparability.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Select</th>
                    <th scope="col">Protocol</th>
                    <th scope="col">Stations</th>
                    <th scope="col">Frame size</th>
                    <th scope="col">Data rate</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Seed</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(run => (
                    <tr key={run.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${formatProtocol(run.config.protocol)} run ${run.id}`}
                          checked={selectedIds.includes(run.id)}
                          onChange={() => toggleRun(run.id)}
                        />
                      </td>
                      <td><Link to={`/simulations/${run.id}`}>{formatProtocol(run.config.protocol)}</Link></td>
                      <td className="numeric-cell">{run.config.stationCount}</td>
                      <td className="numeric-cell">{run.config.frameSizeBytes} bytes</td>
                      <td className="numeric-cell">{run.config.dataRateBps.toLocaleString()} bps</td>
                      <td className="numeric-cell">{run.config.durationMs.toLocaleString()} ms</td>
                      <td className="numeric-cell">{run.config.randomSeed ?? 'Not recorded'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section" aria-labelledby="results-heading">
            <h2 className="section-heading" id="results-heading">Results</h2>
            {selectedRuns.length < 2 ? (
              <div className="empty-state">Select at least two runs to see a comparison.</div>
            ) : (
              <>
                <div className={comparable ? 'comparison-note' : 'error-message'} role={comparable ? 'status' : 'alert'}>
                  {comparable
                    ? 'Selected runs use the same station count, frame size, data rate, duration, traffic model, intensity, and random seed.'
                    : 'Selected runs use different conditions. Values are shown for inspection but are not a fair protocol comparison.'}
                </div>
                <figure
                  className="throughput-chart"
                  aria-label={`Throughput comparison: ${selectedRuns.map(run =>
                    `${formatProtocol(run.config.protocol)} ${formatNumber(run.metrics.throughputBps, 1)} bits per second`,
                  ).join('; ')}`}
                >
                  <figcaption>Throughput by protocol (bps)</figcaption>
                  <ol className="throughput-chart-list" aria-hidden="true">
                    {selectedRuns.map(run => {
                      const throughput = run.metrics.throughputBps ?? 0;
                      const width = maxThroughput > 0 ? (throughput / maxThroughput) * 100 : 0;
                      return (
                        <li className="throughput-chart-row" key={run.id}>
                          <span>{formatProtocol(run.config.protocol)}</span>
                          <span className="throughput-bar-axis">
                            <span className="throughput-bar" style={{ width: `${width}%` }} />
                          </span>
                          <span className="throughput-chart-value">{formatNumber(run.metrics.throughputBps, 1)}</span>
                        </li>
                      );
                    })}
                  </ol>
                </figure>
                <div className="table-wrap comparison-table">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Measured metric</th>
                        {selectedRuns.map(run => <th scope="col" key={run.id}>{formatProtocol(run.config.protocol)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">Successful frames</th>
                        {selectedRuns.map(run => <td className="numeric-cell" key={run.id}>{formatNumber(run.metrics.successfulFrames)}</td>)}
                      </tr>
                      <tr>
                        <th scope="row">Collision incidents</th>
                        {selectedRuns.map(run => <td className="numeric-cell" key={run.id}>{formatNumber(run.metrics.collisions)}</td>)}
                      </tr>
                      <tr>
                        <th scope="row">Retransmissions</th>
                        {selectedRuns.map(run => <td className="numeric-cell" key={run.id}>{formatNumber(run.metrics.retransmissions)}</td>)}
                      </tr>
                      <tr>
                        <th scope="row">Throughput (bps)</th>
                        {selectedRuns.map(run => <td className="numeric-cell" key={run.id}>{formatNumber(run.metrics.throughputBps, 1)}</td>)}
                      </tr>
                      <tr>
                        <th scope="row">Goodput (bps)</th>
                        {selectedRuns.map(run => <td className="numeric-cell" key={run.id}>{formatNumber(run.metrics.goodputBps, 1)}</td>)}
                      </tr>
                      <tr>
                        <th scope="row">Channel utilization</th>
                        {selectedRuns.map(run => (
                          <td className="numeric-cell" key={run.id}>
                            {run.metrics.channelUtilization === undefined
                              ? 'Not available'
                              : `${formatNumber(run.metrics.channelUtilization * 100, 1)}%`}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Average delay (ms)</th>
                        {selectedRuns.map(run => <td className="numeric-cell" key={run.id}>{formatNumber(run.metrics.averageDelayMs, 2)}</td>)}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="help-text">Throughput and goodput are measured over elapsed simulation time. Average delay is unavailable when no frame was delivered.</p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
