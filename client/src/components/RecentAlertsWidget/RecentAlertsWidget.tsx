import React, { useMemo } from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { MissionEvent } from '../../features/telemetry/types'

import styles from './RecentAlertsWidget.module.scss'

interface Props {
    events: MissionEvent[]
    isLoading: boolean
}

const formatRelative = (timestamp: string): string => {
    const diffMs = Date.now() - new Date(timestamp).getTime()
    const minutes = Math.floor(diffMs / 60000)
    if (minutes < 1) {
        return 'just now'
    }
    if (minutes < 60) {
        return `${minutes}m ago`
    }
    const hours = Math.floor(minutes / 60)
    if (hours < 24) {
        return `${hours}h ago`
    }
    return `${Math.floor(hours / 24)}d ago`
}

const RecentAlertsWidget: React.FC<Props> = React.memo(({ events, isLoading }) => {
    const alerts = useMemo(() => events.filter((e) => e.severity === 'warning' || e.severity === 'critical'), [events])
    const showSkeleton = isLoading && events.length === 0

    return (
        <Container
            title='Recent Alerts'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '160px', width: '100%' }} />}
            {!showSkeleton && (
                <ul className={styles.list}>
                    {alerts.map((alert) => (
                        <li
                            key={alert.id}
                            className={`${styles.item} ${alert.severity === 'critical' ? styles.critical : styles.warning}`}
                        >
                            <span className={styles.icon}>{alert.severity === 'critical' ? '⛔' : '⚠'}</span>
                            <span className={styles.message}>{alert.message}</span>
                            <span className={styles.time}>{formatRelative(alert.timestamp)}</span>
                        </li>
                    ))}
                    {alerts.length === 0 && <li className={styles.empty}>No active alerts</li>}
                </ul>
            )}
        </Container>
    )
})

RecentAlertsWidget.displayName = 'RecentAlertsWidget'
export default RecentAlertsWidget
