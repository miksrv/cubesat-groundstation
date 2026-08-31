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

/** Resource thresholds: the same numbers `getObcStatus` warns at, one step
 *  earlier for the eye — a bar should go orange before the badge does. */
const usageLevel = (percent: number | null): 'ok' | 'warn' | 'critical' => {
    if (percent == null) {
        return 'ok'
    }
    return percent >= 90 ? 'critical' : percent >= 75 ? 'warn' : 'ok'
}

const UsageBar: React.FC<{ label: string; percent: number | null }> = ({ label, percent }) => {
    const level = usageLevel(percent)
    return (
        <div className={styles.usageRow}>
            <div className={styles.usageHeader}>
                <span className={styles.usageLabel}>{label}</span>
                <span
                    className={`${styles.usageValue} ${
                        level === 'critical' ? styles.valueCritical : level === 'warn' ? styles.valueWarn : ''
                    }`}
                >
                    {percent != null ? `${percent.toFixed(0)}%` : '—'}
                </span>
            </div>
            <div className={styles.barTrack}>
                <div
                    className={`${styles.barFill} ${
                        level === 'critical' ? styles.barCritical : level === 'warn' ? styles.barWarn : ''
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}
                />
            </div>
        </div>
    )
}

const MetaRow: React.FC<{ label: string; value: React.ReactNode; warn?: boolean; title?: string }> = ({
    label,
    value,
    warn = false,
    title
}) => (
    <div
        className={styles.metaRow}
        title={title}
    >
        <span className={styles.metaLabel}>{label}</span>
        <span className={`${styles.metaValue} ${warn ? styles.metaWarn : ''}`}>{value}</span>
    </div>
)

/**
 * "Boot count" used to sit at the bottom of this widget. Nothing on the
 * satellite counts boots, so the row is gone rather than dashed out — the
 * profile and the mission state are what actually say what the computer is
 * doing, and they were not shown at all.
 *
 * The lower half is deliberately just the two state machines: mission state
 * and profile — with the requested profile alongside when a switch only
 * partly applied, because that difference is the whole debugging story of a
 * failed switch. Cadence, persistence, the governor and the profile TTL were
 * rows here once and are gone: all of them are functions of the profile that
 * change only when it does, and five near-constant rows made this the tallest
 * card in the row. The unit inventory rides the Profile row as a hover title.
 */
const OBCSystemWidget: React.FC<Props> = React.memo(({ live, latest, isLoading }) => {
    const showSkeleton = isLoading && !live.obc
    const status = getObcStatus(live, latest)

    const applied = live.host?.profile ?? live.obc?.profile ?? null
    const requested = live.host?.profileRequested ?? null
    // A profile that applied only partly: HOSTD says what it is actually
    // running apart from what was asked. Collapsing the two hides the fault.
    const partial = requested != null && applied != null && requested !== applied
    const units = live.host?.units ?? null
    const unitsTitle =
        units && Object.keys(units).length > 0
            ? Object.entries(units)
                  .map(([unit, state]) => `${unit}: ${state}`)
                  .join('\n')
            : undefined

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
                    {/* Swap in use means RAM already ran out once — on a Pi it
                        is also SD-card wear, which is this satellite's fuel. */}
                    <UsageBar
                        label='Swap Usage'
                        percent={latest?.swapPercent ?? null}
                    />
                    <MetaRow
                        label='Uptime'
                        value={formatUptime(latest?.uptimeSeconds)}
                    />
                    <MetaRow
                        label='Mission state'
                        value={live.obc?.status ?? '—'}
                    />
                    <MetaRow
                        label='Profile'
                        value={partial ? `${applied} — requested ${requested}` : (applied ?? '—')}
                        warn={partial}
                        title={unitsTitle}
                    />
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
