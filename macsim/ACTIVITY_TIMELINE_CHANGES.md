# MACSim — Activity Timeline Evolution & Latest Implementation

**Component:** `MACsim/macsim/src/components/SimulationTimeline.tsx`  
**Parent Workspace:** `MACsim/macsim/src/pages/SimRun.tsx`  
**Date:** November 5, 2026  
**Scope:** Chronological event parsing, station lane sanitation, two-tier visual hierarchy, interactive state filtering, and tabular inspection mode.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Timeline Evolution & Problem Progression](#2-timeline-evolution--problem-progression)
   - [Phase 1: Initial Blank Timeline](#phase-1-initial-blank-timeline)
   - [Phase 2: Frame IDs Usurping Station Lanes](#phase-2-frame-ids-usurping-station-lanes)
   - [Phase 3: Backoff Yellow Dominance & Clutter](#phase-3-backoff-yellow-dominance--clutter)
3. [Latest Implementation Details](#3-latest-implementation-details)
   - [3.1 Station-Only Lane Architecture](#31-station-only-lane-architecture)
   - [3.2 Multi-Tier Visual Hierarchy (Sub-Track vs Foreground)](#32-multi-tier-visual-hierarchy-sub-track-vs-foreground)
   - [3.3 Event Interval Resolution Engine](#33-event-interval-resolution-engine)
   - [3.4 Interactive One-Click Legend Filter Pills](#34-interactive-one-click-legend-filter-pills)
   - [3.5 Synchronized Tabular Inspection Mode](#35-synchronized-tabular-inspection-mode)
   - [3.6 Time Progress & Grid Synchronization](#36-time-progress--grid-synchronization)
4. [Color Palette & Visual Specifications](#4-color-palette--visual-specifications)
5. [Code Architecture Walkthrough](#5-code-architecture-walkthrough)
6. [Verification & Results](#6-verification--results)

---

## 1. Executive Summary

The **Activity Timeline** tab in the Live Simulation / Simulation Results workspace (`SimRun.tsx`) visualizes channel activity across the simulation duration. Through successive iterations, it was redesigned from an empty/cluttered visualization into a **two-tier multi-layered chart** with **interactive filter pills** and **station-isolated tracks**.

### Key Outcomes:
- **No Station Clutter:** Y-axis lanes strictly show physical network stations (`station_1`, `station_2`, ...), eliminating internal frame IDs from dominating lanes.
- **De-cluttered Backoff:** Yellow backoff is rendered as a sleek, non-intrusive **6px translucent sub-track rail** (`opacity: 0.45`) in the background.
- **Foreground Clarity:** Active channel events (**Transmitting**, **Delivered**, and **Collision**) are rendered at **full 18px height** (3x taller than backoff) with glowing highlights, ensuring they are instantly visible.
- **1-Click Filter Control:** Interactive filter pills in the legend allow users to toggle any state on or off instantly (e.g., turning off Backoff completely with one click to see only channel transmissions).

---

## 2. Timeline Evolution & Problem Progression

```
[Phase 1: Blank Timeline]
  └─ Events not mapped to time intervals -> Empty chart canvas

[Phase 2: Frame IDs Usurping Lanes]
  └─ Frame keys (`frame_1`, `frame_116`) appeared on Y-axis instead of stations

[Phase 3: Yellow Dominance / Visual Clutter]
  └─ Solid yellow backoff blocks filled 90%+ of lanes, obscuring blue/green/red events

[Phase 4: Latest Solution]
  ├─ Two-Tier Hierarchy (18px Foreground vs 6px Background Sub-Track)
  ├─ Station-only lane sanitization via frame-to-station mapping
  ├─ Interactive one-click legend pills with live interval count badges
  └─ Synchronized tabular log mode
```

### Phase 1: Initial Blank Timeline
- **Symptoms:** When viewing simulation results, the Activity Timeline canvas was completely empty.
- **Root Cause:** Backend SSE events were emitted as instantaneous discrete events (`TRANSMISSION_STARTED`, `FRAME_DELIVERED`, `COLLISION_DETECTED`, `BACKOFF_STARTED`), whereas the timeline required continuous `(startMs, endMs)` intervals. Open intervals were not being tracked or resolved.

### Phase 2: Frame IDs Usurping Station Lanes
- **Symptoms:** The Y-axis displayed rows for `frame_1`, `frame_116`, `frame_152`, etc., resulting in a massive vertical list of frame identifiers instead of the 4 configured network stations.
- **Root Cause:** In Pure ALOHA collision payloads, `collidedWith` contained arrays of frame IDs (e.g. `['frame_1', 'frame_2']`). The timeline parser treated these frame strings as station IDs and pushed them directly into the station lane list.

### Phase 3: Backoff Yellow Dominance & Clutter
- **Symptoms:** Once events and stations were properly mapped, the lanes were overwhelmed by massive solid yellow blocks representing `BACKOFF`. Because random backoff delays in ALOHA and CSMA protocols span hundreds of milliseconds, yellow filled nearly the entire horizontal track, drowning out transmissions (blue), collisions (red), and delivered frames (green).
- **User Feedback:** *"it looks so cluttered that i am barely able to find other colours when yellow is dominant can you display it in a better way"*.

---

## 3. Latest Implementation Details

### 3.1 Station-Only Lane Architecture
The timeline strictly filters visible lanes to physical network stations:
```typescript
const visibleStations = useMemo(() => {
  const raw = stationIds && stationIds.length > 0 ? stationIds : [];
  const validProps = raw.filter((s) => typeof s === 'string' && !s.startsWith('frame_'));
  if (validProps.length > 0) return validProps;

  const set = new Set<string>();
  for (const ev of events) {
    if (ev.stationIds) {
      for (const sid of ev.stationIds) {
        if (sid && !sid.startsWith('frame_')) set.add(sid);
      }
    }
    const rawSid = (ev as unknown as Record<string, unknown>).station_id as string;
    if (rawSid && !rawSid.startsWith('frame_')) set.add(rawSid);
  }
  const arr = Array.from(set).sort();
  return arr.length > 0 ? arr : ['station_1', 'station_2', 'station_3', 'station_4'];
}, [stationIds, events]);
```
- A persistent `frameToStation = new Map<string, string>()` associates every `frameId` with its generator/transmitting station.
- When `payload.collidedWith` contains frame strings, they are resolved via the map back to their host station, ensuring collisions illuminate the correct station lanes.

---

### 3.2 Multi-Tier Visual Hierarchy (Sub-Track vs Foreground)

To solve the yellow dominance problem, the timeline separates rendering into two distinct visual planes:

```
+-------------------------------------------------------------------------------+
| STATION LANE (32px total height, baseline at y + 15)                          |
|                                                                               |
|   ┌── Foreground Layer (y + 6, height: 18px) ─────────────────────────────┐   |
|   │ 🟦 Transmission (Blue) │ 🟥 Collision (Red) │ 🟩 Delivered (Green)     │   |
|   └──┬─────────────────────────────────────────────────────────────────┬──┘   |
|      │                                                                 │      |
|  ════╪══════════════════ [ Track Baseline ] ═══════════════════════════╪════  |
|      │                                                                 │      |
|   ───┴── Background Layer (y + 12, height: 6px, opacity: 0.45) ────────┴───  |
|          🟨 Backoff Delay Sub-Track Rail (Translucent Gold)                    |
+-------------------------------------------------------------------------------+
```

1. **Layer 1 (Background Sub-Track — 6px):**
   - Renders `BACKOFF` intervals as slim 6px rounded rails (`rx="3"`).
   - Positioned at `y + 12` (centered on track baseline `y + 15`).
   - Uses `opacity="0.45"` with a subtle border (`stroke="#B88628"`, `strokeWidth="0.5"`).
   - Retains context of when a station is deferring without dominating the visual space.

2. **Layer 2 (Foreground Active Channel Events — 18px):**
   - Renders `TRANSMISSION`, `COLLISION`, and `DELIVERY` at full 18px height (`y + 6`).
   - Positioned with `rx="2.5"` and crisp borders (`stroke="#101111"`).
   - Rendered **after** Layer 1 in SVG DOM order so active channel events tower directly over the sub-track rail with zero occlusion.
   - Successful deliveries feature an emerald green drop-shadow (`drop-shadow(0 0 2px rgba(46,204,113,0.4))`).

---

### 3.3 Event Interval Resolution Engine

The `useMemo` interval builder parses incoming events chronologically:

1. **`TRANSMISSION_STARTED` / `RETRANSMISSION_ATTEMPTED`:**
   - Opens an active transmission record in `openTx.set(stationId, { startMs, frameId, durationMs })`.
2. **`TRANSMISSION_COMPLETED` / `FRAME_DELIVERED`:**
   - Retrieves `openTx` for that station.
   - Creates a **Transmission** interval (`type: 'TRANSMISSION'`) for the channel transit phase.
   - Creates a **Delivery** interval (`type: 'DELIVERY'`) for the completed delivery phase.
   - Closes `openTx.delete(stationId)`.
3. **`COLLISION_DETECTED`:**
   - Resolves all colliding stations from `payload.collidedWith` and `frameToStation`.
   - Generates a pre-collision transmission segment if time elapsed, followed by a **Collision** interval (`type: 'COLLISION'`).
   - Closes `openTx.delete(stationId)` for affected stations.
4. **`BACKOFF_STARTED`:**
   - Records backoff delay duration in `openBackoff.set(stationId, { startMs, expectedEndMs, frameId, message })`.
5. **`BACKOFF_COMPLETED`:**
   - Resolves the exact `startMs` to `endMs` interval and emits a **Backoff** interval (`type: 'BACKOFF'`).
   - Closes `openBackoff.delete(stationId)`.
6. **Ongoing Intervals:**
   - Any currently active backoffs or transmissions that have not yet received completion events are rendered up to `currentTimeMs`.

---

### 3.4 Interactive One-Click Legend Filter Pills

Above the timeline chart, a dedicated filter toolbar allows dynamic toggling of any state:

```tsx
<div className="timeline-legend">
  <span className="legend-label">Filters (click to toggle):</span>
  
  {/* Transmitting Pill */}
  <button onClick={() => toggleFilter('TRANSMISSION')}>
    <span style={{ background: '#4D9FFF' }} />
    <span>Transmitting</span>
    <span>({counts.TRANSMISSION})</span>
  </button>

  {/* Collision Pill */}
  <button onClick={() => toggleFilter('COLLISION')}>
    <span style={{ background: '#FF4D4D' }} />
    <span>Collision</span>
    <span>({counts.COLLISION})</span>
  </button>

  {/* Delivered Pill */}
  <button onClick={() => toggleFilter('DELIVERY')}>
    <span style={{ background: '#2ECC71' }} />
    <span>Delivered</span>
    <span>({counts.DELIVERY})</span>
  </button>

  {/* Backoff Sub-Track Pill */}
  <button onClick={() => toggleFilter('BACKOFF')}>
    <span style={{ background: '#E5A93C' }} />
    <span>Backoff (Sub-Track)</span>
    <span>({counts.BACKOFF})</span>
  </button>
</div>
```

- **Live Counter Badges:** Each pill displays the exact count of intervals recorded (e.g. `Delivered (56)`, `Collision (38)`, `Backoff (Sub-Track) (130)`).
- **1-Click Toggling:** Clicking any pill toggles `activeFilters[type]`, dynamically filtering intervals from both the SVG chart and the tabular view.
- **Zero-Clutter Mode:** Clicking `Backoff (Sub-Track)` completely hides all yellow delay intervals, revealing only channel-level transmission events.

---

### 3.5 Synchronized Tabular Inspection Mode

Clicking **"View Tabular Log"** in the timeline header switches from the visual SVG chart to a structured data table:
- Columns: `Time Range (ms)`, `Station`, `State`, `Frame`, `Details`.
- Respects the same active filter pills selected in the legend.
- Color-coded state tags matching the timeline palette.

---

### 3.6 Time Progress & Grid Synchronization

- **Grid Ticks:** 5 vertical dashed tick markers (`strokeDasharray="2,2"`, `stroke="#262727"`) with timestamps calculated as `(durationMs * i) / 5`.
- **Live Progress Line:** An amber progress line (`stroke="#DDB487"`, `strokeWidth="1.5"`) advances across the timeline in lockstep with `currentTimeMs`.
- **SVG Tooltips:** Native `<title>` elements on all interval bars provide timestamp ranges and detail strings on hover without external popup dependencies.

---

## 4. Color Palette & Visual Specifications

| Activity Type | Layer | Color Hex | Height | Opacity | Description |
|:---|:---:|:---:|:---:|:---:|:---|
| **Transmitting** | Foreground | `#4D9FFF` | 18px | 1.00 | Electric Blue representing station actively emitting frames. |
| **Delivered** | Foreground | `#2ECC71` | 18px | 1.00 | Emerald Green with glowing drop shadow indicating successful receipt. |
| **Collision** | Foreground | `#FF4D4D` | 18px | 1.00 | Crimson Red indicating overlapping simultaneous transmissions. |
| **Backoff** | Background | `#E5A93C` | 6px | 0.45 | Translucent Amber Gold sub-track rail representing random delay. |
| **Track Line** | Background | `#2D2B28` | 1px | 1.00 | Baseline center track along which each station's events unfold. |
| **Time Cursor** | Foreground | `#DDB487` | Full | 1.00 | Amber vertical cursor tracking the simulation's current timestamp. |

---

## 5. Code Architecture Walkthrough

```typescript
// SVG Rendering in SimulationTimeline.tsx
{visibleStations.map((sid, idx) => {
  const y = topOffset + idx * laneHeight; // laneHeight = 32px
  const stationIntervals = filteredIntervals.filter((item) => item.stationId === sid);

  const backoffIntervals = stationIntervals.filter((i) => i.type === 'BACKOFF');
  const activeEvents = stationIntervals.filter((i) => i.type !== 'BACKOFF');

  return (
    <g key={sid}>
      {/* Station Identifier Label */}
      <rect x="2" y={y + 3} width="62" height="24" rx="4" fill="#202222" stroke="#3E3A34" strokeWidth="1" />
      <text x="33" y={y + 19} fill="#F3EDE4" fontSize="10" fontFamily="IBM Plex Mono" textAnchor="middle">
        {sid}
      </text>

      {/* Lane Track Baseline */}
      <line x1="70" y1={y + 15} x2="730" y2={y + 15} stroke="#2D2B28" strokeWidth="1" />

      {/* LAYER 1: Background Backoff Sub-Track (6px) */}
      {backoffIntervals.map((item) => {
        const startX = 70 + (Math.max(0, item.startMs) / effectiveMaxTime) * 660;
        const endX = 70 + (Math.min(effectiveMaxTime, item.endMs) / effectiveMaxTime) * 660;
        const width = Math.max(3.5, endX - startX);

        return (
          <rect
            key={item.id}
            x={startX}
            y={y + 12}
            width={width}
            height="6"
            rx="3"
            fill="#E5A93C"
            opacity="0.45"
            stroke="#B88628"
            strokeWidth="0.5"
          >
            <title>{`${sid} [BACKOFF] ${formatNumber(item.startMs, 1)}ms - ${formatNumber(item.endMs, 1)}ms: ${item.message}`}</title>
          </rect>
        );
      })}

      {/* LAYER 2: Foreground Active Events (18px) */}
      {activeEvents.map((item) => {
        const startX = 70 + (Math.max(0, item.startMs) / effectiveMaxTime) * 660;
        const endX = 70 + (Math.min(effectiveMaxTime, item.endMs) / effectiveMaxTime) * 660;
        const width = Math.max(4, endX - startX);

        return (
          <rect
            key={item.id}
            x={startX}
            y={y + 6}
            width={width}
            height="18"
            rx="2.5"
            fill={colorForType(item.type)}
            stroke="#101111"
            strokeWidth="0.75"
            style={{
              filter: item.type === 'DELIVERY' ? 'drop-shadow(0 0 2px rgba(46,204,113,0.4))' : undefined,
            }}
          >
            <title>{`${sid} [${item.type}] ${formatNumber(item.startMs, 1)}ms - ${formatNumber(item.endMs, 1)}ms: ${item.message}`}</title>
          </rect>
        );
      })}
    </g>
  );
})}
```

---

## 6. Verification & Results

1. **Compilation:**
   - `npm --prefix MACsim/macsim run build` succeeds cleanly in **179ms** with zero TypeScript diagnostic errors.
2. **Backend Regression Testing:**
   - `npm --prefix MACsim/macsim/backend test` passes **28/28 tests** across all 4 MAC protocols (Pure ALOHA, Slotted ALOHA, CSMA, CSMA/CD).
3. **Runtime Verification:**
   - Tested under Pure ALOHA with 4 stations, 1000ms duration, and 0.5 Poisson intensity.
   - Station lanes show strictly `station_1`, `station_2`, `station_3`, `station_4`.
   - Transmissions (blue), collisions (red), and delivered frames (green) stand out distinctly over the subtle 6px backoff rails.
   - Clicking legend filter pills toggles states instantaneously.

