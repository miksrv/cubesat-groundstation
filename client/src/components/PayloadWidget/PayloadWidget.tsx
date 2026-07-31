import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { TelemetryRecord } from '../../features/telemetry/types'
import { getPayloadStatus } from '../../utils/subsystemStatus'
import StatRow from '../common/StatRow/StatRow'
import StatusBadge from '../common/StatusBadge/StatusBadge'

import styles from './PayloadWidget.module.scss'

interface Props {
    latest: TelemetryRecord | null
    isLoading: boolean
}

const PayloadWidget: React.FC<Props> = React.memo(({ latest, isLoading }) => {
    const showSkeleton = isLoading && !latest
    const status = getPayloadStatus(latest)

    return (
        <Container
            title='Payload'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '200px', width: '100%' }} />}
            {!showSkeleton && (
                <div className={styles.body}>
                    <StatRow
                        label='Camera Status'
                        value={latest?.camera_status ?? '—'}
                        accent='main'
                    />
                    <StatRow
                        label='Image Count'
                        value={latest?.image_count ?? '—'}
                        mono
                    />
                    <StatRow
                        label='Image Resolution'
                        value={latest?.image_resolution ?? '—'}
                        mono
                    />
                    <StatRow
                        label='Sensor Status'
                        value={latest?.sensor_status ?? '—'}
                    />
                    <StatRow
                        label='Science Mode'
                        value={latest?.science_mode ? 'Enabled' : 'Disabled'}
                        accent={latest?.science_mode ? 'green' : 'default'}
                    />
                    <StatRow
                        label='Payload Power'
                        value={latest?.payload_power_watts != null ? `${latest.payload_power_watts.toFixed(2)} W` : '—'}
                        mono
                    />
                    <div className={styles.footer}>
                        <span className={styles.footerLabel}>Payload Status</span>
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

PayloadWidget.displayName = 'PayloadWidget'
export default PayloadWidget
