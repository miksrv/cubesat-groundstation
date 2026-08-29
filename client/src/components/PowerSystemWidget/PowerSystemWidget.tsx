import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { EpsStatus, LiveState } from '../../features/telemetry/types'
import { getEpsStatus } from '../../utils/subsystemStatus'
import StatRow from '../common/StatRow/StatRow'
import StatusBadge from '../common/StatusBadge/StatusBadge'

import styles from './PowerSystemWidget.module.scss'

interface Props {
    eps: EpsStatus | null
    isLoading: boolean
}

const barColorByStatus: Record<'OK' | 'WARN' | 'CRITICAL' | 'UNKNOWN', string> = {
    OK: 'var(--color-green)',
    WARN: 'var(--color-orange)',
    CRITICAL: 'var(--color-red)',
    UNKNOWN: 'var(--text-color-secondary)'
}

const EMPTY: LiveState = {
    host: null,
    obc: null,
    eps: null,
    adcs: null,
    payload: null,
    science: null,
    dhs: null,
    comms: null,
    heartbeats: {}
}

/**
 * Current and wattage used to be shown here, derived from a `battery_current`
 * field. **There is no current sensor on this satellite.** The MAX17048 is a
 * fuel gauge: it reports state of charge, voltage, and a rate of change in
 * percent per hour. Multiplying a number the hardware never measured by the
 * voltage produced a wattage that looked like a measurement and was not one, so
 * both rows are gone and `charge_rate` — which the gauge really does report —
 * is here instead.
 */
const PowerSystemWidget: React.FC<Props> = React.memo(({ eps, isLoading }) => {
    const showSkeleton = isLoading && !eps
    const status = getEpsStatus({ ...EMPTY, eps })
    const batteryLevel = eps?.batteryPercent ?? null
    const rate = eps?.chargeRate ?? null

    return (
        <Container
            title='Electrical Power System'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '160px', width: '100%' }} />}
            {!showSkeleton && (
                <div className={styles.body}>
                    <StatRow
                        label='Battery Voltage'
                        value={eps?.voltage != null ? `${eps.voltage.toFixed(3)} V` : '—'}
                        mono
                    />
                    <StatRow
                        label='Battery Level'
                        value={batteryLevel != null ? `${batteryLevel.toFixed(1)} %` : '—'}
                        mono
                        accent={status.status === 'CRITICAL' ? 'red' : status.status === 'WARN' ? 'orange' : 'green'}
                    />
                    {/*
                      Signed percent per hour from the gauge's CRATE register. It is
                      what tells "plugged in and charging" from "plugged in and still
                      going down" without waiting for the charge reading to move —
                      which is why the satellite's own power policy reads it.
                    */}
                    <StatRow
                        label='Charge Rate'
                        value={rate != null ? `${rate > 0 ? '+' : ''}${rate.toFixed(2)} %/h` : '—'}
                        mono
                        accent={rate != null && rate < 0 ? 'orange' : 'default'}
                    />
                    <StatRow
                        label='Power Source'
                        value={eps?.externalPower === true ? 'Mains' : eps?.externalPower === false ? 'Battery' : '—'}
                        accent={eps?.externalPower === true ? 'main' : 'default'}
                    />
                    <div className={styles.barTrack}>
                        <div
                            className={styles.barFill}
                            style={{
                                width: `${Math.min(100, Math.max(0, batteryLevel ?? 0))}%`,
                                background: barColorByStatus[status.status]
                            }}
                        />
                    </div>
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

PowerSystemWidget.displayName = 'PowerSystemWidget'
export default PowerSystemWidget
