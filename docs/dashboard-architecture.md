# Dashboard architecture

**Status:** agreed 2026-08-25, and carried out — Stages 3 and 4 of
[`dashboard-plan.md`](dashboard-plan.md) have landed. The PHP/CodeIgniter backend and MySQL it
replaced are deleted; `README.md`, `ROADMAP.md` and `CLAUDE.md` describe the system as it now is.

This repository stops being a cloud backend with a React frontend attached, and becomes **one user
interface with several data sources behind a single seam**. No PHP and no MySQL survive the change.

---

## The four cases this has to serve

| # | Case | Runs on | Data comes from |
|---|---|---|---|
| 1 | Live dashboard in `DEMO` / `EXPO` | the satellite | the satellite's own MQTT bus and SQLite |
| 2 | Mission archive: load a mission, play its timeline | the satellite | the satellite's SQLite |
| 3 | Public demo, always reachable on the internet | ordinary static hosting | itself — no backend at all |
| 4 | Ground receiver: a Heltec V4 on USB (future) | a laptop | a local serial link and its own SQLite |

They draw the same map, the same 3D attitude, the same charts, the same photographs. They differ
only in where the numbers come from. That is the whole architecture: **the UI must not know which
case it is in.**

The seam already exists — `client/src/features/telemetry/telemetryAPI.ts`, 56 lines with a single
`baseUrl`. Every widget already goes through it and none of them knows about transport.

---

## Where each piece lives

| Piece | Repository | Why there |
|---|---|---|
| React UI | **this one** | one codebase for all four cases |
| Data-source layer and the emulated source | **this one** | part of the interface, not of any backend |
| Ground receiver for case 4 | **this one** | runs on a laptop, needs a serial port, has no satellite on it |
| The satellite's dashboard service | **cubesat-sim**, as `cubesat.dashboard` | see below |

### Why the satellite's service is not in this repository

It is one of the eight services in `cubesat-sim`, and it needs what only that repository has:

- `TOPICS` from `common/topics.py` — the project's rule is that a topic is never a literal string
- the `Profile` and mission-state enums from `common/states.py`
- the table layout owned by `dhs/schema.py`
- `common.service.Service`, which already provides broker connect, retained subscriptions,
  heartbeat, the MQTT last will, cadence and graceful shutdown
- `common/config.py` and `config/config.yaml`

Putting the service here would mean duplicating all of it — and a second copy of a topic name or a
column list is the kind that drifts on the first edit. The slot is already reserved:
`src/cubesat/dashboard/__init__.py` exists, `systemd/cubesat-dashboard.service` runs
`python -m cubesat.dashboard`, and HOSTD's allowlist already names the unit.

### Why the satellite's service is not Node

The Pi already runs seven Python services on one virtualenv. A Node backend there would add a
second runtime and a second package manager to a machine on battery, and would re-implement the
broker plumbing that `Service` already provides and tests cover. It buys nothing that Python does
not already have on that machine.

Node stays where it belongs: building this repository's UI.

### The UI reaches the satellite as a built artifact

`client/dist`, not a checkout. Building React on a Pi 4 costs minutes and a `node_modules` tree on
the SD card to produce a few megabytes of static files. `cubesat-sim` already designates
`/var/lib/cubesat/` for the dashboard build, and the service serves it from
`CUBESAT_DASHBOARD_ROOT`.

### HOSTD starts it, never OBC

`OBC` has no privileges and never touches systemd — that split is structural in `cubesat-sim`.
A profile with `dashboard: true` is all it takes: HOSTD's `_wanted_units()` already brings the unit
up and takes it down again when the profile changes. Nothing needs adding on that side.

---

## The static demo is a constraint, not a later concern

Case 3 must run on ordinary hosting as plain files. Four rules follow, and they are cheap now and
expensive to retrofit:

1. **The UI never assumes a backend exists.** The data source is an interface with several
   implementations, chosen by configuration. Not an `if (DEMO)` spread through the widgets — that
   version breaks every time somebody edits the live one, and nobody notices until it is deployed.
2. **The static build must work on a host with no rewrite rules.** This holds today: there is no
   `react-router` in the dependencies and the SPA is a single page. If case 2 wants addressable
   mission URLs, hash routing is the only option that keeps this true.
3. **The satellite defines the contract, not the emulator.** Real data is born on the Pi; the
   payload schemas are in `cubesat-sim/README.md` and the columns in `dhs/schema.py`. Today
   `types.ts` describes the shape of the PHP API, which is about to stop existing — redefining it
   from the satellite is what stops the emulator being faithful to something imaginary.
4. **Anything reaching outside must degrade visibly.** `getWeather` currently calls
   `https://api.meteo.miksoft.pro/current`. That works on hosting and fails in `EXPO`, which is its
   own access point with no internet, and in `FLIGHT`, which has no network at all.

**A recorded mission makes a better demo than a generator.** Case 3 is case 2 with a static JSON
file instead of a REST endpoint: export a real walk — track, attitude, photographs — and the public
demo replays something the satellite actually measured, reusing the whole timeline implementation.
A synthetic source is then only needed for the live view, and even that can loop the same file.

---

## Order of work

**The contract and the data-source layer here first; the Python service in `cubesat-sim` second,
against a contract that already exists.**

Not the other way round. A service written first produces a contract shaped by whatever was
convenient to hand out of SQLite and MQTT, and case 3 then spends its life imitating the quirks of
a backend it does not have.

---

## Open questions

Settled 2026-08-25. The decisions and the order of work are in
[`dashboard-plan.md`](dashboard-plan.md); `cubesat-sim/ROADMAP.md` → **Next: DASHBOARD** carries
D1–D5 and their answers.
