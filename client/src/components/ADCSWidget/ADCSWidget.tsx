import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { TelemetryRecord } from '../../features/telemetry/types'
import { getAdcsStatus } from '../../utils/subsystemStatus'
import StatRow from '../common/StatRow/StatRow'
import StatusBadge from '../common/StatusBadge/StatusBadge'

import styles from './ADCSWidget.module.scss'

interface Props {
    latest: TelemetryRecord | null
    isLoading: boolean
}

const fmtDeg = (v: number | null | undefined): string => (v != null ? `${v.toFixed(2)}°` : '—')
const fmtRate = (v: number | null | undefined): string => (v != null ? `${v.toFixed(2)}°/s` : '—')

const ADCSWidget: React.FC<Props> = React.memo(({ latest, isLoading }) => {
    const showSkeleton = isLoading && !latest
    const status = getAdcsStatus(latest)

    return (
        <Container
            title='ADCS'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '200px', width: '100%' }} />}
            {!showSkeleton && (
                <div className={styles.body}>
                    <StatRow
                        label='Roll'
                        value={fmtDeg(latest?.roll)}
                        mono
                    />
                    <StatRow
                        label='Pitch'
                        value={fmtDeg(latest?.pitch)}
                        mono
                    />
                    <StatRow
                        label='Yaw'
                        value={fmtDeg(latest?.yaw)}
                        mono
                    />
                    <StatRow
                        label='Angular Rate X'
                        value={fmtRate(latest?.gyro_x)}
                        mono
                    />
                    <StatRow
                        label='Angular Rate Y'
                        value={fmtRate(latest?.gyro_y)}
                        mono
                    />
                    <StatRow
                        label='Angular Rate Z'
                        value={fmtRate(latest?.gyro_z)}
                        mono
                    />
                    <div className={styles.footer}>
                        <span className={styles.footerLabel}>ADCS Status</span>
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

ADCSWidget.displayName = 'ADCSWidget'
export default ADCSWidget
