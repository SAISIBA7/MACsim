# MACSim — Frontend & Simulation Changes Summary

**Date:** November 5, 2026  
**Project:** MACSim Protocol Lab  
**Scope:** Configuration Wizard (`NewSim.tsx`), Live Simulation & Timeline Workspace (`SimRun.tsx`, `SimulationTimeline.tsx`), Navigation Consolidation (`App.tsx`, `Home.tsx`), and Backend Pacing Calibration (`SimulationService.ts`).

---

## Table of Contents

1. [New Simulation Page (`NewSim.tsx`)](#1-new-simulation-page)
2. [Live Simulation Page & Execution Pacing](#2-live-simulation-page--execution-pacing)
3. [Activity Timeline Visual Redesign](#3-activity-timeline-visual-redesign)
4. [Control Toolbar & Action Button Relocation](#4-control-toolbar--action-button-relocation)
5. [History Page Deletion & Simulation History Renaming](#5-history-page-deletion--simulation-history-renaming)
6. [Summary of Modified Files](#6-summary-of-modified-files)
7. [Verification & Test Results](#7-verification--test-results)

---

## 1. New Simulation Page

**File:** `MACsim/macsim/src/pages/NewSim.tsx`

### Issues Addressed:
1. **Duplicate Step Numbering:** The horizontal stepper rendered numbers twice for each stage (e.g., `[1] 1. Protocol`, `[2] 2. Network`, `[3] 3. Traffic`, `[4] 4. Advanced`).
2. **Step 4 Naming:** Step 4 was previously titled "Advanced", which did not accurately describe its purpose.

### Changes Applied:
- **Cleaned Stepper Labels:** Removed duplicate textual numbering from the stepper label definitions so that the badge icon displays the step index and the label displays the clean stage name:
  - `[1] Protocol`
  - `[2] Network`
  - `[3] Traffic`
  - `[4] Simulation`
- **Renamed Step 4 to "Simulation":**
  - Updated step 4 header to **`Step 4: Simulation Parameters`**.
  - Updated wizard summary and step navigation references from "Advanced" to "Simulation".

---

## 2. Live Simulation Page & Execution Pacing

**Files:**
- `MACsim/macsim/src/pages/SimRun.tsx`
- `MACsim/macsim/src/api/simulations.ts`
- `MACsim/macsim/backend/src/services/SimulationService.ts`

### Issues Addressed:
1. When pressing **Start**, the simulation executed at an uncontrollably fast rate, jumping from 0 to 1,000 ms in a fraction of a second, preventing observation of real-time topology and channel states.
2. The playback speed selector in the UI was static and did not affect the backend discrete event execution loop.

### Changes Applied:
- **Backend Pacing Calibration (`SimulationService.ts`):**
  - Re-calibrated the discrete-event ticker loop with an interval of `60ms` per tick and dynamic microsecond advances (`stepDeltaUs = Math.max(500, Math.min(2500, sim_time / 400))`).
  - Added speed scaling logic to divide delta step progression by the requested speed factor, allowing normal 1,000 ms runs to progress smoothly over ~25 seconds at 1.0x speed.
- **Dynamic Speed API (`POST /api/v1/simulations/:id/speed`):**
  - Exposed a dedicated backend endpoint to receive runtime playback speed updates (`0.25x`, `0.5x`, `1.0x`, `2.0x`, `4.0x`).
  - Connected `setSimulationSpeed(id, speed)` in `api/simulations.ts`.
  - Wired `handleSpeedChange` in `SimRun.tsx` to push selected speeds to the backend authority and synchronize playback speed upon start or resume.

---

## 3. Activity Timeline Visual Redesign

**File:** `MACsim/macsim/src/components/SimulationTimeline.tsx`

### Issues Addressed:
1. The Activity Timeline initially failed to display transmissions, collisions, deliveries, or backoffs.
2. Frame IDs (`frame_1`, `frame_2`, etc.) erroneously replaced stations on the Y-axis lanes.
3. Once backoff events were mapped, massive solid yellow backoff blocks dominated the entire chart, creating severe visual clutter and drowning out transmissions (blue), collisions (red), and deliveries (green).

### Changes Applied:
- **Station-Only Lanes:**
  - Resolved colliding frame IDs through a frame-to-station map.
  - Strictly restricted the horizontal lanes to physical network stations (`station_1`, `station_2`, `station_3`, `station_4`), preventing frame IDs from polluting the station axis.
- **Two-Tier Visual Hierarchy (Sub-Track vs. Foreground):**
  - **Foreground Active Medium Events (Full 18px Height):**
    - 🟦 **Transmitting** (`#4D9FFF` Electric Blue): Full-height bars representing active channel occupancy.
    - 🟩 **Delivered** (`#2ECC71` Emerald Green): Full-height bars enhanced with a subtle green glow shadow (`drop-shadow(0 0 2px rgba(46,204,113,0.4))`).
    - 🟥 **Collision** (`#FF4D4D` Crimson Red): Full-height collision indicators.
  - **Background Backoff Sub-Track (Slim 6px Rail):**
    - Converted yellow backoff from full-height solid blocks into a slim **6px translucent rail** (`fill: #E5A93C`, `opacity: 0.45`, `rx: 3px`) centered on the lane baseline.
    - Active foreground events tower over this sub-track without visual occlusion.
- **Interactive One-Click Legend Filters:**
  - Added interactive pill buttons in the timeline legend with real-time event counts:
    - `Transmitting (N)`
    - `Collision (N)`
    - `Delivered (N)`
    - `Backoff (Sub-Track) (N)`
  - Clicking any pill toggles that state on or off instantly. Users can click **`Backoff (Sub-Track)`** to hide yellow backoff delays entirely if they prefer zero visual clutter.
- **Tabular Log View:**
  - Added alternate view toggle ("View Tabular Log") to inspect chronological timeline intervals in a structured table.

---

## 4. Control Toolbar & Action Button Relocation

**File:** `MACsim/macsim/src/pages/SimRun.tsx`

### Issues Addressed:
1. The **New Simulation** and **Compare Results** buttons were positioned at the very bottom of the right-side configuration panel below `Active Configuration`, looking disconnected and pushing content below the fold.

### Changes Applied:
- **Moved to Top Control Toolbar:**
  - Removed the button block from the bottom of the right sidebar (`simulation-aside`).
  - Integrated both buttons directly into the top **Control Toolbar** (`.simulation-toolbar`) on the right side, separated from the playback speed controls by a subtle vertical border divider.
  - All interactive buttons on the workspace are now consolidated into a single horizontal bar at the top:
    - **Left:** Execution playback controls (`Start` / `Pause` / `Resume`, `Step`, `Reset`).
    - **Right:** `Playback Speed` selector + divider + `New Simulation` + `Compare Results`.
- **Pre-Selected Comparison Query:**
  - Updated `Compare Results` link to pass the current simulation ID (`/comparisons?ids=${runId}`), automatically pre-selecting the current run for benchmarking in the Comparisons view.
- **Layout Alignment:**
  - Terminating the right sidebar at `Active Configuration` restored clean horizontal alignment between `Shared Medium Topology` and `Performance Metrics`.

---

## 5. History Page Deletion & Simulation History Renaming

**Files:**
- `MACsim/macsim/src/App.tsx`
- `MACsim/macsim/src/pages/Home.tsx`

### Issues Addressed:
1. The sidebar navigation contained both `Simulations` (`/simulations`) and `History` (`/history`), which were redundant routes rendering the identical component with the same backend experiment records.

### Changes Applied:
- **Deleted Redundant Navigation Item:**
  - Removed `{ to: '/history', label: 'History' }` from `navigation` in `App.tsx`.
- **Renamed to "Simulation History":**
  - Renamed `/simulations` label in the sidebar from `Simulations` to **`Simulation History`**.
  - Updated the route component to pass `title="Simulation History"`, updating the page title accordingly.
  - The clean primary sidebar navigation now contains:
    1. **Home** (`/`)
    2. **New Simulation** (`/simulations/new`)
    3. **Simulation History** (`/simulations`)
    4. **Comparisons** (`/comparisons`)
    5. **Learning Center** (`/learning`)
    6. **Settings** (`/settings`)
- **Route Redirection:**
  - Added an automatic redirect in `App.tsx`:
    ```tsx
    <Route path="/history" element={<Navigate to="/simulations" replace />} />
    ```
    This ensures any legacy links or bookmarks pointing to `/history` automatically resolve to `/simulations`.
- **Updated Dashboard Link (`Home.tsx`):**
  - Updated the button on the Home dashboard from `"View All History"` (`/history`) to **`"View Simulation History"`** (`/simulations`).

---

## 6. Summary of Modified Files

| File Path | Description of Changes |
|:---|:---|
| `MACsim/macsim/src/pages/NewSim.tsx` | Fixed stepper duplicate numbering; renamed step 4 to "Simulation". |
| `MACsim/macsim/src/pages/SimRun.tsx` | Connected real-time playback speed control; moved "New Simulation" and "Compare Results" buttons to the top toolbar; removed redundant bottom button block. |
| `MACsim/macsim/src/components/SimulationTimeline.tsx` | Station-only lanes; two-tier visual hierarchy (18px foreground active vs 6px background backoff sub-track); interactive filter pills with live counts; tabular log mode. |
| `MACsim/macsim/src/api/simulations.ts` | Added `setSimulationSpeed()` API method. |
| `MACsim/macsim/backend/src/services/SimulationService.ts` | Calibrated discrete-event ticker pacing; added speed scaling to event progression loop. |
| `MACsim/macsim/src/App.tsx` | Removed `History` from navigation; renamed `Simulations` to `Simulation History`; added `/history` $\rightarrow$ `/simulations` redirect. |
| `MACsim/macsim/src/pages/Home.tsx` | Updated dashboard button link to point to `/simulations` with label `"View Simulation History"`. |

---

## 7. Verification & Test Results

1. **Frontend Compilation:**
   ```powershell
   npm --prefix MACsim/macsim run build
   ```
   - **Result:** Successfully compiled with Vite 8 in **179ms** with zero TypeScript or bundling errors.

2. **Backend Unit & Integration Tests:**
   ```powershell
   npm --prefix MACsim/macsim/backend test
   ```
   - **Result:** **28/28 tests passed** across 9 test files (EventQueue, BackoffManager, RandomGenerator, Pure ALOHA, CSMA, Slotted ALOHA, Determinism, CSMA/CD, REST API Integration).

3. **Active Servers:**
   - **Backend API:** Fastify daemon running on port `8001` (`http://127.0.0.1:8001/api/v1`).
   - **Frontend App:** Vite development server running on port `5173` (`http://localhost:5173`).

