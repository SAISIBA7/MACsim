import { Link } from 'react-router-dom';
import { ConceptDiagram } from '../components/ConceptDiagram';
import type { Protocol } from '../types';

interface Concept {
  id: string;
  title: string;
  category: string;
  formula?: string;
  explanation: string;
  keyTakeaway: string;
  protocol?: Protocol;
}

const concepts: Concept[] = [
  {
    id: 'shared-medium',
    title: 'Shared-Medium Access',
    category: 'Foundations',
    explanation:
      'In a shared communication medium (such as a coaxial bus, wireless frequency, or broadcast channel), multiple network stations transmit over the identical physical link. Because stations lack separate point-to-point circuits, a Medium Access Control (MAC) protocol is required to arbitrate which station may transmit and resolve contention when simultaneous transmissions occur.',
    keyTakeaway:
      'Without MAC arbitration, concurrent transmissions overlap on the physical medium, causing electrical interference and corrupting packet payloads.',
  },
  {
    id: 'pure-aloha',
    title: 'Pure ALOHA',
    category: 'Random Access',
    formula: 'S = G * e^(-2G)  (Maximum S = 1 / (2e) ≈ 18.4% at G = 0.5)',
    explanation:
      'Developed at the University of Hawaii in 1970, Pure ALOHA allows stations to transmit whenever they have a frame ready. Senders wait for an acknowledgment; if none arrives, a collision is assumed, and the station waits a random interval before retransmitting. Because any overlap destroys both frames, the vulnerable period equals twice the frame transmission time (2 * T_fr).',
    keyTakeaway:
      'Completely decentralized and uncoordinated, but limits maximum achievable channel throughput to only 18.4% of total link capacity.',
    protocol: 'PURE_ALOHA',
  },
  {
    id: 'slotted-aloha',
    title: 'Slotted ALOHA',
    category: 'Random Access',
    formula: 'S = G * e^(-G)  (Maximum S = 1 / e ≈ 36.8% at G = 1.0)',
    explanation:
      'Slotted ALOHA divides continuous time into discrete slots equal to one frame transmission duration (T_fr). Stations are synchronized and may begin transmissions only at slot boundaries. If a frame arrives mid-slot, the station must buffer and defer until the subsequent slot boundary. This alignment restricts the collision vulnerable period to exactly 1 * T_fr.',
    keyTakeaway:
      'Synchronizing transmission starts doubles theoretical peak throughput from 18.4% to 36.8% by preventing partial frame overlaps.',
    protocol: 'SLOTTED_ALOHA',
  },
  {
    id: 'csma',
    title: 'Carrier Sense Multiple Access (CSMA)',
    category: 'Carrier Sensing',
    explanation:
      'CSMA introduces the principle of "listen before talk". Before asserting a frame onto the shared bus, the station senses the channel carrier energy. If the channel is sensed busy, the station defers. Variations include 1-persistent (transmit immediately when idle), non-persistent (wait a random delay when busy), and p-persistent (transmit with probability p when idle).',
    keyTakeaway:
      'Carrier sensing drastically reduces collisions under moderate loads because stations do not interrupt an in-progress frame transmission.',
    protocol: 'CSMA',
  },
  {
    id: 'csma-cd',
    title: 'CSMA with Collision Detection (CSMA/CD)',
    category: 'Carrier Sensing with Detection',
    formula: 'Frame Size >= 2 * Data Rate * Propagation Delay  (L >= 2 * R * tau)',
    explanation:
      'The basis of IEEE 802.3 classic Ethernet. Stations not only sense before transmitting, but continue monitoring the medium during transmission. If signal voltage exceeds normal transmission threshold, a collision is detected. The station immediately halts normal transmission, broadcasts a brief jam signal, and schedules retransmission using exponential backoff.',
    keyTakeaway:
      'Aborting transmission early saves precious channel time that would otherwise be wasted sending the remainder of an already-ruined frame.',
    protocol: 'CSMA_CD',
  },
  {
    id: 'collision-detection',
    title: 'Collision Detection Dynamics',
    category: 'Physical Channel Phenomena',
    explanation:
      'A collision occurs when signals from two or more transmitters overlap on the transmission line. In physical coaxial Ethernet, transceivers compare outgoing voltage to actual line voltage. If line voltage doubles or differs from the transmitted waveform, collision is declared. In this discrete simulation engine, simultaneous occupancy during any tick interval triggers collision state.',
    keyTakeaway:
      'Stations can only detect collisions while still actively transmitting. Hence, minimum frame duration must exceed worst-case round-trip propagation time (2 * tau).',
  },
  {
    id: 'retransmission',
    title: 'Retransmission Handling',
    category: 'Error Recovery',
    explanation:
      'When a frame collides or drops, MAC protocols initiate retransmission. Each frame maintains an internal retry counter. If successive collision counts exceed the maximum configured retry threshold (typically 16 in Ethernet), the frame is dropped and higher-layer protocols (e.g. TCP) must handle recovery.',
    keyTakeaway:
      'Unchecked retransmission without backoff creates deadlock and collision storms as collided stations repeatedly re-collide immediately.',
  },
  {
    id: 'backoff',
    title: 'Binary Exponential Backoff',
    category: 'Contention Resolution',
    formula: 'Backoff Slots r ∈ [0, 2^k - 1],  where k = min(retries, 10)',
    explanation:
      'Truncated Binary Exponential Backoff dynamically resolves contention. After collision i, the station selects a random integer r from the range [0, 2^k - 1], where k = min(i, 10). The station waits r * T_slot time increments before attempting to retransmit. If another collision occurs, the contention window doubles, progressively spreading stations apart over time.',
    keyTakeaway:
      'Exponentially expanding the contention window stabilizes the network during heavy congestion by reducing the probability of repeated collisions.',
    protocol: 'CSMA_CD',
  },
  {
    id: 'throughput-utilization',
    title: 'Throughput versus Channel Utilization',
    category: 'Metrics & Performance Analysis',
    formula: 'Utilization = Busy Time / Total Time;  Throughput = Delivered Bits / Total Time',
    explanation:
      'Gross Channel Utilization measures the fraction of elapsed simulation time during which the physical medium was occupied by any signal (including successful frames and collided bursts). Throughput (or Goodput) measures only the bits of successfully delivered frames divided by elapsed simulation time.',
    keyTakeaway:
      'High utilization does not imply high throughput: an overloaded ALOHA channel can exhibit 95% channel utilization with near 0% useful throughput due to chronic collisions.',
  },
];

export default function Learning() {
  return (
    <div className="learning-workspace">
      <header className="page-header">
        <div>
          <h1>Learning Center</h1>
          <p>
            Theoretical principles, mathematical formulations, and engineering tradeoffs of Medium Access Control protocols.
          </p>
        </div>
        <Link className="btn primary" to="/simulations/new">
          Try in Simulator
        </Link>
      </header>

      <div className="learning-grid">
        {concepts.map(concept => (
          <article className="panel learning-card" key={concept.id}>
            <div className="learning-card-header">
              <div>
                <span className="mono" style={{ fontSize: 11, color: '#DDB487' }}>
                  {concept.category.toUpperCase()}
                </span>
                <h2 style={{ fontSize: 17, margin: '4px 0 0' }}>{concept.title}</h2>
              </div>
              {concept.protocol && (
                <Link
                  className="btn"
                  to={`/simulations/new?protocol=${concept.protocol}`}
                  style={{ fontSize: 12, padding: '3px 8px', minHeight: 28 }}
                >
                  Configure
                </Link>
              )}
            </div>

            {concept.formula && (
              <div className="learning-formula mono">
                {concept.formula}
              </div>
            )}

            <p className="learning-text">{concept.explanation}</p>

            <div className="panel-inset" style={{ marginTop: 12 }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 600, display: 'block' }}>
                KEY TAKEAWAY:
              </span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.55 }}>
                {concept.keyTakeaway}
              </p>
            </div>

            <div style={{ marginTop: 16 }}>
              <ConceptDiagram conceptId={concept.id} protocol={concept.protocol} compact />
            </div>
          </article>
        ))}
      </div>

      <div className="panel-inset" style={{ marginTop: 24 }}>
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Educational disclaimer: MACSim models discrete-event mathematical representations of channel access. Physical transceiver electrical noise, analog waveform distortion, and hardware propagation variations are simplified.
        </p>
      </div>
    </div>
  );
}
