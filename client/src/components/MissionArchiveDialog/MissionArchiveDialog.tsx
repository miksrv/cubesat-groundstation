import React, { useEffect, useRef, useState } from 'react'

import type { MissionSummary } from '../../features/telemetry/types'
import { getSource } from '../../features/telemetry/useSource'
import { distanceLabel, durationLabel, endReasonLabel, startedAtLabel } from '../../features/timeline/labels'

import styles from './MissionArchiveDialog.module.scss'

interface Props {
    /** Newest first, as the archive lists them. Null while they are loading —
     *  which is a different statement from an empty archive, and reads
     *  differently. */
    missions: MissionSummary[] | null
    onPick: (id: number) => void
    /** Resolves when the satellite says the mission is gone, rejects with its
     *  own reason when it refuses. */
    onDelete: (id: number) => Promise<void>
    onClose: () => void
}

/** Which mission, if any, is waiting on a confirmation or on the satellite. */
type Pending = { id: number; phase: 'confirming' | 'deleting' } | null

/**
 * The mission archive: every recorded session, with what it holds, and the two
 * things an operator can do with one.
 *
 * A modal rather than the inline list this replaces. The list lived in the
 * timeline bar and pushed the page down while it was open, which was tolerable
 * for a single verb — "replay this one" — and is not once a row can also erase
 * a walk permanently. A destructive action needs room for the thing being
 * destroyed to be described (when it ran, how far it went, how many rows) and
 * for a confirmation step that is not a browser `confirm()` the operator will
 * learn to dismiss without reading.
 *
 * **Delete is the satellite's, never this page's.** The dashboard's HTTP surface
 * is read-only by construction, so this publishes `delete_mission` and DHS —
 * which owns the database — performs it. That is why the failures rendered here
 * are the satellite's own words: it is the half that knows the profile is
 * `EXPO`, or that the mission asked for is the one currently being recorded.
 *
 * A source that cannot delete (a recording opened with no satellite behind it)
 * gets no delete buttons at all, rather than buttons that can only fail.
 */
const MissionArchiveDialog: React.FC<Props> = ({ missions, onPick, onDelete, onClose }) => {
    const [pending, setPending] = useState<Pending>(null)
    const [error, setError] = useState<string | null>(null)
    const panel = useRef<HTMLDivElement>(null)
    // Asked once per open. A source's capabilities do not change under it, and
    // the dialog is the only thing on the page that needs this one.
    const canDelete = getSource().capabilities.deleteMissions

    // Escape closes it. The dialog covers the page, so the key that gets out of
    // every other dialog has to get out of this one; without it the only way
    // back to the live view is a mouse.
    useEffect(() => {
        const onKey = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                onClose()
            }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])

    // Focus moves into the panel when it opens, so the keyboard is inside the
    // dialog rather than still on the page behind it.
    useEffect(() => {
        panel.current?.focus()
    }, [])

    const remove = (id: number): void => {
        setPending({ id, phase: 'deleting' })
        setError(null)
        onDelete(id)
            .then(() => setPending(null))
            .catch((cause: unknown) => {
                // The satellite's reason, verbatim. Paraphrasing it here would
                // put a second, worse explanation in front of the operator —
                // and the refusals are specific enough to act on.
                setError(cause instanceof Error ? cause.message : `mission ${id} was not deleted`)
                setPending({ id, phase: 'confirming' })
            })
    }

    return (
        <div
            className={styles.backdrop}
            // A click on the page behind the dialog closes it, exactly as CLOSE
            // does. Guarded on the target so that a click that started inside
            // the panel and drifted out — selecting a mission label — does not.
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose()
                }
            }}
        >
            <div
                ref={panel}
                className={styles.panel}
                role='dialog'
                aria-modal='true'
                aria-labelledby='mission-archive-title'
                tabIndex={-1}
            >
                <header className={styles.header}>
                    <h2
                        id='mission-archive-title'
                        className={styles.title}
                    >
                        MISSION ARCHIVE
                    </h2>
                    <button
                        type='button'
                        className={styles.close}
                        aria-label='Close the mission archive'
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </header>

                <div className={styles.list}>
                    {missions == null && <p className={styles.hint}>Loading missions…</p>}
                    {missions != null && missions.length === 0 && (
                        <p className={styles.hint}>
                            The archive holds no missions yet. Only <code>FLIGHT</code> and <code>DIAG</code> record — a
                            demonstration on a desk deliberately writes nothing to the card.
                        </p>
                    )}
                    {missions?.map((mission) => {
                        const confirming = pending?.id === mission.id && pending.phase === 'confirming'
                        const deleting = pending?.id === mission.id && pending.phase === 'deleting'
                        return (
                            <div
                                key={mission.id}
                                className={`${styles.row} ${confirming ? styles.rowConfirming : ''}`}
                            >
                                <div className={styles.about}>
                                    <span className={styles.missionId}>
                                        #{mission.id} {mission.label ?? mission.profile}
                                    </span>
                                    <span className={styles.meta}>
                                        {startedAtLabel(mission.startedAt)}
                                        {durationLabel(mission) != null && ` · ${durationLabel(mission)}`}
                                        {mission.rows != null && ` · ${mission.rows} rows`}
                                        {distanceLabel(mission.distanceM) != null &&
                                            ` · ${distanceLabel(mission.distanceM)}`}
                                        {endReasonLabel(mission.endReason) != null &&
                                            ` · ${endReasonLabel(mission.endReason)}`}
                                        {/* The row outlives its rows. Saying so is the
                                            whole point: an empty replay would otherwise
                                            read as "nothing happened on this trip". */}
                                        {mission.purgedAt != null && ' · detail purged'}
                                    </span>
                                </div>

                                {confirming ? (
                                    <div className={styles.actions}>
                                        <span className={styles.warning}>
                                            Erase #{mission.id} and its photographs? This cannot be undone.
                                        </span>
                                        <button
                                            type='button'
                                            className={`${styles.action} ${styles.danger}`}
                                            onClick={() => remove(mission.id)}
                                        >
                                            ERASE
                                        </button>
                                        <button
                                            type='button'
                                            className={styles.action}
                                            onClick={() => {
                                                setPending(null)
                                                setError(null)
                                            }}
                                        >
                                            KEEP
                                        </button>
                                    </div>
                                ) : (
                                    <div className={styles.actions}>
                                        <button
                                            type='button'
                                            className={`${styles.action} ${styles.replay}`}
                                            disabled={deleting}
                                            onClick={() => onPick(mission.id)}
                                        >
                                            REPLAY
                                        </button>
                                        {canDelete && (
                                            <button
                                                type='button'
                                                className={styles.action}
                                                disabled={deleting}
                                                onClick={() => {
                                                    setPending({ id: mission.id, phase: 'confirming' })
                                                    setError(null)
                                                }}
                                            >
                                                {deleting ? 'ERASING…' : 'DELETE'}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {error != null && pending?.id === mission.id && (
                                    <p
                                        className={styles.error}
                                        role='alert'
                                    >
                                        ⚠ {error}
                                    </p>
                                )}
                            </div>
                        )
                    })}
                </div>

                <footer className={styles.footer}>
                    <span className={styles.hint}>
                        Deleting a mission removes its telemetry, its attitude track, its radio log and its photographs
                        from the satellite. The recorder does it, not this page.
                    </span>
                </footer>
            </div>
        </div>
    )
}

export default MissionArchiveDialog
