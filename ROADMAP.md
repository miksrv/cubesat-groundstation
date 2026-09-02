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
widgets that command, and plays at ×1 through ×16. On 2026-09-02 the picker became a modal —
`MissionArchiveDialog` — and gained the second verb: a mission can be erased from the satellite's
archive, rows, attitude, radio log and photographs together. **Deleting is the satellite's, never
this page's**: the dashboard's HTTP surface is read-only by construction, so the dialog publishes
`delete_mission` on `cubesat/command` and DHS, which owns the database, performs it and answers in
`dhs_status.last_delete`. That is the one command this UI sets a `request_id` on, because that
answer is retained and somebody else's must not be mistaken for our own. Export and import are not
in the dialog and are Stage 7's, for the reason below.

**Stage 7 needs two things from the satellite before it is worth doing:** the export must carry the
mission's photographs (it now carries `radio` as of 2026-09-01, but the body is still
`{mission, telemetry, attitude, radio}` with frames listed separately), and it needs a real walk to
export — only `FLIGHT` and `DIAG` record now, so a demonstration leaves nothing to bundle.

---

## Open

**The 3D view's world frame is only half-verified, on purpose.** The scene now draws a floor, a
horizon and a compass, and the mapping from the BNO055's world frame to the scene lives in one
constant (`client/src/components/Satellite3DView/worldFrame.ts`). Only the *up* axis is established
— from the bench dump, where the fused quaternion goes to identity as the board goes level. The
scene's +X heading is not assumed to be magnetic north: it is reconciled at runtime against the
published `yaw`, and the ring keeps its letters only while the two agree. Two things follow, and
both are expected rather than broken:

- Below magnetometer calibration 3 there is no heading anywhere in the widget — the ring is a plain
  circle, as `yaw` is withheld and for the same reason.
- In a *mission replay* the compass may never fix north at all. The two heading sources are
  simultaneous live, but a replay interpolates attitude at the playhead while ADCS comes from the
  nearest DHS row, so pairs are only accepted while the gyro says the satellite was nearly still.
  A sparse recording of a moving satellite legitimately yields nothing.

The frame check itself is live: the measured `accel`, rotated by the attitude, must point at the
scene's up. When it does not, the horizon dims and says so rather than drawing a confident ground
plane. **Nothing here has been confirmed against the real chip yet** — the bundled recording is
synthetic, so the check exists precisely to speak up when a real walk finally arrives.

**`Mission Events` should be a ship's log, and it is missing the entries an operator looks for
first — requested 2026-09-01.** Four transitions, all already on the bus and all derivable in
`features/events/observed.ts` the way the existing entries are: `eps_status.external_power` flipping
("mains lost" / "mains restored" — the charging investigation kept wanting that timestamp);
`payload_photo` arriving (an on-demand `photo` and a mission `mission_frame` are different lines, with
file name and sequence); `adcs_status.gnss.fix` flipping, with the satellite count; and
`comms_status.lora_enabled` flipping ("beacon on" / "beacon off"). Rename the widget to what it is —
a ship's log, *бортовой журнал*. The honest limitation stays: this log starts when the page does.
Whether the satellite should keep an `events` table of its own — the same transitions recorded by DHS
beside `radio_log`, exported and replayed with the mission — is a decision filed in `cubesat-sim`'s
`ROADMAP.md`; if it lands, the widget reads that table for history and keeps deriving live lines as
now.

**The LoRa antenna is not drawn on the satellite model.** The BNO055 notes fix the camera face
(`+X points away from the camera`), which is what anchors the drawing to the real object, but no
document in `cubesat-sim` — hardware notes, README or the frame STLs — records which face the
antenna leaves from. A mast on a guessed face is the same invention as the nadir vector that was
removed from this widget, so it stays off until somebody measures it. Two lines to add back.

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

**Commands are unrestricted by design, for now — with one exception.** The dashboard publishes onto
`cubesat/command` exactly as the radio does — one vocabulary, whatever the channel. In `EXPO` the
satellite is its own access point in a public room, so a visitor can send `set_profile HOSTED` and
end the demonstration by taking the access point down. The ground vocabulary has no `poweroff`, so
the worst case is a nuisance. If it becomes one in a real room, the fix is a per-profile command
allowlist enforced on the satellite, not a change to the broker ACL — that file cannot see which
profile is active.

The exception is `delete_mission`, added 2026-09-02, because erasing somebody's recorded flight is
not a nuisance. DHS refuses it outright in `EXPO`, and it deliberately has **no compact spelling**
on the satellite, so it is in neither the radio vocabulary nor this console's mirror of it — the
archive dialog is the only thing here that sends it. When the general fence is built, the
profile-shaped half of that is what it should look like.

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
