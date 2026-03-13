import React, { useEffect, useState } from 'react'
import { Badge } from 'simple-react-ui-kit'

import type { TelemetryRecord } from '../../features/telemetry/types'

import styles from './Header.module.scss'

interface Props {
    latest: TelemetryRecord | null
    isLoading: boolean
    isError: boolean
}

const Header: React.FC<Props> = ({ latest, isLoading, isError }) => {
    const [countdown, setCountdown] = useState(30)

    useEffect(() => {
        setCountdown(30)
        const interval = setInterval(() => setCountdown((c) => (c <= 1 ? 30 : c - 1)), 1000)
        return () => clearInterval(interval)
    }, [latest])

    const obcState = latest?.obc_state ?? 'UNKNOWN'

    const getBadgeClass = (state: string): string => {
        switch (state) {
            case 'NOMINAL':
                return styles.badgeNominal
            case 'BOOT':
                return styles.badgeBoot
            case 'DEPLOY':
                return styles.badgeDeploy
            case 'SCIENCE':
                return styles.badgeScience
            case 'LOW_POWER':
                return styles.badgeLowPower
            case 'SAFE':
                return styles.badgeSafe
            default:
                return ''
        }
    }

    return (
        <header className={styles.header}>
            <div className={styles.title}>
                <span className={styles.icon}>🛰</span>
                <h1>CubeSat Ground Station</h1>
            </div>
            <div className={styles.status}>
                <Badge
                    label={obcState}
                    className={getBadgeClass(obcState)}
                />
                {latest && <span className={styles.ts}>{new Date(latest.timestamp).toLocaleTimeString()}</span>}
                <span className={`${styles.dot} ${isError ? styles.dotError : styles.dotLive}`} />
                {!isError && <span className={styles.countdown}>↻ {countdown}s</span>}
                {isLoading && <span className={styles.loading}>Syncing…</span>}
                {isError && <span className={styles.errorText}>API Offline</span>}
            </div>
        </header>
    )
}

export default Header
