import React from 'react'

import type { StatusLevel } from '../../../utils/subsystemStatus'

import styles from './StatusBadge.module.scss'

interface Props {
    status: StatusLevel
    label?: string
}

const classByStatus: Record<StatusLevel, string> = {
    OK: 'ok',
    WARN: 'warn',
    CRITICAL: 'critical',
    UNKNOWN: 'unknown'
}

const defaultLabel: Record<StatusLevel, string> = {
    OK: 'OK',
    WARN: 'WARN',
    CRITICAL: 'CRIT',
    UNKNOWN: '—'
}

const StatusBadge: React.FC<Props> = ({ status, label }) => (
    <span className={`${styles.badge} ${styles[classByStatus[status]]}`}>
        <span className={styles.dot} />
        {label ?? defaultLabel[status]}
    </span>
)

export default StatusBadge
