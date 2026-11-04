import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Protocol, SimulationConfig, TrafficModel } from '../types';
import { formatNumber, formatProtocol } from '../utils/format';
import { ProtocolDiagram } from '../components/ProtocolDiagram';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from '../components/Icons';
import { getSimulationDefaults } from '../store/runs';
import { createSimulation } from '../api/simulations';
import { HttpResponseError } from '../api/client';

const protocols: { id: Protocol; name: string; description: string }[] = [
  {
    id: 'PURE_ALOHA',
    name: 'Pure ALOHA',
    description: 'Stations transmit frames immediately without sensing. Collision vulnerability period equals 2 frame times.',
  },
  {
    id: 'SLOTTED_ALOHA',
    name: 'Slotted ALOHA',
    description: 'Transmissions are restricted to predefined discrete time slots. Collision vulnerability period is reduced to 1 frame time.',
  },
  {
    id: 'CSMA',
    name: 'CSMA',
    description: 'Carrier Sense Multiple Access senses the medium before transmitting. Defers if another station is transmitting.',
  },
  {
    id: 'CSMA_CD',
    name: 'CSMA/CD',
    description: 'Carrier Sense with Collision Detection aborts transmissions immediately upon detecting an active collision.',
  },
];

type WizardStep = 1 | 2 | 3 | 4;

export default function NewSim() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedProtocol = searchParams.get('protocol');
  const defaults = getSimulationDefaults();

  const [step, setStep] = useState<WizardStep>(1);

  // Step 1: Protocol
  const [protocol, setProtocol] = useState<Protocol>(
    protocols.some(p => p.id === requestedProtocol) ? (requestedProtocol as Protocol) : 'PURE_ALOHA',
  );

  // Step 2: Network
  const [stationCount, setStationCount] = useState(String(defaults.stationCount));
  const [frameSizeBytes, setFrameSizeBytes] = useState(String(defaults.frameSizeBytes));
  const [dataRateBps, setDataRateBps] = useState(String(defaults.dataRateBps));
  const [durationMs, setDurationMs] = useState(String(defaults.durationMs));

  // Step 3: Traffic
  const [trafficModel, setTrafficModel] = useState<TrafficModel>(defaults.trafficModel);
  const [trafficIntensity, setTrafficIntensity] = useState(String(defaults.trafficIntensity));

  // Step 4: Simulation
  const [randomSeed, setRandomSeed] = useState('42');
  const [slotDurationMs, setSlotDurationMs] = useState('8.192');
  const [propagationDelayMs, setPropagationDelayMs] = useState('0.25');
  const [maxRetries, setMaxRetries] = useState('12');
  const [maxBackoffSlots, setMaxBackoffSlots] = useState('16');

  // Errors & submission
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Validation per step
  const validateStep = (targetStep: WizardStep): boolean => {
    const nextErrors: Record<string, string> = {};

    if (targetStep === 1) {
      if (!protocols.some(p => p.id === protocol)) {
        nextErrors.protocol = 'Please select a valid MAC protocol.';
      }
    } else if (targetStep === 2) {
      const stationVal = Number(stationCount);
      const frameVal = Number(frameSizeBytes);
      const rateVal = Number(dataRateBps);
      const durationVal = Number(durationMs);

      if (!Number.isInteger(stationVal) || stationVal < 2 || stationVal > 64) {
        nextErrors.stationCount = 'Enter a whole number of stations from 2 to 64.';
      }
      if (!Number.isInteger(frameVal) || frameVal < 64 || frameVal > 65535) {
        nextErrors.frameSizeBytes = 'Enter a frame size from 64 to 65,535 bytes.';
      }
      if (!Number.isInteger(rateVal) || rateVal < 1000 || rateVal > 1_000_000_000) {
        nextErrors.dataRateBps = 'Enter a transmission rate from 1,000 to 1,000,000,000 bits per second.';
      }
      if (!Number.isFinite(durationVal) || durationVal < 1 || durationVal > 120_000) {
        nextErrors.durationMs = 'Enter an experiment duration from 1 to 120,000 milliseconds.';
      }
    } else if (targetStep === 3) {
      const intensityVal = Number(trafficIntensity);
      if (!Number.isFinite(intensityVal) || intensityVal <= 0 || intensityVal > 5) {
        nextErrors.trafficIntensity = 'Traffic intensity must be greater than 0 and no more than 5.0.';
      }

      // Check expected total frame volume
      const frameVal = Number(frameSizeBytes);
      const rateVal = Number(dataRateBps);
      const stationVal = Number(stationCount);
      const durationVal = Number(durationMs);
      if (frameVal > 0 && rateVal > 0 && stationVal > 0 && durationVal > 0) {
        const frameTimeMs = (frameVal * 8 * 1000) / rateVal;
        const expectedFrames = (stationVal * intensityVal * durationVal) / frameTimeMs;
        if (expectedFrames > 50_000) {
          nextErrors.workload =
            'Estimated workload exceeds 50,000 frames. Reduce duration, reduce traffic intensity, or increase frame size.';
        }
      }
    } else if (targetStep === 4) {
      const seedVal = randomSeed.trim() === '' ? undefined : Number(randomSeed);
      const slotVal = Number(slotDurationMs);
      const propVal = Number(propagationDelayMs);
      const retryVal = Number(maxRetries);
      const backoffVal = Number(maxBackoffSlots);

      if (
        randomSeed.trim() !== '' &&
        (!Number.isInteger(seedVal) || (seedVal ?? -1) < 0 || (seedVal ?? 0) > 2_147_483_647)
      ) {
        nextErrors.randomSeed = 'Random seed must be an integer between 0 and 2,147,483,647.';
      }
      if (protocol === 'SLOTTED_ALOHA' || protocol === 'CSMA_CD') {
        if (!Number.isFinite(slotVal) || slotVal <= 0) {
          nextErrors.slotDurationMs = 'Slot duration must be a positive number greater than 0 ms.';
        }
      }
      if (protocol === 'CSMA_CD') {
        if (!Number.isFinite(propVal) || propVal < 0) {
          nextErrors.propagationDelayMs = 'Propagation delay must be 0 ms or greater.';
        }
        if (!Number.isInteger(retryVal) || retryVal < 1 || retryVal > 32) {
          nextErrors.maxRetries = 'Maximum retries must be a whole number from 1 to 32.';
        }
        if (!Number.isInteger(backoffVal) || backoffVal < 1 || backoffVal > 1024) {
          nextErrors.maxBackoffSlots = 'Maximum backoff slots must be a whole number from 1 to 1,024.';
        }
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(curr => Math.min(4, curr + 1) as WizardStep);
    }
  };

  const prevStep = () => {
    setErrors({});
    setStep(curr => Math.max(1, curr - 1) as WizardStep);
  };

  const jumpToStep = (target: WizardStep) => {
    if (target < step) {
      setErrors({});
      setStep(target);
    } else {
      let canAdvance = true;
      for (let s = step; s < target; s++) {
        if (!validateStep(s as WizardStep)) {
          canAdvance = false;
          break;
        }
      }
      if (canAdvance) {
        setStep(target);
      }
    }
  };

  const handleStartSimulation = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError('');

    for (let s = 1; s <= 4; s++) {
      if (!validateStep(s as WizardStep)) {
        setStep(s as WizardStep);
        return;
      }
    }

    setSubmitting(true);
    try {
      const config: SimulationConfig = {
        protocol,
        stationCount: Number(stationCount),
        frameSizeBytes: Number(frameSizeBytes),
        dataRateBps: Number(dataRateBps),
        durationMs: Number(durationMs),
        trafficModel,
        trafficIntensity: Number(trafficIntensity),
        randomSeed: randomSeed.trim() === '' ? undefined : Number(randomSeed),
        slotDurationMs:
          protocol === 'SLOTTED_ALOHA' || protocol === 'CSMA_CD' ? Number(slotDurationMs) : undefined,
        propagationDelayMs:
          protocol === 'CSMA_CD' || protocol === 'CSMA' ? Number(propagationDelayMs) : undefined,
        maxRetries: protocol === 'CSMA_CD' ? Number(maxRetries) : undefined,
        maxBackoffSlots: protocol === 'CSMA_CD' ? Number(maxBackoffSlots) : undefined,
      };

      const created = await createSimulation(config);
      navigate(`/simulations/${created.id}`);
    } catch (reason) {
      if (reason instanceof HttpResponseError) {
        setSubmitError(reason.apiError.message || `Server rejected simulation configuration (Status ${reason.statusCode}).`);
      } else if (reason instanceof Error) {
        setSubmitError(reason.message);
      } else {
        setSubmitError('The simulation could not be initialized.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const frameTimeMs =
    Number(dataRateBps) > 0 ? (Number(frameSizeBytes) * 8 * 1000) / Number(dataRateBps) : 0;
  const estimatedFrames =
    frameTimeMs > 0
      ? Math.round((Number(stationCount) * Number(trafficIntensity) * Number(durationMs)) / frameTimeMs)
      : 0;

  const fieldError = (key: string) =>
    errors[key] ? (
      <small id={`${key}-error`} className="error-text">
        {errors[key]}
      </small>
    ) : null;

  return (
    <div className="new-sim-workspace">
      <header className="page-header">
        <div>
          <h1>Configure Your Simulation</h1>
          <p>
            Define repeatable channel parameters, station topology, and traffic intensity across four configuration stages.
          </p>
        </div>
      </header>

      {/* 4-Step Horizontal Progress Indicator */}
      <div className="stepper" role="navigation" aria-label="Configuration steps">
        <button
          type="button"
          className={`step-item${step === 1 ? ' active' : ''}${step > 1 ? ' completed' : ''}`}
          onClick={() => jumpToStep(1)}
        >
          <span className="step-number">{step > 1 ? <CheckIcon /> : '1'}</span>
          <span className="step-label">Protocol</span>
        </button>

        <div className="step-connector" />

        <button
          type="button"
          className={`step-item${step === 2 ? ' active' : ''}${step > 2 ? ' completed' : ''}`}
          onClick={() => jumpToStep(2)}
        >
          <span className="step-number">{step > 2 ? <CheckIcon /> : '2'}</span>
          <span className="step-label">Network</span>
        </button>

        <div className="step-connector" />

        <button
          type="button"
          className={`step-item${step === 3 ? ' active' : ''}${step > 3 ? ' completed' : ''}`}
          onClick={() => jumpToStep(3)}
        >
          <span className="step-number">{step > 3 ? <CheckIcon /> : '3'}</span>
          <span className="step-label">Traffic</span>
        </button>

        <div className="step-connector" />

        <button
          type="button"
          className={`step-item${step === 4 ? ' active' : ''}`}
          onClick={() => jumpToStep(4)}
        >
          <span className="step-number">4</span>
          <span className="step-label">Simulation</span>
        </button>
      </div>

      {submitError && <div className="error-message" role="alert">{submitError}</div>}
      {errors.workload && <div className="error-message" role="alert">{errors.workload}</div>}

      <div className="wizard-layout">
        <form className="panel wizard-main" onSubmit={handleStartSimulation} noValidate>
          {/* STEP 1: PROTOCOL */}
          {step === 1 && (
            <div className="wizard-step-body">
              <h2 className="step-title">Step 1: Select MAC Protocol</h2>
              <p className="step-subtitle">
                Choose the channel access arbitration mechanism to observe on the shared medium.
              </p>

              <div className="protocol-select-grid" role="radiogroup" aria-label="MAC Protocol Selection">
                {protocols.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={protocol === p.id}
                    className={`protocol-select-card${protocol === p.id ? ' selected' : ''}`}
                    onClick={() => {
                      setProtocol(p.id);
                      setErrors({});
                    }}
                  >
                    <div className="protocol-select-top">
                      <strong>{p.name}</strong>
                      {protocol === p.id && <span className="selection-badge">SELECTED</span>}
                    </div>
                    <p className="protocol-select-desc">{p.description}</p>
                    <div className="protocol-select-preview">
                      <ProtocolDiagram protocol={p.id} compact />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: NETWORK PARAMETERS */}
          {step === 2 && (
            <div className="wizard-step-body">
              <h2 className="step-title">Step 2: Network Parameters</h2>
              <p className="step-subtitle">
                Configure physical stations, payload sizes, transmission data rate, and experiment duration.
              </p>

              <div className="field-grid">
                <div className="field">
                  <label htmlFor="station-count">Number of Stations (2 to 64)</label>
                  <input
                    id="station-count"
                    type="number"
                    min="2"
                    max="64"
                    step="1"
                    value={stationCount}
                    aria-invalid={Boolean(errors.stationCount)}
                    onChange={e => setStationCount(e.target.value)}
                  />
                  <small>Total network nodes contending for channel access.</small>
                  {fieldError('stationCount')}
                </div>

                <div className="field">
                  <label htmlFor="frame-size">Frame Size (Bytes)</label>
                  <input
                    id="frame-size"
                    type="number"
                    min="64"
                    max="65535"
                    step="1"
                    value={frameSizeBytes}
                    aria-invalid={Boolean(errors.frameSizeBytes)}
                    onChange={e => setFrameSizeBytes(e.target.value)}
                  />
                  <small>Packet payload length (standard range: 64 to 65,535 bytes).</small>
                  {fieldError('frameSizeBytes')}
                </div>

                <div className="field">
                  <label htmlFor="data-rate">Data Rate (bits per second)</label>
                  <input
                    id="data-rate"
                    type="number"
                    min="1000"
                    max="1000000000"
                    step="1000"
                    value={dataRateBps}
                    aria-invalid={Boolean(errors.dataRateBps)}
                    onChange={e => setDataRateBps(e.target.value)}
                  />
                  <small>Raw medium bandwidth (e.g. 1,000,000 bps = 1.0 Mbps).</small>
                  {fieldError('dataRateBps')}
                </div>

                <div className="field">
                  <label htmlFor="duration">Simulation Duration (ms)</label>
                  <input
                    id="duration"
                    type="number"
                    min="1"
                    max="120000"
                    step="100"
                    value={durationMs}
                    aria-invalid={Boolean(errors.durationMs)}
                    onChange={e => setDurationMs(e.target.value)}
                  />
                  <small>Virtual time limit for experiment execution (1 to 120,000 ms).</small>
                  {fieldError('durationMs')}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: TRAFFIC */}
          {step === 3 && (
            <div className="wizard-step-body">
              <h2 className="step-title">Step 3: Traffic Generation Model</h2>
              <p className="step-subtitle">
                Specify frame arrival distribution and load intensity across stations.
              </p>

              <div className="field-grid">
                <div className="field">
                  <label htmlFor="traffic-model">Arrival Model</label>
                  <select
                    id="traffic-model"
                    value={trafficModel}
                    onChange={e => setTrafficModel(e.target.value as TrafficModel)}
                  >
                    <option value="poisson">Poisson Process (Stochastic inter-arrivals)</option>
                    <option value="uniform">Uniform Intervals (Deterministic periodic load)</option>
                  </select>
                  <small>
                    Poisson models memoryless packet arrivals. Uniform distributes arrivals evenly per station.
                  </small>
                </div>

                <div className="field">
                  <label htmlFor="traffic-intensity">
                    Traffic Intensity G (frames / frame time / station)
                  </label>
                  <input
                    id="traffic-intensity"
                    type="number"
                    min="0.01"
                    max="5.0"
                    step="0.05"
                    value={trafficIntensity}
                    aria-invalid={Boolean(errors.trafficIntensity)}
                    onChange={e => setTrafficIntensity(e.target.value)}
                  />
                  <small>
                    Per-station arrival rate normalized to frame transmission duration. G = 0.5 means one arrival every 2 frame times per station.
                  </small>
                  {fieldError('trafficIntensity')}
                </div>
              </div>

              <div className="panel-inset" style={{ marginTop: 16 }}>
                <strong>Workload Estimation</strong>
                <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                  Frame Transmission Time T_fr: <strong>{formatNumber(frameTimeMs, 3)} ms</strong>
                  <br />
                  Estimated Total Frame Generation: <strong>~{estimatedFrames.toLocaleString()} frames</strong>
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: SIMULATION SETTINGS */}
          {step === 4 && (
            <div className="wizard-step-body">
              <h2 className="step-title">Step 4: Simulation Parameters</h2>
              <p className="step-subtitle">
                Configure protocol-specific parameters and pseudorandom seed for experiment repeatability.
              </p>

              <div className="field-grid">
                <div className="field">
                  <label htmlFor="random-seed">Random Seed (Optional)</label>
                  <input
                    id="random-seed"
                    type="number"
                    min="0"
                    max="2147483647"
                    step="1"
                    value={randomSeed}
                    aria-invalid={Boolean(errors.randomSeed)}
                    onChange={e => setRandomSeed(e.target.value)}
                  />
                  <small>Integer seed ensures repeatable random packet arrival sequences.</small>
                  {fieldError('randomSeed')}
                </div>

                {protocol === 'SLOTTED_ALOHA' && (
                  <div className="field">
                    <label htmlFor="slot-duration">Slot Duration (ms)</label>
                    <input
                      id="slot-duration"
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={slotDurationMs}
                      aria-invalid={Boolean(errors.slotDurationMs)}
                      onChange={e => setSlotDurationMs(e.target.value)}
                    />
                    <small>Discrete time slot boundary length. Usually set equal to frame time.</small>
                    {fieldError('slotDurationMs')}
                  </div>
                )}

                {protocol === 'CSMA_CD' && (
                  <>
                    <div className="field">
                      <label htmlFor="propagation-delay">Propagation Delay (ms)</label>
                      <input
                        id="propagation-delay"
                        type="number"
                        min="0"
                        step="0.01"
                        value={propagationDelayMs}
                        aria-invalid={Boolean(errors.propagationDelayMs)}
                        onChange={e => setPropagationDelayMs(e.target.value)}
                      />
                      <small>Medium propagation latency before other stations detect active carrier.</small>
                      {fieldError('propagationDelayMs')}
                    </div>

                    <div className="field">
                      <label htmlFor="backoff-slot">Backoff Slot Duration (ms)</label>
                      <input
                        id="backoff-slot"
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={slotDurationMs}
                        aria-invalid={Boolean(errors.slotDurationMs)}
                        onChange={e => setSlotDurationMs(e.target.value)}
                      />
                      <small>Base slot time multiplier for binary exponential backoff.</small>
                      {fieldError('slotDurationMs')}
                    </div>

                    <div className="field">
                      <label htmlFor="max-retries">Maximum Retries (1 to 32)</label>
                      <input
                        id="max-retries"
                        type="number"
                        min="1"
                        max="32"
                        step="1"
                        value={maxRetries}
                        aria-invalid={Boolean(errors.maxRetries)}
                        onChange={e => setMaxRetries(e.target.value)}
                      />
                      <small>Max transmission attempts before dropping a collided frame.</small>
                      {fieldError('maxRetries')}
                    </div>

                    <div className="field">
                      <label htmlFor="max-backoff-slots">Max Backoff Slots (1 to 1024)</label>
                      <input
                        id="max-backoff-slots"
                        type="number"
                        min="1"
                        max="1024"
                        step="1"
                        value={maxBackoffSlots}
                        aria-invalid={Boolean(errors.maxBackoffSlots)}
                        onChange={e => setMaxBackoffSlots(e.target.value)}
                      />
                      <small>Upper ceiling window for truncated binary backoff.</small>
                      {fieldError('maxBackoffSlots')}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Wizard Controls */}
          <div className="wizard-controls">
            <button
              className="btn"
              type="button"
              disabled={step === 1}
              onClick={prevStep}
            >
              <ArrowLeftIcon />
              Back
            </button>

            {step < 4 ? (
              <button className="btn primary" type="button" onClick={nextStep}>
                Next Step
                <ArrowRightIcon />
              </button>
            ) : (
              <button className="btn primary" type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Start Simulation'}
                <ArrowRightIcon />
              </button>
            )}
          </div>
        </form>

        {/* Live Configuration Summary Panel */}
        <aside className="panel wizard-aside" aria-labelledby="summary-heading">
          <h2 id="summary-heading" style={{ fontSize: 16, marginBottom: 12 }}>
            Configuration Summary
          </h2>

          <dl className="summary-list">
            <dt>Protocol</dt>
            <dd><strong>{formatProtocol(protocol)}</strong></dd>

            <dt>Stations</dt>
            <dd>{stationCount}</dd>

            <dt>Frame Size</dt>
            <dd>{Number(frameSizeBytes).toLocaleString()} bytes</dd>

            <dt>Data Rate</dt>
            <dd>{(Number(dataRateBps) / 1000).toLocaleString()} kbps</dd>

            <dt>Duration</dt>
            <dd>{Number(durationMs).toLocaleString()} ms</dd>

            <dt>Traffic Model</dt>
            <dd>{trafficModel === 'poisson' ? 'Poisson arrivals' : 'Uniform intervals'}</dd>

            <dt>Intensity G</dt>
            <dd>{trafficIntensity} frames/Tfr/station</dd>

            <dt>Frame Time T_fr</dt>
            <dd className="mono">{formatNumber(frameTimeMs, 3)} ms</dd>

            <dt>Estimated Load</dt>
            <dd className="mono">~{estimatedFrames.toLocaleString()} frames</dd>

            <dt>Random Seed</dt>
            <dd className="mono">{randomSeed.trim() || 'Unset (Random)'}</dd>

            {protocol === 'SLOTTED_ALOHA' && (
              <>
                <dt>Slot Duration</dt>
                <dd className="mono">{slotDurationMs} ms</dd>
              </>
            )}

            {protocol === 'CSMA_CD' && (
              <>
                <dt>Prop Delay</dt>
                <dd className="mono">{propagationDelayMs} ms</dd>
                <dt>Max Retries</dt>
                <dd>{maxRetries}</dd>
                <dt>Backoff Limit</dt>
                <dd>{maxBackoffSlots} slots</dd>
              </>
            )}
          </dl>

          <div className="panel-inset" style={{ marginTop: 16 }}>
            <span className="muted" style={{ fontSize: 11, display: 'block' }}>
              Execution note: Simulation will run on the authoritative engine using real-time event dispatch.
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
