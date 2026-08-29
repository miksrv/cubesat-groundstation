import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { EventSeverity, ObservedEvent } from '../../features/events/observed'

import styles from './MissionEventsWidget.module.scss'

interface Props {
    events: ObservedEvent[]
    isLoading: boolean
}

const severityClass: Record<EventSeverity, string> = {
    info: 'severityInfo',
    success: 'severitySuccess',
    warning: 'severityWarning',
    critical: 'severityCritical'
}

const formatTime = (epochSeconds: number): string =>
    new Date(epochSeconds * 1000).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })

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
                            <span className={styles.time}>{formatTime(event.at)}</span>
                            <span className={`${styles.dot} ${styles[severityClass[event.severity]]}`} />
                            <span className={styles.message}>{event.message}</span>
                        </li>
                    ))}
                    {/*
                        The satellite keeps no events table: this log is built from
                        what the page itself has witnessed since it was opened, so
                        empty is the normal state right after a reload rather than a
                        claim that nothing has happened. Say so.
                    */}
                    {events.length === 0 && (
                        <li className={styles.empty}>Nothing observed since this page was opened</li>
                    )}
                </ul>
            )}
        </Container>
    )
})

MissionEventsWidget.displayName = 'MissionEventsWidget'
export default MissionEventsWidget
