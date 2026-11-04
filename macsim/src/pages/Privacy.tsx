export default function Privacy() {
  return (
    <div className="legal-workspace">
      <header className="page-header">
        <div>
          <h1>Privacy Policy</h1>
          <p>Data handling, local database persistence, and telemetry transparency for MACSim.</p>
        </div>
      </header>

      <div className="panel" style={{ marginBottom: 20, borderColor: '#D5A45D' }}>
        <h2 style={{ fontSize: 16, margin: '0 0 6px', color: '#D5A45D' }}>
          Notice: Institutional Review Pending
        </h2>
        <p style={{ margin: 0, fontSize: 13 }}>
          This Privacy Policy outlines local data storage and transparency practices for MACSim. Formal approval by the project custodian or educational institution is required before public deployment.
        </p>
      </div>

      <div className="panel" style={{ display: 'grid', gap: 20 }}>
        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>1. Zero External Telemetry Collection</h2>
          <p>
            MACSim operates as a self-contained local simulation environment. The application does not collect, track, profile, or transmit personal information, telemetry, usage statistics, or analytics to external servers or third-party tracking services.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>2. Local Persistence Architecture</h2>
          <p>
            The application maintains simulation data across the backend database and browser storage:
          </p>
          <ul style={{ margin: '8px 0 0 20px', color: 'var(--color-text-primary)', fontSize: 13, lineHeight: 1.8 }}>
            <li><strong className="mono">Local Database (SQLite via Prisma):</strong> Authoritative simulation runs, station states, frame sequences, event logs, and calculated metrics.</li>
            <li><code className="mono" style={{ color: 'var(--color-accent)', fontWeight: 600 }}>macsim_runs</code>: User-exported or locally archived experiment records.</li>
            <li><code className="mono" style={{ color: 'var(--color-accent)', fontWeight: 600 }}>macsim_defaults</code>: User-customized default simulation parameters.</li>
            <li><code className="mono" style={{ color: 'var(--color-accent)', fontWeight: 600 }}>theme</code>: Active workspace appearance setting (dark or light).</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>3. Data Control & Deletion</h2>
          <p>
            Users retain complete control over their simulation records. Experiments can be deleted individually from the History workspace or wiped locally at any time. All stored data remains on the user&apos;s own system.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>4. Cookies and Tracking Technologies</h2>
          <p>
            MACSim does not use advertising identifiers, tracking pixels, marketing cookies, or third-party analytics scripts.
          </p>
        </section>
      </div>
    </div>
  );
}
