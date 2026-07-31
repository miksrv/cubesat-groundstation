import React from 'react'

import styles from './StatRow.module.scss'

interface Props {
    label: string
    value: React.ReactNode
    mono?: boolean
    accent?: 'green' | 'orange' | 'red' | 'main' | 'default'
}

const accentClass: Record<NonNullable<Props['accent']>, string> = {
    green: 'accentGreen',
    orange: 'accentOrange',
    red: 'accentRed',
    main: 'accentMain',
    default: ''
}

const StatRow: React.FC<Props> = ({ label, value, mono = false, accent = 'default' }) => (
    <div className={styles.row}>
        <span className={styles.label}>{label}</span>
        <span
            className={`${styles.value} ${mono ? styles.mono : ''} ${
                accent !== 'default' ? styles[accentClass[accent]] : ''
            }`}
        >
            {value}
        </span>
    </div>
)

export default StatRow
