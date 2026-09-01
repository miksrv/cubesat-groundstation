# Roadmap

The ground segment of **[CubeSat Sim](https://github.com/miksrv/cubesat-sim)**: one React interface
over several data sources.

Two documents carry the reasoning, and this file only tracks state:

- [`docs/dashboard-architecture.md`](docs/dashboard-architecture.md) — what this repository is, and
  why the boundary with `cubesat-sim` falls where it does.
- [`docs/dashboard-plan.md`](docs/dashboard-plan.md) — the staged plan, with what "done" means for
  each stage.

---

## Where the work stands

| Stage | What | Repository | Status |
|---|---|---|---|
| 0 | Remove the cloud leg from COMMS | `cubesat-sim` | ✅ |
| 1 | The `attitude` table — orientation at the rate it was measured | `cubesat-sim` | ✅ |
| 2 | mosquitto's WebSocket listener and the browser ACL | `cubesat-sim` | ✅ |
| 3 | **The contract and the data-source layer** | here | ✅ |
| 4 | **Delete PHP** | here | ✅ |
| 5 | The `cubesat.dashboard` service — static files and read-only REST | `cubesat-sim` | ✅ |
| 6 | The mission timeline: play, scrub, one clock for map and attitude | here | ☐ built, awaiting a hands-on run |
| 7 | Export a real mission; replace the placeholder recording | both | ☐ next |
| 8 | The USB Meshtastic receiver | here | ☐ later |

Stage 5 landed 2026-08-25 and passed its bench checks on the satellite on 2026-08-28 (V8/V9 in
`cubesat-sim/ROADMAP.md`). Stage 6 is implemented and deployed; it stays unticked until the
timeline has been stepped through by hand. Stage 7 is next — and it now has one more requirement,
see 2026-08-29 below.

---

## What Stage 3 settled

**The satellite defines the contract.** `types.ts` mirrors `cubesat-sim/src/cubesat/dhs/schema.py`
and that project's documented payloads. A shape invented here would leave the emulated source
faithful to something that does not exist.

**The source is chosen by the bundler, not at runtime.** `#active-source` resolves to
`active.live.ts` or `active.replay.ts`; the module not chosen is never imported. Verified on the
built output — the live bundle carries mqtt.js and no recording, the replay bundle carries the
recording and no mqtt.js. A runtime `if (demo)` would ship both and would let a widget depend on
which one is running.

**The browser talks to the broker directly.** No MQTT-to-WebSocket bridge exists in either
repository, so there is none to keep in step with the topic list. What a browser may publish is an
allowlist on mosquitto's side.

**Attitude bypasses Redux**, into a ref the three.js scene reads on its own animation frame. The
satellite cannot sample faster — the I2C bus is clamped to 10 kHz — so the smoothness between
samples is the viewer's job, and interpolating quaternions is most of why the satellite publishes
them.

**Three panels stopped showing values the satellite does not measure**: a battery current and
wattage derived from a field no sensor produces, four per-subsystem temperatures where there are
three thermometers, and an RSSI/SNR/latency link budget that Meshtastic never reports. Removed, not
dashed out — a row that is always empty is a promise something will fill it.

**Two things are computed here and labelled as such**: the orbital view, which is a simulation
because this satellite rides to work in a backpack, and the mission log, which is built from
transitions the page witnessed because the satellite keeps no events table.

---

## Widgets pass — 2026-08-29

A day on the widgets, driven by data the bus did not yet carry — the satellite side of each item is
in `cubesat-sim` (see its ROADMAP, same date). Committed here; not yet deployed to the Pi.

- **Subsystem Status** is two columns again, with the *why* as a row tooltip, and renders OBC's own
  health verdict from the new `obc_status.subsystems` field: OK / WARN / **FAIL** (the profile
  expects the service and OBC declared it lost — overrides whatever its stale retained status
  claims) / **OFF** (the profile never started it — grey, because a red light on correct behaviour
  would be a lie). UNKNOWN survives only as "no evidence yet". The old CRITICAL level is renamed
  FAIL everywhere (Power, Thermal).
- **MQTT Bus Monitor**: the hub cube is labelled `CubeSat` (OBC is one of the services on the bus,
  drawn as one); services the profile never started are drawn grey and still — a pulsing line out
  of a stopped unit would be the diagram inventing traffic; the not-heard-yet dimming now applies
  to the right column too.
- **Radio Link Log** — a new widget on its own grid row: the radio's session log, live from
  `cubesat/comms/radio` (the same events DHS records into `radio_log`). Time, direction, kind or
  sender, RSSI/SNR/hops, bytes, the line verbatim; nulls render as dashes, a transmission that
  never left is a red row rather than a hidden one. Fed by a new `subscribeRadio` channel and a
  `radio` capability on the source interface.
- **The recording format grew a `radio` array** (the shape of `radio_log` rows), so the static demo
  shows the table too: the placeholder generator writes plausible traffic — a beacon per minute in
  the real `CSAT …` line format, two queries with their 10 s acks, one failed transmit — and
  `ReplaySource` replays it in step with the playhead, restarting with each loop. A recording
  without radio rows declares the capability absent rather than delivering an empty table.
- **Consequence for Stage 7:** the mission export must carry the mission's `radio_log` rows;
  `loadRecording` already accepts them, so the change is on the satellite's `/api/missions/<id>`
  side.

## Camera widget — 2026-08-30

- **Onboard Camera** — a new widget in the right stack: the newest image the satellite can show,
  from whichever channel has one. An on-demand `take_photo` arrives with its pixels on
  `cubesat/payload/photo` and renders instantly; a timelapse frame arrives as metadata and is
  fetched from the mission's directory over the existing `/api/photos/<mission>/<name>`; a page
  opened between captures asks `/api/missions/<id>/photos` once for the newest file. Resolution
  lives in a `useCameraShot` hook and two new source methods (`listPhotos`, `photoUrl`); the widget
  renders a `CameraShot` and cannot tell the channels apart. The empty state is a drawn placeholder
  and says *why* it is empty — no photograph yet, or a recording that carries no photographs
  (`capabilities.photos`, false on the replay build) — and a URL that 404s (retention deletes a
  mission's photos with the mission) falls back to it rather than a broken-image glyph. An unfiled
  frame (no mission open) honestly renders nothing fetchable: the satellite serves only filed
  photos.
- **A decoder bug died on the way**: the satellite says `kind: "timelapse"` and `decodePhoto`
  expected `timelapse_frame`, a name of this repo's own invention — every frame was silently
  dropped. The wire is the satellite's vocabulary. `decodePhoto` also now carries `file` (what the
  photo endpoint wants) and the echoed sidecar `overlay` instead of two fields the satellite never
  published.
- **Satellite side, same date** (`cubesat-sim`): the camera is given back after
  `camera.idle_close_sec` of no captures — an open Picamera2 runs its ISP loops continuously, which
  is SoC heat for nothing in DEMO/EXPO where the DEPLOY probe used to leave the sensor streaming
  until the profile changed. Exposure of the first cold capture is its bench check V11.

## Data-coverage pass — 2026-08-30

A full audit of what the satellite publishes against what the page renders, then the fixes. Three
display bugs died: the telemetry graphs charted the *oldest* 50 rows of a newest-first window and
drew withheld readings as dives to zero (`?? 0` — the exact thing the satellite's null discipline
exists to prevent); `dhs_status.radio {written, buffered}` was silently ignored by the decoder, so
"the card stopped accepting radio-log writes" never reached the ground while the identical
`attitude.buffered` signal did; and GNSS altitude was labelled **km** while the receiver reports
metres — a 116 m bench read as orbit (the link map's footprint formula was fed the same metres as
kilometres).

Two blind zones closed:

- **HOSTD** — its `errors` now surface as a page-level banner (they used to reach nobody but the
  journal); the Wi-Fi mode/SSID/client-count joined the Ground Station Link panel (EXPO is the
  satellite being its own access point, and the page could not tell that from the house network);
  the On-Board Computer card gained the swap bar, colour thresholds on all four bars, profile TTL,
  `profile — requested X` when a switch applied only partly, cadence scale, persistence, mission
  label and the CPU governor (the `units` inventory rides the Profile row as a hover title).
- **DHS** — a new **Flight Recorder** card, sixth in the subsystem row: recording/mission, mission
  rows, both tracks as `written (+held)`, database size, last write, retention horizon, unfiled
  photo bytes (which retention can never remove, so a non-zero number only grows).

Smaller: Payload shows the sensor read counter with the last-read time (the proof a reachable
sensor is actually measuring) and a running timelapse's interval; the mission picker shows distance
(null stays absent — no fix is not zero metres) and `end_reason`; and the console's `telemetry`
command finally hears its answer — `cubesat/comms/data` is subscribed and rendered, where before
the question was published and the reply arrived on a topic nothing listened to.

## Recording narrowed to `FLIGHT` — 2026-09-01

The satellite decided that only `FLIGHT` and `DIAG` write to the SD card (`cubesat-sim` Q7): a
demonstration is not a mission, the satellite stands on a desk during one, and the card is the
component that wears out. The full account is in `cubesat-sim/ROADMAP.md`. What it changed here:

- **`decodePhoto` accepts `kind: "mission_frame"`**, which is what the satellite now calls a frame a
  mission took by itself. This field has cost us once already — an earlier build expected
  `timelapse_frame`, a name of this repository's own invention, and silently dropped every frame —
  so the rename was made in both repositories in one pass.
- **`TelemetryRecord.missionId` is nullable.** A row published on `cubesat/dhs/telemetry` in
  `DEMO`/`EXPO` belongs to no mission, and the decoder no longer coerces that to `0`, which would
  have named a mission that does not exist.
- **`payload_status.timelapse` is `mission_photos`**, and the Payload widget's row with it: a mission
  photographs itself every `photos.mission_interval_sec` (300 s) while it is open, and there is no
  command for it, so that row is the only place the state appears.
- **`timelapse` is gone from the Mission Console** and from the satellite's compact radio
  vocabulary. A spelling the satellite would answer `err=unknown` to is worse than no spelling.
- **The Flight Recorder card lost "Unfiled photos".** `photos/unfiled/` no longer exists: a
  photograph taken with no mission open is written to a tmpfs, published on the now-**retained**
  `cubesat/payload/photo`, and deleted. Retention was forbidden to touch that directory, which made
  the one place guaranteed to grow the one holding the least wanted photographs.
- **The charts' history in `DEMO`/`EXPO` comes from RAM on the satellite**, not from the card:
  `DASHBOARD` keeps a bounded ring of published rows and serves `/api/telemetry` out of it. Nothing
  changed on this side — the same endpoint, the same shape — but the endpoint's *meaning* did: it is
  now "the current session" (the open mission from the database while one is being recorded, the ring
  otherwise) and carries `source: "mission" | "live"`.

That closes the satellite half of the first 2026-08-31 finding below. **The client half is still
open:** break the chart line on a gap. It is worth doing regardless of which source answered,
because gaps happen *within* a mission too.

`source` is also an opportunity not yet taken: "this session is not being recorded" and "the
satellite has just started" are different statements, and a viewer who cannot tell them apart
eventually decides the recorder is broken.

---

## Open

**The bundled recording is a placeholder.** `client/scripts/make-placeholder-recording.mjs` generates
it and it is meant to be thrown away — the demo should replay a real walk exported from the
satellite. The stack has run on the Pi twice (2026-08-28 and 2026-08-31) and there are recorded
missions to export, so what Stage 7 waits on is now a *walk* rather than a working satellite. Note
what the export must carry before it is worth bundling: the mission's `radio_log` rows (2026-08-29,
below) and its photographs, which `{mission, telemetry, attitude}` does not include. And after
2026-09-01 only `FLIGHT` and `DIAG` record at all, so the mission to export is a trip or a rehearsal
of one — a demonstration no longer leaves anything to export.

**Attitude playback needs the timeline (Stage 6).** The `attitude` table exists on the satellite and
`MissionDetail` carries it, but nothing draws it yet: the 3D view follows the live channel only.

**Commands are unrestricted by design, for now.** The dashboard publishes onto `cubesat/command`
exactly as the radio does — one vocabulary, whatever the channel. In `EXPO` the satellite is its own
access point in a public room, so a visitor can send `set_profile HOSTED` and end the demonstration
by taking the access point down. The ground vocabulary has no `poweroff`, so the worst case is a
nuisance. If it becomes one in a real room, the fix is a per-profile command allowlist in the
dashboard service, not a change to the broker ACL — that file cannot see which profile is active.

**There is no end-to-end test.** The Cypress spec went with the PHP backend: it stubbed
`/api/cubesat/*` endpoints that no longer exist and asserted on widgets that were rewritten, so it
could not have passed. It was deleted rather than left as a file nobody runs — it was wired into
neither CI nor `package.json`. The replacement is cheaper than the original was: a
`PUBLIC_SOURCE=replay` build needs no interception at all, because the page carries its own data.
Stage 6 is the natural place for it, once there is a timeline worth driving.

**Little here has run against a real satellite.** Every source is exercised against a fake or a
recording in the tests. In front of the hardware it has been open twice — V8 and V9 in
`cubesat-sim/ROADMAP.md` passed on 2026-08-28, and the 2026-08-31 session found the two display bugs
recorded above — but the widget passes of 2026-08-29 and 2026-08-30, the timeline of Stage 6 and the
2026-09-01 changes above have all been written and tested without one. The next deploy is where they
meet it.
