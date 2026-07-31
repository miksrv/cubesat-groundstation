import React, { lazy, Suspense } from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { TelemetryRecord } from '../../features/telemetry/types'
import { chartColors } from '../../styles/chartColors'

import styles from './Satellite3DView.module.scss'

interface Props {
    latest: TelemetryRecord | null
    isLoading: boolean
}

const AXIS = {
    x: chartColors.red[0],
    y: chartColors.green[0],
    z: chartColors.blue[0]
}
const ACCEL_COLOR = chartColors.orange[0]

// The three.js/@react-three/fiber scene is a heavy WebGL bundle — load it lazily
// so it isn't in the critical path for the rest of the dashboard.
const Satellite3DScene = lazy(() => import('./Satellite3DScene'))

const fmtRate = (n: number | null | undefined): string => (n != null ? n.toFixed(2) : '—')

const Satellite3DView: React.FC<Props> = React.memo(({ latest, isLoading }) => {
    const showSkeleton = isLoading && !latest

    return (
        <Container
            title='3D Satellite View'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '280px', width: '100%' }} />}
            {!showSkeleton && (
                <>
                    <div className={styles.canvasWrapper}>
                        <Suspense fallback={<Skeleton style={{ height: '100%', width: '100%' }} />}>
                            <Satellite3DScene latest={latest} />
                        </Suspense>
                    </div>
                    <div className={styles.values}>
                        <div className={styles.axis}>
                            <span className={styles.axisLabel}>Roll (X)</span>
                            <span className={styles.axisValue}>{latest?.roll?.toFixed(1) ?? '—'}°</span>
                        </div>
                        <div className={styles.axis}>
                            <span className={styles.axisLabel}>Pitch (Y)</span>
                            <span className={styles.axisValue}>{latest?.pitch?.toFixed(1) ?? '—'}°</span>
                        </div>
                        <div className={styles.axis}>
                            <span className={styles.axisLabel}>Yaw (Z)</span>
                            <span className={styles.axisValue}>{latest?.yaw?.toFixed(1) ?? '—'}°</span>
                        </div>
                    </div>
                    <div className={styles.rates}>
                        <span>
                            ω<sub>x</sub> {fmtRate(latest?.gyro_x)}°/s
                        </span>
                        <span>
                            ω<sub>y</sub> {fmtRate(latest?.gyro_y)}°/s
                        </span>
                        <span>
                            ω<sub>z</sub> {fmtRate(latest?.gyro_z)}°/s
                        </span>
                    </div>
                    <div className={styles.legend}>
                        <div className={styles.legendItem}>
                            <span
                                className={styles.legendColor}
                                style={{ background: AXIS.x }}
                            />
                            <span>X — Velocity</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span
                                className={styles.legendColor}
                                style={{ background: AXIS.y }}
                            />
                            <span>Y — Orbit Normal</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span
                                className={styles.legendColor}
                                style={{ background: AXIS.z }}
                            />
                            <span>Z — Nadir</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span
                                className={styles.legendColor}
                                style={{ background: ACCEL_COLOR }}
                            />
                            <span>Measured g</span>
                        </div>
                    </div>
                </>
            )}
        </Container>
    )
})

Satellite3DView.displayName = 'Satellite3DView'
export default Satellite3DView
