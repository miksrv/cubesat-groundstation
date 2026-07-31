import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { TelemetryRecord } from '../../features/telemetry/types'
import { getObcStatus } from '../../utils/subsystemStatus'
import StatusBadge from '../common/StatusBadge/StatusBadge'

import styles from './OBCSystemWidget.module.scss'

interface Props {
    latest: TelemetryRecord | null
    isLoading: boolean
}

const formatUptime = (seconds: number | null | undefined): string => {
    if (seconds == null) {
        return '—'
    }
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`
}

const UsageBar: React.FC<{ label: string; percent: number | null }> = ({ label, percent }) => (
    <div className={styles.usageRow}>
        <div className={styles.usageHeader}>
            <span className={styles.usageLabel}>{label}</span>
            <span className={styles.usageValue}>{percent != null ? `${percent.toFixed(0)}%` : '—'}</span>
        </div>
        <div className={styles.barTrack}>
            <div
                className={styles.barFill}
                style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}
            />
        </div>
    </div>
)

const OBCSystemWidget: React.FC<Props> = React.memo(({ latest, isLoading }) => {
    const showSkeleton = isLoading && !latest
    const status = getObcStatus(latest)

    return (
        <Container
            title='On-Board Computer'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '200px', width: '100%' }} />}
            {!showSkeleton && (
                <div className={styles.body}>
                    <UsageBar
                        label='CPU Usage'
                        percent={latest?.cpu_percent ?? null}
                    />
                    <UsageBar
                        label='RAM Usage'
                        percent={latest?.ram_percent ?? null}
                    />
                    <UsageBar
                        label='Storage Usage'
                        percent={latest?.disk_percent ?? null}
                    />
                    <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Uptime</span>
                        <span className={styles.metaValue}>{formatUptime(latest?.uptime_seconds)}</span>
                    </div>
                    <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Boot Count</span>
                        <span className={styles.metaValue}>{latest?.boot_count ?? '—'}</span>
                    </div>
                    <div className={styles.footer}>
                        <span className={styles.footerLabel}>Health</span>
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

OBCSystemWidget.displayName = 'OBCSystemWidget'
export default OBCSystemWidget
