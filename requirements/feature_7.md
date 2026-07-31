# Feature 7: Mission Control Dashboard Redesign (Widget-Based, No Sidebar)

## Goal
Replace the current chart-heavy dashboard with a dense, widget-based "Mission Control" layout inspired by
`design.png`, without a left navigation sidebar. Every subsystem gets its own compact status widget instead of
one giant chart each; detailed time-series graphs are consolidated into a single "Telemetry Graphs" widget.
Adds mission event logging (state transitions, commands, deployments), a simulated command interface, a 3D
orbit/ground-track globe, and a ground-station link map — all backed by an extended, additive API contract.

Reference: `design.png` (ChatGPT mockup, "CUBESAT SIM — MISSION CONTROL").

## Decisions (confirmed with user)
- **Process:** direct implementation in this session/conversation. No GitHub Project cards, no Backend/Frontend/QA/Doc
  agent hand-offs for this feature — CLAUDE.md's full card workflow is skipped for speed of iteration.
- **3D rendering:** two different techniques, matched to what each widget actually needs:
  - **3D Satellite View** — reuse/extend the existing hand-rolled canvas 2.5D renderer already built in
    `AttitudeIndicator.tsx` (rotating CubeSat body driven by real roll/pitch/yaw/gyro/accel telemetry). No new
    dependency needed here — it already does exactly this job.
  - **Orbit & Ground Track** (textured Earth + orbit path + ground track + footprint) — needs a real textured
    WebGL sphere with day/night city-light texture, which canvas 2D can't do convincingly. Add
    **`three`** + **`@react-three/fiber`** + **`@react-three/drei`** as new client dependencies, same spirit as
    `spacekit.js` in `asteroid-monitoring` but React-native and better suited to LEO scale (spacekit is tuned for
    AU-scale solar-system orbits, not a 500 km-altitude ground track over a textured Earth).
- **Backend changes are additive-only.** No existing columns are dropped or renamed; only new nullable columns and
  new tables are added, so historical demo data and any already-deployed CubeSat sender keep working.
- **Ground station:** consolidate the two placeholder ground stations in `OrbitMap.tsx` (Orenburg/Almaty) into a
  single canonical ground station — **Orenburg, Russia** (51.7727° N, 55.0988° E), reusing the existing `OrbitMap.tsx` placeholder coordinates — configurable
  via env (`GROUND_STATION_NAME`, `GROUND_STATION_LAT`, `GROUND_STATION_LON`).

---

## 1. Design Reference — Widget Inventory

| # | Design widget | New/Reused component | Data source | Priority |
|---|---|---|---|---|
| 1 | Top status bar (mission status, UTC time, mission time, orbit #, link status, ground station, next pass) | **MissionStatusBar** (replaces `Header`) | `latest` + new `/orbit` endpoint | P0 |
| 2 | 3D Satellite View | **Satellite3DView** (renamed/restyled `AttitudeIndicator`) | `latest` (roll/pitch/yaw/gyro/accel) | P0 |
| 3 | Orbit & Ground Track (3D globe) | **OrbitGroundTrack** (new, three.js) | new `/orbit` endpoint + `history` (lat/lon/alt) | P0 |
| 4 | Ground Station Link (2D map) | **GroundStationLinkMap** (repurposed `OrbitMap`) | `latest`/`history` (gps) + new `comms` fields | P0 |
| 5 | Subsystem Status list | **SubsystemStatusWidget** (new) | derived from `latest` via status-threshold util | P0 |
| 6 | Mission Events | **MissionEventsWidget** (new) | new `mission_events` table/endpoint | P0 |
| 7 | Power System | **PowerSystemWidget** (replaces gauge-heavy `EPSPanel`) | `latest` (eps fields) | P0 |
| 8 | Thermal System | **ThermalSystemWidget** (new) | `latest` + new thermal fields | P0 |
| 9 | ADCS | **ADCSWidget** (replaces chart-heavy `ADCSPanel`) | `latest` (adcs fields) | P0 |
| 10 | OBC System | **OBCSystemWidget** (new) | `latest` (system fields) + new `boot_count` | P0 |
| 11 | Payload | **PayloadWidget** (replaces `PayloadChart` as a standalone big chart) | `latest` + new payload fields | P0 |
| 12 | Live Telemetry Stream | **LiveTelemetryStreamWidget** (new) | client-derived from polled `latest`/`history` | P1 |
| 13 | Telemetry Graphs (2×2 small multiples) | **TelemetryGraphsWidget** (new, consolidates `EPSPanel`/`SystemChart`/`PayloadChart` line charts) | `history` | P0 |
| 14 | MQTT Bus Monitor | **MqttBusMonitorWidget** (new, animated SVG diagram) | derived "last seen" per subsystem from `latest` | P1 |
| 15 | Orbit Info sidebar | **OrbitInfoWidget** (new) | new `/orbit` endpoint | P0 |
| 16 | Weather (ground station) | **WeatherWidget** (new) | new `/weather` proxy endpoint (Open-Meteo, no key) | P1 (optional flavor) |
| 17 | Mission Console | **MissionConsoleWidget** (new, interactive) | new `/commands` endpoint | P0 |
| 18 | Quick Commands | **QuickCommandsWidget** (new) | new `/commands` endpoint | P0 |
| 19 | Recent Alerts | **RecentAlertsWidget** (new) | filtered `mission_events` (severity ≥ warning) | P0 |
| 20 | System Health ring + per-subsystem bars (was in left sidebar) | folded into **MissionStatusBar** right-hand cluster (no sidebar) | derived status util | P1 |
| 21 | Left nav sidebar (Overview/Power/Thermal/...) | **dropped entirely** per user request | — | — |

Components retired/removed: `GPSPanel` (absorbed into `OrbitInfoWidget` + `OrbitGroundTrack`), `SystemChart`
(absorbed into `OBCSystemWidget` + `TelemetryGraphsWidget`), `TelemetryTimeline` (split into
`MissionEventsWidget` + `LiveTelemetryStreamWidget`).

---

## 2. API Contract v2 (additive)

### 2.1 Extended telemetry payload
New nested groups added to the existing POST body; all new columns nullable.

```jsonc
{
  "timestamp": "2026-07-30T12:00:00Z",
  "eps": { "battery": 82.1, "voltage": 8.14, "external_power": 1 },
  "adcs": { "roll": 2.31, "pitch": -1.24, "yaw": 5.67, "imu_temp": 27.4,
            "accel_g": { "x": 0.01, "y": -0.02, "z": 0.00 },
            "gyro_dps": { "x": 0.1, "y": -0.1, "z": 0.0 } },
  "thermal": { "obc_temperature": 28.4, "eps_temperature": 26.7, "battery_temperature": 21.3,
               "payload_temperature": 23.1 },
  "payload": { "temperature": 23.0, "humidity": 50.0, "pressure": 1000.0,
               "camera_status": "READY", "image_count": 1284, "image_resolution": "1280x720",
               "sensor_status": "NOMINAL", "science_mode": false, "power_watts": 1.23 },
  "system": { "cpu_percent": 34.0, "ram_percent": 52.0, "swap_percent": 10.0, "disk_percent": 41.0,
              "uptime_seconds": 187562, "cpu_temperature": 55.0, "boot_count": 7 },
  "comms": { "rssi": -63, "snr": 17.0, "uplink_bps": 9600, "downlink_bps": 9600,
             "latency_ms": 127, "packet_loss_pct": 0.2 },
  "obc_state": "NOMINAL",
  "gps": { "latitude": 55.7961, "longitude": 49.1087, "altitude": 512.4, "speed_kms": 7.61 }
}
```

### 2.2 New DB columns (single additive migration `AddSubsystemDetailColumnsToTelemetry`)
- Thermal: `obc_temperature`, `eps_temperature`, `battery_temperature`, `payload_temperature` (all `DECIMAL(5,2)` null)
  — note `payload.temperature` and `system.cpu_temperature`/`adcs.imu_temp` already exist and keep their current
  meaning (payload ambient / OBC CPU / IMU temp respectively); the four new columns fill in the remaining gauges
  shown in the design's Thermal System widget.
- Payload: `camera_status` VARCHAR(20), `image_count` INT, `image_resolution` VARCHAR(20), `sensor_status`
  VARCHAR(20), `science_mode` TINYINT(1), `payload_power_watts` DECIMAL(5,2)
- System: `boot_count` INT
- Comms: `rssi` INT, `snr` DECIMAL(5,2), `uplink_bps` INT, `downlink_bps` INT, `latency_ms` INT,
  `packet_loss_pct` DECIMAL(5,2)
- GPS: `speed_kms` DECIMAL(6,3)

`TelemetryController::store()` flattening and `formatRecord()` extended for all of the above.
`client/src/features/telemetry/types.ts` `TelemetryRecord` extended to match.

### 2.3 New table `mission_events`
```php
'id'         => auto-increment PK
'timestamp'  => DATETIME, indexed
'type'       => VARCHAR(20)  // state_transition | command | deployment | alert | info
'severity'   => VARCHAR(10)  // info | success | warning | critical
'message'    => VARCHAR(255)
'meta_json'  => TEXT null    // e.g. { "from": "BOOT", "to": "NOMINAL" }
```
Populated automatically:
- On telemetry ingest, if `obc_state` differs from the previous record's `obc_state` → insert a `state_transition`
  event ("OBC state changed: BOOT → NOMINAL").
- On every accepted `/commands` call → insert a `command` event.
- In demo mode, `DemoDataService` deterministically synthesizes a plausible event timeline (deployment, antenna
  deployed, mode changes, alerts) seeded off elapsed time, same trig-seeded determinism pattern as the rest of the
  service — no randomness, same input timestamp always produces the same log.

Endpoints:
- `GET /api/cubesat/events?limit=50` → `{ count, records: MissionEvent[] }`, newest first.

### 2.4 New `commands` endpoint (simulated, no real uplink)
- `POST /api/cubesat/commands` — body `{ "command": "ENABLE_SCIENCE_MODE" }`
  Allowed commands: `REFRESH_TELEMETRY`, `ENABLE_SCIENCE_MODE`, `DISABLE_SCIENCE_MODE`, `REBOOT_OBC`, `RESET_ADCS`,
  `SAFE_MODE`.
  - Validates against the allow-list (400 on unknown command).
  - Requires the same `X-API-Key` as telemetry ingest **only when not in demo mode**; in demo mode it's a no-op
    that still logs a `mission_events` row and returns a canned console message, so the UI stays interactive
    without write access to a real satellite.
  - Response: `{ status: 'ok', message: 'Science mode enabled', event_id }`.
  - This is intentionally a mocked command bus for the console/quick-commands widgets — it does not attempt to
    reach real hardware.

### 2.5 New `/orbit` endpoint
`GET /api/cubesat/orbit` → current orbital state, computed server-side from a simple circular LEO propagator
(mock data, deterministic from time — same approach as `DemoDataService`, lives in new `OrbitService`):
```jsonc
{
  "orbit_type": "LEO",
  "altitude_km": 512.4,
  "inclination_deg": 97.45,
  "period_min": 94.62,
  "raan_deg": 123.54,
  "aop_deg": 87.12,
  "true_anomaly_deg": 45.32,
  "eclipse": false,
  "beta_angle_deg": 32.1,
  "orbit_number": 245,
  "ground_station": { "name": "ORENBURG, RUSSIA", "lat": 51.7727, "lon": 55.0988 },
  "next_pass_seconds": 454
}
```
Orbit mechanics stay intentionally simple (circular orbit, fixed inclination, slowly precessing RAAN) — good
enough for a believable "mock but self-consistent" display; not a real SGP4/TLE propagator.

### 2.6 New `/weather` endpoint (P1, optional)
`GET /api/cubesat/weather` — thin backend proxy to Open-Meteo (free, no API key) for the fixed ground-station
coordinates, cached in-process for ~10 minutes to avoid hammering the upstream API.
```json
{ "temperature_c": 16, "condition": "Scattered clouds", "wind_ms": 4.1, "humidity_pct": 68, "pressure_hpa": 1018 }
```

---

## 3. Backend Task Breakdown
1. Migration: `AddSubsystemDetailColumnsToTelemetry` (thermal/payload/system/comms/gps columns above).
2. Migration: `CreateMissionEventsTable`.
3. `TelemetryController`: extend `store()` flattening + `formatRecord()` for new fields; insert `mission_events`
   row on `obc_state` transition.
4. `DemoDataService`: extend `generateRecord()` with deterministic thermal/payload/comms/gps values; add
   `generateEvents(limit)` producing a believable seeded mission timeline.
5. New `EventsController` (`GET /api/cubesat/events`) + `EventModel`.
6. New `CommandsController` (`POST /api/cubesat/commands`) + allow-list validation + demo-mode short-circuit.
7. New `OrbitService` (pure PHP orbital math, deterministic from time) + `OrbitController`
   (`GET /api/cubesat/orbit`).
8. New `WeatherController` (`GET /api/cubesat/weather`) with simple file/array cache — P1, do last.
9. Update `Routes.php` with all new endpoints.
10. PHPUnit: extend `TelemetryControllerTest`, add `EventsControllerTest`, `CommandsControllerTest`,
    `OrbitControllerTest`.

## 4. Frontend Task Breakdown

### 4.1 Data layer
1. Extend `types.ts` (`TelemetryRecord` new fields) + add `MissionEvent`, `OrbitState`, `WeatherInfo`,
   `CommandResponse` types.
2. Extend `telemetryAPI.ts` with `getEvents`, `sendCommand`, `getOrbit`, `getWeather` RTK Query endpoints
   (new `eventsApi`/`orbitApi` slices or extra endpoints on the existing `telemetryApi` — keep one API slice for
   simplicity).
3. Add `client/src/utils/subsystemStatus.ts` — pure functions mapping telemetry values to
   `OK | WARN | CRITICAL` per subsystem (battery thresholds, temperature ranges, packet loss, etc.), shared by
   `SubsystemStatusWidget`, `MissionStatusBar`, and `RecentAlertsWidget`.

### 4.2 Dependencies
4. `yarn add three @react-three/fiber @react-three/drei` in `/client`.
5. Source a free-to-use Earth day/night texture (NASA Blue/Black Marble, public domain) into
   `client/src/assets/earth/` (two JPGs: day + night-lights, blended in the fragment shader/material based on
   sun angle — same visual idea as the design's terminator-lit globe).

### 4.3 Layout shell
6. New `AppShell`/`MissionStatusBar` replacing `Header` — mission status, UTC clock, mission time (T+DD:HH:MM:SS
   since deploy), orbit number, link status, ground station name, next-pass countdown. Drop the old
   logo-row-only header.
7. New `Dashboard` grid (CSS grid, bento-style, matching the design's asymmetric rows) — replaces the current
   `row1..row4` flex rows. No sidebar; `System Health` ring/bars fold into the status bar's right cluster.

### 4.4 Widgets (new files under `client/src/components/`)
8. `SubsystemStatusWidget` — OBC/EPS/ADCS/PAYLOAD/COMMS list with OK/WARN/CRIT badges from `subsystemStatus.ts`.
9. `MissionEventsWidget` — scrollable log, color-coded by severity, "View all events" opening a modal/expanded list.
10. `PowerSystemWidget` — compact stat card (battery voltage/current, level, solar current/voltage, status)
    replacing `EPSPanel`'s gauge+chart.
11. `ThermalSystemWidget` — OBC/EPS/battery/payload temps + max temp + thermal status.
12. `ADCSWidget` — roll/pitch/yaw, angular rates x/y/z, mode — replacing `ADCSPanel`'s chart.
13. `OBCSystemWidget` — CPU/RAM/storage bars, uptime, boot count, health.
14. `PayloadWidget` — camera status, image count/resolution, sensor status, science mode, payload power.
15. `TelemetryGraphsWidget` — 2×2 (or 4×1 responsive) small-multiple ECharts: battery voltage, temperature, RSSI,
    CPU usage — the *only* place with real time-series line charts, replacing the big standalone charts.
16. `LiveTelemetryStreamWidget` — monospace scrolling feed synthesized client-side from each new polled record
    ("12:52:20.123 EPS Battery Voltage: 8.14 V", etc.), with pause/resume.
17. `MqttBusMonitorWidget` — static SVG topology (EPS/PAYLOAD/ADCS/SENSORS → OBC → TELEMETRY/GROUND
    STATION/CLOUD/COMMANDS) with animated dashed "packet" pulses; purely presentational, no new data needed beyond
    "is this subsystem currently reporting" (derived from `latest` freshness).
18. `OrbitInfoWidget` — renders `/orbit` response as a label/value list.
19. `WeatherWidget` — renders `/weather` response (P1).
20. `MissionConsoleWidget` — text input + scrollback; supports `status`, `help`, `enable science`,
    `disable science`, `reboot obc`, `reset adcs`, `safe mode`, `clear`; dispatches to `/commands` where
    applicable and prints the response.
21. `QuickCommandsWidget` — buttons wrapping the same `/commands` calls as the console (REFRESH TELEMETRY,
    ENABLE/DISABLE SCIENCE MODE, REBOOT OBC, RESET ADCS, SAFE MODE styled as destructive).
22. `RecentAlertsWidget` — last N `mission_events` with severity ≥ warning, icon + relative time.
23. `GroundStationLinkMap` — repurpose `OrbitMap.tsx`: keep the dark Leaflet map + satellite marker, replace the
    ground-track polyline (now owned by `OrbitGroundTrack`) with a single great-circle arc from the satellite's
    current subpoint to the Orenburg ground station, add the RSSI/SNR/uplink/downlink/latency/packet-loss side panel
    fed by the new `comms` fields.
24. `OrbitGroundTrack` — new three.js/`@react-three/fiber` widget: textured rotating Earth, orbit path (derived
    from `/orbit` + recent `history` lat/lon/alt), current position marker, footprint circle, side panel
    (lat/lon/alt/speed/eclipse/beta angle), basic orbit/zoom camera controls (`OrbitControls` from drei).
25. `Satellite3DView` — rename/restyle `AttitudeIndicator` to match the design's framing (title, small
    view-control icon row: reset view / zoom / wireframe toggle — cosmetic only, the rotation math is unchanged).

### 4.5 Styling
26. Adjust `global.scss` dark theme variables to lean slightly more navy (design uses a cooler near-black,
    `#0a0e14`-ish, vs. the current pure `#060606`) while keeping the existing green ops-accent — this is a small,
    low-risk palette nudge, not a full re-theme.
27. Per-widget `.module.scss` following the existing `Container` + uppercase-label convention already established
    in `EPSPanel`/`ADCSPanel`.

### 4.6 Tests
28. Update/replace Jest tests for every retired component's replacement; add tests for `subsystemStatus.ts`,
    `MissionConsoleWidget` command dispatch, `MissionEventsWidget` severity rendering.
29. Update Cypress `dashboard.cy.ts` scenarios for the new layout and the console/quick-commands interaction.

---

## 5. Layout Plan (no sidebar)

```
┌─────────────────────────────── MissionStatusBar ───────────────────────────────┐
│ Status · UTC · Mission Time · Orbit # · Link · Ground Station · Next Pass      │
├──────────────┬──────────────────────────────┬──────────────────┬──────────────┤
│ Satellite3D  │ OrbitGroundTrack (3D globe)   │ GroundStationLink │ Subsystem    │
│ View         │                               │ Map               │ Status +     │
│              │                               │                   │ Mission      │
│              │                               │                   │ Events       │
├──────────────┴──────┬──────────────┬─────────┴────────┬──────────┴──────────────┤
│ PowerSystemWidget    │ ThermalWidget│ ADCSWidget       │ OBCSystemWidget │ Payload│
├──────────────────────┴──────────────┴──────────────────┴─────────────┴────────┤
│ LiveTelemetryStream   │ TelemetryGraphs (2×2)          │ MqttBusMonitor        │
├───────────────────────┴─────────────────────────────────┴───────────────────────┤
│ MissionConsole                     │ QuickCommands      │ RecentAlerts          │
└───────────────────────────────────────────────────────────────────────────────┘
```
`OrbitInfoWidget` and `WeatherWidget` slot into the right column near `SubsystemStatus`/`MissionEvents` (matching
the design's right-hand stack). CSS grid with named areas, collapsing to a single column on mobile in this
priority order: status bar → 3D satellite → subsystem status → power/thermal/adcs/obc/payload → graphs →
console/commands → orbit/ground-track/map → events/alerts (heavy 3D widgets sink lower on small screens, which
also happens to be the cheapest way to keep first paint fast on mobile).

---

## 6. Rollout / Risk Notes
- All schema changes are additive — safe to run against the existing dev DB via `php spark migrate`, no data loss.
- Demo mode (`DEMO_MODE=true`) remains the default local/dev path; every new endpoint must have a deterministic
  demo-mode branch, same as the existing ones, so the dashboard is fully explorable with zero real hardware.
- three.js/`@react-three/fiber` is a genuinely new, non-trivial dependency (WebGL) — verify it tree-shakes
  acceptably in the Rsbuild bundle and doesn't regress the "fast dashboard" goal from Feature 2; lazy-load
  `OrbitGroundTrack` (dynamic `import()`) so the WebGL bundle isn't in the critical path for the rest of the
  dashboard.
- Earth texture assets must be public-domain/CC0 (NASA Blue/Black Marble qualifies) and kept small
  (compressed JPG, ~200–500 KB per texture) to avoid bloating the bundle.

## 7. Suggested Implementation Order
1. Backend: migrations + extended `TelemetryController`/`DemoDataService` (§3.1–3.4) — unblocks everything else.
2. Backend: events + commands + orbit endpoints (§3.5–3.7).
3. Frontend: data layer + `subsystemStatus.ts` (§4.1).
4. Frontend: layout shell — `MissionStatusBar` + new `Dashboard` grid (§4.3), with placeholder widgets, so the
   no-sidebar structure is visible early.
5. Frontend: the five compact subsystem widgets + `TelemetryGraphsWidget` (§4.4 items 8–15) — directly resolves
   the "endless charts" complaint.
6. Frontend: `MissionEventsWidget`, `RecentAlertsWidget`, console + quick commands (§4.4 items 9, 20–22).
7. Frontend: `GroundStationLinkMap` rework (§4.4 item 23) — lower risk, reuses existing Leaflet code.
8. Frontend: `three`/`@react-three/fiber` setup + `OrbitGroundTrack` (§4.2, §4.4 item 24) — highest complexity,
   scheduled after everything else works with mocked/placeholder orbit visuals.
9. `Satellite3DView` restyle (§4.4 item 25) — cosmetic pass on already-working code.
10. Styling pass (§4.5), then tests (§4.6).
