export default function Privacy() {
  return (
    <div className="legal-workspace">
      <header className="page-header">
        <div>
          <h1>Privacy Policy</h1>
          <p>Data handling, local storage practices, and telemetry transparency for MACSim.</p>
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
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>1. Zero External Data Collection</h2>
          <p>
            MACSim operates as a purely client-side simulation workspace. The application does not collect, transmit, profile, or sell personal information, telemetry, usage statistics, or IP addresses to any external server or third-party service.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>2. Local Browser Storage Usage</h2>
          <p>
            The application uses browser localStorage solely to preserve user preferences and simulation experiment records:
          </p>
          <ul style={{ margin: '8px 0 0 20px', color: 'var(--color-text-primary)', fontSize: 13, lineHeight: 1.8 }}>
            <li><code className="mono" style={{ color: 'var(--color-accent)', fontWeight: 600 }}>macsim_runs</code>: User-saved simulation runs, event sequences, and metrics.</li>
            <li><code className="mono" style={{ color: 'var(--color-accent)', fontWeight: 600 }}>macsim_defaults</code>: User-customized default simulation parameters.</li>
            <li><code className="mono" style={{ color: 'var(--color-accent)', fontWeight: 600 }}>theme</code>: Active workspace appearance setting (dark or light).</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>3. Data Control & Deletion</h2>
          <p>
            Users retain complete sovereignty over their data. All stored simulation records can be exported as a standard JSON file or permanently wiped at any time using the &quot;Clear All Saved History&quot; button located in the Settings workspace. Clearing browser application cache also eliminates all stored data.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>4. Cookies and Tracking Technologies</h2>
          <p>
            MACSim does not use cookies, advertising identifiers, tracking pixels, or third-party analytics scripts.
          </p>
        </section>
      </div>
    </div>
  );
}
