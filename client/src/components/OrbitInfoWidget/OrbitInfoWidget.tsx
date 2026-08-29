import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { OrbitState } from '../../features/orbit/simulate'
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
                    value={orbit.orbitType}
                />
                <StatRow
                    label='Altitude'
                    value={`${orbit.altitudeKm.toFixed(1)} km`}
                    mono
                />
                <StatRow
                    label='Inclination'
                    value={`${orbit.inclinationDeg.toFixed(2)}°`}
                    mono
                />
                <StatRow
                    label='Period'
                    value={`${orbit.periodMin.toFixed(2)} min`}
                    mono
                />
                <StatRow
                    label='RAAN'
                    value={`${orbit.raanDeg.toFixed(2)}°`}
                    mono
                />
                <StatRow
                    label='AOP'
                    value={`${orbit.aopDeg.toFixed(2)}°`}
                    mono
                />
                <StatRow
                    label='True Anomaly'
                    value={`${orbit.trueAnomalyDeg.toFixed(2)}°`}
                    mono
                />
            </div>
        )}
    </Container>
))

OrbitInfoWidget.displayName = 'OrbitInfoWidget'
export default OrbitInfoWidget
