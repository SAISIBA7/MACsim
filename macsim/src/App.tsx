import { NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Home from './pages/Home';
import NewSim from './pages/NewSim';
import SimRun from './pages/SimRun';
import Comparisons from './pages/Comparisons';
import ComparisonAnalysis from './pages/ComparisonAnalysis';
import Learning from './pages/Learning';
import History from './pages/History';
import Settings from './pages/Settings';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import { BrandWaveformIcon, ArrowRightIcon } from './components/Icons';

type ThemePreference = 'light' | 'dark';

const navigation = [
  { to: '/', label: 'Home', end: true },
  { to: '/simulations/new', label: 'New Simulation' },
  { to: '/simulations', label: 'Simulation History', end: true },
  { to: '/comparisons', label: 'Comparisons' },
  { to: '/learning', label: 'Learning Center' },
  { to: '/settings', label: 'Settings' },
];

function SimulationRoute() {
  const { id = '' } = useParams();
  return <SimRun key={id} runId={id} />;
}

export default function App() {
  const [theme, setTheme] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem('theme');
    return stored === 'light' ? 'light' : 'dark';
  });
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      {/* Persistent 220px Left Navigation Sidebar */}
      <aside
        className={`sidebar${navOpen ? ' nav-open' : ''}`}
        aria-label="Application navigation"
      >
        <div className="sidebar-top">
          <NavLink
            className="brand"
            to="/"
            aria-label="MACSim Home"
            onClick={() => setNavOpen(false)}
          >
            <BrandWaveformIcon className="brand-mark" />
            <div className="brand-text">
              <span className="brand-title">MACSim</span>
              <span className="brand-subtitle mono">PROTOCOL LAB</span>
            </div>
          </NavLink>

          <button
            className="nav-toggle"
            type="button"
            aria-controls="primary-navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(open => !open)}
          >
            {navOpen ? 'Close Menu' : 'Menu'}
          </button>
        </div>

        <nav className="nav-links" id="primary-navigation" aria-label="Primary Navigation">
          {navigation.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              onClick={() => setNavOpen(false)}
            >
              <span className="nav-label">{item.label}</span>
              <ArrowRightIcon className="nav-arrow" width="12" height="12" aria-hidden="true" />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="theme-selector-wrap">
            <label htmlFor="theme-preference">Appearance</label>
            <select
              id="theme-preference"
              value={theme}
              onChange={event => setTheme(event.target.value as ThemePreference)}
            >
              <option value="dark">Dark Charcoal</option>
              <option value="light">Warm Light</option>
            </select>
          </div>

          <div className="legal-links">
            <NavLink to="/terms" onClick={() => setNavOpen(false)}>
              Terms of Service
            </NavLink>
            <NavLink to="/privacy" onClick={() => setNavOpen(false)}>
              Privacy Policy
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Main Workspace Canvas (PRD 6.1: min-width: 0, full remaining width) */}
      <main className="main-workspace" id="main-content" tabIndex={-1}>
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/simulations/new" element={<NewSim />} />
            <Route path="/simulations" element={<History title="Simulation History" />} />
            <Route path="/simulations/:id" element={<SimulationRoute />} />
            <Route path="/comparisons" element={<Comparisons />} />
            <Route path="/comparisons/analysis" element={<ComparisonAnalysis />} />
            <Route path="/comparisons/:idA/:idB" element={<ComparisonAnalysis />} />
            <Route path="/learning" element={<Learning />} />
            <Route path="/history" element={<Navigate to="/simulations" replace />} />
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
