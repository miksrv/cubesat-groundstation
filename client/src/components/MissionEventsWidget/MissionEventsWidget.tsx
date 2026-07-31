import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { EventSeverity, MissionEvent } from '../../features/telemetry/types'

import styles from './MissionEventsWidget.module.scss'

interface Props {
    events: MissionEvent[]
    isLoading: boolean
}

const severityClass: Record<EventSeverity, string> = {
    info: 'severityInfo',
    success: 'severitySuccess',
    warning: 'severityWarning',
    critical: 'severityCritical'
}

const formatTime = (timestamp: string): string =>
    new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })

const MissionEventsWidget: React.FC<Props> = React.memo(({ events, isLoading }) => {
    const showSkeleton = isLoading && events.length === 0

    return (
        <Container
            title='Mission Events'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '220px', width: '100%' }} />}
            {!showSkeleton && (
                <ul className={styles.list}>
                    {events.map((event) => (
                        <li
                            key={event.id}
                            className={styles.item}
                        >
                            <span className={styles.time}>{formatTime(event.timestamp)}</span>
                            <span className={`${styles.dot} ${styles[severityClass[event.severity]]}`} />
                            <span className={styles.message}>{event.message}</span>
                        </li>
                    ))}
                    {events.length === 0 && <li className={styles.empty}>No events yet</li>}
                </ul>
            )}
        </Container>
    )
})

MissionEventsWidget.displayName = 'MissionEventsWidget'
export default MissionEventsWidget
