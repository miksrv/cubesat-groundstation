/**
 * The mission timeline: one clock, and everything the replay shows derived
 * from it.
 *
 * The hook owns the playhead — play, pause, scrub, speed — and hands the
 * Dashboard three things per instant: the live-shaped state (so every widget
 * renders a replayed mission exactly as it renders the satellite), the rows
 * recorded up to the playhead (so the charts grow with it instead of showing
 * the mission's future), and the interpolated attitude in a ref (so the 3D
 * scene reads it on its own animation frame, exactly as it reads the live
 * channel — see `useAttitudeRef` for why that bypasses React).
 *
 * Loading goes through the one data-source interface, so the timeline works
 * against the satellite's archive and against the recording bundled with the
 * static demo build alike — which is what makes it a feature of the demo
 * rather than something only reachable on the satellite.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

import type { ObservedEvent } from '../events/observed'
import { diffStates, MAX_EVENTS } from '../events/observed'
import { liveStateFromRow } from '../telemetry/fromRow'
import type { AttitudeUpdate } from '../telemetry/source'
import type {
    AttitudeSample,
    LiveState,
    MissionDetail,
    MissionSummary,
    RadioEvent,
    TelemetryRecord
} from '../telemetry/types'
import { getSource } from '../telemetry/useSource'

import { attitudeAt, epochOf, hasQuaternion, indexAtOrBefore } from './playback'

/** How often the playhead advances, in ms. Four steps a second is finer than
 *  the attitude was recorded (1 Hz), so playback is limited by the recording,
 *  never by this. */
const TICK_MS = 250

/** ×1 is the walk as it happened. Cycled rather than picked from a menu — a
 *  short ladder beats a slider nobody can set precisely.
 *
 *  What bounds the ladder is arithmetic, not taste. A tick moves the playhead
 *  TICK_MS × speed — 0.25 s × speed — and a recorded row is skipped whenever
 *  that step grows longer than the spacing between rows. Telemetry is written
 *  30 s apart in FLIGHT and about 6 s in DIAG (cadence_scale 0.2), so ×16 steps
 *  4 s and still lands inside every gap in both. ×32 would step 8 s and begin
 *  stepping over DIAG rows, which is where the ladder has to stop.
 *
 *  That rule is what ×10/×60 taught: they were the first pair tried, and at ×60
 *  the playhead crossed two FLIGHT rows per tick, so the charts moved in jumps
 *  rather than playing. Everything up to ×16 keeps every recorded row on screen
 *  for at least a moment. */
const SPEEDS = [1, 2, 4, 8, 16]

export type TimelinePhase = 'idle' | 'picking' | 'loading' | 'ready' | 'error'

export interface Timeline {
    phase: TimelinePhase
    /** Known once the picker has opened; newest first, as the archive lists. */
    missions: MissionSummary[] | null
    detail: MissionDetail | null
    error: string | null

    /** Epoch seconds. Meaningful only in `ready`. */
    playhead: number
    start: number
    end: number
    playing: boolean
    speed: number

    /** The replayed state at the playhead, shaped exactly like the live one.
     *  Null before the mission's first row: nothing had been recorded yet, and
     *  the widgets render that as they render a satellite not yet heard from. */
    state: LiveState | null
    /** Rows recorded up to the playhead, newest first — what the charts draw. */
    rows: TelemetryRecord[]
    /** The mission's own log up to the playhead, newest first.
     *
     *  Computed here from the recorded rows through `diffStates` — the very
     *  function the live log uses — rather than being fetched: the satellite
     *  keeps no events table, and it should not. Events are a reading of
     *  telemetry, and the reading belongs wherever the telemetry is displayed,
     *  which is also what lets the backend-less demo build show them. */
    events: ObservedEvent[]
    /** The link's traffic up to the playhead, newest first. From the mission's
     *  own `radio_log`, so the Radio Link Log reads the trip rather than the
     *  live satellite while everything beside it reads a recording. */
    radio: RadioEvent[]
    /** Orientation at the playhead, slerped between recorded samples. */
    attitudeRef: React.MutableRefObject<AttitudeUpdate | null>

    open: () => void
    pick: (id: number) => void
    play: () => void
    pause: () => void
    seek: (t: number) => void
    cycleSpeed: () => void
    /** Back to the live view; everything loaded is dropped. */
    exit: () => void
}

export const useTimeline = (): Timeline => {
    const [phase, setPhase] = useState<TimelinePhase>('idle')
    const [missions, setMissions] = useState<MissionSummary[] | null>(null)
    const [detail, setDetail] = useState<MissionDetail | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [playhead, setPlayhead] = useState(0)
    const [playing, setPlaying] = useState(false)
    const [speed, setSpeed] = useState(SPEEDS[0])
    const attitudeRef = useRef<AttitudeUpdate | null>(null)

    // Parsed once per mission, not once per tick: the playhead asks "which row
    // is current" four times a second, over what can be thousands of rows.
    const rowTimes = useMemo(() => (detail ? detail.telemetry.map((row) => epochOf(row.timestamp)) : []), [detail])
    const usableAttitude = useMemo<AttitudeSample[]>(
        () => (detail ? detail.attitude.filter(hasQuaternion) : []),
        [detail]
    )

    const start = useMemo(() => (detail ? epochOf(detail.mission.startedAt) : 0), [detail])
    const end = useMemo(() => {
        if (!detail) {
            return 0
        }
        if (detail.mission.endedAt) {
            return epochOf(detail.mission.endedAt)
        }
        // A mission still open (or closed by a power loss before DHS could
        // write the end) replays up to the last thing it recorded.
        const lastRow = rowTimes.length > 0 ? rowTimes[rowTimes.length - 1] : start
        const lastAttitude = usableAttitude.length > 0 ? usableAttitude[usableAttitude.length - 1].t : start
        return Math.max(start, lastRow, lastAttitude)
    }, [detail, rowTimes, usableAttitude, start])

    // ── the clock ────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!playing) {
            return
        }
        const timer = setInterval(() => {
            setPlayhead((current) => Math.min(current + (TICK_MS / 1000) * speed, end))
        }, TICK_MS)
        return () => clearInterval(timer)
    }, [playing, speed, end])

    // Pausing at the end is an effect of the playhead arriving there, not a
    // special case inside the ticker — scrubbing to the end pauses the same way.
    useEffect(() => {
        if (playing && playhead >= end) {
            setPlaying(false)
        }
    }, [playing, playhead, end])

    // ── what the playhead means ──────────────────────────────────────────────

    const rowIndex = indexAtOrBefore(rowTimes, playhead)

    const state = useMemo(() => {
        if (!detail || rowIndex < 0) {
            return null
        }
        return liveStateFromRow(detail.telemetry[rowIndex], detail.mission, {
            played: rowIndex + 1,
            total: detail.telemetry.length
        })
    }, [detail, rowIndex])

    const rows = useMemo(() => {
        if (!detail || rowIndex < 0) {
            return []
        }
        return detail.telemetry.slice(0, rowIndex + 1).reverse()
    }, [detail, rowIndex])

    // Every event the whole mission holds, derived once per mission rather than
    // once per tick: the playhead moves four times a second over what can be
    // thousands of rows, and re-diffing the lot each time would be the most
    // expensive thing on the page. Filtering the result by the playhead is what
    // makes the log grow as the replay plays.
    const allEvents = useMemo(() => {
        if (!detail) {
            return []
        }
        const out: ObservedEvent[] = []
        let previous: LiveState | null = null
        detail.telemetry.forEach((row, index) => {
            const at = liveStateFromRow(row, detail.mission, {
                played: index + 1,
                total: detail.telemetry.length
            })
            out.push(...diffStates(previous, at))
            previous = at
        })
        return out
    }, [detail])

    const events = useMemo(
        () =>
            allEvents
                .filter((entry) => entry.at <= playhead)
                .slice(-MAX_EVENTS)
                .reverse(),
        [allEvents, playhead]
    )

    const radio = useMemo(
        () =>
            detail
                ? detail.radio
                      .filter((entry) => entry.timestamp <= playhead)
                      .slice(-MAX_EVENTS)
                      .reverse()
                : [],
        [detail, playhead]
    )

    useEffect(() => {
        attitudeRef.current = phase === 'ready' ? attitudeAt(usableAttitude, playhead) : null
    }, [phase, usableAttitude, playhead])

    // ── actions ──────────────────────────────────────────────────────────────

    const open = (): void => {
        setPhase('picking')
        setError(null)
        getSource()
            .listMissions()
            .then(setMissions)
            .catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : 'the mission archive is unreachable')
                setPhase('error')
            })
    }

    const pick = (id: number): void => {
        setPhase('loading')
        setError(null)
        getSource()
            .loadMission(id)
            .then((loaded) => {
                setDetail(loaded)
                const openedAt = epochOf(loaded.mission.startedAt)
                setPlayhead(openedAt)
                // A mission with nothing to replay — purged, or recorded
                // nothing — opens paused: pressing play on it would do nothing,
                // and the bar says why instead.
                setPlaying(loaded.telemetry.length > 0 || loaded.attitude.length > 0)
                setPhase('ready')
            })
            .catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : `mission ${id} would not load`)
                setPhase('error')
            })
    }

    const exit = (): void => {
        setPhase('idle')
        setMissions(null)
        setDetail(null)
        setError(null)
        setPlaying(false)
        setPlayhead(0)
        setSpeed(SPEEDS[0])
        attitudeRef.current = null
    }

    return {
        phase,
        missions,
        detail,
        error,
        playhead,
        start,
        end,
        playing,
        speed,
        state,
        rows,
        events,
        radio,
        attitudeRef,
        open,
        pick,
        play: () => {
            // Play at the end means "again": rewind rather than a button that
            // silently does nothing.
            if (playhead >= end) {
                setPlayhead(start)
            }
            setPlaying(true)
        },
        pause: () => setPlaying(false),
        seek: (t: number) => setPlayhead(Math.min(Math.max(t, start), end)),
        cycleSpeed: () => setSpeed((current) => SPEEDS[(SPEEDS.indexOf(current) + 1) % SPEEDS.length]),
        exit
    }
}
