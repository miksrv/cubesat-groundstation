import React, { useMemo } from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { ObservedEvent } from '../../features/events/observed'

import styles from './RecentAlertsWidget.module.scss'

interface Props {
    events: ObservedEvent[]
    isLoading: boolean
}

/**
 * The clock time, not "Nd ago": the timestamps come from the payloads
 * themselves, so on a replayed recording a relative age counts from the
 * recording's own past and reads as nonsense. The full date lives in the
 * row's tooltip for exactly that case.
 */
const formatTime = (epochSeconds: number): string =>
    new Date(epochSeconds * 1000).toLocaleTimeString(undefined, { hour12: false })

const formatFull = (epochSeconds: number): string =>
    new Date(epochSeconds * 1000).toLocaleString(undefined, { hour12: false })

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
                            <span
                                className={styles.time}
                                title={formatFull(alert.at)}
                            >
                                {formatTime(alert.at)}
                            </span>
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
