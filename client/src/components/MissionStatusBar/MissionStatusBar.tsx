import React, { useEffect, useState } from 'react'
import { Badge } from 'simple-react-ui-kit'

import type { OrbitState } from '../../features/orbit/simulate'
import type { LiveState, TelemetryRecord } from '../../features/telemetry/types'
import { getMissionStatus } from '../../utils/subsystemStatus'

import styles from './MissionStatusBar.module.scss'

interface Props {
    live: LiveState
    /** For uptime, which only DHS records. */
    latest: TelemetryRecord | null
    /** Simulated — the satellite has no orbit. See features/orbit/simulate.ts. */
    orbit: OrbitState | null
    isLoading: boolean
    isError: boolean
}

const pad = (n: number): string => n.toString().padStart(2, '0')

const formatMissionTime = (uptimeSeconds: number | null | undefined): string => {
    if (uptimeSeconds == null) {
        return '—'
    }
    const days = Math.floor(uptimeSeconds / 86400)
    const hours = Math.floor((uptimeSeconds % 86400) / 3600)
    const minutes = Math.floor((uptimeSeconds % 3600) / 60)
    const seconds = Math.floor(uptimeSeconds % 60)
    return `T+${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

const formatCountdown = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${pad(m)}:${pad(s)}`
}

const statusBadgeClass = (status: string): string => {
    switch (status) {
        case 'NOMINAL':
            return styles.statusNominal
        case 'WARNING':
            return styles.statusWarning
        case 'CRITICAL':
            return styles.statusCritical
        default:
            return styles.statusUnknown
    }
}

const obcBadgeClass = (state: string): string => {
    switch (state) {
        case 'NOMINAL':
            return styles.badgeNominal
        case 'BOOT':
        case 'DEPLOY':
            return styles.badgeBoot
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

const MissionStatusBar: React.FC<Props> = ({ live, latest, orbit, isLoading, isError }) => {
    const [utcClock, setUtcClock] = useState('')
    const [nextPassSeconds, setNextPassSeconds] = useState<number | null>(null)

    useEffect(() => {
        const tick = () => setUtcClock(new Date().toUTCString().replace(' GMT', ' UTC').toUpperCase())
        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        setNextPassSeconds(orbit?.nextPassSeconds ?? null)
    }, [orbit?.nextPassSeconds])

    useEffect(() => {
        if (nextPassSeconds == null) {
            return
        }
        const interval = setInterval(() => {
            setNextPassSeconds((s) => (s != null && s > 0 ? s - 1 : 0))
        }, 1000)
        return () => clearInterval(interval)
    }, [nextPassSeconds != null])

    const obcState = live.obc?.status ?? 'UNKNOWN'
    const missionStatus = getMissionStatus(live)
    const utcTime = utcClock.split(' ').slice(-2).join(' ')

    return (
        <header className={styles.bar}>
            <div className={styles.brand}>
                <span className={styles.logoMark}>◈</span>
                <div className={styles.logoTextColumn}>
                    <div className={styles.logoRow}>
                        <span className={styles.logoName}>CUBESAT</span>
                        <span className={styles.logoDivider}>/</span>
                        <span className={styles.logoSub}>GS</span>
                    </div>
                    <div className={styles.copyright}>
                        <a
                            href={'https://miksoft.pro'}
                            className={styles.link}
                            title={'Mik — author'}
                            target={'_blank'}
                            rel={'noopener noreferrer'}
                        >
                            <img
                                className={styles.copyrightImage}
                                src={'https://miksoft.pro/favicon.ico'}
                                alt={'Mik'}
                                width={10}
                                height={10}
                            />
                            {'Mik'}
                        </a>
                        {` ${new Date().getFullYear()}`}
                    </div>
                </div>
            </div>

            <div className={styles.stats}>
                <div className={styles.stat}>
                    <span className={styles.statLabel}>Mission Status</span>
                    <span className={`${styles.statValue} ${statusBadgeClass(missionStatus)}`}>
                        <span className={styles.statusDot} />
                        {missionStatus}
                    </span>
                </div>

                <div className={styles.stat}>
                    <span className={styles.statLabel}>UTC Time</span>
                    <span className={`${styles.statValue} ${styles.mono}`}>{utcTime || '—'}</span>
                </div>

                <div className={`${styles.stat} ${styles.hideMobile}`}>
                    <span className={styles.statLabel}>Mission Time</span>
                    <span className={`${styles.statValue} ${styles.mono}`}>
                        {formatMissionTime(latest?.uptimeSeconds)}
                    </span>
                </div>

                <div className={`${styles.stat} ${styles.hideMobile}`}>
                    {/* Simulated. This satellite rides to work in a backpack —
                        the orbital view is a teaching aid and is labelled as one
                        wherever it appears. */}
                    <span className={styles.statLabel}>Orbit (sim)</span>
                    <span className={`${styles.statValue} ${styles.mono}`}>
                        {orbit ? `#${orbit.orbitNumber}` : '—'}
                    </span>
                </div>

                <div className={styles.stat}>
                    <span className={styles.statLabel}>Link Status</span>
                    <span className={`${styles.statValue} ${isError ? styles.linkOffline : styles.linkActive}`}>
                        <span className={`${styles.liveDot} ${isError ? styles.dotError : styles.dotLive}`} />
                        {isError ? 'OFFLINE' : 'ACTIVE'}
                    </span>
                </div>

                <div className={`${styles.stat} ${styles.hideMobile}`}>
                    <span className={styles.statLabel}>Ground Station</span>
                    <span className={styles.statValue}>{orbit?.groundStation.name ?? '—'}</span>
                </div>

                <div className={`${styles.stat} ${styles.hideMobile}`}>
                    <span className={styles.statLabel}>Next Pass</span>
                    <span className={`${styles.statValue} ${styles.mono}`}>
                        {nextPassSeconds != null ? formatCountdown(nextPassSeconds) : '—'}
                    </span>
                </div>
            </div>

            <div className={styles.right}>
                <Badge
                    label={obcState}
                    className={obcBadgeClass(obcState)}
                />
                {isLoading && <span className={styles.syncing}>SYNC</span>}
            </div>
        </header>
    )
}

export default MissionStatusBar
