import React from 'react'

import { missionTime, utcClock } from '../../features/timeline/labels'
import type { Timeline } from '../../features/timeline/useTimeline'
import MissionArchiveDialog from '../MissionArchiveDialog/MissionArchiveDialog'

import styles from './MissionTimelineBar.module.scss'

interface Props {
    timeline: Timeline
}

/**
 * The timeline's own chrome: the archive button and the transport controls. The
 * replayed data itself goes through the Dashboard into the same widgets the live
 * view uses — this bar only owns the clock's UI.
 *
 * Choosing a mission is not here. It was, as an inline list that pushed the page
 * down while it was open, and it is now `MissionArchiveDialog`: a listing that
 * can also delete needs room for what a mission recorded and for a confirmation
 * step, and neither belongs in a strip of chrome.
 */
const MissionTimelineBar: React.FC<Props> = ({ timeline }) => {
    // The bar looks the same whether or not the archive is open: the dialog is
    // a layer over the page, so the chrome underneath it should not rearrange
    // itself behind the operator's back and then rearrange back on cancel.
    if (timeline.phase === 'idle' || timeline.phase === 'picking') {
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
                {timeline.phase === 'picking' && (
                    <MissionArchiveDialog
                        missions={timeline.missions}
                        onPick={timeline.pick}
                        onDelete={timeline.remove}
                        onClose={timeline.exit}
                    />
                )}
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
                        className={`${styles.button} ${styles.speed}`}
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
