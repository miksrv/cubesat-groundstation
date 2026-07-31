import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { TelemetryRecord } from '../../features/telemetry/types'
import { getEpsStatus } from '../../utils/subsystemStatus'
import StatRow from '../common/StatRow/StatRow'
import StatusBadge from '../common/StatusBadge/StatusBadge'

import styles from './PowerSystemWidget.module.scss'

interface Props {
    latest: TelemetryRecord | null
    isLoading: boolean
}

const barColorByStatus: Record<'OK' | 'WARN' | 'CRITICAL' | 'UNKNOWN', string> = {
    OK: 'var(--color-green)',
    WARN: 'var(--color-orange)',
    CRITICAL: 'var(--color-red)',
    UNKNOWN: 'var(--text-color-secondary)'
}

const PowerSystemWidget: React.FC<Props> = React.memo(({ latest, isLoading }) => {
    const showSkeleton = isLoading && !latest
    const status = getEpsStatus(latest)

    const batteryLevel = latest?.battery ?? null
    const consumptionMa = latest?.battery_current != null ? latest.battery_current * 1000 : null
    const consumptionW =
        latest?.battery_current != null && latest?.voltage != null ? latest.battery_current * latest.voltage : null

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
                        value={latest?.voltage != null ? `${latest.voltage.toFixed(2)} V` : '—'}
                        mono
                    />
                    <StatRow
                        label='Consumption (mA)'
                        value={consumptionMa != null ? `${consumptionMa.toFixed(0)} mA` : '—'}
                        mono
                    />
                    <StatRow
                        label='Consumption (W)'
                        value={consumptionW != null ? `${consumptionW.toFixed(2)} W` : '—'}
                        mono
                    />
                    <StatRow
                        label='Power Source'
                        value={latest?.external_power ? 'External' : 'Battery Only'}
                        accent={latest?.external_power ? 'main' : 'default'}
                    />
                    <StatRow
                        label='Battery Level'
                        value={batteryLevel != null ? `${batteryLevel.toFixed(1)}%` : '—'}
                        mono
                        accent={status === 'CRITICAL' ? 'red' : status === 'WARN' ? 'orange' : 'green'}
                    />
                    <div className={styles.barTrack}>
                        <div
                            className={styles.barFill}
                            style={{
                                width: `${Math.min(100, Math.max(0, batteryLevel ?? 0))}%`,
                                background: barColorByStatus[status]
                            }}
                        />
                    </div>
                    <div className={styles.footer}>
                        <span className={styles.footerLabel}>Power Status</span>
                        <StatusBadge
                            status={status}
                            label={status === 'OK' ? 'NOMINAL' : undefined}
                        />
                    </div>
                </div>
            )}
        </Container>
    )
})

PowerSystemWidget.displayName = 'PowerSystemWidget'
export default PowerSystemWidget
