import React from 'react'

import type { MissionSummary } from '../../features/telemetry/types'
import type { Timeline } from '../../features/timeline/useTimeline'

import styles from './MissionTimelineBar.module.scss'

interface Props {
    timeline: Timeline
}

const pad = (n: number): string => n.toString().padStart(2, '0')

/** Mission-relative time: `T+MM:SS`, growing hours only when a mission has
 *  them — a 50-minute walk should not read `T+00:50:00`. */
const missionTime = (seconds: number): string => {
    const whole = Math.max(0, Math.floor(seconds))
    const hours = Math.floor(whole / 3600)
    const minutes = Math.floor((whole % 3600) / 60)
    const rest = whole % 60
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`
}

const utcClock = (epoch: number): string => {
    const date = new Date(epoch * 1000)
    return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`
}

const startedAtLabel = (iso: string): string => iso.replace('T', ' ').replace('Z', ' UTC')

const durationLabel = (mission: MissionSummary): string | null => {
    if (!mission.endedAt) {
        return 'running'
    }
    const seconds = (Date.parse(mission.endedAt) - Date.parse(mission.startedAt)) / 1000
    return Number.isFinite(seconds) ? missionTime(seconds) : null
}

/** Null stays null: a mission with no fix walked no measurable distance, and
 *  the satellite says so by withholding the number rather than writing 0. */
const distanceLabel = (metres: number | null): string | null => {
    if (metres == null) {
        return null
    }
    return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres.toFixed(0)} m`
}

/** `end_reason` as the recorder wrote it, spaced for reading. `interrupted`
 *  is the one worth noticing before pressing play: power was lost mid-mission
 *  and the closing timestamp is the last row's, not a shutdown's. */
const endReasonLabel = (reason: string | null): string | null => reason?.replace(/_/g, ' ') ?? null

/**
 * The timeline's own chrome: the archive button, the mission picker, and the
 * transport controls. The replayed data itself goes through the Dashboard into
 * the same widgets the live view uses — this bar only owns the clock's UI.
 */
const MissionTimelineBar: React.FC<Props> = ({ timeline }) => {
    if (timeline.phase === 'idle') {
        return (
            <div className={styles.bar}>
                <span className={styles.hint}>Replay a recorded mission from the satellite's archive</span>
                <button
                    type='button'
                    className={styles.button}
                    onClick={timeline.open}
                >
                    MISSION ARCHIVE
                </button>
            </div>
        )
    }

    if (timeline.phase === 'picking') {
        return (
            <div className={styles.bar}>
                <div className={styles.picker}>
                    {timeline.missions == null && <span className={styles.hint}>Loading missions…</span>}
                    {timeline.missions != null && timeline.missions.length === 0 && (
                        <span className={styles.hint}>The archive holds no missions yet</span>
                    )}
                    {timeline.missions?.map((mission) => (
                        <button
                            key={mission.id}
                            type='button'
                            className={styles.missionRow}
                            onClick={() => timeline.pick(mission.id)}
                        >
                            <span className={styles.missionId}>
                                #{mission.id} {mission.label ?? mission.profile}
                            </span>
                            <span className={styles.missionMeta}>
                                {startedAtLabel(mission.startedAt)}
                                {durationLabel(mission) != null && ` · ${durationLabel(mission)}`}
                                {mission.rows != null && ` · ${mission.rows} rows`}
                                {distanceLabel(mission.distanceM) != null && ` · ${distanceLabel(mission.distanceM)}`}
                                {endReasonLabel(mission.endReason) != null && ` · ${endReasonLabel(mission.endReason)}`}
                                {mission.purgedAt != null && ' · detail purged'}
                            </span>
                        </button>
                    ))}
                </div>
                <button
                    type='button'
                    className={styles.button}
                    onClick={timeline.exit}
                >
                    CANCEL
                </button>
            </div>
        )
    }

    if (timeline.phase === 'loading') {
        return (
            <div className={styles.bar}>
                <span className={styles.hint}>Loading mission…</span>
            </div>
        )
    }

    if (timeline.phase === 'error') {
        return (
            <div className={styles.bar}>
                <span className={styles.error}>⚠ {timeline.error}</span>
                <button
                    type='button'
                    className={styles.button}
                    onClick={timeline.open}
                >
                    RETRY
                </button>
                <button
                    type='button'
                    className={styles.button}
                    onClick={timeline.exit}
                >
                    BACK TO LIVE
                </button>
            </div>
        )
    }

    const mission = timeline.detail?.mission
    if (!mission) {
        return null
    }

    // The mission row outlives its rows. Saying why the charts are empty is
    // the whole point — an empty chart alone would read as "nothing happened".
    const purged = mission.purgedAt != null
    const empty = !purged && timeline.detail?.telemetry.length === 0 && timeline.detail?.attitude.length === 0

    return (
        <div className={`${styles.bar} ${styles.active}`}>
            <span className={styles.replayBadge}>REPLAY</span>
            <span className={styles.missionId}>
                #{mission.id} {mission.label ?? mission.profile}
            </span>
            {purged && (
                <span className={styles.hint}>
                    Detail removed by the retention policy — this mission once held {mission.rows ?? 'its'} rows
                </span>
            )}
            {empty && <span className={styles.hint}>This mission recorded nothing to replay</span>}
            {!purged && !empty && (
                <>
                    <button
                        type='button'
                        className={styles.transport}
                        aria-label={timeline.playing ? 'Pause' : 'Play'}
                        onClick={timeline.playing ? timeline.pause : timeline.play}
                    >
                        {timeline.playing ? '❚❚' : '▶'}
                    </button>
                    <input
                        type='range'
                        className={styles.scrubber}
                        aria-label='Mission time'
                        min={timeline.start}
                        max={timeline.end}
                        step={1}
                        value={timeline.playhead}
                        onChange={(event) => timeline.seek(Number(event.target.value))}
                    />
                    <span className={styles.clock}>
                        T+{missionTime(timeline.playhead - timeline.start)} /{' '}
                        {missionTime(timeline.end - timeline.start)}
                    </span>
                    <span className={styles.clockUtc}>{utcClock(timeline.playhead)}</span>
                    <button
                        type='button'
                        className={styles.button}
                        aria-label='Playback speed'
                        onClick={timeline.cycleSpeed}
                    >
                        ×{timeline.speed}
                    </button>
                </>
            )}
            <button
                type='button'
                className={`${styles.button} ${styles.live}`}
                onClick={timeline.exit}
            >
                ✕ LIVE
            </button>
        </div>
    )
}

export default MissionTimelineBar
