# Roadmap

The ground segment of **[CubeSat Sim](https://github.com/miksrv/cubesat-sim)**: one React interface
over several data sources.

**Finished work is removed from this file rather than ticked off.** The reasoning behind a closed
stage lives in the plan below, next to what "done" meant for it; git holds what this file used to
say. What is left here is what is left to do.

Two documents carry the reasoning, and this file only tracks state:

- [`docs/dashboard-architecture.md`](docs/dashboard-architecture.md) — what this repository is, and
  why the boundary with `cubesat-sim` falls where it does.
- [`docs/dashboard-plan.md`](docs/dashboard-plan.md) — the staged plan, with what "done" means for
  each stage.

---

## Where the work stands

Stages 0–5 are done and gone from this table; what each of them settled is recorded in
[`docs/dashboard-plan.md`](docs/dashboard-plan.md) under its own stage.

| Stage | What | Repository | Status |
|---|---|---|---|
| 6 | The mission timeline: play, scrub, one clock for map and attitude | here | ☐ built, awaiting a hands-on run |
| 7 | Export a real mission; replace the placeholder recording | both | ☐ next |
| 8 | The USB Meshtastic receiver | here | ☐ later |

**Stage 6 is implemented and deployed**, and stays unticked until the timeline has been stepped
through by hand in front of the satellite. It grew on 2026-09-01: the replay keeps the whole widget
set in place, draws the mission's own events, radio traffic and photographs, disables the two
widgets that command, and plays at ×1/×2/×4.

**Stage 7 needs two things from the satellite before it is worth doing:** the export must carry the
mission's photographs (it now carries `radio` as of 2026-09-01, but the body is still
`{mission, telemetry, attitude, radio}` with frames listed separately), and it needs a real walk to
export — only `FLIGHT` and `DIAG` record now, so a demonstration leaves nothing to bundle.

---

## Open

**Two 2026-09-01 items are done and gone from here:** the three logs on the page now all read
newest-first (the console keeps bottom-append — it has a prompt at the bottom), and `Quick Commands`
no longer narrates its own buttons. The console prints what crosses `cubesat/command` instead, which
covers a phone, the `cubesat` CLI and an uplink relayed off the radio as well; a publish that failed
has no echo, so it is posted into the console explicitly.

**The bundled recording is a placeholder.** `client/scripts/make-placeholder-recording.mjs` generates
it and it is meant to be thrown away — the demo should replay a real walk exported from the
satellite. The stack has run on the Pi twice, and there are recorded missions, so what Stage 7 waits
on is a *walk* rather than a working satellite. See the note under Stage 6 above for what the export
must carry first.

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
recording in the tests. The page has been open in front of the hardware twice (2026-08-28 and
2026-08-31, the second of which found two display bugs), but everything since — the widget passes,
the camera, the timeline, and the 2026-09-01 replay work — has been written and tested without one.
The next deploy is where they meet it.

**The chart line should break on a gap in the data.** The last open item from the 2026-08-31 run: a
recorder that stops in `HOSTED` and resumes on the next active profile leaves a hole, and a line
drawn straight through it invents a trend. Worth doing whichever source answered `/api/telemetry` —
gaps happen *within* a mission too.
