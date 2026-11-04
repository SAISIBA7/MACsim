import { NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Home from './pages/Home';
import NewSim from './pages/NewSim';
import SimRun from './pages/SimRun';
import Comparisons from './pages/Comparisons';
import Learning from './pages/Learning';
import History from './pages/History';
import Settings from './pages/Settings';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

type ThemePreference = 'system' | 'light' | 'dark';

const navigation = [
  { to: '/', label: 'Home', end: true },
  { to: '/simulations/new', label: 'New Simulation' },
  { to: '/simulations', label: 'Simulations', end: true },
  { to: '/comparisons', label: 'Comparisons' },
  { to: '/learning', label: 'Learning Center' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
];

function SimulationRoute() {
  const { id = '' } = useParams();
  return <SimRun key={id} runId={id} />;
}

export default function App() {
  const [theme, setTheme] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem('theme');
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  });
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const activeTheme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = activeTheme;
    };
    applyTheme();
    localStorage.setItem('theme', theme);
    if (theme === 'system') {
      media.addEventListener('change', applyTheme);
      return () => media.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  return (
    <div className="layout">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className={`nav-shell${navOpen ? ' nav-open' : ''}`} aria-label="Application navigation">
        <div className="nav-top">
          <NavLink className="brand" to="/" aria-label="MACSim home" onClick={() => setNavOpen(false)}>
            <span className="brand-mark" aria-hidden="true">M</span>
            <span>MACSim</span>
          </NavLink>
          <button
            className="nav-toggle"
            type="button"
            aria-controls="primary-navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(open => !open)}
          >
            {navOpen ? 'Close menu' : 'Menu'}
          </button>
        </div>
        <nav className="nav-links" id="primary-navigation" aria-label="Primary">
          {navigation.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              onClick={() => setNavOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-bottom">
          <label htmlFor="theme-preference">Appearance</label>
          <select
            id="theme-preference"
            value={theme}
            onChange={event => setTheme(event.target.value as ThemePreference)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <div className="legal-links">
            <NavLink to="/terms" onClick={() => setNavOpen(false)}>Terms of Service</NavLink>
            <NavLink to="/privacy" onClick={() => setNavOpen(false)}>Privacy Policy</NavLink>
          </div>
        </div>
      </aside>
      <main className="main" id="main-content" tabIndex={-1}>
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/simulations/new" element={<NewSim />} />
            <Route path="/simulations" element={<History title="Simulations" />} />
            <Route path="/simulations/:id" element={<SimulationRoute />} />
            <Route path="/comparisons" element={<Comparisons />} />
            <Route path="/learning" element={<Learning />} />
            <Route path="/history" element={<History title="History" />} />
            <Route path="/settings" element={<Settings theme={theme} setTheme={setTheme} />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
