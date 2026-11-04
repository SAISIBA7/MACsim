import type { Protocol } from '../types';
import { ProtocolDiagram } from './ProtocolDiagram';

interface ConceptDiagramProps {
  conceptId: string;
  protocol?: Protocol;
  compact?: boolean;
}

export function ConceptDiagram({ conceptId, protocol, compact = false }: ConceptDiagramProps) {
  const heightStyle = compact ? { maxHeight: 120 } : { maxHeight: 150 };

  switch (conceptId) {
    case 'shared-medium':
      return (
        <svg
          viewBox="0 0 450 135"
          width="100%"
          style={{ display: 'block', width: '100%', height: 'auto', ...heightStyle }}
          aria-label="Shared-Medium Access diagram illustrating multi-access bus with broadcast propagation and single collision domain"
          role="img"
        >
          {/* Instrument Panel Surface */}
          <rect width="450" height="135" fill="#161818" stroke="#3A3832" strokeWidth="1" />

          {/* Header */}
          <text x="14" y="16" fill="#928A7F" fontSize="8.5" fontFamily="IBM Plex Mono">
            TOPOLOGY: SHARED MULTI-ACCESS BUS (SINGLE COLLISION DOMAIN)
          </text>

          {/* Bus Medium Line */}
          <line x1="30" y1="72" x2="420" y2="72" stroke="#DDB487" strokeWidth="3" />

          {/* 50 Ohm Terminators */}
          <rect x="18" y="65" width="12" height="14" fill="#202222" stroke="#DDB487" strokeWidth="1.2" />
          <text x="24" y="76" fill="#DDB487" fontSize="7" fontFamily="IBM Plex Mono" textAnchor="middle">50Ω</text>

          <rect x="420" y="65" width="12" height="14" fill="#202222" stroke="#DDB487" strokeWidth="1.2" />
          <text x="426" y="76" fill="#DDB487" fontSize="7" fontFamily="IBM Plex Mono" textAnchor="middle">50Ω</text>

          {/* Stations */}
          {/* Node A (Transmitting) */}
          <g>
            <rect x="45" y="25" width="68" height="28" fill="#1E2838" stroke="#78A9E8" strokeWidth="1.5" />
            <text x="79" y="38" fill="#F3EDE4" fontSize="9" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">Node A</text>
            <text x="79" y="49" fill="#78A9E8" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">TX (Active)</text>
            <line x1="79" y1="53" x2="79" y2="71" stroke="#78A9E8" strokeWidth="1.5" />
            <circle cx="79" cy="72" r="3" fill="#78A9E8" />
          </g>

          {/* Node B (Listening) */}
          <g>
            <rect x="141" y="25" width="68" height="28" fill="#202222" stroke="#403C36" strokeWidth="1.2" />
            <text x="175" y="38" fill="#F3EDE4" fontSize="9" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">Node B</text>
            <text x="175" y="49" fill="#928A7F" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">Sense Busy</text>
            <line x1="175" y1="53" x2="175" y2="71" stroke="#403C36" strokeWidth="1.2" />
            <circle cx="175" cy="72" r="3" fill="#DDB487" />
          </g>

          {/* Node C (Listening) */}
          <g>
            <rect x="237" y="25" width="68" height="28" fill="#202222" stroke="#403C36" strokeWidth="1.2" />
            <text x="271" y="38" fill="#F3EDE4" fontSize="9" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">Node C</text>
            <text x="271" y="49" fill="#928A7F" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">Sense Busy</text>
            <line x1="271" y1="53" x2="271" y2="71" stroke="#403C36" strokeWidth="1.2" />
            <circle cx="271" cy="72" r="3" fill="#DDB487" />
          </g>

          {/* Node D (Target Receiver) */}
          <g>
            <rect x="333" y="25" width="68" height="28" fill="#1C2E1F" stroke="#78B978" strokeWidth="1.5" />
            <text x="367" y="38" fill="#F3EDE4" fontSize="9" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">Node D</text>
            <text x="367" y="49" fill="#78B978" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">RX (Target)</text>
            <line x1="367" y1="53" x2="367" y2="71" stroke="#78B978" strokeWidth="1.5" />
            <circle cx="367" cy="72" r="3" fill="#78B978" />
          </g>

          {/* Transmitted frame packet travelling across the cable */}
          <rect x="98" y="66" width="62" height="12" fill="#78A9E8" stroke="#F3EDE4" strokeWidth="0.8" />
          <text x="129" y="75" fill="#141515" fontSize="7.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
            FRAME [A→D]
          </text>

          {/* Propagation Indicators */}
          <text x="225" y="94" fill="#DDB487" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="middle">
            ◄── Bidirectional Signal Propagation ──►
          </text>

          {/* Technical Note with ample bottom margin */}
          <line x1="14" y1="104" x2="436" y2="104" stroke="#252828" strokeWidth="1" />
          <text x="225" y="120" fill="#928A7F" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="middle">
            Shared collision domain: concurrent transmissions overlap and corrupt frames.
          </text>
        </svg>
      );

    case 'collision-detection':
      return (
        <svg
          viewBox="0 0 450 148"
          width="100%"
          style={{ display: 'block', width: '100%', height: 'auto', ...heightStyle }}
          aria-label="Collision Detection Dynamics diagram showing round trip propagation delay 2*tau and collision overlap"
          role="img"
        >
          {/* Instrument Panel Surface */}
          <rect width="450" height="148" fill="#161818" stroke="#3A3832" strokeWidth="1" />

            {/* Header Row (Isolated) */}
            <text x="14" y="15" fill="#928A7F" fontSize="8.5" fontFamily="IBM Plex Mono">
              COLLISION DYNAMICS: WORST-CASE DETECTION WINDOW (2 * τ)
            </text>
            <line x1="14" y1="22" x2="436" y2="22" stroke="#252828" strokeWidth="1" />

              {/* Cable Span header (Placed cleanly on its own row) */}
              <line x1="85" y1="34" x2="365" y2="34" stroke="#403C36" strokeWidth="1" />
              <polyline points="89,31 85,34 89,37" fill="#403C36" />
              <polyline points="361,31 365,34 361,37" fill="#403C36" />
              <text x="225" y="30" fill="#928A7F" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">
                Cable Length L (One-Way Propagation Delay = τ)
              </text>

              {/* Station A (Left) */}
              <rect x="14" y="44" width="65" height="22" fill="#202222" stroke="#78A9E8" strokeWidth="1.2" />
              <text x="46" y="58" fill="#78A9E8" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">Station A</text>

              {/* Station B (Right) */}
              <rect x="371" y="44" width="65" height="22" fill="#202222" stroke="#D5A45D" strokeWidth="1.2" />
              <text x="403" y="58" fill="#D5A45D" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">Station B</text>

              {/* Transmission waveforms */}
              {/* Wave from A starts at t = 0 */}
                <rect x="83" y="45" width="115" height="20" fill="#1F2836" stroke="#78A9E8" strokeWidth="1" />
                <text x="140" y="58" fill="#78A9E8" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="middle">
                  Tx Wave from A (t=0) →
                </text>

                {/* Wave from B starts at t = τ - ε */}
                  <rect x="252" y="45" width="115" height="20" fill="#2B2317" stroke="#D5A45D" strokeWidth="1" />
                  <text x="309" y="58" fill="#D5A45D" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="middle">
                    ← Tx B (t=τ-ε)
                  </text>

                  {/* Collision interference zone in middle */}
                    <rect x="202" y="41" width="46" height="28" fill="#3D1A1A" stroke="#D96A62" strokeWidth="1.5" />
                    <text x="225" y="58" fill="#FF8A80" fontSize="8" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                      COLLIDE
                    </text>

                    {/* Reflected collision wave returning to A */}
                      <line x1="202" y1="81" x2="46" y2="81" stroke="#D96A62" strokeWidth="1.5" strokeDasharray="3,2" />
                      <polyline points="52,78 46,81 52,84" fill="#D96A62" />
                      <text x="135" y="77" fill="#FF8A80" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">
                        Collision reflection arrives at Station A at t = 2τ
                      </text>

                      {/* Minimum frame condition callout card */}
                        <rect x="14" y="93" width="422" height="46" fill="#1E2020" stroke="#403C36" strokeWidth="1" />
                        <text x="225" y="111" fill="#DDB487" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                          Requirement: Minimum Frame Duration T_frame ≥ 2τ (Slot Time)
                        </text>
                          <text x="225" y="127" fill="#928A7F" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">
                            Station A must still be actively asserting bits when reflection returns to detect conflict.
                          </text>
                        </svg>
                        );

                        case 'retransmission':
                        return (
                        <svg
                          viewBox="0 0 450 145"
                          width="100%"
                          style={{ display: 'block', width: '100%', height: 'auto', ...heightStyle }}
                          aria-label="Retransmission Handling flowchart illustrating retry tracking, exponential backoff, and packet drop limits"
                          role="img"
                        >
                          {/* Instrument Panel Surface */}
                          <rect width="450" height="145" fill="#161818" stroke="#3A3832" strokeWidth="1" />

                          {/* Header */}
                          <text x="14" y="16" fill="#928A7F" fontSize="8.5" fontFamily="IBM Plex Mono">
                            RETRANSMISSION HANDLING: RETRY COUNTER &amp; DEADLOCK ABORT
                          </text>

                          {/* Stage 1: Collision */}
                          <rect x="14" y="28" width="85" height="36" fill="#2E1B1B" stroke="#D96A62" strokeWidth="1.2" />
                          <text x="56" y="42" fill="#FF8A80" fontSize="8" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                            Collision
                          </text>
                          <text x="56" y="54" fill="#C5B9A8" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">
                            retries = k + 1
                          </text>

                          {/* Arrow 1 */}
                          <line x1="99" y1="46" x2="118" y2="46" stroke="#928A7F" strokeWidth="1.2" />
                          <polyline points="114,43 119,46 114,49" fill="#928A7F" />

                          {/* Stage 2: Retry Threshold Decision */}
                          <rect x="120" y="28" width="90" height="36" fill="#202222" stroke="#D5A45D" strokeWidth="1.2" />
                          <text x="165" y="42" fill="#D5A45D" fontSize="8" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                            k ≤ 16?
                          </text>
                          <text x="165" y="54" fill="#C5B9A8" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">
                            Check Threshold
                          </text>

                          {/* Arrow 2 */}
                          <line x1="210" y1="46" x2="228" y2="46" stroke="#928A7F" strokeWidth="1.2" />
                          <polyline points="224,43 229,46 224,49" fill="#928A7F" />

                          {/* Stage 3: Backoff Delay */}
                          <rect x="230" y="28" width="105" height="36" fill="#282116" stroke="#D5A45D" strokeWidth="1.2" />
                          <text x="282" y="42" fill="#D5A45D" fontSize="8" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                            Backoff Delay
                          </text>
                          <text x="282" y="54" fill="#C5B9A8" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">
                            r ∈ [0, 2^k - 1]
                          </text>

                          {/* Arrow 3 */}
                          <line x1="335" y1="46" x2="353" y2="46" stroke="#928A7F" strokeWidth="1.2" />
                          <polyline points="349,43 354,46 349,49" fill="#928A7F" />

                          {/* Stage 4: Retransmit */}
                          <rect x="355" y="28" width="81" height="36" fill="#1C2E1F" stroke="#78B978" strokeWidth="1.2" />
                          <text x="395" y="42" fill="#78B978" fontSize="8" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                            Retry Tx
                          </text>
                          <text x="395" y="54" fill="#C5B9A8" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">
                            Wait r * Tslot
                          </text>

                          {/* Failure branch: k > 16 */}
                          <line x1="165" y1="64" x2="165" y2="80" stroke="#D96A62" strokeWidth="1.2" />
                          <polyline points="162,76 165,81 168,76" fill="#D96A62" />

                          <rect x="90" y="82" width="150" height="34" fill="#2A1414" stroke="#D96A62" strokeWidth="1.2" />
                          <text x="165" y="96" fill="#FF8A80" fontSize="8" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                            k &gt; 16: Frame Dropped
                          </text>
                          <text x="165" y="108" fill="#C5B9A8" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">
                            Excessive Collisions → Abort
                          </text>

                          {/* Success note */}
                          <rect x="265" y="82" width="171" height="34" fill="#182A1B" stroke="#78B978" strokeWidth="1.2" />
                          <text x="350" y="96" fill="#78B978" fontSize="8" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                            Delivery ACK: Reset k = 0
                          </text>
                          <text x="350" y="108" fill="#C5B9A8" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">
                            Window resets to minimum [0, 1]
                          </text>
                        </svg>
                        );

                        case 'backoff':
                        return (
                        <svg
                          viewBox="0 0 450 145"
                          width="100%"
                          style={{ display: 'block', width: '100%', height: 'auto', ...heightStyle }}
                          aria-label="Binary Exponential Backoff diagram illustrating widening contention windows across collision retries"
                          role="img"
                        >
                          {/* Instrument Panel Surface */}
                          <rect width="450" height="145" fill="#161818" stroke="#3A3832" strokeWidth="1" />

                          {/* Header */}
                          <text x="14" y="16" fill="#928A7F" fontSize="8.5" fontFamily="IBM Plex Mono">
                            EXPONENTIAL BACKOFF: EXPANDING CONTENTION WINDOW W = [0, 2^k - 1]
                          </text>

                          {/* Rows of expanding contention windows */}
                          {/* Lane 1: k=1 */}
                          <text x="14" y="38" fill="#C5B9A8" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono">k=1</text>
                          <rect x="46" y="27" width="55" height="15" fill="#282116" stroke="#D5A45D" strokeWidth="1" />
                          <text x="73" y="38" fill="#D5A45D" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">W = 2</text>
                          <text x="110" y="38" fill="#928A7F" fontSize="7.5" fontFamily="IBM Plex Mono">r ∈ [0, 1] slots</text>

                          {/* Lane 2: k=2 */}
                          <text x="14" y="58" fill="#C5B9A8" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono">k=2</text>
                          <rect x="46" y="47" width="100" height="15" fill="#282116" stroke="#D5A45D" strokeWidth="1" />
                          <text x="96" y="58" fill="#D5A45D" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">W = 4</text>
                          <text x="156" y="58" fill="#928A7F" fontSize="7.5" fontFamily="IBM Plex Mono">r ∈ [0, 3] slots</text>

                          {/* Lane 3: k=3 */}
                          <text x="14" y="78" fill="#C5B9A8" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono">k=3</text>
                          <rect x="46" y="67" width="170" height="15" fill="#282116" stroke="#D5A45D" strokeWidth="1" />
                          <text x="131" y="78" fill="#D5A45D" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">W = 8</text>
                          <text x="226" y="78" fill="#928A7F" fontSize="7.5" fontFamily="IBM Plex Mono">r ∈ [0, 7] slots</text>

                          {/* Lane 4: k=4 */}
                          <text x="14" y="98" fill="#C5B9A8" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono">k=4</text>
                          <rect x="46" y="87" width="280" height="15" fill="#282116" stroke="#D5A45D" strokeWidth="1" />
                          <text x="186" y="98" fill="#D5A45D" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">W = 16</text>
                          <text x="336" y="98" fill="#928A7F" fontSize="7.5" fontFamily="IBM Plex Mono">r ∈ [0, 15] slots</text>

                          {/* Cap summary badge */}
                          <rect x="300" y="27" width="136" height="35" fill="#202222" stroke="#403C36" strokeWidth="1" />
                          <text x="368" y="41" fill="#DDB487" fontSize="7.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                            Cap: k = 10 (1024 slots)
                          </text>
                          <text x="368" y="53" fill="#928A7F" fontSize="7" fontFamily="IBM Plex Mono" textAnchor="middle">
                            Drop packet if retries &gt; 16
                          </text>

                          {/* Technical footer */}
                          <line x1="14" y1="112" x2="436" y2="112" stroke="#252828" strokeWidth="1" />
                          <text x="225" y="128" fill="#928A7F" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="middle">
                            Doubling window spreads contending stations exponentially apart in time.
                          </text>
                        </svg>
                        );

                        case 'throughput-utilization':
                        return (
                        <svg
                          viewBox="0 0 450 145"
                          width="100%"
                          style={{ display: 'block', width: '100%', height: 'auto', ...heightStyle }}
                          aria-label="Throughput versus Channel Utilization plot showing Pure ALOHA, Slotted ALOHA, and CSMA performance curves"
                          role="img"
                        >
                          {/* Instrument Panel Surface */}
                          <rect width="450" height="145" fill="#161818" stroke="#3A3832" strokeWidth="1" />

                          {/* Header */}
                          <text x="14" y="16" fill="#928A7F" fontSize="8.5" fontFamily="IBM Plex Mono">
                            THROUGHPUT (S) VS OFFERED LOAD (G) &amp; CHANNEL UTILIZATION
                          </text>

                          {/* Coordinate Axes */}
                          <line x1="44" y1="114" x2="325" y2="114" stroke="#403C36" strokeWidth="1.2" />
                          <line x1="44" y1="114" x2="44" y2="26" stroke="#403C36" strokeWidth="1.2" />

                          {/* Y Axis ticks (Throughput S) */}
                          <text x="38" y="117" fill="#928A7F" fontSize="7" fontFamily="IBM Plex Mono" textAnchor="end">0%</text>
                          <text x="38" y="99" fill="#928A7F" fontSize="7" fontFamily="IBM Plex Mono" textAnchor="end">20%</text>
                          <text x="38" y="81" fill="#928A7F" fontSize="7" fontFamily="IBM Plex Mono" textAnchor="end">40%</text>
                          <text x="38" y="63" fill="#928A7F" fontSize="7" fontFamily="IBM Plex Mono" textAnchor="end">60%</text>
                          <text x="38" y="45" fill="#928A7F" fontSize="7" fontFamily="IBM Plex Mono" textAnchor="end">80%</text>
                          <text x="38" y="28" fill="#928A7F" fontSize="7" fontFamily="IBM Plex Mono" textAnchor="end">100%</text>

                          {/* X Axis ticks (Offered Load G) */}
                          <text x="44" y="125" fill="#928A7F" fontSize="7" fontFamily="IBM Plex Mono" textAnchor="middle">0</text>
                          <text x="91" y="125" fill="#928A7F" fontSize="7" fontFamily="IBM Plex Mono" textAnchor="middle">0.5</text>
                          <text x="138" y="125" fill="#928A7F" fontSize="7" fontFamily="IBM Plex Mono" textAnchor="middle">1.0</text>
                          <text x="185" y="125" fill="#928A7F" fontSize="7" fontFamily="IBM Plex Mono" textAnchor="middle">1.5</text>
                          <text x="232" y="125" fill="#928A7F" fontSize="7" fontFamily="IBM Plex Mono" textAnchor="middle">2.0</text>
                          <text x="325" y="125" fill="#928A7F" fontSize="7" fontFamily="IBM Plex Mono" textAnchor="middle">3.0</text>

                          {/* Clean, centered X-Axis Title */}
                          <text x="185" y="137" fill="#DDB487" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="middle">
                            Offered Traffic Load G (Attempts / Frame Time) →
                          </text>

                          {/* Grid lines subtle */}
                          <line x1="44" y1="96" x2="325" y2="96" stroke="#222525" strokeWidth="1" strokeDasharray="2,2" />
                          <line x1="44" y1="78" x2="325" y2="78" stroke="#222525" strokeWidth="1" strokeDasharray="2,2" />
                          <line x1="44" y1="60" x2="325" y2="60" stroke="#222525" strokeWidth="1" strokeDasharray="2,2" />
                          <line x1="44" y1="42" x2="325" y2="42" stroke="#222525" strokeWidth="1" strokeDasharray="2,2" />

                          {/* 1. Pure ALOHA: S = G * e^(-2G), peak at G = 0.5, S = 18.4% */}
                          <path
                            d="M 44,114 Q 70,93 91,97 Q 130,105 325,113"
                            fill="none"
                            stroke="#DDB487"
                            strokeWidth="2"
                          />
                          <circle cx="91" cy="97" r="2.5" fill="#DDB487" />

                          {/* 2. Slotted ALOHA: S = G * e^(-G), peak at G = 1.0, S = 36.8% */}
                          <path
                            d="M 44,114 Q 90,75 138,81 Q 200,95 325,111"
                            fill="none"
                            stroke="#78A9E8"
                            strokeWidth="2"
                          />
                          <circle cx="138" cy="81" r="2.5" fill="#78A9E8" />

                          {/* 3. 1-Persistent CSMA: peak at ~53% */}
                          <path
                            d="M 44,114 Q 75,63 91,66 Q 140,80 325,108"
                            fill="none"
                            stroke="#78B978"
                            strokeWidth="2"
                          />
                          <circle cx="91" cy="66" r="2.5" fill="#78B978" />

                          {/* 4. Gross Channel Utilization: rises to ~95-100% under high G while S collapses */}
                          <path
                            d="M 44,114 Q 90,55 170,38 L 325,32"
                            fill="none"
                            stroke="#D96A62"
                            strokeWidth="1.5"
                            strokeDasharray="3,2"
                          />

                          {/* Dedicated Technical Legend Panel on Right - completely separates text from curves */}
                          <rect x="335" y="26" width="105" height="88" fill="#1E2020" stroke="#403C36" strokeWidth="1" />
                          <text x="342" y="39" fill="#928A7F" fontSize="7.5" fontWeight="600" fontFamily="IBM Plex Mono">LEGEND</text>

                          <line x1="342" y1="51" x2="356" y2="51" stroke="#78B978" strokeWidth="2" />
                          <text x="362" y="54" fill="#78B978" fontSize="7.5" fontFamily="IBM Plex Mono">CSMA (53%)</text>

                          <line x1="342" y1="67" x2="356" y2="67" stroke="#78A9E8" strokeWidth="2" />
                          <text x="362" y="70" fill="#78A9E8" fontSize="7.5" fontFamily="IBM Plex Mono">Slotted 36.8%</text>

                          <line x1="342" y1="83" x2="356" y2="83" stroke="#DDB487" strokeWidth="2" />
                          <text x="362" y="86" fill="#DDB487" fontSize="7.5" fontFamily="IBM Plex Mono">Pure 18.4%</text>

                          <line x1="342" y1="99" x2="356" y2="99" stroke="#D96A62" strokeWidth="1.5" strokeDasharray="3,2" />
                          <text x="362" y="102" fill="#FF8A80" fontSize="7.5" fontFamily="IBM Plex Mono">Utilization</text>
                        </svg>
                        );

                        default:
                        if (protocol) {
        return <ProtocolDiagram protocol={protocol} compact={compact} />;
      }
                        return null;
  }
}
