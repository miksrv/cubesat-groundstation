# Dashboard: the plan

Continues [`dashboard-architecture.md`](dashboard-architecture.md), which records *what* was agreed
and *why*. This document is *in what order*, and what has to be true before each stage is called
done. Decisions taken 2026-08-25 are marked **[D]**.

Work spans two repositories. Each stage says which one it lands in.

---

## Decisions this plan implements

| | Decision |
|---|---|
| **[D1]** | Attitude gets its own narrow table in the satellite's database, decimated to a fixed maximum rate. It costs SD-card writes, not I2C bus time — DHS holds no hardware |
| **[D2]** | One command vocabulary. The dashboard is a ground client publishing to `cubesat/command`, exactly as the radio does. No per-profile gate for now |
| **[D3]** | The cloud leg is removed: `comms/api.py`, the cloud half of `comms/service.py`, and the `downlink.api` flag itself |
| **[D4]** | Live data reaches the browser over mosquitto's own WebSocket listener. No MQTT→WebSocket bridge is written; the satellite's service has no WebSocket code |
| **[D5]** | Publishing from a browser is an allowlist: `cubesat/command` only |

---

## Stage 0 — Remove the cloud leg · *cubesat-sim*

Independent of everything else; first only because it makes every later file smaller.

- Delete `src/cubesat/comms/api.py` and `tests/unit/comms/test_api.py`
- Strip `_cloud_cycle()`, `_api_requested`, the `CloudApi` construction and the api fields of
  `comms_status` from `comms/service.py`; correct the module docstring, which currently opens by
  describing the cloud as one of two jobs
- Remove `api` from `DownlinkSpec` (`common/profiles.py`), from all six profiles in
  `config/profiles.yaml`, and from `README.md` and `docs/concept.md`
- `COMMS_API_URL` / `COMMS_API_KEY` leave the environment documentation
- Close **Q6** in `ROADMAP.md` with the answer: nothing beyond LoRa and the local dashboard

**Done when:** `ruff check`, `mypy`, and the suite at 100 % coverage; no occurrence of `cloud` or
`api` remains in `comms/` outside a historical note.

---

## Stage 1 — The `attitude` table · *cubesat-sim*

Blocks Stage 6. Does not block the live view.

- `dhs/schema.py`: `attitude(mission_id, t REAL, quat_w, quat_x, quat_y, quat_z, gyro_x, gyro_y,
  gyro_z)` with an index on `(mission_id, t)`. `t` is the epoch from the ADCS payload — the sensor's
  own time, not the recorder's, which also keeps it clear of `telemetry.timestamp` being TEXT at
  one-second resolution
- `dhs/recorder.py`: a **bounded** buffer of attitude samples, flushed as one transaction on DHS's
  existing tick. No new wakeups — one wakeup writes more rows. Bounded because a stalled writer
  must not grow it without limit
- `config/config.yaml`: `dhs.attitude_min_interval_sec`, default `1.0`. Samples arriving sooner are
  dropped. This is also the cap that keeps `DIAG` — where `cadence_scale: 0.2` runs ADCS at 10 Hz —
  from writing ten rows a second
- Mission close, orphan recovery and retention must all cover the new table: attitude rows belong to
  a mission and are purged with it

**Done when:** the suite proves the decimation boundary from the constant rather than a literal
(project rule), that a closed mission has no orphaned attitude rows, and that purge removes them.

---

## Stage 2 — mosquitto WebSocket listener and ACL · *cubesat-sim*

- A second listener speaking `protocol websockets`, and an ACL file, both installed by
  `scripts/install.sh` alongside the units
- The ACL is an allowlist, and the two denials are the load-bearing part:

  | | Topic | Browser |
  |---|---|---|
  | subscribe | `cubesat/#` | ✅ |
  | publish | `cubesat/command` | ✅ — a ground client, exactly like the radio |
  | publish | `cubesat/host/command` | ❌ HOSTD's inbox. HOSTD runs as root |
  | publish | `cubesat/+/status`, `cubesat/heartbeat` | ❌ a browser must not be able to forge telemetry OBC makes decisions from |

- Document the listener in `README.md` → MQTT contract

**Done when:** documented and installed. Marked in `ROADMAP.md` as bench-verifiable only — nothing
here can be proven without a broker.

---

## Stage 3 — The contract and the data-source layer · *groundstation* · ✅ done 2026-08-25

The centre of the whole rework. Nothing in Stage 5 may start before this is settled.

- Define the source interface at the domain level — "latest state", "subscribe to attitude", "load
  mission", "list missions" — never in transport terms
- Rewrite `client/src/features/telemetry/types.ts` from the satellite's own schemas
  (`cubesat-sim/README.md` payloads, `dhs/schema.py` columns). It currently describes the PHP API,
  which Stage 0 and Stage 4 delete
- Three implementations behind one interface:
  - `LiveSource` — `mqtt.js` over the WebSocket listener, plus REST for history and photographs
  - `ArchiveSource` — REST against the satellite's service
  - `StaticSource` — a mission exported to JSON, bundled with the build
- Selection by configuration at build time. **No `if (DEMO)` inside a widget** — that variant breaks
  every time the live path is edited, and nobody notices until it is deployed
- **Attitude bypasses Redux.** 2 Hz through a dispatch and a re-render of a three.js scene will
  stutter; the quaternion goes to a ref and the scene updates imperatively, with slerp between
  samples for smoothness the sensor cadence cannot provide
- `getWeather` must degrade visibly: it calls an absolute external URL, which has no internet in
  `EXPO` and no network at all in `FLIGHT`

**Done when:** every widget renders against `StaticSource` with no backend running anywhere.

**What landed.** `types.ts` rewritten from `dhs/schema.py` and the README's payloads;
`source.ts` as the interface, with `LiveSource` (mqtt.js over the broker's WebSocket listener plus
REST for the archive) and `ReplaySource` (a recording, no backend at all) behind it. Selection is a
**bundler alias**, not a runtime branch: `#active-source` resolves to `active.live.ts` or
`active.replay.ts`, so the module not chosen is never imported. Verified on the built output — the
live bundle carries mqtt.js and no recording, the replay bundle carries the recording and no
mqtt.js.

Attitude has its own channel into a ref, never through Redux; RTK Query is gone with the backend it
wrapped. Three things the old UI showed that the satellite does not measure were removed rather
than dashed out: a battery current and wattage derived from a field no sensor produces, four
per-subsystem temperatures where there are three thermometers, and an RSSI/SNR/latency/packet-loss
link budget that Meshtastic never reports. The mission log is now built from state transitions the
page witnessed, because the satellite keeps no events table — and it says so when empty. The
orbital view is `features/orbit/simulate.ts`, computed in the browser from the clock and labelled
`(sim)` wherever it appears.

**The bundled recording is a placeholder** (`scripts/make-placeholder-recording.mjs`), and is meant
to be replaced by a real `GET /api/missions/<id>/export` as soon as the satellite has run. It
reproduces the awkward parts on purpose — a withheld `yaw` for the first third, `uv_index` null
throughout, a fix that drops and leaves the coordinates stale — because those are what the widgets
have to handle.

97 tests, `tsc`, `eslint` and `prettier` all clean.

---

## Stage 4 — Delete PHP · *groundstation* · ✅ done 2026-08-25

The client had already stopped importing anything from `server/` by the end of Stage 3, so this was
a clean removal rather than a refactor:

- Remove `server/`, `docker/mysql`, the MySQL half of `docker-compose.yml`, PHPUnit, the API
  reference and the requirements that describe them
- Rewrite `README.md`, `ROADMAP.md` and `CLAUDE.md` for what the repository now is, and drop the
  superseded banners those files currently carry

**Done when:** no PHP remains and the three documents describe one system rather than two.

**What landed.** `server/`, `docker/`, `docker-compose.yml`, the Postman collection and the
`requirements/` feature specs are gone, along with the Backend Agent and 63 MB of composer vendor
tree. `README.md`, `ROADMAP.md` and `CLAUDE.md` were rewritten for what the repository now is, and
the superseded banners came off.

Two things the deletion turned up:

- **The FTP deploy target is the public demo.** `deploy.yml` had two jobs shipping to the same host;
  the PHP one is gone and the UI one now builds with `PUBLIC_SOURCE=replay`, because that host is
  ordinary static hosting — which is exactly the case that has no backend.
- **CI builds both variants.** The source is swapped by a bundler alias, so a break in the module
  that is not aliased in is invisible from the other build.

---

## Stage 5 — The satellite's dashboard service · *cubesat-sim*

Written against the contract Stage 3 has already fixed.

- `cubesat.dashboard`, inheriting `common.service.Service` — broker connect, heartbeat, last will,
  cadence and shutdown come free and must not be hand-rolled
- Serves the static build from `CUBESAT_DASHBOARD_ROOT`; no WebSocket code, per **[D4]**
- Read-only REST: mission list, one mission, its telemetry, its attitude, its photographs, and
  `GET /api/missions/<id>/export` — the same endpoint backs both "keep a copy of this walk" and
  "produce the file the public demo replays"
- SQLite read-only on its own connection, WAL, never a long transaction and never a write lock
  against the recorder
- A mission with `purged_at` renders as a mission row plus an explicit "detail removed by the
  retention policy". An empty chart would be a lie
- Free space comes from DHS's system-health columns and the retained `dhs_status`, not from polling
  `payload_status`, which is not republished on a cadence

**Done when:** `ruff`, `mypy`, suite at 100 %; no hardware and no broker required to test it.

---

## Stage 6 — The mission timeline · *groundstation*

Needs Stage 1 and Stage 5.

- Mission picker, play/pause, scrubbing
- One clock drives all of it: the point on the map, the attitude widget, the charts and the values
  all read the same instant
- Attitude comes from the `attitude` table at 1 Hz with slerp between samples; everything else from
  `telemetry` at DHS's own cadence. Two different rates on one timeline is the thing to get right

---

## Stage 7 — The public demo · *groundstation*

- Export a real walk through Stage 5's endpoint, commit the JSON with the build
- The demo replays something the satellite actually measured rather than a generator's idea of it,
  and reuses the whole of Stage 6
- Deploy as plain files. It must work on a host with no rewrite rules — which holds while there is
  no `react-router`; if addressable mission URLs are wanted, hash routing is the only option that
  keeps it true

---

## Stage 8 — The USB ground receiver · *groundstation* · later

Not built now. The constraint that costs nothing today: the receiver stores into **the same schema**
as `dhs/schema.py`, so `ArchiveSource` and Stage 6 work against it unchanged.

---

## Dependencies

```
Stage 0 ─┐                          (independent — any time)
Stage 1 ─┼─────────────────┐
Stage 2 ─┘                 │
                           │
Stage 3 ──┬── Stage 4      │        (contract first — this is the rule)
          │                │
          └── Stage 5 ─────┴── Stage 6 ── Stage 7 ── Stage 8
```

---

## Noted, not scheduled

**ADCS runs at 10 Hz in `DIAG`.** `cadence_scale: 0.2` against a 0.5 s interval, on a bus clamped to
10 kHz where a single read costs tens of milliseconds and four processes share an advisory lock.
This is true today and has nothing to do with the dashboard. Stage 1's cap keeps it out of the
database; whether it belongs on the bus at all is a separate question.
