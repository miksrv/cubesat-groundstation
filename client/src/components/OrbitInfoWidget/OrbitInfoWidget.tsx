import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { OrbitState } from '../../features/telemetry/types'
import StatRow from '../common/StatRow/StatRow'

import styles from './OrbitInfoWidget.module.scss'

interface Props {
    orbit: OrbitState | null
}

const OrbitInfoWidget: React.FC<Props> = React.memo(({ orbit }) => (
    <Container
        title='Orbit Info'
        className={styles.panel}
    >
        {!orbit && <Skeleton style={{ height: '160px', width: '100%' }} />}
        {orbit && (
            <div className={styles.body}>
                <StatRow
                    label='Orbit Type'
                    value={orbit.orbit_type}
                />
                <StatRow
                    label='Altitude'
                    value={`${orbit.altitude_km.toFixed(1)} km`}
                    mono
                />
                <StatRow
                    label='Inclination'
                    value={`${orbit.inclination_deg.toFixed(2)}°`}
                    mono
                />
                <StatRow
                    label='Period'
                    value={`${orbit.period_min.toFixed(2)} min`}
                    mono
                />
                <StatRow
                    label='RAAN'
                    value={`${orbit.raan_deg.toFixed(2)}°`}
                    mono
                />
                <StatRow
                    label='AOP'
                    value={`${orbit.aop_deg.toFixed(2)}°`}
                    mono
                />
                <StatRow
                    label='True Anomaly'
                    value={`${orbit.true_anomaly_deg.toFixed(2)}°`}
                    mono
                />
            </div>
        )}
    </Container>
))

OrbitInfoWidget.displayName = 'OrbitInfoWidget'
export default OrbitInfoWidget
