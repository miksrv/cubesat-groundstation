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
    const [utcClock, setUtcClock] = useState('')

    useEffect(() => {
        const tick = () => setUtcClock(new Date().toUTCString().replace(' GMT', ' UTC').toUpperCase())
        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [])

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
                return styles.badgeUnknown
        }
    }

    const utcTime = utcClock.split(' ').slice(-2).join(' ')

    return (
        <header className={styles.header}>
            <div className={styles.left}>
                <div className={styles.logoRow}>
                    <span className={styles.logoMark}>◈</span>
                    <span className={styles.logoName}>CUBESAT</span>
                    <span className={styles.logoDivider}>/</span>
                    <span className={styles.logoSub}>GS</span>
                    <span className={styles.version}>v1.0</span>
                </div>
                <span className={styles.utcMobile}>{utcTime}</span>
            </div>

            <div className={styles.center}>
                <span className={styles.utcClock}>{utcClock}</span>
            </div>

            <div className={styles.right}>
                <Badge
                    label={obcState}
                    className={getBadgeClass(obcState)}
                />
                <div className={`${styles.liveGroup} ${isError ? styles.liveGroupOffline : styles.liveGroupOnline}`}>
                    <span className={`${styles.liveDot} ${isError ? styles.dotError : styles.dotLive}`} />
                    <span className={styles.liveLabel}>{isError ? 'OFFLINE' : 'LIVE'}</span>
                </div>
                {!isError && <span className={styles.countdown}>↻ {countdown}s</span>}
                {isLoading && <span className={styles.syncing}>SYNC</span>}
            </div>
        </header>
    )
}

export default Header
