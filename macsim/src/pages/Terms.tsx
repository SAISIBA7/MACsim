export default function Terms() {
  return (
    <div className="legal-workspace">
      <header className="page-header">
        <div>
          <h1>Terms of Service</h1>
          <p>Product terms, educational scope, and usage guidelines for MACSim.</p>
        </div>
      </header>

      <div className="panel" style={{ marginBottom: 20, borderColor: '#D5A45D' }}>
        <h2 style={{ fontSize: 16, margin: '0 0 6px', color: '#D5A45D' }}>
          Notice: Institutional Review Pending
        </h2>
        <p style={{ margin: 0, fontSize: 13 }}>
          These draft Terms of Service define the educational parameters of MACSim. Formal administrative and legal approval by the project custodian or educational institution is required prior to public production release.
        </p>
      </div>

      <div className="panel" style={{ display: 'grid', gap: 20 }}>
        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>1. Educational Purpose & Scope</h2>
          <p>
            MACSim is an interactive educational tool designed for academic instruction in computer networking, data communications, and distributed medium access arbitration. The models provided (Pure ALOHA, Slotted ALOHA, CSMA, and CSMA/CD) are discrete-event mathematical abstractions intended to illustrate protocol concepts.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>2. No Hardware Representation</h2>
          <p>
            The timing, collision detection thresholds, signal propagation delays, and contention resolution algorithms in MACSim do not replicate physical analog voltages, electrical transceiver noise, or commercial IEEE 802.3 Ethernet chipsets. MACSim must not be used for mission-critical network sizing or physical safety-critical engineering validation.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>3. User Conduct & Local Execution</h2>
          <p>
            MACSim executes locally within the user client browser. Users may configure experiments, adjust workloads, export simulation logs, and evaluate results freely for non-commercial educational study, instruction, and research.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>4. Warranty Disclaimer</h2>
          <p>
            The software is provided &quot;as is&quot;, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular academic purpose, and non-infringement.
          </p>
        </section>
      </div>
    </div>
  );
}
