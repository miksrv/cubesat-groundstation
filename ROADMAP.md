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
| 5 | The `cubesat.dashboard` service — static files and read-only REST | `cubesat-sim` | ☐ |
| 6 | The mission timeline: play, scrub, one clock for map and attitude | here | ☐ |
| 7 | Export a real mission; replace the placeholder recording | both | ☐ |
| 8 | The USB Meshtastic receiver | here | ☐ later |

Stage 5 is next, and it lands in the other repository.

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

## Open

**The bundled recording is a placeholder.** `client/scripts/make-placeholder-recording.mjs` generates
it and it is meant to be thrown away — the demo should replay a real walk exported from the
satellite. Nothing has run on the Raspberry Pi yet, so there is nothing to bundle. Stage 7 closes
this, and it cannot close before the hardware has run.

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

**Nothing here has run against a real satellite.** Every source is exercised against a fake or a
recording. `cubesat-sim`'s `ROADMAP.md` carries the bench checks the WebSocket listener and its ACL
are waiting on (V8, V9).
