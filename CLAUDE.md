# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# CubeSat Ground Station

## Read this first

Two documents are the authority, and they were written together:

- [`docs/dashboard-architecture.md`](docs/dashboard-architecture.md) — *what* this repository is
  and *why* the boundary with `cubesat-sim` falls where it does.
- [`docs/dashboard-plan.md`](docs/dashboard-plan.md) — *in what order*, and what is left.

## Project Overview

This repository is **one React interface over several data sources**, not a backend with a frontend
attached. The same page draws the same satellite whether the numbers come from the satellite's own
broker, from a mission replayed out of its archive, or from a recording bundled with a static build
that has no backend at all.

The PHP/CodeIgniter backend and MySQL are **gone** — deleted, not deprecated. So is the cloud leg on
the satellite's side. No cloud service is deployed and none is planned.

**Stack:** React 19, Redux Toolkit (store kept, RTK Query removed with the backend it wrapped),
Rsbuild, ECharts, Leaflet, three.js via react-three-fiber, mqtt.js, Jest. (Cypress went
with the backend it stubbed; see ROADMAP.) A Python ground
receiver will join it for the USB-Heltec case.

## The rules that are easy to undo

**The satellite defines the contract.** `src/features/telemetry/types.ts` mirrors
`cubesat-sim/src/cubesat/dhs/schema.py` and that project's documented MQTT payloads. When the two
disagree, this repository is wrong. A shape invented here would leave the emulated source faithful
to something that does not exist.

**Null means withheld, and it is never a zero.** `yaw` is null until the magnetometer is calibrated
because the BNO055 reports a *constant* below that; `uv_index` is null until the SEN0501 board
revision is known because two revisions read one register with formulas that disagree by a factor of
forty. `?? 0` anywhere in a decoder or a widget undoes all of it.

**The source is chosen by the bundler, never at runtime.** `#active-source` is an alias resolved in
`rsbuild.config.ts` to `active.live.ts` or `active.replay.ts`; the module not chosen is never
imported. Do not replace this with `if (demo)` — both halves would then ship, and a widget could
come to depend on which one is running.

**Widgets take plain props and know nothing about transport.** Data is fetched in exactly one place,
`Dashboard.tsx`. A widget that reaches for the source directly has broken the property the whole
data layer exists to hold.

**Attitude bypasses Redux.** It arrives at 2 Hz and drives one imperative three.js scene, so it goes
into a ref and the scene interpolates on its own animation frame. A dispatch per sample would
re-render the tree for a value only the WebGL scene consumes.

**Withhold rather than fabricate, here too.** Three panels used to show values the satellite does
not measure: a battery current and wattage derived from a field no sensor produces, four
per-subsystem temperatures where there are three thermometers, and an RSSI/SNR/latency link budget
that Meshtastic never reports. They were removed, not dashed out. If a value is not in
`cubesat-sim`'s schema or payloads, it does not exist — do not add a row for it.

**Say when something is not telemetry.** The orbital view is computed in the browser from the clock
(`features/orbit/simulate.ts`) and labelled `(sim)`; the mission log is built from transitions this
page witnessed (`features/events/observed.ts`) and says so when empty, because the satellite keeps
no events table.

## Testing

`src/test-source.ts` installs a fake source; tests need neither a broker nor a server. Fixtures in
`src/test-fixtures.ts` are taken from `cubesat-sim`'s documented payloads rather than invented, so a
test that passes against them would pass against the satellite.

```bash
cd client && yarn test && yarn eslint:check && yarn prettier:check
```

Both builds are checked in CI, because the alias swap means a break in the module that is not
aliased in is invisible from the other build.

---

## Role of Team Lead Claude
You are the AI Team Lead. You coordinate agents but do not write production code directly.

**Responsibilities:**
1. Break features into micro-tasks, create GitHub issues via GitHub MCP server.
2. Delegate tasks to agents (Backend, Frontend, QA, Doc).
3. Verify QA passes before proceeding to the next feature.
4. Maintain progress log in `/ROADMAP.md`.

---

## GitHub Projects Workflow

**Project URL:** https://github.com/users/miksrv/projects/8/

### Team Lead Responsibilities:
1. **Detailed Task Decomposition:**
   - Break each feature into granular micro-tasks (5-20 tasks per feature)
   - Each task should be completable in 1-2 hours
   - Create clear, actionable titles (e.g., "Add a mission picker to the timeline")
   - Add brief description with acceptance criteria and technical notes
   
2. **Card Creation:**
   ```bash
   gh project item-create 8 --owner miksrv \
     --title "Task title" \
     --body "Description with acceptance criteria"
   ```
   - All new cards start in **"Todo"** status
   - Include which agent should handle the task
   - Reference related requirement files
   - Add technical context or dependencies

3. **Task Assignment:**
   - Assign each card to appropriate agent (Backend, Frontend, QA, Doc)
   - Ensure dependencies are clear in card description

### Agent Responsibilities:
Each agent MUST manage their assigned cards through the workflow:

1. **Pick a task from "Todo":**
   ```bash
   gh project item-edit --project-id 8 --id <item-id> --field-id <status-field-id> --text "In Progress"
   ```

2. **While working:**
   - Keep card in **"In Progress"** status
   - Add comments on progress if task takes multiple sessions
   
3. **After completing implementation:**
   - Move card to **"Testing"** status
   - Notify QA Agent if tests are needed
   
4. **After QA passes:**
   - Move card to **"Done"** status
   - Add final comment with PR link or completion notes

### Card Status Flow:
```
Todo → In Progress → Testing → Done
```

### Important Rules:
- **DO NOT create GitHub Issues** — use Project cards only
- Each card must have a clear title and description
- Team Lead tracks overall progress in `/ROADMAP.md`
- Agents update card status immediately when changing phases
- All cards must reach "Done" before moving to next feature

---

## Team Agents

| Agent | Code Location | Instructions |
|-------|--------------|--------------|
| **Frontend Agent** | `/client` | `/.claude/agents/frontend_agent.md` |
| **QA Agent** | `/client/src` | `/.claude/agents/qa_agent.md` |
| **Doc Agent** | `/docs`, `README.md` | `/.claude/agents/doc_agent.md` |

The Backend Agent is gone with the backend. When the USB-Heltec receiver
([`docs/dashboard-plan.md`](docs/dashboard-plan.md), Stage 8) is built it will need one again — in
Python, against the same SQLite schema as the satellite's recorder, not a new one.

---

## Commands

```bash
cd client
yarn install
yarn dev                          # http://localhost:3000, live source
PUBLIC_SOURCE=replay yarn dev     # the bundled recording, no backend
yarn test                         # jest
yarn eslint:check
yarn prettier:check
yarn build                        # PUBLIC_SOURCE=live by default
PUBLIC_SOURCE=replay yarn build   # the public demo
```

There is no `composer`, no `php spark`, no `docker compose`, and no database to migrate. The
satellite owns the database; this repository reads it through the dashboard service's read-only
REST, or replays a file.

---

## Where the work stands

[`docs/dashboard-plan.md`](docs/dashboard-plan.md) is the tracker. Stages 3 and 4 are done: the
contract, the source layer, the widget rewrite, and the removal of PHP. What is left is Stage 5 (the
Python dashboard service, which lives in `cubesat-sim`), Stage 6 (the mission timeline), Stage 7
(exporting a real mission to replace the placeholder recording) and Stage 8 (the USB receiver).

**The bundled recording is a placeholder.** `client/scripts/make-placeholder-recording.mjs` generates
it, and it is meant to be thrown away: the demo is supposed to replay a real walk exported from the
satellite. Nothing has run on the Raspberry Pi yet, so there is nothing to bundle. It does reproduce
the awkward parts on purpose — a withheld `yaw` for the first third, `uv_index` null throughout, a
fix that drops and leaves the coordinates stale — because those are what the widgets have to handle.
