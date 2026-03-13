import React from 'react'
import { Badge, Container, Skeleton } from 'simple-react-ui-kit'

import type { TelemetryRecord } from '../../features/telemetry/types'

import styles from './TelemetryTimeline.module.scss'

interface Props {
    history: TelemetryRecord[]
    isLoading: boolean
}

const getBadgeClass = (state: string | null | undefined): string => {
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
        case null:
        case undefined:
        default:
            return ''
    }
}

const TelemetryTimeline: React.FC<Props> = ({ history, isLoading }) => {
    const sorted = [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    if (isLoading && history.length === 0) {
        return (
            <div className={styles.panel}>
                <Skeleton style={{ height: '150px', width: '100%' }} />
            </div>
        )
    }

    return (
        <Container
            title='📋 Telemetry Timeline'
            className={styles.panel}
        >
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            {[
                                'Timestamp',
                                'State',
                                'Battery',
                                'Voltage',
                                'CPU%',
                                'RAM%',
                                'Temp',
                                'Humidity',
                                'Pressure'
                            ].map((h) => (
                                <th key={h}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((r) => (
                            <tr key={r.id}>
                                <td>{new Date(r.timestamp).toLocaleString()}</td>
                                <td>
                                    <Badge
                                        size='small'
                                        label={r.obc_state ?? '—'}
                                        className={getBadgeClass(r.obc_state)}
                                    />
                                </td>
                                <td>{r.battery != null ? r.battery.toFixed(1) : '—'}%</td>
                                <td>{r.voltage != null ? r.voltage.toFixed(2) : '—'} V</td>
                                <td>{r.cpu_percent != null ? r.cpu_percent.toFixed(1) : '—'}%</td>
                                <td>{r.ram_percent != null ? r.ram_percent.toFixed(1) : '—'}%</td>
                                <td>{r.temperature != null ? r.temperature.toFixed(1) : '—'}°C</td>
                                <td>{r.humidity != null ? r.humidity.toFixed(1) : '—'}%</td>
                                <td>{r.pressure != null ? r.pressure.toFixed(0) : '—'} hPa</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {sorted.length === 0 && <div className={styles.empty}>No telemetry data yet</div>}
            </div>
        </Container>
    )
}

export default TelemetryTimeline
