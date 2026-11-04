import { Link } from 'react-router-dom';

const concepts = [
  {
    title: 'Shared-medium access',
    text: 'Stations share one communication channel. A medium access control protocol determines when each station may transmit and how it responds when transmissions overlap.',
  },
  {
    title: 'Pure ALOHA',
    text: 'A station transmits as soon as a frame is ready. Any overlap between frames can cause a collision, so the sender waits and retries.',
    protocol: 'PURE_ALOHA',
  },
  {
    title: 'Slotted ALOHA',
    text: 'Time is divided into slots, and a station may begin a frame only at a slot boundary. Aligning transmission starts reduces the possible collision window.',
    protocol: 'SLOTTED_ALOHA',
  },
  {
    title: 'CSMA',
    text: 'Carrier Sense Multiple Access checks whether the channel is busy before transmitting. Stations that sense an active frame defer and try again later.',
    protocol: 'CSMA',
  },
  {
    title: 'CSMA/CD',
    text: 'Carrier Sense Multiple Access with Collision Detection monitors the medium while transmitting. A detected collision stops normal delivery and triggers a retry after backoff.',
    protocol: 'CSMA_CD',
  },
  {
    title: 'Collision detection',
    text: 'A collision occurs when transmissions overlap on the shared medium. In this simulator, overlapping active frames are recorded as a collision incident and affected frames enter retry handling.',
  },
  {
    title: 'Retransmission',
    text: 'A frame that collides may be queued again. The retransmission count increases when that frame actually starts another transmission.',
  },
  {
    title: 'Backoff',
    text: 'After a collision, a station waits for a randomly selected number of backoff slots. The configured retry and slot settings make this delay observable.',
    protocol: 'CSMA_CD',
  },
  {
    title: 'Throughput and channel utilization',
    text: 'Throughput is the number of successfully delivered frame bits per elapsed simulation second. Channel utilization is the fraction of elapsed time with at least one active transmission.',
  },
];

export default function Learning() {
  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Learning center</h1>
          <p>Review the channel-access concepts shown in the live simulation.</p>
        </div>
        <Link className="btn primary" to="/simulations/new">Try a simulation</Link>
      </header>
      <div className="learning-list">
        {concepts.map(concept => (
          <section className="learning-item" key={concept.title}>
            <h2>{concept.title}</h2>
            <p>{concept.text}</p>
            {concept.protocol && (
              <Link to={`/simulations/new?protocol=${concept.protocol}`}>Configure {concept.title}</Link>
            )}
          </section>
        ))}
      </div>
      <p className="help-text">The simulator is an educational model. Its timing and collision behavior are simplified and do not represent physical Ethernet hardware.</p>
    </div>
  );
}
