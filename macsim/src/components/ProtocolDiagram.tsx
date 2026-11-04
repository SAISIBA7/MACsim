import type { Protocol } from '../types';

interface ProtocolDiagramProps {
  protocol: Protocol;
  compact?: boolean;
}

export function ProtocolDiagram({ protocol, compact = false }: ProtocolDiagramProps) {
  const heightStyle = compact ? { maxHeight: 115 } : { maxHeight: 140 };

  switch (protocol) {
    case 'PURE_ALOHA':
      return (
        <svg
          viewBox="0 0 450 135"
          width="100%"
          style={{ display: 'block', width: '100%', height: 'auto', ...heightStyle }}
          aria-label="Pure ALOHA asynchronous transmission diagram showing overlapping collision window"
          role="img"
        >
          {/* Instrument panel background */}
          <rect width="450" height="135" fill="#161818" stroke="#3A3832" strokeWidth="1" />

            {/* Header Row (Isolated) */}
            <text x="14" y="15" fill="#928A7F" fontSize="8.5" fontFamily="IBM Plex Mono">
              PURE ALOHA: ASYNCHRONOUS OVERLAP COLLISION (VULNERABLE = 2 * T_fr)
            </text>
            <line x1="14" y1="22" x2="436" y2="22" stroke="#252828" strokeWidth="1" />

            {/* Collision Callout Badge (Below header divider) */}
            <rect x="110" y="25" width="72" height="13" fill="#2E1414" stroke="#D96A62" strokeWidth="1" />
            <text x="146" y="34" fill="#FF8A80" fontSize="7" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
              COLLISION (2T)
            </text>

            {/* Station labels */}
            <text x="14" y="49" fill="#C5B9A8" fontSize="9" fontWeight="600" fontFamily="IBM Plex Mono">PC-1</text>
            <text x="14" y="75" fill="#C5B9A8" fontSize="9" fontWeight="600" fontFamily="IBM Plex Mono">PC-2</text>
            <text x="14" y="101" fill="#C5B9A8" fontSize="9" fontWeight="600" fontFamily="IBM Plex Mono">PC-3</text>

            {/* Lane guides */}
            <line x1="50" y1="46" x2="410" y2="46" stroke="#262828" strokeWidth="1" />
            <line x1="50" y1="72" x2="410" y2="72" stroke="#262828" strokeWidth="1" />
            <line x1="50" y1="98" x2="410" y2="98" stroke="#262828" strokeWidth="1" />

            {/* PC-1 frame (transmitting) */}
              <rect x="58" y="37" width="105" height="18" fill="#1E2838" stroke="#78A9E8" strokeWidth="1.2" />
              <text x="110" y="49" fill="#78A9E8" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                Frame 1 (PC-1)
              </text>

              {/* PC-2 frame that overlaps PC-1 -> COLLISION */}
                <rect x="128" y="63" width="105" height="18" fill="#2E1C1C" stroke="#D96A62" strokeWidth="1.2" />
                <text x="180" y="75" fill="#D96A62" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                  Frame 2 (PC-2)
                </text>

                {/* Collision overlap zone */}
                <rect x="128" y="37" width="35" height="44" fill="#D96A62" fillOpacity="0.22" stroke="#D96A62" strokeDasharray="3,2" strokeWidth="1.2" />

                {/* PC-3 frame (uncontested) */}
                  <rect x="280" y="89" width="110" height="18" fill="#1C2E1F" stroke="#78B978" strokeWidth="1.2" />
                  <text x="335" y="101" fill="#78B978" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                    Frame 3 (Delivered)
                  </text>

                  {/* Time axis */}
                  <line x1="50" y1="122" x2="425" y2="122" stroke="#403C36" strokeWidth="1.2" />
                  <polyline points="420,119 426,122 420,125" fill="#403C36" />
                  <text x="425" y="116" fill="#928A7F" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="end">Time →</text>
                </svg>
                );

                case 'SLOTTED_ALOHA':
                return (
                <svg
                  viewBox="0 0 450 135"
                  width="100%"
                  style={{ display: 'block', width: '100%', height: 'auto', ...heightStyle }}
                  aria-label="Slotted ALOHA transmission diagram showing synchronized slot boundaries"
                  role="img"
                >
                  {/* Instrument panel background */}
                  <rect width="450" height="135" fill="#161818" stroke="#3A3832" strokeWidth="1" />

                    {/* Header Row (Isolated) */}
                    <text x="14" y="15" fill="#928A7F" fontSize="8.5" fontFamily="IBM Plex Mono">
                      SLOTTED ALOHA: SYNCHRONIZED SLOTS (VULNERABLE = 1 * T_fr)
                    </text>
                    <line x1="14" y1="22" x2="436" y2="22" stroke="#252828" strokeWidth="1" />

                    {/* Slot vertical boundary markers */}
                    <line x1="58" y1="26" x2="58" y2="114" stroke="#333636" strokeDasharray="3,3" strokeWidth="1" />
                    <line x1="148" y1="26" x2="148" y2="114" stroke="#333636" strokeDasharray="3,3" strokeWidth="1" />
                    <line x1="238" y1="26" x2="238" y2="114" stroke="#333636" strokeDasharray="3,3" strokeWidth="1" />
                    <line x1="328" y1="26" x2="328" y2="114" stroke="#333636" strokeDasharray="3,3" strokeWidth="1" />
                    <line x1="418" y1="26" x2="418" y2="114" stroke="#333636" strokeDasharray="3,3" strokeWidth="1" />

                    {/* Slot labels */}
                    <text x="103" y="34" fill="#928A7F" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="middle">Slot 1</text>
                    <text x="193" y="34" fill="#FF8A80" fontSize="8" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">Slot 2 (Collision)</text>
                    <text x="283" y="34" fill="#928A7F" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="middle">Slot 3 (Idle)</text>
                    <text x="373" y="34" fill="#78B978" fontSize="8" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">Slot 4 (Success)</text>

                    {/* Stations */}
                    <text x="14" y="55" fill="#C5B9A8" fontSize="9" fontWeight="600" fontFamily="IBM Plex Mono">PC-1</text>
                    <text x="14" y="85" fill="#C5B9A8" fontSize="9" fontWeight="600" fontFamily="IBM Plex Mono">PC-2</text>

                    {/* Slot 1: PC-1 transmits successfully */}
                      <rect x="63" y="44" width="80" height="18" fill="#1C2E1F" stroke="#78B978" strokeWidth="1.2" />
                      <text x="103" y="56" fill="#78B978" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                        Delivered
                      </text>

                      {/* Slot 2: Both transmit in same slot -> collision */}
                        <rect x="153" y="44" width="80" height="18" fill="#2E1C1C" stroke="#D96A62" strokeWidth="1.2" />
                        <text x="193" y="56" fill="#FF8A80" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                          Collision
                        </text>

                          <rect x="153" y="74" width="80" height="18" fill="#2E1C1C" stroke="#D96A62" strokeWidth="1.2" />
                          <text x="193" y="86" fill="#FF8A80" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                            Collision
                          </text>

                          {/* Slot 3: PC-2 waits backoff */}
                            <rect x="243" y="74" width="80" height="18" fill="#242016" stroke="#D5A45D" strokeDasharray="2,2" strokeWidth="1" />
                            <text x="283" y="86" fill="#D5A45D" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="middle">
                              Wait Backoff
                            </text>

                            {/* Slot 4: PC-2 retransmits successfully */}
                              <rect x="333" y="74" width="80" height="18" fill="#1C2E1F" stroke="#78B978" strokeWidth="1.2" />
                              <text x="373" y="86" fill="#78B978" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                                Delivered
                              </text>

                              {/* Time axis */}
                              <line x1="50" y1="122" x2="425" y2="122" stroke="#403C36" strokeWidth="1.2" />
                              <polyline points="420,119 426,122 420,125" fill="#403C36" />
                              <text x="425" y="116" fill="#928A7F" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="end">Time →</text>
                            </svg>
                            );

                            case 'CSMA':
                            return (
                            <svg
                              viewBox="0 0 450 135"
                              width="100%"
                              style={{ display: 'block', width: '100%', height: 'auto', ...heightStyle }}
                              aria-label="CSMA carrier sensing diagram showing listen before transmit behavior"
                              role="img"
                            >
                              {/* Instrument panel background */}
                              <rect width="450" height="135" fill="#161818" stroke="#3A3832" strokeWidth="1" />

                                {/* Header Row (Isolated) */}
                                <text x="14" y="15" fill="#928A7F" fontSize="8.5" fontFamily="IBM Plex Mono">
                                  CSMA: CARRIER SENSE &quot;LISTEN BEFORE TALK&quot;
                                </text>
                                <line x1="14" y1="22" x2="436" y2="22" stroke="#252828" strokeWidth="1" />

                                {/* Row labels */}
                                <text x="14" y="44" fill="#C5B9A8" fontSize="9" fontWeight="600" fontFamily="IBM Plex Mono">Channel</text>
                                <text x="14" y="82" fill="#C5B9A8" fontSize="9" fontWeight="600" fontFamily="IBM Plex Mono">Station</text>

                                {/* Column 1: Busy Frame */}
                                  <rect x="70" y="32" width="150" height="19" fill="#1E2838" stroke="#78A9E8" strokeWidth="1.2" />
                                  <text x="145" y="44" fill="#78A9E8" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                                    Busy: Active Frame
                                  </text>

                                  {/* Column 1: Sense Busy Defer */}
                                    <rect x="70" y="70" width="150" height="20" fill="#282116" stroke="#D5A45D" strokeWidth="1.2" />
                                    <text x="145" y="83" fill="#D5A45D" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                                      Sense Busy → Defer Tx
                                    </text>

                                    {/* Sensing arrow (Busy -> Defer) */}
                                    <line x1="145" y1="69" x2="145" y2="54" stroke="#D5A45D" strokeWidth="1.2" strokeDasharray="2,2" />
                                    <polyline points="142,59 145,53 148,59" fill="#D5A45D" />

                                    {/* Transition arrow */}
                                    <line x1="223" y1="80" x2="246" y2="80" stroke="#928A7F" strokeWidth="1.2" />
                                    <polyline points="242,77 247,80 242,83" fill="#928A7F" />

                                    {/* Column 2: Idle Channel */}
                                      <rect x="250" y="32" width="175" height="19" fill="#1F2321" stroke="#3E4540" strokeWidth="1.2" />
                                      <text x="337" y="44" fill="#78B978" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                                        Medium Sensed Idle
                                      </text>

                                      {/* Column 2: Sense Idle Transmit */}
                                        <rect x="250" y="70" width="175" height="20" fill="#1C2E1F" stroke="#78B978" strokeWidth="1.2" />
                                        <text x="337" y="83" fill="#78B978" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                                          Sense Idle → Transmit
                                        </text>

                                        {/* Sensing arrow (Idle -> Transmit) */}
                                        <line x1="337" y1="69" x2="337" y2="54" stroke="#78B978" strokeWidth="1.2" strokeDasharray="2,2" />
                                        <polyline points="334,59 337,53 340,59" fill="#78B978" />

                                        {/* Time axis */}
                                        <line x1="50" y1="122" x2="425" y2="122" stroke="#403C36" strokeWidth="1.2" />
                                        <polyline points="420,119 426,122 420,125" fill="#403C36" />
                                        <text x="425" y="116" fill="#928A7F" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="end">Time →</text>
                                      </svg>
                                      );

                                      case 'CSMA_CD':
                                      return (
                                      <svg
                                        viewBox="0 0 450 135"
                                        width="100%"
                                        style={{ display: 'block', width: '100%', height: 'auto', ...heightStyle }}
                                        aria-label="CSMA/CD diagram showing collision detection, abortion, and backoff"
                                        role="img"
                                      >
                                        {/* Instrument panel background */}
                                        <rect width="450" height="135" fill="#161818" stroke="#3A3832" strokeWidth="1" />

                                          {/* Header Row (Isolated) */}
                                          <text x="14" y="15" fill="#928A7F" fontSize="8.5" fontFamily="IBM Plex Mono">
                                            CSMA/CD: COLLISION DETECTION, JAM &amp; EXPONENTIAL BACKOFF
                                          </text>
                                          <line x1="14" y1="22" x2="436" y2="22" stroke="#252828" strokeWidth="1" />

                                          {/* Collision Callout Tag (Placed safely below header divider) */}
                                          <rect x="99" y="25" width="62" height="13" fill="#2E1414" stroke="#D96A62" strokeWidth="1" />
                                          <text x="130" y="34" fill="#FF8A80" fontSize="7" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                                            COLLISION
                                          </text>

                                          {/* Station labels */}
                                          <text x="14" y="49" fill="#C5B9A8" fontSize="9" fontWeight="600" fontFamily="IBM Plex Mono">PC-1</text>
                                          <text x="14" y="74" fill="#C5B9A8" fontSize="9" fontWeight="600" fontFamily="IBM Plex Mono">PC-2</text>

                                          {/* Station 1 transmission start */}
                                            <rect x="52" y="37" width="68" height="19" fill="#1E2838" stroke="#78A9E8" strokeWidth="1.2" />
                                            <text x="86" y="49" fill="#78A9E8" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                                              Tx Start
                                            </text>

                                            {/* Station 2 transmits before sensing PC-1 wave */}
                                              <rect x="82" y="62" width="38" height="19" fill="#1E2838" stroke="#78A9E8" strokeWidth="1.2" />
                                              <text x="101" y="74" fill="#78A9E8" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                                                Tx
                                              </text>

                                              {/* Collision Detection pulse */}
                                              <rect x="120" y="37" width="20" height="44" fill="#D96A62" fillOpacity="0.25" stroke="#D96A62" strokeWidth="1" />

                                              {/* Abort immediately & Jam */}
                                                <rect x="144" y="37" width="82" height="19" fill="#2E1616" stroke="#D96A62" strokeWidth="1.2" />
                                                <text x="185" y="49" fill="#FF8A80" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                                                  Abort + Jam
                                                </text>

                                                {/* Exponential Backoff wait */}
                                                  <rect x="230" y="37" width="110" height="19" fill="#282116" stroke="#D5A45D" strokeWidth="1.2" />
                                                  <text x="285" y="49" fill="#D5A45D" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                                                    Backoff r * Tslot
                                                  </text>

                                                  {/* Successful retry */}
                                                    <rect x="344" y="37" width="82" height="19" fill="#1C2E1F" stroke="#78B978" strokeWidth="1.2" />
                                                    <text x="385" y="49" fill="#78B978" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">
                                                      Retry Tx
                                                    </text>

                                                      {/* Cleanly centered sequence step note at bottom */}
                                                      <text x="225" y="98" fill="#C5B9A8" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="middle">
                                                        1. Detect Conflict  →  2. Abort &amp; Jam  →  3. Backoff  →  4. Retransmit
                                                      </text>

                                                      {/* Time axis */}
                                                      <line x1="50" y1="122" x2="425" y2="122" stroke="#403C36" strokeWidth="1.2" />
                                                      <polyline points="420,119 426,122 420,125" fill="#403C36" />
                                                      <text x="425" y="116" fill="#928A7F" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="end">Time →</text>
                                                    </svg>
                                                    );
  }
}
