import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Protocol, SimulationConfig, TrafficModel } from '../types';
import { formatProtocol } from '../utils/format';

const protocols: Protocol[] = ['PURE_ALOHA', 'SLOTTED_ALOHA', 'CSMA', 'CSMA_CD'];

export default function NewSim() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedProtocol = searchParams.get('protocol');
  const [protocol, setProtocol] = useState<Protocol>(
    protocols.find(value => value === requestedProtocol) ?? 'PURE_ALOHA',
  );
  const [stationCount, setStationCount] = useState('4');
  const [frameSizeBytes, setFrameSizeBytes] = useState('1024');
  const [dataRateBps, setDataRateBps] = useState('1000000');
  const [durationMs, setDurationMs] = useState('1000');
  const [trafficModel, setTrafficModel] = useState<TrafficModel>('poisson');
  const [trafficIntensity, setTrafficIntensity] = useState('0.5');
  const [randomSeed, setRandomSeed] = useState('42');
  const [slotDurationMs, setSlotDurationMs] = useState('8.192');
  const [propagationDelayMs, setPropagationDelayMs] = useState('0.25');
  const [maxRetries, setMaxRetries] = useState('12');
  const [maxBackoffSlots, setMaxBackoffSlots] = useState('16');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const validate = (): { config?: SimulationConfig; errors: Record<string, string> } => {
    const nextErrors: Record<string, string> = {};
    const stationValue = Number(stationCount);
    const frameValue = Number(frameSizeBytes);
    const rateValue = Number(dataRateBps);
    const durationValue = Number(durationMs);
    const intensityValue = Number(trafficIntensity);
    const slotValue = Number(slotDurationMs);
    const propagationValue = Number(propagationDelayMs);
    const retryValue = Number(maxRetries);
    const backoffValue = Number(maxBackoffSlots);
    const seedValue = randomSeed.trim() === '' ? undefined : Number(randomSeed);

    if (!Number.isInteger(stationValue) || stationValue < 2 || stationValue > 64) {
      nextErrors.stationCount = 'Enter a whole number from 2 to 64.';
    }
    if (!Number.isInteger(frameValue) || frameValue < 64 || frameValue > 65535) {
      nextErrors.frameSizeBytes = 'Enter a whole number from 64 to 65,535 bytes.';
    }
    if (!Number.isInteger(rateValue) || rateValue < 1000 || rateValue > 1_000_000_000) {
      nextErrors.dataRateBps = 'Enter a rate from 1,000 to 1,000,000,000 bits per second.';
    }
    if (!Number.isFinite(durationValue) || durationValue < 1 || durationValue > 120_000) {
      nextErrors.durationMs = 'Enter a duration from 1 to 120,000 milliseconds.';
    }
    if (!Number.isFinite(intensityValue) || intensityValue <= 0 || intensityValue > 5) {
      nextErrors.trafficIntensity = 'Enter an intensity greater than 0 and no more than 5.';
    }
    if (randomSeed.trim() !== '' && (!Number.isInteger(seedValue) || (seedValue ?? -1) < 0 || (seedValue ?? 0) > 2_147_483_647)) {
      nextErrors.randomSeed = 'Enter a whole number from 0 to 2,147,483,647, or leave it blank.';
    }
    if ((protocol === 'SLOTTED_ALOHA' || protocol === 'CSMA_CD') && (!Number.isFinite(slotValue) || slotValue <= 0)) {
      nextErrors.slotDurationMs = 'Enter a slot duration greater than 0 milliseconds.';
    }
    if (protocol === 'CSMA_CD' && (!Number.isFinite(propagationValue) || propagationValue < 0)) {
      nextErrors.propagationDelayMs = 'Enter a propagation delay of 0 milliseconds or more.';
    }
    if (protocol === 'CSMA_CD' && (!Number.isInteger(retryValue) || retryValue < 1 || retryValue > 32)) {
      nextErrors.maxRetries = 'Enter a whole number from 1 to 32.';
    }
    if (protocol === 'CSMA_CD' && (!Number.isInteger(backoffValue) || backoffValue < 1 || backoffValue > 1024)) {
      nextErrors.maxBackoffSlots = 'Enter a whole number from 1 to 1,024.';
    }
    if (Object.keys(nextErrors).length === 0) {
      const frameTimeMs = (frameValue * 8 * 1000) / rateValue;
      const expectedFrames = (stationValue * intensityValue * durationValue) / frameTimeMs;
      if (expectedFrames > 50_000) {
        nextErrors.workload = 'These settings may generate more than 50,000 frames. Reduce duration or traffic intensity, or increase frame size.';
      }
    }

    if (Object.keys(nextErrors).length > 0) return { errors: nextErrors };

    return {
      errors: {},
      config: {
        protocol,
        stationCount: stationValue,
        frameSizeBytes: frameValue,
        dataRateBps: rateValue,
        durationMs: durationValue,
        trafficModel,
        trafficIntensity: intensityValue,
        randomSeed: seedValue,
        slotDurationMs: protocol === 'SLOTTED_ALOHA' || protocol === 'CSMA_CD' ? slotValue : undefined,
        propagationDelayMs: protocol === 'CSMA_CD' ? propagationValue : undefined,
        maxRetries: protocol === 'CSMA_CD' ? retryValue : undefined,
        maxBackoffSlots: protocol === 'CSMA_CD' ? backoffValue : undefined,
      },
    };
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError('');
    const result = validate();
    setErrors(result.errors);
    if (!result.config) return;

    try {
      const id = crypto.randomUUID();
      sessionStorage.setItem(`macsim_pending_${id}`, JSON.stringify(result.config));
      navigate(`/simulations/${id}`);
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : 'The simulation could not be initialized.');
    }
  };

  const fieldError = (key: string) => errors[key] ? <small id={`${key}-error`} className="error-text">{errors[key]}</small> : null;
  const describedBy = (key: string) => errors[key] ? `${key}-error` : undefined;
  const configPreview = validate().config;

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>New simulation</h1>
          <p>Set the shared experiment conditions. A random seed makes the traffic sequence repeatable.</p>
        </div>
      </header>

      <div className="form-layout">
        <form className="panel form-stack" onSubmit={submit} noValidate>
          {submitError && <div className="error-message" role="alert">{submitError}</div>}
          {errors.workload && <div className="error-message" role="alert">{errors.workload}</div>}
          <div className="field">
            <label htmlFor="protocol">Protocol</label>
            <select id="protocol" value={protocol} onChange={event => setProtocol(event.target.value as Protocol)}>
              {protocols.map(value => <option value={value} key={value}>{formatProtocol(value)}</option>)}
            </select>
            <small>Select the channel access rules to simulate.</small>
          </div>

          <div className="field-grid">
            <div className="field">
              <label htmlFor="station-count">Number of stations</label>
              <input id="station-count" type="number" min="2" max="64" step="1" value={stationCount} aria-invalid={Boolean(errors.stationCount)} aria-describedby={describedBy('stationCount')} onChange={event => setStationCount(event.target.value)} />
              {fieldError('stationCount')}
            </div>
            <div className="field">
              <label htmlFor="frame-size">Frame size (bytes)</label>
              <input id="frame-size" type="number" min="64" max="65535" step="1" value={frameSizeBytes} aria-invalid={Boolean(errors.frameSizeBytes)} aria-describedby={describedBy('frameSizeBytes')} onChange={event => setFrameSizeBytes(event.target.value)} />
              {fieldError('frameSizeBytes')}
            </div>
            <div className="field">
              <label htmlFor="data-rate">Data rate (bits per second)</label>
              <input id="data-rate" type="number" min="1000" max="1000000000" step="1000" value={dataRateBps} aria-invalid={Boolean(errors.dataRateBps)} aria-describedby={describedBy('dataRateBps')} onChange={event => setDataRateBps(event.target.value)} />
              {fieldError('dataRateBps')}
            </div>
            <div className="field">
              <label htmlFor="duration">Simulation duration (ms)</label>
              <input id="duration" type="number" min="1" max="120000" step="100" value={durationMs} aria-invalid={Boolean(errors.durationMs)} aria-describedby={describedBy('durationMs')} onChange={event => setDurationMs(event.target.value)} />
              {fieldError('durationMs')}
            </div>
            <div className="field">
              <label htmlFor="traffic-model">Traffic generation model</label>
              <select id="traffic-model" value={trafficModel} onChange={event => setTrafficModel(event.target.value as TrafficModel)}>
                <option value="poisson">Poisson arrivals</option>
                <option value="uniform">Uniform intervals</option>
              </select>
              <small>Poisson uses random inter-arrival times. Uniform uses a fixed interval per station.</small>
            </div>
            <div className="field">
              <label htmlFor="traffic-intensity">Traffic intensity (frames / frame time / station)</label>
              <input id="traffic-intensity" type="number" min="0.01" max="5" step="0.05" value={trafficIntensity} aria-invalid={Boolean(errors.trafficIntensity)} aria-describedby={describedBy('trafficIntensity')} onChange={event => setTrafficIntensity(event.target.value)} />
              {fieldError('trafficIntensity')}
            </div>
            <div className="field">
              <label htmlFor="random-seed">Random seed (optional)</label>
              <input id="random-seed" type="number" min="0" max="2147483647" step="1" value={randomSeed} aria-invalid={Boolean(errors.randomSeed)} aria-describedby={describedBy('randomSeed')} onChange={event => setRandomSeed(event.target.value)} />
              {fieldError('randomSeed')}
            </div>
          </div>

          {protocol === 'SLOTTED_ALOHA' && (
            <div className="field">
              <label htmlFor="slot-duration">Slot duration (ms)</label>
              <input id="slot-duration" type="number" min="0.001" step="0.001" value={slotDurationMs} aria-invalid={Boolean(errors.slotDurationMs)} aria-describedby={describedBy('slotDurationMs')} onChange={event => setSlotDurationMs(event.target.value)} />
              <small>Frames can begin only at multiples of this slot duration.</small>
              {fieldError('slotDurationMs')}
            </div>
          )}

          {protocol === 'CSMA_CD' && (
            <fieldset className="field-grid protocol-settings">
              <legend>CSMA/CD collision and backoff settings</legend>
              <div className="field">
                <label htmlFor="propagation-delay">Propagation delay (ms)</label>
                <input id="propagation-delay" type="number" min="0" step="0.01" value={propagationDelayMs} aria-invalid={Boolean(errors.propagationDelayMs)} aria-describedby={describedBy('propagationDelayMs')} onChange={event => setPropagationDelayMs(event.target.value)} />
                <small>Models the time before another station senses a transmission.</small>
                {fieldError('propagationDelayMs')}
              </div>
              <div className="field">
                <label htmlFor="backoff-slot">Backoff slot duration (ms)</label>
                <input id="backoff-slot" type="number" min="0.001" step="0.001" value={slotDurationMs} aria-invalid={Boolean(errors.slotDurationMs)} aria-describedby={describedBy('slotDurationMs')} onChange={event => setSlotDurationMs(event.target.value)} />
                {fieldError('slotDurationMs')}
              </div>
              <div className="field">
                <label htmlFor="max-retries">Maximum retries</label>
                <input id="max-retries" type="number" min="1" max="32" step="1" value={maxRetries} aria-invalid={Boolean(errors.maxRetries)} aria-describedby={describedBy('maxRetries')} onChange={event => setMaxRetries(event.target.value)} />
                {fieldError('maxRetries')}
              </div>
              <div className="field">
                <label htmlFor="max-backoff-slots">Maximum backoff slots</label>
                <input id="max-backoff-slots" type="number" min="1" max="1024" step="1" value={maxBackoffSlots} aria-invalid={Boolean(errors.maxBackoffSlots)} aria-describedby={describedBy('maxBackoffSlots')} onChange={event => setMaxBackoffSlots(event.target.value)} />
                {fieldError('maxBackoffSlots')}
              </div>
            </fieldset>
          )}

          <div className="button-row">
            <button className="btn primary" type="submit">Start simulation</button>
          </div>
        </form>

        <aside className="panel" aria-labelledby="summary-heading">
          <h2 id="summary-heading">Configuration summary</h2>
          {configPreview ? (
            <dl className="summary-list">
              <dt>Protocol</dt><dd>{formatProtocol(configPreview.protocol)}</dd>
              <dt>Stations</dt><dd>{configPreview.stationCount}</dd>
              <dt>Frame size</dt><dd>{configPreview.frameSizeBytes.toLocaleString()} bytes</dd>
              <dt>Data rate</dt><dd>{configPreview.dataRateBps.toLocaleString()} bps</dd>
              <dt>Duration</dt><dd>{configPreview.durationMs.toLocaleString()} ms</dd>
              <dt>Traffic model</dt><dd>{configPreview.trafficModel === 'poisson' ? 'Poisson arrivals' : 'Uniform intervals'}</dd>
              <dt>Traffic intensity</dt><dd>{configPreview.trafficIntensity} frames per frame time per station</dd>
              <dt>Random seed</dt><dd>{configPreview.randomSeed ?? 'Generated on run start'}</dd>
              {configPreview.slotDurationMs !== undefined && <><dt>Slot duration</dt><dd>{configPreview.slotDurationMs} ms</dd></>}
              {configPreview.propagationDelayMs !== undefined && <><dt>Propagation delay</dt><dd>{configPreview.propagationDelayMs} ms</dd></>}
              {configPreview.maxRetries !== undefined && <><dt>Retry limit</dt><dd>{configPreview.maxRetries}</dd></>}
              {configPreview.maxBackoffSlots !== undefined && <><dt>Backoff limit</dt><dd>{configPreview.maxBackoffSlots} slots</dd></>}
            </dl>
          ) : (
            <p className="muted">Correct the highlighted values to review this configuration.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
