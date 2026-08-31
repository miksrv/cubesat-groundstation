import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { LiveState, TelemetryRecord } from '../../features/telemetry/types'
import { getSubsystemStatuses } from '../../utils/subsystemStatus'
import StatusBadge from '../common/StatusBadge/StatusBadge'

import styles from './SubsystemStatusWidget.module.scss'

interface Props {
    live: LiveState
    /** For the OBC row's CPU and RAM, which only DHS records. */
    latest: TelemetryRecord | null
    isLoading: boolean
}

const SubsystemStatusWidget: React.FC<Props> = React.memo(({ live, latest, isLoading }) => {
    const showSkeleton = isLoading && !live.obc
    const statuses = getSubsystemStatuses(live, latest)

    return (
        <Container
            title='Subsystem Status'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '160px', width: '100%' }} />}
            {!showSkeleton && (
                <ul className={styles.list}>
                    {statuses.map((s) => (
                        <li
                            key={s.key}
                            className={styles.item}
                            /* The detail still matters — a colour on its own says a
                               subsystem is unhappy without saying why, and half of
                               the amber states are the satellite behaving correctly.
                               It lives on hover so the row stays two columns. */
                            title={s.detail}
                        >
                            <span className={styles.name}>{s.label}</span>
                            <StatusBadge status={s.status} />
                        </li>
                    ))}
                </ul>
            )}
        </Container>
    )
})

SubsystemStatusWidget.displayName = 'SubsystemStatusWidget'
export default SubsystemStatusWidget
