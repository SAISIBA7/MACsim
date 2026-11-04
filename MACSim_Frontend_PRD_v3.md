# MACSim Frontend Product Requirements Document

## Visual Redesign and Functional UI Specification

**Product:** MACSim - Medium Access Control Protocol Simulator\
**Document:** Frontend Product Requirements Document (PRD)\
**Version:** 3.0\
**Status:** Ready for frontend design and implementation planning\
**Primary visual reference:** User-provided MACSim dashboard screenshot\
**Related specifications:** MACSim Backend PRD v1.0 and existing
Frontend PRD v2.0

------------------------------------------------------------------------

## 1. Executive Summary

MACSim is an educational web application for configuring, running,
observing, and comparing Medium Access Control (MAC) protocol
simulations.

This PRD specifies a frontend redesign that closely follows the supplied
MACSim reference screenshot. The target interface is a dark, technical
simulation workspace using charcoal and near-black surfaces, warm
beige/champagne accents, thin borders, compact typography, and clear
network visualizations.

The redesign covers four primary screens shown in the reference:

1.  Home Dashboard
2.  New Simulation Configuration
3.  Live Simulation
4.  Protocol Comparison

The application must retain the existing product capabilities and
integrate with the existing backend. This is a visual and
frontend-experience redesign, not a request to rewrite the simulation
engine.

The 30 prohibited design patterns supplied by the user are binding
requirements. They apply to every screen, component, state, chart, and
interaction. If a detail in the reference screenshot conflicts with one
of these restrictions, the restriction takes priority.

## 2. Product Goals

1.  Reproduce the visual style, page hierarchy, layout proportions, and
    component arrangement of the supplied MACSim screenshot.
2.  Provide a clear workflow for creating and configuring MAC protocol
    simulations.
3.  Visualize network stations, shared-medium activity, collisions,
    retransmissions, and backoff.
4.  Present simulation metrics and protocol comparisons using
    backend-provided data.
5.  Preserve all working simulation functionality and existing API
    integrations.
6.  Provide consistent desktop, tablet, and mobile experiences.
7.  Satisfy all 30 prohibited-design restrictions.
8.  Keep the frontend maintainable, accessible, and responsive during
    live simulation updates.

## 3. Scope

### 3.1 In scope

-   Shared application shell and left navigation.
-   Home dashboard.
-   New Simulation configuration wizard.
-   Live Simulation workspace.
-   Protocol Comparison.
-   Simulations list and History.
-   Learning Center.
-   Settings.
-   Terms of Service and Privacy Policy routes.
-   Responsive layouts.
-   Loading, empty, error, disconnected, running, paused, completed, and
    failed states.
-   Backend REST and real-time integration.

### 3.2 Out of scope

-   Rewriting or changing the simulation engine.
-   Changing MAC protocol rules or backend metric formulas.
-   Physical network transmission or hardware integration.
-   Introducing unrelated marketing sections or product features.
-   Adding pricing tiers, testimonials, social features, or public
    leaderboards.
-   Presenting hardcoded sample values as real simulation results.
-   Changing database schemas for a frontend-only redesign.

### 3.3 Implementation boundary

Before implementation, inspect the existing repository, routes,
components, dependencies, API clients, state management, and current
functionality.

Reuse the existing framework and working application code. Do not
migrate frameworks or replace working components solely for visual
reasons. Do not modify backend behavior unless a concrete API contract
mismatch is discovered and documented.

## 4. Target Users

-   Data Communication students learning MAC protocols.
-   Instructors demonstrating network access protocols.
-   Project evaluators reviewing simulation behavior and experiment
    results.

## 5. Design Reference and Visual Direction

### 5.1 Primary reference

The supplied MACSim screenshot is the primary visual source. Reproduce
its:

-   Dark technical application appearance.
-   Left sidebar and navigation hierarchy.
-   Main content proportions.
-   Warm beige/champagne accent treatment.
-   Thin panel borders.
-   Hero section and network illustration.
-   Protocol selection area.
-   Simulation topology and event panel.
-   Metric panels and timeline.
-   Comparison chart and results table.

Do not reinterpret the reference as a generic SaaS dashboard or
marketing landing page.

### 5.2 Visual character

The interface should feel like a professional engineering simulation
workstation: precise, restrained, information-dense, and easy to
inspect.

Use: - Near-black and charcoal surfaces. - Warm beige, champagne, and
bronze accents. - Off-white primary text. - Muted warm-gray secondary
text. - Thin, subtle borders. - Clear spacing and alignment. - Simple
technical diagrams. - Restrained semantic colors for simulation states.

Avoid unnecessary decoration. Use layout, borders, typography, and
spacing to establish hierarchy.

### 5.3 Suggested color tokens

These values are implementation starting points based on the supplied
reference. Verify contrast before finalizing.

  --------------------------------------------------------------------------
  Token                      Hex                     Purpose
  -------------------------- ----------------------- -----------------------
  `--color-background`       `#141515`               Main application canvas

  `--color-sidebar`          `#191A1A`               Navigation background

  `--color-surface`          `#1E2020`               Main panels

  `--color-surface-raised`   `#252626`               Nested panels and
                                                     controls

  `--color-input`            `#202222`               Form controls

  `--color-border`           `#403C36`               Panel and control
                                                     borders

  `--color-border-strong`    `#625344`               Selected and emphasized
                                                     borders

  `--color-text-primary`     `#F3EDE4`               Primary text

  `--color-text-secondary`   `#C5B9A8`               Supporting text

  `--color-text-muted`       `#928A7F`               Muted labels

  `--color-accent`           `#DDB487`               Primary actions and
                                                     selected states

  `--color-accent-hover`     `#EAC59B`               Static hover state

  `--color-accent-pressed`   `#BD9163`               Pressed state

  `--color-transmitting`     `#78A9E8`               Active transmission

  `--color-collision`        `#D96A62`               Collision/error

  `--color-success`          `#78B978`               Successful delivery

  `--color-backoff`          `#D5A45D`               Backoff/waiting
  --------------------------------------------------------------------------

Semantic status colors must only be used to communicate actual states.
Always pair them with text or another non-color cue.

### 5.4 Typography

-   Primary interface font: IBM Plex Sans.
-   Numeric data, identifiers, and timestamps: IBM Plex Mono.
-   Do not use Inter, Geist, or Space Grotesk.
-   Suggested desktop type scale:
    -   Brand: 18-20px, semibold.
    -   Main page heading: 28-32px, semibold.
    -   Section heading: 18-20px, semibold.
    -   Panel heading: 15-17px, semibold.
    -   Body: 13-14px.
    -   Supporting labels: 11-12px.
    -   Metric values: 24-30px.

Maintain legibility. Do not shrink text simply to fit more information.

### 5.5 Geometry and surfaces

-   Corner radius: 0px.
-   Use square geometry consistently.
-   Use thin 1px borders for separation.
-   Do not use drop shadows.
-   Use opaque solid surfaces.
-   No glassmorphism or translucent panels.
-   No decorative colored left-edge stripes.
-   Use a consistent 4px-based spacing scale.
-   Keep button and input heights consistent.

### 5.6 Icons

-   Do not use Lucide or Lucide React.
-   Do not use emojis.
-   Use a small consistent set of custom-drawn SVG line icons or text
    labels.
-   Icons must be simple and technical.
-   Do not use an icon without a text label when its meaning could be
    ambiguous.
-   Do not use sparkle symbols or decorative sparkle iconography.

## 6. Application Shell and Navigation

### 6.1 Desktop layout

The application must use the full viewport width.

-   Sidebar: approximately 220px fixed width.
-   Main workspace: remaining width using `minmax(0, 1fr)`.
-   Main workspace must have `min-width: 0`.
-   Avoid a narrow centered content column.
-   Use consistent page padding and alignment.
-   The content must scale appropriately at 1440x900 and 1920x1080.

Suggested structural CSS:

``` css
.app-shell {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-height: 100vh;
  width: 100%;
}

.main-workspace {
  min-width: 0;
  width: 100%;
}

.main-content {
  width: 100%;
  min-width: 0;
  padding: 28px 32px;
}
```

### 6.2 Sidebar

Display the MACSim brand and a small custom waveform/network symbol at
the top.

Navigation order: 1. Home 2. New Simulation 3. Simulations 4.
Comparisons 5. Learning Center 6. History 7. Settings

Requirements: - Active navigation item uses a warm beige fill with dark
text, or an equally clear warm-accent selected treatment. - Inactive
items use muted light text. - Labels remain visible on desktop. - Tablet
and mobile use a compact navigation pattern. - Hover and focus states
are static. - Do not add unrelated navigation items.

### 6.3 Header

Include: - Page-specific title and actions. - Theme control if theme
switching exists in the current application. - Profile area only if
already supported. - Compact alignment consistent across routes.

## 7. Screen Requirements

## 7.1 Home Dashboard

### Purpose

Provide an entry point to create, resume, and review simulations.

### Layout

Follow the top-left region of the supplied screenshot:

1.  Persistent sidebar.
2.  Hero section at the top of the main workspace.
3.  Available Protocols section below the hero.
4.  Recent Simulations table near the bottom.

### Hero section

Required elements: - Large heading: `MACSim`. - Subtitle:
`Medium Access Control Protocol Simulator`. - Short explanatory text
describing how network stations share a communication channel. - Primary
action: `Create Simulation`. - A custom network illustration on the
right showing several stations connected to one shared communication
medium.

The network illustration must be a purposeful vector/UI diagram, not a
stock image or unrelated decoration.

### Available Protocols

Display all four supported protocols: - Pure ALOHA - Slotted ALOHA -
CSMA - CSMA/CD

Each protocol entry must contain: - Protocol name. - One-sentence
explanation. - Small protocol-specific technical diagram or visual
explanation. - Configure action.

Keep all four protocols equally visible and easy to select. Follow the
reference's compact protocol-panel treatment. Do not convert this
section into a generic marketing feature-card layout.

### Recent Simulations

Display a compact table with: - Name or simulation ID. - Protocol. -
Number of stations. - Date/time. - Status. - Action to open the run.

Use only actual saved simulation records. If no runs exist, show a
useful empty state and a Create Simulation action. Never invent real
history.

## 7.2 New Simulation Configuration

### Purpose

Collect a valid simulation configuration before creating a run.

### Layout

Follow the top-right region of the reference screenshot.

Required elements: - Heading: `Configure Your Simulation`. - Short
instruction text. - Four-step horizontal progress indicator: 1. Protocol
2. Network 3. Traffic 4. Advanced - Main configuration panel. - Back and
Next actions.

### Step 1: Protocol

Show four selectable protocol options: - Pure ALOHA. - Slotted ALOHA. -
CSMA. - CSMA/CD.

Each option includes: - Name. - Short description. - Small technical
diagram. - Clear selected state.

The selected option must be identifiable through border, surface
treatment, and text or selection indicator. Do not rely on color alone.

### Step 2: Network

Show supported fields: - Number of stations. - Frame size with unit. -
Data rate with unit. - Simulation duration with unit. - Propagation
delay only if implemented by the backend.

### Step 3: Traffic

Show: - Traffic generation model supported by the backend. - Traffic
intensity with explicit unit and meaning. - Other implemented traffic
parameters. - Helper text clarifying whether intensity is per-station or
aggregate when the backend defines this.

### Step 4: Advanced

Show only implemented settings: - Random seed. - Slot duration for
Slotted ALOHA. - CSMA persistence mode if implemented. - Backoff
configuration if implemented. - Retry limit if supported.

### Wizard behavior

-   Validate each step.
-   Preserve entered values when moving backward or when validation
    fails.
-   Explain field errors in plain language.
-   Show only protocol-relevant settings.
-   Provide a final configuration summary.
-   Backend validation remains authoritative.
-   If the backend normalizes a configuration, show the normalized
    values or explanation.

Do not expose unsupported configuration fields.

## 7.3 Live Simulation Workspace

### Purpose

Make the running simulation observable and controllable.

### Layout

Follow the bottom-left region of the reference screenshot.

The screen contains: - Top toolbar. - Main network topology. -
Event/station/metrics detail panel. - Performance metrics region. -
Simulation timeline.

### Top toolbar

Include: - Simulation name or ID. - Protocol name. - Textual status. -
Elapsed simulation time. - Pause/Resume control. - Step control. - Reset
control. - Playback speed selector.

Supported status labels: - Ready - Running - Paused - Completed -
Failed - Disconnected

Controls must call the existing backend lifecycle operations. Disable
controls when the current run state does not permit an operation.

### Network topology visualization

Display: - Shared communication channel as a horizontal medium. -
Station nodes connected to the medium. - Stable station identifiers such
as PC-01. - Visible state labels. - Active transmission paths where
supported by live state/events. - Collision indication for affected
stations. - Clear connection points.

Minimum station states: - Idle - Sensing - Transmitting - Collision -
Backoff - Waiting - Successful

Selecting a station should reveal available details: - Queue length. -
Current frame. - Retry count. - Remaining backoff. - Recent events.

The topology must support the backend's maximum station count. On narrow
screens, use horizontal scrolling or a readable stacked layout. Never
silently omit stations.

### Event panel

Provide three views or tabs: - Events - Station Details - Metrics

Each event entry includes: - Simulation timestamp. - Event type. -
Involved station identifiers. - Frame identifier when available. -
Concise description.

Events must remain in simulation-time order. Incoming events must not
forcibly scroll the user away from an event they are inspecting.

### Performance metrics

Display only metrics returned or supported by the backend: - Successful
frames. - Collision events or collided attempts, according to backend
definitions. - Retransmissions. - Throughput or goodput using the
backend's exact definition. - Channel utilization. - Average delay if
implemented. - Elapsed simulation time.

Each metric must show: - Label. - Value. - Unit where relevant. -
Accessible explanation or definition.

Do not fabricate metrics or use throughput and goodput interchangeably.

### Simulation timeline

Show: - Simulation time axis. - Transmission intervals. - Collision
intervals. - Successful delivery intervals. - Backoff intervals.

Only draw event segments when the backend provides sufficient timing
data. Provide an accessible textual or tabular equivalent.

### Real-time correctness

-   REST remains responsible for resource creation, retrieval, controls,
    metrics, and history.
-   Use the real-time transport implemented by the backend: WebSocket or
    Server-Sent Events.
-   Respect event sequence numbers.
-   Detect sequence gaps.
-   Recover through the backend's event retrieval or snapshot mechanism.
-   Show connection status visibly.
-   Do not present stale values as live.
-   Reconnect without silently restarting or resetting the simulation.
-   Playback speed affects presentation pacing only, not protocol
    behavior or final metrics.

## 7.4 Protocol Comparison

### Purpose

Compare completed protocol runs under equivalent conditions.

### Layout

Follow the bottom-right region of the reference screenshot.

Required elements: - Heading: `Protocol Comparison`. - Short
description. - Metric selector. - Main line chart. - Legend. - Results
summary table. - Key Insight panel.

### Chart

Support metrics implemented by the backend, such as: -
Throughput/goodput. - Collisions. - Retransmissions. - Channel
utilization. - Average delay.

Requirements: - Clear axes and units. - Readable labels. - Restrained
series colors. - Consistent protocol colors within the comparison. -
Clear legend. - Accessible text summary or equivalent table. - Explicit
handling for unavailable metrics. - No fabricated chart values.

### Results summary

Include: - Protocol. - Selected metric values. - Units. - Relevant
experiment configuration context.

### Key Insight

Show a concise factual observation derived from actual comparison
results. Do not make unsupported performance claims. If data is
insufficient, show that a conclusion is unavailable.

### Fair comparison

-   Use equivalent traffic and network conditions unless the user
    explicitly chooses otherwise.
-   Preserve each run's configuration and random seed.
-   Make configuration differences visible.
-   Do not imply that runs with materially different configurations are
    directly comparable without qualification.

## 7.5 Simulations and History

Required information: - Run name or ID. - Protocol. - Date/time. -
Configuration summary. - Status. - Key outcome metrics. - Open and
compare actions.

Use pagination or virtualization for long lists. Distinguish completed,
failed, and cancelled runs.

If persistence is not implemented, clearly explain whether history is
limited to the current browser session.

## 7.6 Learning Center

Provide concise, structured learning content for: - Shared-medium
access. - Pure ALOHA. - Slotted ALOHA. - CSMA. - CSMA/CD. - Collision
detection. - Retransmission. - Backoff. - Throughput and channel
utilization.

Where possible, connect explanations to preconfigured example
simulations.

## 7.7 Settings and Legal Pages

Settings should include supported preferences, such as theme selection
and simulation defaults.

Provide: - Terms of Service route. - Privacy Policy route.

Do not publish placeholder legal text as reviewed policy. The project
owner must provide or approve the actual content before public release.

## 8. Responsive Requirements

### Desktop

-   Persistent sidebar approximately 220px wide.
-   Main workspace fills the remaining viewport.
-   Dashboard follows the reference hierarchy.
-   Live topology and event panel may sit side by side.
-   Tables and charts use available width.

### Tablet

-   Sidebar may collapse into a compact rail or menu.
-   Configuration and metrics may stack.
-   Topology remains fully accessible.
-   Primary controls remain reachable.

### Mobile

-   Compact navigation.
-   Stack hero, protocol options, topology, metrics, events, and tables.
-   Allow horizontal scrolling for topology when required.
-   Keep simulation controls reachable.
-   Tables may scroll horizontally or use readable row layouts.
-   Do not remove essential information or controls.

## 9. Accessibility Requirements

-   Target WCAG 2.2 AA.
-   Use semantic landmarks, headings, labels, buttons, and tables.
-   Support keyboard navigation.
-   Provide visible focus indicators.
-   Ensure sufficient contrast.
-   Communicate states using text and visual indicators, not color
    alone.
-   Respect reduced-motion preferences.
-   Do not use hover animations.
-   Provide chart summaries or data tables.
-   Use visible input labels and units.
-   Keep disabled states legible.

## 10. Frontend Architecture and Backend Integration

Use the existing framework and architecture. If the project is already
React and TypeScript, retain it.

Keep separate: - Layout and shared components. - Feature-specific
screens. - Typed API services. - Real-time transport. - Shared
simulation state. - Theme tokens. - Formatting and chart utilities.

The frontend must not implement authoritative protocol logic. The
backend remains the source of truth for: - Simulation status. - Station
and medium state. - Frame outcomes. - Event sequence and timestamps. -
Metrics and final results. - Configuration validation and normalization.

Align frontend types with actual backend responses. Illustrative names
in this PRD are not a substitute for inspecting the real API contract.

### 10.1 Backend endpoints

Use the existing backend API contract where implemented. The backend PRD
describes these resources:

  Method   Endpoint                         Purpose
  -------- -------------------------------- --------------------------------------
  GET      `/protocols`                     Supported protocols and capabilities
  POST     `/simulations`                   Create a simulation
  GET      `/simulations/{simulation_id}`   Retrieve simulation state
  POST     `/simulations/{id}/start`        Start simulation
  POST     `/simulations/{id}/pause`        Pause simulation
  POST     `/simulations/{id}/resume`       Resume simulation
  POST     `/simulations/{id}/step`         Advance one step
  POST     `/simulations/{id}/reset`        Reset simulation
  GET      `/simulations/{id}/events`       Retrieve ordered events
  GET      `/simulations/{id}/metrics`      Retrieve metrics
  GET      `/simulations`                   List simulations
  GET      `/simulations/{id}/results`      Retrieve final results
  POST     `/comparisons`                   Create comparison
  GET      `/comparisons`                   List comparisons
  GET      `/comparisons/{id}`              Retrieve comparison

The real-time transport must match the transport actually implemented by
the backend. Do not assume WebSocket if the backend uses Server-Sent
Events, or vice versa.

## 11. Frontend States and Error Handling

Every data-driven page must support: - Initial state. - Loading state. -
Empty state. - Ready/success state. - Error state. - Retry/recovery
action where appropriate.

Simulation-specific states: - Ready. - Running. - Paused. - Completed. -
Failed. - Disconnected.

Do not use skeleton loaders. Use concise text loading states, for
example: - Loading simulations... - Connecting to simulation... -
Retrieving results...

Show actionable validation errors. Do not expose stack traces or
internal exception details.

## 12. Performance Requirements

-   Avoid full-page rerenders for every incoming event.
-   Batch visual updates where appropriate without dropping event
    records.
-   Virtualize or paginate long event histories.
-   Avoid rendering every simulation tick if periodic snapshots are
    sufficient.
-   Keep charts responsive.
-   Keep navigation and controls responsive during long simulations.
-   Test using the maximum supported station count and event volume.
-   Avoid unbounded client-side event accumulation.

## 13. The 30 Prohibited Design Patterns

These restrictions are mandatory for every route, component, chart,
loading state, empty state, and interaction.

  ------------------------------------------------------------------------
                           No. Must avoid            Required treatment
  ---------------------------- --------------------- ---------------------
                             1 Harsh gradients       Use solid color
                                                     tokens.

                             2 Lucide icons          Use custom simple
                                                     line icons or text
                                                     labels.

                             3 Pure white            Use dark charcoal and
                               backgrounds           warm neutral
                                                     surfaces.

                             4 Rainbow coloring      Use the restrained
                                                     palette and semantic
                                                     status colors only.

                             5 Drop shadows          Use borders and
                                                     spacing.

                             6 Three feature cards   Use task-oriented
                               in a row              protocol panels and
                                                     structured layouts,
                                                     not generic marketing
                                                     cards.

                             7 Emojis                Do not use emojis in
                                                     UI copy or controls.

                             8 Liquid glass          Use opaque, solid
                                                     surfaces.

                             9 Em dashes             Do not use the em
                                                     dash character in
                                                     interface or
                                                     documentation copy.

                            10 Inter, Geist, Space   Use IBM Plex Sans and
                               Grotesk               IBM Plex Mono.

                            11 Colored left stripes  Do not add decorative
                                                     colored edge stripes.

                            12 Fake testimonials     Do not include
                                                     invented reviews or
                                                     endorsements.

                            13 Bento grids           Do not use
                                                     bento-style dashboard
                                                     compositions.

                            14 Terminal windows      Do not add decorative
                                                     terminal mockups.

                            15 "It's not X, it's Y"  Use direct, literal
                                                     copywriting.

                            16 Checkmark bullets     Use plain bullets,
                                                     numbered steps, or
                                                     concise labels.

                            17 Three pricing tiers   Do not add pricing
                                                     tables or pricing
                                                     sections.

                            18 No real product demo  The actual simulator
                                                     must remain
                                                     functional. Do not
                                                     substitute a static
                                                     fake demo.

                            19 Soft corner radius    Use 0px square
                                                     geometry.

                            20 Purple and black      Use charcoal, warm
                                                     neutrals, and
                                                     champagne accents.

                            21 Skeleton loaders      Use concise text
                                                     loading states.

                            22 Radial orbs           Do not use decorative
                                                     radial gradients or
                                                     orb shapes.

                            23 Dot grids             Do not use dot-grid
                                                     backgrounds or
                                                     decoration.

                            24 Sparkle icons         Do not use sparkle
                                                     symbols or
                                                     iconography.

                            25 Animated arrows       Do not animate arrows
                                                     or use decorative
                                                     directional motion.

                            26 Missing Terms of      Include a Terms of
                               Service               Service page before
                                                     public release.

                            27 Missing Privacy       Include a Privacy
                               Policy                Policy page before
                                                     public release.

                            28 Hover animations      Use static hover,
                                                     focus, and active
                                                     states.

                            29 Neon colors           Do not use neon
                                                     colors.

                            30 Basic pastel colors   Use the specified
                                                     charcoal, warm
                                                     neutral, and
                                                     champagne palette.
  ------------------------------------------------------------------------

### Restriction enforcement

-   Apply the checklist to all routes and components.
-   Audit third-party component defaults.
-   Override or replace any component that introduces a prohibited
    style.
-   Do not introduce prohibited decoration to make a screen look more
    elaborate.
-   Run a final visual restriction audit before acceptance.

## 14. Testing and Acceptance Criteria

### 14.1 Functional acceptance

-   [ ] All four protocols are selectable when supported by the backend.
-   [ ] User can configure and validate a simulation.
-   [ ] Configuration input is preserved after validation errors.
-   [ ] User can start, pause, resume, step, and reset according to
    backend state.
-   [ ] Topology reflects authoritative station states.
-   [ ] Event history displays ordered events.
-   [ ] Metrics match backend responses.
-   [ ] User can inspect completed and failed runs.
-   [ ] Comparisons use actual results and show configuration context.
-   [ ] Learning Center covers all four protocols.
-   [ ] Settings and legal routes work.

### 14.2 Visual acceptance

-   [ ] The four primary screens closely follow the supplied reference.
-   [ ] Charcoal and warm champagne identity is consistent.
-   [ ] Sidebar width and workspace proportions are correct.
-   [ ] Typography hierarchy is consistent.
-   [ ] Panels, tables, and charts align cleanly.
-   [ ] Square geometry and thin borders are consistent.
-   [ ] No gradients, shadows, glass effects, or prohibited decoration.
-   [ ] All 30 restrictions are satisfied.
-   [ ] Desktop, tablet, and mobile layouts work.

### 14.3 Correctness and quality

-   [ ] No fabricated simulation data is presented as real.
-   [ ] No frontend-side authoritative protocol calculations.
-   [ ] Connection loss is visible and recoverable.
-   [ ] Keyboard navigation works.
-   [ ] Contrast is checked.
-   [ ] Long event histories remain usable.
-   [ ] Existing working functionality has not been removed or broken.
-   [ ] Existing lint, type-check, and test commands pass.

## 15. Delivery Phases

### Phase 1: Repository audit and visual foundation

-   Inspect existing routes, components, dependencies, API services, and
    state management.
-   Record current working functionality.
-   Define color, typography, spacing, and geometry tokens.
-   Implement the shared shell and sidebar.

### Phase 2: Dashboard and configuration

-   Implement dashboard hierarchy.
-   Implement protocol selection.
-   Implement the four-step configuration wizard.
-   Preserve validation and existing API flows.

### Phase 3: Live simulation

-   Implement topology styling.
-   Implement station detail and event views.
-   Implement metrics and timeline.
-   Connect controls and real-time updates to existing backend services.

### Phase 4: Comparison and supporting pages

-   Implement comparison chart and results table.
-   Implement simulations/history, Learning Center, settings, and legal
    routes.

### Phase 5: Quality assurance

-   Test all four protocols.
-   Test loading, empty, error, completed, and disconnected states.
-   Test desktop, tablet, and mobile.
-   Audit all 30 prohibited design patterns.
-   Verify that backend behavior and simulation functionality remain
    unchanged.

## 16. Definition of Done

The frontend redesign is accepted when:

1.  The four primary screens closely match the supplied MACSim visual
    reference.
2.  All existing simulation workflows remain functional.
3.  All four protocols can be configured and run where supported.
4.  Live topology, events, controls, and metrics reflect backend state.
5.  Comparison charts and tables use actual experiment results.
6.  History, Learning Center, Settings, Terms, and Privacy routes are
    available.
7.  Responsive and accessibility requirements are met.
8.  All 30 prohibited design patterns have been checked and avoided.
9.  No unrelated backend or simulation-engine changes have been
    introduced.
10. Existing project checks pass.

------------------------------------------------------------------------

## Appendix A - Stitch Design Generation Instructions

Upload the original MACSim dashboard screenshot as the primary visual
reference. Upload both restriction screenshots as a mandatory
negative-design checklist.

Use this instruction when generating the screens:

> Design MACSim as a cohesive, high-fidelity technical web application.
> Reproduce the uploaded dashboard screenshot's charcoal and near-black
> surfaces, warm champagne/beige accents, thin borders, left sidebar,
> content proportions, typography hierarchy, protocol panels, network
> topology, metrics, timeline, and comparison chart. Generate the Home
> Dashboard, New Simulation wizard, Live Simulation workspace, and
> Protocol Comparison screens as one consistent application. Do not
> invent a different visual direction or turn the product into a generic
> SaaS marketing dashboard. Follow all 30 prohibited design restrictions
> in this PRD. If the reference screenshot conflicts with a restriction,
> the restriction takes priority. Keep the result realistic and
> implementation-friendly for the existing frontend.

## Appendix B - Coding Agent Implementation Instructions

Use this instruction after the Stitch design is approved:

> Inspect the existing MACSim frontend repository before making changes.
> Preserve its framework, routing, API clients, state management,
> simulation controls, and all working functionality. Implement the
> approved reference-matching design using this PRD. Do not rewrite the
> backend or simulation engine for a visual task. Connect every
> functional control to the existing API or handler. Use backend
> responses as the source of truth for simulation state, events,
> metrics, and comparison data. Implement all four primary screens and
> the supporting routes. Preserve real-time sequence handling and
> reconnect recovery. Make the application responsive and accessible. Do
> not use any of the 30 prohibited design patterns. Run the existing
> lint, type-check, and test commands. At completion, report changed
> files, implemented screens, integrations reused, tests executed, and
> remaining limitations. Do not stop after creating a static visual
> shell.
