import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { DhsStatus, LiveState, ObcStatus } from '../../features/telemetry/types'
import { applyObcVerdict, getDhsStatus } from '../../utils/subsystemStatus'
import StatRow from '../common/StatRow/StatRow'
import StatusBadge from '../common/StatusBadge/StatusBadge'

import styles from './FlightRecorderWidget.module.scss'

interface Props {
    dhs: DhsStatus | null
    /** For OBC's verdict on the service itself: a subsystem the profile never
     *  started earns "OFF", not the dash of a page still waiting for data. */
    obc: ObcStatus | null
    isLoading: boolean
}

const EMPTY: LiveState = {
    host: null,
    obc: null,
    eps: null,
    adcs: null,
    payload: null,
    science: null,
    dhs: null,
    comms: null
}

const time = (epoch: number | null): string =>
    epoch != null ? new Date(epoch * 1000).toLocaleTimeString(undefined, { hour12: false }) : '—'

const megabytes = (bytes: number | null): string => (bytes != null ? `${(bytes / 1_000_000).toFixed(1)} MB` : '—')

/** Rows on disk plus rows waiting on a write that is failing — the second
 *  number is the one that says the card stopped accepting writes while the
 *  recorder is still, correctly, alive. */
const writtenPlusHeld = (track: { written: number; buffered: number } | null): string =>
    track == null ? '—' : track.buffered > 0 ? `${track.written} (+${track.buffered} held)` : `${track.written}`

/**
 * DHS is the flight recorder, and until this widget existed the recorder had
 * no face: whether a mission was being written was answerable only by typing
 * `status` into the console or hovering a tooltip. Everything here is the
 * retained `dhs_status`, so a freshly opened page knows it immediately.
 */
const FlightRecorderWidget: React.FC<Props> = React.memo(({ dhs, obc, isLoading }) => {
    const showSkeleton = isLoading && !dhs
    const live: LiveState = { ...EMPTY, dhs, obc }
    const status = applyObcVerdict(getDhsStatus(live), live)

    return (
        <Container
            title='Flight Recorder'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '200px', width: '100%' }} />}
            {!showSkeleton && (
                <div className={styles.body}>
                    <StatRow
                        label='Recording'
                        value={dhs ? (dhs.recording ? `mission ${dhs.mission?.id ?? '?'}` : 'idle') : '—'}
                        accent={dhs?.recording ? 'green' : 'default'}
                    />
                    <StatRow
                        label='Mission rows'
                        value={dhs?.mission?.rows != null ? `${dhs.mission.rows}` : '—'}
                        mono
                    />
                    <StatRow
                        label='Attitude track'
                        value={writtenPlusHeld(dhs?.attitude ?? null)}
                        mono
                        accent={(dhs?.attitude?.buffered ?? 0) > 0 ? 'orange' : 'default'}
                    />
                    <StatRow
                        label='Radio log'
                        value={writtenPlusHeld(dhs?.radio ?? null)}
                        mono
                        accent={(dhs?.radio?.buffered ?? 0) > 0 ? 'orange' : 'default'}
                    />
                    <StatRow
                        label='Database'
                        value={megabytes(dhs?.dbSizeBytes ?? null)}
                        mono
                    />
                    <StatRow
                        label='Last write'
                        value={dhs ? time(dhs.lastWrite) : '—'}
                        mono
                    />
                    <StatRow
                        label='Retention'
                        value={dhs?.retentionDays != null ? `${dhs.retentionDays} days` : '—'}
                        mono
                    />
                    <div className={styles.footer}>
                        <span className={styles.footerLabel}>{status.detail}</span>
                        <StatusBadge
                            status={status.status}
                            label={status.status === 'OK' ? 'NOMINAL' : undefined}
                        />
                    </div>
                </div>
            )}
        </Container>
    )
})

FlightRecorderWidget.displayName = 'FlightRecorderWidget'
export default FlightRecorderWidget
