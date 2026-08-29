import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { LiveState, TelemetryRecord } from '../../features/telemetry/types'
import { getObcStatus } from '../../utils/subsystemStatus'
import StatusBadge from '../common/StatusBadge/StatusBadge'

import styles from './OBCSystemWidget.module.scss'

interface Props {
    live: LiveState
    /**
     * The newest recorded row. CPU, RAM and disk are not on any status topic —
     * only DHS records them — so these numbers are up to one DHS cadence old
     * (30 s in NOMINAL) and absent entirely while no mission is being recorded.
     */
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

/**
 * "Boot count" used to sit at the bottom of this widget. Nothing on the
 * satellite counts boots, so the row is gone rather than dashed out — the
 * profile and the mission state are what actually say what the computer is
 * doing, and they were not shown at all.
 */
const OBCSystemWidget: React.FC<Props> = React.memo(({ live, latest, isLoading }) => {
    const showSkeleton = isLoading && !live.obc
    const status = getObcStatus(live, latest)

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
                        percent={latest?.cpuPercent ?? null}
                    />
                    <UsageBar
                        label='RAM Usage'
                        percent={latest?.ramPercent ?? null}
                    />
                    <UsageBar
                        label='Storage Usage'
                        percent={latest?.diskPercent ?? null}
                    />
                    <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Uptime</span>
                        <span className={styles.metaValue}>{formatUptime(latest?.uptimeSeconds)}</span>
                    </div>
                    <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Mission state</span>
                        <span className={styles.metaValue}>{live.obc?.status ?? '—'}</span>
                    </div>
                    <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Profile</span>
                        <span className={styles.metaValue}>{live.host?.profile ?? live.obc?.profile ?? '—'}</span>
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

OBCSystemWidget.displayName = 'OBCSystemWidget'
export default OBCSystemWidget
