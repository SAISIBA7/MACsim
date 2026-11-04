export function NetworkIllustration() {
  return (
    <svg
      viewBox="0 0 460 215"
      width="100%"
      height="100%"
      style={{ maxHeight: 220, display: 'block' }}
      aria-label="Technical diagram of network stations connected to a shared bus communication medium"
      role="img"
    >
      {/* Background panel */}
      <rect x="2" y="2" width="456" height="211" fill="#1E2020" stroke="#403C36" strokeWidth="1" />

      {/* Grid subtle markings */}
      <line x1="16" y1="30" x2="444" y2="30" stroke="#252626" strokeWidth="1" />
      <line x1="16" y1="180" x2="444" y2="180" stroke="#252626" strokeWidth="1" />

      {/* Header technical tag */}
      <text x="16" y="21" fill="#928A7F" fontSize="9.5" fontFamily="IBM Plex Mono" fontWeight="500">
        TOPOLOGY: SHARED BUS TRANSMISSION MEDIUM
      </text>

      {/* Bus line (The shared medium) */}
      <line x1="45" y1="126" x2="415" y2="126" stroke="#DDB487" strokeWidth="3" />

      {/* Bus Terminators at left and right */}
      <rect x="24" y="118" width="18" height="16" fill="#252626" stroke="#DDB487" strokeWidth="1.5" />
      <text x="33" y="129" fill="#DDB487" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">50Ω</text>
      <text x="33" y="146" fill="#928A7F" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">TERM-L</text>

      <rect x="418" y="118" width="18" height="16" fill="#252626" stroke="#DDB487" strokeWidth="1.5" />
      <text x="427" y="129" fill="#DDB487" fontSize="7.5" fontFamily="IBM Plex Mono" textAnchor="middle">50Ω</text>
      <text x="427" y="146" fill="#928A7F" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">TERM-R</text>

      {/* Bus Medium Label */}
      <rect x="145" y="142" width="170" height="18" fill="#141515" stroke="#403C36" strokeWidth="1" />
      <text x="230" y="154" fill="#C5B9A8" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">
        SHARED COAXIAL / BUS CHANNEL
      </text>

      {/* Station 1: PC-01 */}
      <g>
        <rect x="62" y="40" width="66" height="42" fill="#252626" stroke="#625344" strokeWidth="1.5" />
        <text x="95" y="56" fill="#F3EDE4" fontSize="11" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">PC-01</text>
        <text x="95" y="72" fill="#78B978" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">TX READY</text>
        {/* Drop tap line */}
        <line x1="95" y1="82" x2="95" y2="124" stroke="#625344" strokeWidth="1.5" />
        {/* Tap transceiver */}
        <rect x="91" y="122" width="8" height="8" fill="#DDB487" />
        <circle cx="95" cy="126" r="2" fill="#141515" />
      </g>

      {/* Station 2: PC-02 (Transmitting frame onto channel) */}
      <g>
        <rect x="156" y="40" width="66" height="42" fill="#252626" stroke="#78A9E8" strokeWidth="1.5" />
        <text x="189" y="56" fill="#F3EDE4" fontSize="11" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">PC-02</text>
        <text x="189" y="72" fill="#78A9E8" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">TRANSMIT</text>
        {/* Drop tap line - Active */}
        <line x1="189" y1="82" x2="189" y2="124" stroke="#78A9E8" strokeWidth="2" />
        <rect x="185" y="122" width="8" height="8" fill="#78A9E8" />
        <circle cx="189" cy="126" r="2" fill="#141515" />

        {/* Transmitted signal packet on the bus */}
        <rect x="204" y="121" width="40" height="10" fill="#78A9E8" stroke="#F3EDE4" strokeWidth="1" />
        <text x="224" y="129" fill="#141515" fontSize="7.5" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">F-0012</text>
      </g>

      {/* Station 3: PC-03 (Carrier Sense Busy) */}
      <g>
        <rect x="250" y="40" width="66" height="42" fill="#252626" stroke="#D5A45D" strokeWidth="1.5" />
        <text x="283" y="56" fill="#F3EDE4" fontSize="11" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">PC-03</text>
        <text x="283" y="72" fill="#D5A45D" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">SENSE BUSY</text>
        {/* Drop tap line */}
        <line x1="283" y1="82" x2="283" y2="124" stroke="#D5A45D" strokeWidth="1.5" />
        <rect x="279" y="122" width="8" height="8" fill="#D5A45D" />
        <circle cx="283" cy="126" r="2" fill="#141515" />
      </g>

      {/* Station 4: PC-04 (Idle) */}
      <g>
        <rect x="344" y="40" width="66" height="42" fill="#252626" stroke="#625344" strokeWidth="1.5" />
        <text x="377" y="56" fill="#F3EDE4" fontSize="11" fontWeight="600" fontFamily="IBM Plex Mono" textAnchor="middle">PC-04</text>
        <text x="377" y="72" fill="#928A7F" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">IDLE</text>
        {/* Drop tap line */}
        <line x1="377" y1="82" x2="377" y2="124" stroke="#625344" strokeWidth="1.5" />
        <rect x="373" y="122" width="8" height="8" fill="#DDB487" />
        <circle cx="377" cy="126" r="2" fill="#141515" />
      </g>

      {/* Bottom technical parameters indicator cleanly divided left and right */}
      <text x="16" y="198" fill="#928A7F" fontSize="8.5" fontFamily="IBM Plex Mono">
        CH_RATE: 1.0 Mbps  ·  PROPAGATION: 5 µs/km
      </text>
      <text x="444" y="198" fill="#DDB487" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="end">
        ALOHA · SLOTTED · CSMA · CSMA/CD
      </text>
    </svg>
  );
}
