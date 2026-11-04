import { useEffect, useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getRun, type RunRecord } from '../store/runs';
import { formatDate, formatNumber, formatProtocol } from '../utils/format';
import type { Protocol } from '../types';
import { getSimulation } from '../api/simulations';
import { ArrowLeftIcon } from '../components/Icons';

const protocolColors: Record<Protocol, string> = {
  PURE_ALOHA: '#DDB487',
  SLOTTED_ALOHA: '#78A9E8',
  CSMA: '#78B978',
  CSMA_CD: '#D5A45D',
};

const EXP_A_COLOR = '#78A9E8';
const EXP_B_COLOR = '#78B978';

interface MetricComparisonItem {
  name: string;
  category: 'throughput' | 'contention' | 'reliability' | 'latency';
  unit: string;
  valA: number;
  valB: number;
  fractionDigits: number;
  higherIsBetter: boolean | null; // null = contextual / neutral
}

export default function ComparisonAnalysis() {
  const { idA: paramA, idB: paramB } = useParams<{ idA?: string; idB?: string }>();
  const [searchParams] = useSearchParams();

  // Parse ID parameters (supports route params, ?a=...&b=..., and ?ids=...,...)
  const idA = paramA || searchParams.get('a') || searchParams.get('ids')?.split(',')[0] || '';
  const idB = paramB || searchParams.get('b') || searchParams.get('ids')?.split(',')[1] || '';

  const [runA, setRunA] = useState<RunRecord | null>(null);
  const [runB, setRunB] = useState<RunRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Load experiment data from backend (with local storage fallback)
  useEffect(() => {
    if (!idA || !idB) {
      setLoadError('Two experiment IDs are required for comparative analysis.');
      setLoading(false);
      return;
    }

    if (idA === idB) {
      setLoadError('Please select two distinct experiments to compare.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    const fetchRun = async (id: string): Promise<RunRecord | null> => {
      // 1. Try backend
      try {
        const snap = await getSimulation(id);
        return {
          id: snap.id,
          config: snap.configuration,
          metrics: snap.metrics,
          createdAt: snap.createdAt,
          events: [],
          stations: snap.stations || [],
        };
      } catch {
        // 2. Try local runs
        const local = getRun(id);
        if (local) return local;
        return null;
      }
    };

    Promise.all([fetchRun(idA), fetchRun(idB)])
      .then(([resA, resB]) => {
        if (!resA && !resB) {
          setLoadError(`Neither experiment "${idA.slice(0, 8)}" nor "${idB.slice(0, 8)}" could be loaded from the server or local storage.`);
        } else if (!resA) {
          setLoadError(`Experiment A ("${idA.slice(0, 8)}") was not found.`);
        } else if (!resB) {
          setLoadError(`Experiment B ("${idB.slice(0, 8)}") was not found.`);
        } else {
          setRunA(resA);
          setRunB(resB);
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load comparison data.');
        setLoading(false);
      });
  }, [idA, idB]);

  // Controlled Experiment Verification
  const controlledComparison = useMemo(() => {
    if (!runA || !runB) return { isControlled: false, differences: [] };

    const confA = runA.config;
    const confB = runB.config;
    const diffs: string[] = [];

    if (confA.stationCount !== confB.stationCount) diffs.push(`Station Count (${confA.stationCount} vs ${confB.stationCount})`);
    if (confA.frameSizeBytes !== confB.frameSizeBytes) diffs.push(`Frame Size (${confA.frameSizeBytes}B vs ${confB.frameSizeBytes}B)`);
    if (confA.dataRateBps !== confB.dataRateBps) diffs.push(`Data Rate (${confA.dataRateBps / 1000}k vs ${confB.dataRateBps / 1000}k)`);
    if (confA.durationMs !== confB.durationMs) diffs.push(`Duration (${confA.durationMs}ms vs ${confB.durationMs}ms)`);
    if (confA.trafficModel !== confB.trafficModel) diffs.push(`Traffic Model (${confA.trafficModel} vs ${confB.trafficModel})`);
    if (confA.trafficIntensity !== confB.trafficIntensity) diffs.push(`Traffic Intensity (${confA.trafficIntensity} vs ${confB.trafficIntensity})`);
    if (confA.randomSeed !== confB.randomSeed) diffs.push(`Random Seed (${confA.randomSeed} vs ${confB.randomSeed})`);

    return {
      isControlled: diffs.length === 0,
      differences: diffs,
    };
  }, [runA, runB]);

  // Comprehensive Metric Definitions
  const metricsData = useMemo<MetricComparisonItem[]>(() => {
    if (!runA || !runB) return [];

    const mA = runA.metrics;
    const mB = runB.metrics;

    const collisionRateA = (mA.collisions / Math.max(1, (mA.successfulFrames + mA.collisions))) * 100;
    const collisionRateB = (mB.collisions / Math.max(1, (mB.successfulFrames + mB.collisions))) * 100;

    const pdrA = mA.generatedFrames && mA.generatedFrames > 0
      ? (mA.successfulFrames / mA.generatedFrames) * 100
      : (mA.successfulFrames / Math.max(1, (mA.successfulFrames + (mA.droppedFrames ?? 0)))) * 100;

    const pdrB = mB.generatedFrames && mB.generatedFrames > 0
      ? (mB.successfulFrames / mB.generatedFrames) * 100
      : (mB.successfulFrames / Math.max(1, (mB.successfulFrames + (mB.droppedFrames ?? 0)))) * 100;

    return [
      {
        name: 'Throughput',
        category: 'throughput',
        unit: 'bps',
        valA: mA.throughputBps ?? 0,
        valB: mB.throughputBps ?? 0,
        fractionDigits: 1,
        higherIsBetter: true,
      },
      {
        name: 'Channel Utilization',
        category: 'throughput',
        unit: '%',
        valA: (mA.channelUtilization ?? 0) * 100,
        valB: (mB.channelUtilization ?? 0) * 100,
        fractionDigits: 2,
        higherIsBetter: true,
      },
      {
        name: 'Collision Incidents',
        category: 'contention',
        unit: 'events',
        valA: mA.collisions ?? 0,
        valB: mB.collisions ?? 0,
        fractionDigits: 0,
        higherIsBetter: false,
      },
      {
        name: 'Collided Attempts',
        category: 'contention',
        unit: 'attempts',
        valA: mA.collidedAttempts ?? mA.collisions ?? 0,
        valB: mB.collidedAttempts ?? mB.collisions ?? 0,
        fractionDigits: 0,
        higherIsBetter: false,
      },
      {
        name: 'Collision Rate',
        category: 'contention',
        unit: '%',
        valA: collisionRateA,
        valB: collisionRateB,
        fractionDigits: 2,
        higherIsBetter: false,
      },
      {
        name: 'Delivered Frames',
        category: 'reliability',
        unit: 'frames',
        valA: mA.successfulFrames ?? 0,
        valB: mB.successfulFrames ?? 0,
        fractionDigits: 0,
        higherIsBetter: true,
      },
      {
        name: 'Packet Delivery Ratio',
        category: 'reliability',
        unit: '%',
        valA: pdrA,
        valB: pdrB,
        fractionDigits: 1,
        higherIsBetter: true,
      },
      {
        name: 'Retransmissions',
        category: 'contention',
        unit: 'attempts',
        valA: mA.retransmissions ?? 0,
        valB: mB.retransmissions ?? 0,
        fractionDigits: 0,
        higherIsBetter: false,
      },
      {
        name: 'Average Delay',
        category: 'latency',
        unit: 'ms',
        valA: mA.averageDelayMs ?? 0,
        valB: mB.averageDelayMs ?? 0,
        fractionDigits: 2,
        higherIsBetter: false,
      },
      {
        name: 'Dropped Frames',
        category: 'reliability',
        unit: 'frames',
        valA: mA.droppedFrames ?? 0,
        valB: mB.droppedFrames ?? 0,
        fractionDigits: 0,
        higherIsBetter: false,
      },
    ];
  }, [runA, runB]);

  // Deterministic Key Findings
  const keyFindings = useMemo(() => {
    if (!runA || !runB) return [];

    const findings: string[] = [];
    const pA = runA.config.protocol;
    const pB = runB.config.protocol;
    const nameA = `${formatProtocol(pA)} (Exp A)`;
    const nameB = `${formatProtocol(pB)} (Exp B)`;

    const tpA = runA.metrics.throughputBps ?? 0;
    const tpB = runB.metrics.throughputBps ?? 0;

    const colA = runA.metrics.collisions ?? 0;
    const colB = runB.metrics.collisions ?? 0;

    const delA = runA.metrics.averageDelayMs ?? 0;
    const delB = runB.metrics.averageDelayMs ?? 0;

    const framesA = runA.metrics.successfulFrames ?? 0;
    const framesB = runB.metrics.successfulFrames ?? 0;

    // 1. Throughput finding
    if (tpA > 0 || tpB > 0) {
      if (tpA > tpB) {
        const diffPct = tpB > 0 ? (((tpA - tpB) / tpB) * 100).toFixed(1) : '100.0';
        findings.push(`${nameA} delivered ${diffPct}% higher throughput (${formatNumber(tpA, 1)} bps) compared to ${nameB} (${formatNumber(tpB, 1)} bps).`);
      } else if (tpB > tpA) {
        const diffPct = tpA > 0 ? (((tpB - tpA) / tpA) * 100).toFixed(1) : '100.0';
        findings.push(`${nameB} delivered ${diffPct}% higher throughput (${formatNumber(tpB, 1)} bps) compared to ${nameA} (${formatNumber(tpA, 1)} bps).`);
      } else {
        findings.push(`Both experiments achieved identical throughput of ${formatNumber(tpA, 1)} bps.`);
      }
    }

    // 2. Collision & contention finding
    if (colA !== colB) {
      const lower = colA < colB ? nameA : nameB;
      const higher = colA < colB ? nameB : nameA;
      const lowerVal = Math.min(colA, colB);
      const higherVal = Math.max(colA, colB);
      findings.push(
        `${lower} experienced ${higherVal - lowerVal} fewer collision incidents (${lowerVal} vs ${higherVal}) on the shared medium than ${higher}.`,
      );
    } else {
      findings.push(`Both protocols encountered an equal number of collisions (${colA} incidents).`);
    }

    // 3. Frame delivery finding
    if (framesA !== framesB) {
      const winner = framesA > framesB ? nameA : nameB;
      const winnerCount = Math.max(framesA, framesB);
      const loserCount = Math.min(framesA, framesB);
      findings.push(`${winner} successfully transferred ${winnerCount} frames cleanly compared to ${loserCount} frames.`);
    }

    // 4. Latency / Delay finding
    if (delA > 0 && delB > 0) {
      if (delA < delB) {
        findings.push(`${nameA} recorded lower average transmission delay (${formatNumber(delA, 2)} ms vs ${formatNumber(delB, 2)} ms), expediting queue clearance.`);
      } else if (delB < delA) {
        findings.push(`${nameB} recorded lower average transmission delay (${formatNumber(delB, 2)} ms vs ${formatNumber(delA, 2)} ms), expediting queue clearance.`);
      }
    }

    // 5. Theoretical protocol architecture insight
    if (pA === 'PURE_ALOHA' && pB === 'SLOTTED_ALOHA') {
      findings.push('Slotted ALOHA constrains transmission starts to discrete slot boundaries, cutting the vulnerable collision window in half (from 2T to T) relative to uncoordinated Pure ALOHA.');
    } else if ((pA === 'PURE_ALOHA' || pA === 'SLOTTED_ALOHA') && (pB === 'CSMA' || pB === 'CSMA_CD')) {
      findings.push(`${formatProtocol(pB)} employs carrier sensing before transmitting ("listen before talk"), preventing stations from transmitting over existing on-air signals and drastically reducing primary collisions.`);
    } else if (pA === 'CSMA' && pB === 'CSMA_CD') {
      findings.push('CSMA/CD monitors channel voltage while transmitting ("listen while talk") and immediately halts corrupted transmissions with a 32-bit jam signal, saving channel time that standard CSMA wastes transmitting doomed packets.');
    }

    return findings;
  }, [runA, runB]);

  if (loading) {
    return (
      <div className="comparisons-workspace">
        <header className="page-header">
          <div>
            <h1>Loading Experiment Comparison...</h1>
            <p className="mono">Comparing {idA.slice(0, 8)} vs {idB.slice(0, 8)}</p>
          </div>
        </header>
        <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
          <p className="muted">Fetching authoritative experiment metrics from backend database...</p>
        </div>
      </div>
    );
  }

  if (loadError || !runA || !runB) {
    return (
      <div>
        <header className="page-header">
          <div>
            <h1>Comparison Unavailable</h1>
          </div>
        </header>
        <div className="error-message" role="alert">{loadError || 'The requested experiments could not be compared.'}</div>
        <p style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          <Link className="btn primary" to="/comparisons">
            <ArrowLeftIcon />
            Back to Experiment Selection
          </Link>
        </p>
      </div>
    );
  }

  // Calculate winner for a metric
  const getWinner = (item: MetricComparisonItem): {
    winner: 'A' | 'B' | 'TIED' | 'NONE';
    delta: number;
    pctDiff: number;
  } => {
    const delta = item.valB - item.valA;
    const base = item.valA;
    const pctDiff = base !== 0 ? Math.abs((delta / base) * 100) : 0;

    if (item.valA === item.valB) {
      return { winner: 'TIED', delta, pctDiff: 0 };
    }

    if (item.higherIsBetter === null) {
      return { winner: 'NONE', delta, pctDiff };
    }

    if (item.higherIsBetter) {
      return { winner: item.valB > item.valA ? 'B' : 'A', delta, pctDiff };
    } else {
      return { winner: item.valB < item.valA ? 'B' : 'A', delta, pctDiff };
    }
  };

  return (
    <div className="comparisons-workspace">
      {/* SECTION A: Comparison Header */}
      <header className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Experiment Comparison</h1>
          <p style={{ margin: '4px 0 0' }}>
            Side-by-side comparative analysis of Medium Access Control protocol mechanisms and recorded metrics.
          </p>
        </div>

        <div className="button-row">
          <Link className="btn" to="/simulations/new">
            New Simulation
          </Link>
        </div>
      </header>

      {/* Experiment Identity Cards (Side-by-Side A vs B) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
          gap: 16,
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        {/* Experiment A Card */}
        <div
          className="panel"
          style={{
            borderLeft: `4px solid ${EXP_A_COLOR}`,
            background: 'var(--color-surface)',
            padding: '12px 16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: EXP_A_COLOR }}>
              EXPERIMENT A
            </span>
            <Link className="mono" to={`/simulations/${runA.id}`} style={{ fontSize: 11 }}>
              Run: {runA.id.slice(0, 8)} ↗
            </Link>
          </div>
          <h2 style={{ fontSize: 18, margin: '2px 0 6px', color: protocolColors[runA.config.protocol] }}>
            {formatProtocol(runA.config.protocol)}
          </h2>
          <div className="mono muted" style={{ fontSize: 11 }}>
            {runA.config.stationCount} stations · {runA.config.durationMs}ms duration · {formatDate(runA.createdAt)}
          </div>
        </div>

        {/* VS Divider */}
        <div
          className="mono"
          style={{
            fontSize: 14,
            fontWeight: 700,
            padding: '8px 12px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-raised)',
            color: 'var(--color-accent)',
          }}
        >
          VS
        </div>

        {/* Experiment B Card */}
        <div
          className="panel"
          style={{
            borderLeft: `4px solid ${EXP_B_COLOR}`,
            background: 'var(--color-surface)',
            padding: '12px 16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: EXP_B_COLOR }}>
              EXPERIMENT B
            </span>
            <Link className="mono" to={`/simulations/${runB.id}`} style={{ fontSize: 11 }}>
              Run: {runB.id.slice(0, 8)} ↗
            </Link>
          </div>
          <h2 style={{ fontSize: 18, margin: '2px 0 6px', color: protocolColors[runB.config.protocol] }}>
            {formatProtocol(runB.config.protocol)}
          </h2>
          <div className="mono muted" style={{ fontSize: 11 }}>
            {runB.config.stationCount} stations · {runB.config.durationMs}ms duration · {formatDate(runB.createdAt)}
          </div>
        </div>
      </div>

      {/* SECTION B: Configuration Comparison & Controlled Experiment Detection */}
      <section className="panel" style={{ marginBottom: 20 }} aria-labelledby="config-heading">
        <div className="topology-header" style={{ marginBottom: 12 }}>
          <h2 id="config-heading" style={{ fontSize: 15, margin: 0 }}>
            Experimental Parameter Matrix
          </h2>
          <span className="mono" style={{ fontSize: 12 }}>
            {controlledComparison.isControlled ? (
              <strong style={{ color: '#78B978' }}>CONTROLLED COMPARISON (1 VARIABLE)</strong>
            ) : (
              <span style={{ color: '#D5A45D' }}>MULTI-VARIABLE COMPARISON ({controlledComparison.differences.length} DIFFS)</span>
            )}
          </span>
        </div>

        {/* Controlled Experiment Status Banner */}
        <div
          className={controlledComparison.isControlled ? 'comparison-fair-note' : 'comparison-caution-note'}
          role={controlledComparison.isControlled ? 'status' : 'alert'}
          style={{ marginBottom: 14 }}
        >
          {controlledComparison.isControlled ? (
            <>
              <strong style={{ color: '#78B978' }}>Controlled Scientific Benchmark: </strong>
              Both experiments share identical station count, frame size, channel data rate, simulation duration, traffic model, traffic intensity ($G$), and random seed. The MAC protocol architecture is the primary independent variable.
            </>
          ) : (
            <>
              <strong style={{ color: '#D5A45D' }}>Multi-Variable Comparison Detected: </strong>
              Experiments differ in: {controlledComparison.differences.join(', ')}. Performance differences reflect distinct experimental workloads and environmental configurations in addition to protocol mechanics.
            </>
          )}
        </div>

        {/* Configuration Parameters Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col" style={{ width: '28%' }}>Parameter</th>
                <th scope="col" style={{ width: '30%', color: EXP_A_COLOR }}>
                  Exp A: {formatProtocol(runA.config.protocol)}
                </th>
                <th scope="col" style={{ width: '30%', color: EXP_B_COLOR }}>
                  Exp B: {formatProtocol(runB.config.protocol)}
                </th>
                <th scope="col" style={{ width: '12%' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">MAC Protocol</th>
                <td className="mono"><strong>{formatProtocol(runA.config.protocol)}</strong></td>
                <td className="mono"><strong>{formatProtocol(runB.config.protocol)}</strong></td>
                <td>
                  <span className="mono" style={{ fontSize: 10, padding: '2px 6px', background: '#252626', color: 'var(--color-accent)' }}>
                    {runA.config.protocol === runB.config.protocol ? 'IDENTICAL' : 'VARIABLE'}
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">Active Stations</th>
                <td className="mono">{runA.config.stationCount} stations</td>
                <td className="mono">{runB.config.stationCount} stations</td>
                <td>
                  <span className="mono" style={{ fontSize: 10, color: runA.config.stationCount === runB.config.stationCount ? '#78B978' : '#D5A45D' }}>
                    {runA.config.stationCount === runB.config.stationCount ? 'IDENTICAL' : 'DIFFERENT'}
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">Frame Size</th>
                <td className="mono">{runA.config.frameSizeBytes.toLocaleString()} bytes</td>
                <td className="mono">{runB.config.frameSizeBytes.toLocaleString()} bytes</td>
                <td>
                  <span className="mono" style={{ fontSize: 10, color: runA.config.frameSizeBytes === runB.config.frameSizeBytes ? '#78B978' : '#D5A45D' }}>
                    {runA.config.frameSizeBytes === runB.config.frameSizeBytes ? 'IDENTICAL' : 'DIFFERENT'}
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">Channel Bandwidth</th>
                <td className="mono">{(runA.config.dataRateBps / 1000).toLocaleString()} kbps</td>
                <td className="mono">{(runB.config.dataRateBps / 1000).toLocaleString()} kbps</td>
                <td>
                  <span className="mono" style={{ fontSize: 10, color: runA.config.dataRateBps === runB.config.dataRateBps ? '#78B978' : '#D5A45D' }}>
                    {runA.config.dataRateBps === runB.config.dataRateBps ? 'IDENTICAL' : 'DIFFERENT'}
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">Experiment Duration</th>
                <td className="mono">{runA.config.durationMs.toLocaleString()} ms</td>
                <td className="mono">{runB.config.durationMs.toLocaleString()} ms</td>
                <td>
                  <span className="mono" style={{ fontSize: 10, color: runA.config.durationMs === runB.config.durationMs ? '#78B978' : '#D5A45D' }}>
                    {runA.config.durationMs === runB.config.durationMs ? 'IDENTICAL' : 'DIFFERENT'}
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">Traffic Distribution</th>
                <td className="mono">{runA.config.trafficModel.toUpperCase()}</td>
                <td className="mono">{runB.config.trafficModel.toUpperCase()}</td>
                <td>
                  <span className="mono" style={{ fontSize: 10, color: runA.config.trafficModel === runB.config.trafficModel ? '#78B978' : '#D5A45D' }}>
                    {runA.config.trafficModel === runB.config.trafficModel ? 'IDENTICAL' : 'DIFFERENT'}
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">Offered Traffic Intensity (G)</th>
                <td className="mono">{runA.config.trafficIntensity}</td>
                <td className="mono">{runB.config.trafficIntensity}</td>
                <td>
                  <span className="mono" style={{ fontSize: 10, color: runA.config.trafficIntensity === runB.config.trafficIntensity ? '#78B978' : '#D5A45D' }}>
                    {runA.config.trafficIntensity === runB.config.trafficIntensity ? 'IDENTICAL' : 'DIFFERENT'}
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">Pseudo-RNG Seed</th>
                <td className="mono">{runA.config.randomSeed ?? 'Not recorded'}</td>
                <td className="mono">{runB.config.randomSeed ?? 'Not recorded'}</td>
                <td>
                  <span className="mono" style={{ fontSize: 10, color: runA.config.randomSeed === runB.config.randomSeed ? '#78B978' : '#D5A45D' }}>
                    {runA.config.randomSeed === runB.config.randomSeed ? 'IDENTICAL' : 'DIFFERENT'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION C: Key Performance Indicators (KPI Grid) */}
      <section className="panel" style={{ marginBottom: 20 }} aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" style={{ fontSize: 15, marginBottom: 12 }}>
          Key Performance Indicators & Head-to-Head Variance
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12,
          }}
        >
          {metricsData.map((item) => {
            const { winner, delta, pctDiff } = getWinner(item);

            let winnerTag = 'TIED';
            let winnerColor = '#928A7F';

            if (winner === 'A') {
              winnerTag = `EXP A ADVANTAGE (+${pctDiff.toFixed(1)}%)`;
              winnerColor = EXP_A_COLOR;
            } else if (winner === 'B') {
              winnerTag = `EXP B ADVANTAGE (+${pctDiff.toFixed(1)}%)`;
              winnerColor = EXP_B_COLOR;
            } else if (winner === 'NONE') {
              winnerTag = 'CONTEXTUAL';
              winnerColor = '#DDB487';
            }

            return (
              <div
                key={item.name}
                style={{
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-raised)',
                  padding: '10px 14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                    {item.name}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      padding: '1px 5px',
                      border: '1px solid currentColor',
                      color: winnerColor,
                    }}
                  >
                    {winnerTag}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    padding: '6px 0',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <div>
                    <span className="muted mono" style={{ fontSize: 10, display: 'block' }}>EXP A ({formatProtocol(runA.config.protocol)})</span>
                    <strong className="mono" style={{ fontSize: 15, color: EXP_A_COLOR }}>
                      {formatNumber(item.valA, item.fractionDigits)} <span style={{ fontSize: 11 }}>{item.unit}</span>
                    </strong>
                  </div>
                  <div>
                    <span className="muted mono" style={{ fontSize: 10, display: 'block' }}>EXP B ({formatProtocol(runB.config.protocol)})</span>
                    <strong className="mono" style={{ fontSize: 15, color: EXP_B_COLOR }}>
                      {formatNumber(item.valB, item.fractionDigits)} <span style={{ fontSize: 11 }}>{item.unit}</span>
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 11 }}>
                  <span className="muted mono">
                    Difference (B - A):
                  </span>
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {delta > 0 ? `+${formatNumber(delta, item.fractionDigits)}` : formatNumber(delta, item.fractionDigits)} {item.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION D: Multiple Data Visualizations */}
      <section className="panel" style={{ marginBottom: 20 }} aria-labelledby="visualizations-heading">
        <div className="topology-header" style={{ marginBottom: 16 }}>
          <h2 id="visualizations-heading" style={{ fontSize: 15, margin: 0 }}>
            Analytical Data Visualizations
          </h2>
          <div className="chart-legend mono" style={{ fontSize: 11 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, background: EXP_A_COLOR }} />
              Exp A: {formatProtocol(runA.config.protocol)}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 12 }}>
              <span style={{ width: 10, height: 10, background: EXP_B_COLOR }} />
              Exp B: {formatProtocol(runB.config.protocol)}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
          {/* Chart 1: Throughput Comparison */}
          <div style={{ border: '1px solid var(--color-border)', padding: 12, background: '#191A1A' }}>
            <div style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 13, margin: '0 0 2px' }}>1. Effective Throughput (bps)</h3>
              <span className="muted mono" style={{ fontSize: 11 }}>Actual delivered bit rate transferred across the channel</span>
            </div>
            {(() => {
              const tpA = runA.metrics.throughputBps ?? 0;
              const tpB = runB.metrics.throughputBps ?? 0;
              const maxTp = Math.max(tpA, tpB, 1000);
              const wA = (tpA / maxTp) * 260;
              const wB = (tpB / maxTp) * 260;

              return (
                <svg viewBox="0 0 460 90" width="100%" height="90" style={{ display: 'block' }} aria-label="Throughput Comparison Chart">
                  <line x1="120" y1="10" x2="120" y2="75" stroke="#403C36" strokeWidth="1" />
                  {/* Exp A */}
                  <text x="110" y="32" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="end">Exp A</text>
                  <rect x="120" y="20" width={Math.max(2, wA)} height="16" fill={EXP_A_COLOR} />
                  <text x={126 + wA} y="32" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono">{formatNumber(tpA, 1)} bps</text>
                  {/* Exp B */}
                  <text x="110" y="62" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="end">Exp B</text>
                  <rect x="120" y="50" width={Math.max(2, wB)} height="16" fill={EXP_B_COLOR} />
                  <text x={126 + wB} y="62" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono">{formatNumber(tpB, 1)} bps</text>
                </svg>
              );
            })()}
          </div>

          {/* Chart 2: Collision & Overlap Analysis */}
          <div style={{ border: '1px solid var(--color-border)', padding: 12, background: '#191A1A' }}>
            <div style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 13, margin: '0 0 2px' }}>2. Collision Incidents vs Collided Attempts</h3>
              <span className="muted mono" style={{ fontSize: 11 }}>Incident count on medium vs station attempts ruined</span>
            </div>
            {(() => {
              const incA = runA.metrics.collisions ?? 0;
              const attA = runA.metrics.collidedAttempts ?? incA;
              const incB = runB.metrics.collisions ?? 0;
              const attB = runB.metrics.collidedAttempts ?? incB;
              const maxCol = Math.max(incA, attA, incB, attB, 1);
              const wIncA = (incA / maxCol) * 220;
              const wAttA = (attA / maxCol) * 220;
              const wIncB = (incB / maxCol) * 220;
              const wAttB = (attB / maxCol) * 220;

              return (
                <svg viewBox="0 0 460 115" width="100%" height="115" style={{ display: 'block' }} aria-label="Collision Analysis Chart">
                  <line x1="140" y1="10" x2="140" y2="105" stroke="#403C36" strokeWidth="1" />
                  {/* Exp A */}
                  <text x="130" y="26" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="end">A: Incidents</text>
                  <rect x="140" y="16" width={Math.max(2, wIncA)} height="12" fill={EXP_A_COLOR} />
                  <text x={146 + wIncA} y="26" fill="#F3EDE4" fontSize="9" fontFamily="IBM Plex Mono">{incA}</text>

                  <text x="130" y="44" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="end">A: Attempts</text>
                  <rect x="140" y="34" width={Math.max(2, wAttA)} height="12" fill="#D96A62" />
                  <text x={146 + wAttA} y="44" fill="#F3EDE4" fontSize="9" fontFamily="IBM Plex Mono">{attA}</text>

                  {/* Exp B */}
                  <text x="130" y="74" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="end">B: Incidents</text>
                  <rect x="140" y="64" width={Math.max(2, wIncB)} height="12" fill={EXP_B_COLOR} />
                  <text x={146 + wIncB} y="74" fill="#F3EDE4" fontSize="9" fontFamily="IBM Plex Mono">{incB}</text>

                  <text x="130" y="92" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="end">B: Attempts</text>
                  <rect x="140" y="82" width={Math.max(2, wAttB)} height="12" fill="#D96A62" />
                  <text x={146 + wAttB} y="92" fill="#F3EDE4" fontSize="9" fontFamily="IBM Plex Mono">{attB}</text>
                </svg>
              );
            })()}
          </div>

          {/* Chart 3: Frame Delivery Accounting */}
          <div style={{ border: '1px solid var(--color-border)', padding: 12, background: '#191A1A' }}>
            <div style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 13, margin: '0 0 2px' }}>3. Frame Delivery Accounting</h3>
              <span className="muted mono" style={{ fontSize: 11 }}>Cleanly delivered vs collided frames</span>
            </div>
            {(() => {
              const delA = runA.metrics.successfulFrames ?? 0;
              const delB = runB.metrics.successfulFrames ?? 0;
              const maxDel = Math.max(delA, delB, 1);
              const wDelA = (delA / maxDel) * 260;
              const wDelB = (delB / maxDel) * 260;

              return (
                <svg viewBox="0 0 460 90" width="100%" height="90" style={{ display: 'block' }} aria-label="Delivered Frames Chart">
                  <line x1="120" y1="10" x2="120" y2="75" stroke="#403C36" strokeWidth="1" />
                  {/* Exp A */}
                  <text x="110" y="32" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="end">Exp A Delivered</text>
                  <rect x="120" y="20" width={Math.max(2, wDelA)} height="16" fill={EXP_A_COLOR} />
                  <text x={126 + wDelA} y="32" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono">{delA} frames</text>
                  {/* Exp B */}
                  <text x="110" y="62" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="end">Exp B Delivered</text>
                  <rect x="120" y="50" width={Math.max(2, wDelB)} height="16" fill={EXP_B_COLOR} />
                  <text x={126 + wDelB} y="62" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono">{delB} frames</text>
                </svg>
              );
            })()}
          </div>

          {/* Chart 4: Channel Utilization & Efficiency */}
          <div style={{ border: '1px solid var(--color-border)', padding: 12, background: '#191A1A' }}>
            <div style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 13, margin: '0 0 2px' }}>4. Channel Utilization Ratio</h3>
              <span className="muted mono" style={{ fontSize: 11 }}>Percentage of simulation time medium was occupied cleanly</span>
            </div>
            {(() => {
              const utilA = (runA.metrics.channelUtilization ?? 0) * 100;
              const utilB = (runB.metrics.channelUtilization ?? 0) * 100;
              const wUtilA = Math.min(260, (utilA / 100) * 260);
              const wUtilB = Math.min(260, (utilB / 100) * 260);

              return (
                <svg viewBox="0 0 460 90" width="100%" height="90" style={{ display: 'block' }} aria-label="Channel Utilization Chart">
                  <line x1="120" y1="10" x2="120" y2="75" stroke="#403C36" strokeWidth="1" />
                  {/* 100% boundary */}
                  <line x1={380} y1="10" x2={380} y2="75" stroke="#625344" strokeDasharray="3 3" />
                  <text x="380" y="8" fill="#928A7F" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="middle">100%</text>

                  {/* Exp A */}
                  <text x="110" y="32" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="end">Exp A</text>
                  <rect x="120" y="20" width={Math.max(2, wUtilA)} height="16" fill={EXP_A_COLOR} />
                  <text x={126 + wUtilA} y="32" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono">{formatNumber(utilA, 2)}%</text>
                  {/* Exp B */}
                  <text x="110" y="62" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="end">Exp B</text>
                  <rect x="120" y="50" width={Math.max(2, wUtilB)} height="16" fill={EXP_B_COLOR} />
                  <text x={126 + wUtilB} y="62" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono">{formatNumber(utilB, 2)}%</text>
                </svg>
              );
            })()}
          </div>

          {/* Chart 5: Average Transmission Delay */}
          <div style={{ border: '1px solid var(--color-border)', padding: 12, background: '#191A1A' }}>
            <div style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 13, margin: '0 0 2px' }}>5. Average Frame Delay (ms)</h3>
              <span className="muted mono" style={{ fontSize: 11 }}>Mean time from generation to delivery including backoff</span>
            </div>
            {(() => {
              const delA = runA.metrics.averageDelayMs ?? 0;
              const delB = runB.metrics.averageDelayMs ?? 0;
              const maxDel = Math.max(delA, delB, 0.1);
              const wDelA = (delA / maxDel) * 260;
              const wDelB = (delB / maxDel) * 260;

              return (
                <svg viewBox="0 0 460 90" width="100%" height="90" style={{ display: 'block' }} aria-label="Average Delay Chart">
                  <line x1="120" y1="10" x2="120" y2="75" stroke="#403C36" strokeWidth="1" />
                  {/* Exp A */}
                  <text x="110" y="32" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="end">Exp A</text>
                  <rect x="120" y="20" width={Math.max(2, wDelA)} height="16" fill={EXP_A_COLOR} />
                  <text x={126 + wDelA} y="32" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono">{formatNumber(delA, 2)} ms</text>
                  {/* Exp B */}
                  <text x="110" y="62" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="end">Exp B</text>
                  <rect x="120" y="50" width={Math.max(2, wDelB)} height="16" fill={EXP_B_COLOR} />
                  <text x={126 + wDelB} y="62" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono">{formatNumber(delB, 2)} ms</text>
                </svg>
              );
            })()}
          </div>

          {/* Chart 6: Retransmission Overhead */}
          <div style={{ border: '1px solid var(--color-border)', padding: 12, background: '#191A1A' }}>
            <div style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 13, margin: '0 0 2px' }}>6. Retransmission Overhead</h3>
              <span className="muted mono" style={{ fontSize: 11 }}>Repeat attempts caused by contention and collisions</span>
            </div>
            {(() => {
              const retA = runA.metrics.retransmissions ?? 0;
              const retB = runB.metrics.retransmissions ?? 0;
              const maxRet = Math.max(retA, retB, 1);
              const wRetA = (retA / maxRet) * 260;
              const wRetB = (retB / maxRet) * 260;

              return (
                <svg viewBox="0 0 460 90" width="100%" height="90" style={{ display: 'block' }} aria-label="Retransmission Overhead Chart">
                  <line x1="120" y1="10" x2="120" y2="75" stroke="#403C36" strokeWidth="1" />
                  {/* Exp A */}
                  <text x="110" y="32" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="end">Exp A</text>
                  <rect x="120" y="20" width={Math.max(2, wRetA)} height="16" fill={EXP_A_COLOR} />
                  <text x={126 + wRetA} y="32" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono">{retA} retries</text>
                  {/* Exp B */}
                  <text x="110" y="62" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="end">Exp B</text>
                  <rect x="120" y="50" width={Math.max(2, wRetB)} height="16" fill={EXP_B_COLOR} />
                  <text x={126 + wRetB} y="62" fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono">{retB} retries</text>
                </svg>
              );
            })()}
          </div>
        </div>
      </section>

      {/* SECTION E: Detailed Comparative Metrics Table */}
      <section className="panel" style={{ marginBottom: 20 }} aria-labelledby="detailed-table-heading">
        <h2 id="detailed-table-heading" style={{ fontSize: 16, marginBottom: 12 }}>
          Detailed Comparative Metrics Table
        </h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col" style={{ width: '26%' }}>Parameter / Metric</th>
                <th scope="col" style={{ width: '22%', color: EXP_A_COLOR }}>
                  Exp A: {formatProtocol(runA.config.protocol)}
                  <br />
                  <span className="mono muted" style={{ fontSize: 10 }}>({runA.id.slice(0, 8)})</span>
                </th>
                <th scope="col" style={{ width: '22%', color: EXP_B_COLOR }}>
                  Exp B: {formatProtocol(runB.config.protocol)}
                  <br />
                  <span className="mono muted" style={{ fontSize: 10 }}>({runB.id.slice(0, 8)})</span>
                </th>
                <th scope="col" style={{ width: '16%' }}>Difference (B - A)</th>
                <th scope="col" style={{ width: '16%' }}>Better Result</th>
              </tr>
            </thead>
            <tbody>
              {metricsData.map((item) => {
                const { winner, delta, pctDiff } = getWinner(item);

                let winnerLabel = 'Tied';
                let winnerColor = '#928A7F';

                if (winner === 'A') {
                  winnerLabel = `Exp A (${formatProtocol(runA.config.protocol)})`;
                  winnerColor = EXP_A_COLOR;
                } else if (winner === 'B') {
                  winnerLabel = `Exp B (${formatProtocol(runB.config.protocol)})`;
                  winnerColor = EXP_B_COLOR;
                } else if (winner === 'NONE') {
                  winnerLabel = 'Neutral';
                  winnerColor = '#DDB487';
                }

                return (
                  <tr key={item.name}>
                    <th scope="row">
                      {item.name}
                      <span className="muted" style={{ fontSize: 11, marginLeft: 4 }}>
                        ({item.unit})
                      </span>
                    </th>
                    <td className="mono">
                      {formatNumber(item.valA, item.fractionDigits)}
                    </td>
                    <td className="mono">
                      {formatNumber(item.valB, item.fractionDigits)}
                    </td>
                    <td className="mono">
                      {delta > 0 ? `+${formatNumber(delta, item.fractionDigits)}` : formatNumber(delta, item.fractionDigits)}
                      {pctDiff > 0 && <span className="muted" style={{ fontSize: 10, marginLeft: 4 }}>({pctDiff.toFixed(1)}%)</span>}
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: 11, color: winnerColor, fontWeight: 600 }}>
                        {winnerLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION F: Key Simulation Findings */}
      <section className="panel key-insight-panel" style={{ marginBottom: 20 }} aria-labelledby="findings-heading">
        <div className="insight-header">
          <h2 id="findings-heading" style={{ fontSize: 15, margin: 0, color: 'var(--color-accent)' }}>
            Key Findings & Analytical Deductions
          </h2>
          <span className="mono" style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            DATA-DRIVEN FACTUAL DEDUCTION
          </span>
        </div>

        <ul style={{ margin: '8px 0 0 20px', padding: 0, fontSize: 13, lineHeight: 1.8 }}>
          {keyFindings.map((finding, idx) => (
            <li key={idx} style={{ color: 'var(--color-text-primary)' }}>
              {finding}
            </li>
          ))}
        </ul>
      </section>

      {/* SECTION G: Navigation and Actions Footer */}
      <div className="button-row" style={{ justifyContent: 'space-between' }}>
        <Link className="btn" to="/comparisons">
          <ArrowLeftIcon />
          Back to Experiment Selection
        </Link>

        <div>
          <Link className="btn primary" to="/simulations/new">
            New Simulation
          </Link>
        </div>
      </div>
    </div>
  );
}
