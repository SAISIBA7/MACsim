import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clearRuns } from '../store/runs';

type ThemePreference = 'system' | 'light' | 'dark';

interface SettingsProps {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

export default function Settings({ theme, setTheme }: SettingsProps) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const clearHistory = () => {
    if (!window.confirm('Delete all saved simulations from this browser? This cannot be undone.')) return;
    try {
      clearRuns();
      setError('');
      setMessage('Saved simulation history was cleared from this browser.');
    } catch (reason) {
      setMessage('');
      setError(reason instanceof Error ? reason.message : 'Saved history could not be cleared.');
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Manage the appearance and local data used by MACSim.</p>
        </div>
      </header>

      <section className="panel settings-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Appearance</h2>
        <div className="field settings-field">
          <label htmlFor="settings-theme">Theme preference</label>
          <select id="settings-theme" value={theme} onChange={event => setTheme(event.target.value as ThemePreference)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <small>System follows the device color preference. Your choice is saved in this browser.</small>
        </div>
      </section>

      <section className="panel settings-section" aria-labelledby="storage-heading">
        <h2 id="storage-heading">Saved simulations</h2>
        <p>Simulation history is stored locally in this browser. It is not uploaded or synchronized.</p>
        <button className="btn danger" type="button" onClick={clearHistory}>Clear saved history</button>
        {message && <p className="success-message" role="status">{message}</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>

      <section className="section" aria-labelledby="legal-heading">
        <h2 id="legal-heading">Legal information</h2>
        <p><Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link> are available for review. Owner-approved legal copy is required before public release.</p>
      </section>
    </div>
  );
}
