import React from 'react'

import type { TelemetryRecord } from '../../features/telemetry/types'

import styles from './TelemetryTimeline.module.scss'

interface Props {
    history: TelemetryRecord[]
    isLoading: boolean
}

const OBC_COLORS: Record<string, string> = {
    NOMINAL: '#10b981',
    SCIENCE: '#3b82f6',
    DEPLOY: '#f59e0b',
    LOW_POWER: '#f59e0b',
    SAFE: '#ef4444',
    BOOT: '#94a3b8'
}

const TelemetryTimeline: React.FC<Props> = ({ history, isLoading }) => {
    const sorted = [...history].sort(
        (a, b) =>
            new Date(b.timestamp.replace(' ', 'T')).getTime() - new Date(a.timestamp.replace(' ', 'T')).getTime()
    )

    if (isLoading && history.length === 0) {
        return (
            <div className={styles.panel}>
                <div className={styles.skeleton} />
            </div>
        )
    }

    return (
        <div className={styles.panel}>
            <h3 className={styles.title}>📋 Telemetry Timeline</h3>
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
                                <td>{new Date(r.timestamp.replace(' ', 'T')).toLocaleString()}</td>
                                <td>
                                    <span
                                        className={styles.badge}
                                        style={{
                                            background: OBC_COLORS[r.obc_state ?? ''] ?? '#94a3b8'
                                        }}
                                    >
                                        {r.obc_state ?? '—'}
                                    </span>
                                </td>
                                <td>{r.battery != null ? Number(r.battery).toFixed(1) : '—'}%</td>
                                <td>{r.voltage != null ? Number(r.voltage).toFixed(2) : '—'} V</td>
                                <td>{r.cpu_percent != null ? Number(r.cpu_percent).toFixed(1) : '—'}%</td>
                                <td>{r.ram_percent != null ? Number(r.ram_percent).toFixed(1) : '—'}%</td>
                                <td>{r.temperature != null ? Number(r.temperature).toFixed(1) : '—'}°C</td>
                                <td>{r.humidity != null ? Number(r.humidity).toFixed(1) : '—'}%</td>
                                <td>{r.pressure != null ? Number(r.pressure).toFixed(0) : '—'} hPa</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {sorted.length === 0 && <div className={styles.empty}>No telemetry data yet</div>}
            </div>
        </div>
    )
}

export default TelemetryTimeline
