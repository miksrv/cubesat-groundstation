import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { TelemetryRecord } from '../../features/telemetry/types'
import { getSubsystemStatuses } from '../../utils/subsystemStatus'
import StatusBadge from '../common/StatusBadge/StatusBadge'

import styles from './SubsystemStatusWidget.module.scss'

interface Props {
    latest: TelemetryRecord | null
    isLoading: boolean
}

const SubsystemStatusWidget: React.FC<Props> = React.memo(({ latest, isLoading }) => {
    const showSkeleton = isLoading && !latest
    const statuses = getSubsystemStatuses(latest)

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
