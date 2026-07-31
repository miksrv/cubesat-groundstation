import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { TelemetryRecord } from '../../features/telemetry/types'
import type { StatusLevel } from '../../utils/subsystemStatus'
import StatRow from '../common/StatRow/StatRow'
import StatusBadge from '../common/StatusBadge/StatusBadge'

import styles from './ThermalSystemWidget.module.scss'

interface Props {
    latest: TelemetryRecord | null
    isLoading: boolean
}

const fmt = (v: number | null | undefined): string => (v != null ? `${v.toFixed(1)}°C` : '—')

const getThermalStatus = (max: number | null): StatusLevel => {
    if (max == null) {
        return 'UNKNOWN'
    }
    if (max > 65) {
        return 'CRITICAL'
    }
    if (max > 50) {
        return 'WARN'
    }
    return 'OK'
}

const ThermalSystemWidget: React.FC<Props> = React.memo(({ latest, isLoading }) => {
    const showSkeleton = isLoading && !latest

    const temps = [
        latest?.obc_temperature,
        latest?.eps_temperature,
        latest?.battery_temperature,
        latest?.payload_temperature
    ]
    const known = temps.filter((t): t is number => t != null)
    const maxTemp = known.length > 0 ? Math.max(...known) : null
    const status = getThermalStatus(maxTemp)

    return (
        <Container
            title='Thermal System'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '180px', width: '100%' }} />}
            {!showSkeleton && (
                <div className={styles.body}>
                    <StatRow
                        label='OBC Temperature'
                        value={fmt(latest?.obc_temperature)}
                        mono
                    />
                    <StatRow
                        label='EPS Temperature'
                        value={fmt(latest?.eps_temperature)}
                        mono
                    />
                    <StatRow
                        label='Battery Temperature'
                        value={fmt(latest?.battery_temperature)}
                        mono
                    />
                    <StatRow
                        label='Payload Temperature'
                        value={fmt(latest?.payload_temperature)}
                        mono
                    />
                    <StatRow
                        label='Max Temperature'
                        value={fmt(maxTemp)}
                        mono
                        accent={status === 'CRITICAL' ? 'red' : status === 'WARN' ? 'orange' : 'default'}
                    />
                    <div className={styles.footer}>
                        <span className={styles.footerLabel}>Thermal Status</span>
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

ThermalSystemWidget.displayName = 'ThermalSystemWidget'
export default ThermalSystemWidget
