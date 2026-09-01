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
    FAIL: 'fail',
    OFF: 'off',
    UNKNOWN: 'unknown'
}

const defaultLabel: Record<StatusLevel, string> = {
    OK: 'OK',
    WARN: 'WARN',
    FAIL: 'FAIL',
    OFF: 'OFF',
    // In words, not a dash: UNKNOWN is a finding too ("nothing reported yet"),
    // and it must not be confusable with OFF, which claims the profile never
    // started the service. A replayed mission shows this for COMMS — the
    // export records the link's process, never its device.
    UNKNOWN: 'NO DATA'
}

const StatusBadge: React.FC<Props> = ({ status, label }) => (
    <span className={`${styles.badge} ${styles[classByStatus[status]]}`}>
        <span className={styles.dot} />
        {label ?? defaultLabel[status]}
    </span>
)

export default StatusBadge
