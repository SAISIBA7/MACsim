import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  clearRuns,
  exportRunsJson,
  getRuns,
  getSimulationDefaults,
  importRunsJson,
  saveSimulationDefaults,
  type SimulationDefaults,
} from '../store/runs';

type ThemePreference = 'light' | 'dark';

interface SettingsProps {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

export default function Settings({ theme, setTheme }: SettingsProps) {
  const [defaults, setDefaults] = useState<SimulationDefaults>(() => getSimulationDefaults());
  const [defaultsSaved, setDefaultsSaved] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [runsCount, setRunsCount] = useState(() => {
    try {
      return getRuns().length;
    } catch {
      return 0;
    }
  });

  const handleSaveDefaults = (e: React.FormEvent) => {
    e.preventDefault();
    saveSimulationDefaults(defaults);
    setDefaultsSaved(true);
    setTimeout(() => setDefaultsSaved(false), 3000);
  };

  const clearHistory = () => {
    if (!window.confirm('Delete all saved simulations from this browser? This action cannot be reversed.')) {
      return;
    }
    try {
      clearRuns();
      setRunsCount(0);
      setError('');
      setMessage('All local simulation runs were removed.');
    } catch (reason) {
      setMessage('');
      setError(reason instanceof Error ? reason.message : 'Saved history could not be cleared.');
    }
  };

  const handleExportJson = () => {
    try {
      const json = exportRunsJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `macsim_runs_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage('Simulation records exported successfully.');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed.');
      setMessage('');
    }
  };

  const handleImportJson = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string;
        const result = importRunsJson(text);
        setRunsCount(getRuns().length);
        setMessage(`Successfully imported ${result.importedCount} simulation runs.`);
        setError('');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Invalid JSON import file.');
        setMessage('');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="settings-workspace">
      <header className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Configure simulator appearance, default network parameters, and local experiment persistence.</p>
        </div>
      </header>

      {message && <div className="panel-inset" style={{ borderColor: '#78B978', color: '#78B978', marginBottom: 16 }}>{message}</div>}
      {error && <div className="error-message" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Appearance Section */}
      <section className="panel settings-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" style={{ fontSize: 16, marginBottom: 8 }}>
          Appearance & Theme
        </h2>
        <p className="section-subtext">
          MACSim is styled natively as a dark charcoal engineering workstation with champagne accents.
        </p>

        <div className="field settings-field">
          <label htmlFor="settings-theme">Workspace Theme</label>
          <select
            id="settings-theme"
            value={theme}
            onChange={event => setTheme(event.target.value as ThemePreference)}
          >
            <option value="dark">Dark Charcoal (Reference Standard)</option>
            <option value="light">Warm Light</option>
          </select>
          <small>Preference is preserved across sessions in this browser.</small>
        </div>
      </section>

      {/* Default Simulation Parameters */}
      <section className="panel settings-section" aria-labelledby="defaults-heading">
        <h2 id="defaults-heading" style={{ fontSize: 16, marginBottom: 8 }}>
          Default Simulation Parameters
        </h2>
        <p className="section-subtext">
          Pre-populate the New Simulation wizard with your preferred baseline values.
        </p>

        <form onSubmit={handleSaveDefaults}>
          <div className="field-grid" style={{ marginBottom: 16 }}>
            <div className="field">
              <label htmlFor="def-stations">Default Stations (2 - 64)</label>
              <input
                id="def-stations"
                type="number"
                min="2"
                max="64"
                value={defaults.stationCount}
                onChange={e => setDefaults({ ...defaults, stationCount: Number(e.target.value) })}
              />
            </div>

            <div className="field">
              <label htmlFor="def-frame">Default Frame Size (Bytes)</label>
              <input
                id="def-frame"
                type="number"
                min="64"
                max="65535"
                value={defaults.frameSizeBytes}
                onChange={e => setDefaults({ ...defaults, frameSizeBytes: Number(e.target.value) })}
              />
            </div>

            <div className="field">
              <label htmlFor="def-rate">Default Data Rate (bps)</label>
              <input
                id="def-rate"
                type="number"
                min="1000"
                max="1000000000"
                step="1000"
                value={defaults.dataRateBps}
                onChange={e => setDefaults({ ...defaults, dataRateBps: Number(e.target.value) })}
              />
            </div>

            <div className="field">
              <label htmlFor="def-duration">Default Duration (ms)</label>
              <input
                id="def-duration"
                type="number"
                min="1"
                max="120000"
                value={defaults.durationMs}
                onChange={e => setDefaults({ ...defaults, durationMs: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="button-row">
            <button className="btn primary" type="submit">
              {defaultsSaved ? 'Defaults Saved!' : 'Save Defaults'}
            </button>
          </div>
        </form>
      </section>

      {/* Local Storage & Experiment Data */}
      <section className="panel settings-section" aria-labelledby="storage-heading">
        <h2 id="storage-heading" style={{ fontSize: 16, marginBottom: 8 }}>
          Saved Simulation Data ({runsCount} Runs)
        </h2>
        <p className="section-subtext">
          Simulation runs are stored client-side in browser localStorage. No data is transmitted to external servers.
        </p>

        <div className="button-row" style={{ marginTop: 16 }}>
          <button
            className="btn"
            type="button"
            disabled={runsCount === 0}
            onClick={handleExportJson}
          >
            Export Runs as JSON
          </button>

          <label className="btn" style={{ cursor: 'pointer' }}>
            Import Runs from JSON
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportJson}
            />
          </label>

          <button
            className="btn danger"
            type="button"
            disabled={runsCount === 0}
            onClick={clearHistory}
          >
            Clear All Saved History
          </button>
        </div>
      </section>

      {/* Legal & Governance */}
      <section className="section" aria-labelledby="legal-heading">
        <h2 className="section-heading" id="legal-heading">Legal & Compliance</h2>
        <p className="section-subtext">
          Review the product <Link to="/terms">Terms of Service</Link> and{' '}
          <Link to="/privacy">Privacy Policy</Link>. All documentation complies with educational software guidelines.
        </p>
      </section>
    </div>
  );
}
