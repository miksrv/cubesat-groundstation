import React, { lazy, Suspense } from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { AdcsStatus } from '../../features/telemetry/types'
import { useAttitudeRef } from '../../features/telemetry/useSource'
import { chartColors } from '../../styles/chartColors'

import styles from './Satellite3DView.module.scss'

interface Props {
    adcs: AdcsStatus | null
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

const Satellite3DView: React.FC<Props> = React.memo(({ adcs, isLoading }) => {
    const showSkeleton = isLoading && !adcs
    /*
      The scene reads this on its own animation frame. Deliberately not state:
      attitude arrives at 2 Hz and drives one imperative WebGL scene, so a
      dispatch and a render per sample would be a frame budget spent
      re-rendering a tree that did not change.
    */
    const attitudeRef = useAttitudeRef()

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
                            <Satellite3DScene
                                attitudeRef={attitudeRef}
                                accel={adcs?.accel ?? null}
                            />
                        </Suspense>
                    </div>
                    <div className={styles.values}>
                        <div className={styles.axis}>
                            <span className={styles.axisLabel}>Roll (X)</span>
                            <span className={styles.axisValue}>{adcs?.roll?.toFixed(1) ?? '—'}°</span>
                        </div>
                        <div className={styles.axis}>
                            <span className={styles.axisLabel}>Pitch (Y)</span>
                            <span className={styles.axisValue}>{adcs?.pitch?.toFixed(1) ?? '—'}°</span>
                        </div>
                        <div className={styles.axis}>
                            <span className={styles.axisLabel}>Yaw (Z)</span>
                            {/* Withheld, not missing: below magnetometer calibration 3 the
                                BNO055 reports a constant rather than a poor estimate. The
                                cube still turns correctly — the scene is driven by the
                                quaternion, which does not depend on the magnetometer. */}
                            <span className={styles.axisValue}>
                                {adcs?.yaw != null ? `${adcs.yaw.toFixed(1)}°` : 'withheld'}
                            </span>
                        </div>
                    </div>
                    <div className={styles.rates}>
                        <span>
                            ω<sub>x</sub> {fmtRate(adcs?.gyro.x)}°/s
                        </span>
                        <span>
                            ω<sub>y</sub> {fmtRate(adcs?.gyro.y)}°/s
                        </span>
                        <span>
                            ω<sub>z</sub> {fmtRate(adcs?.gyro.z)}°/s
                        </span>
                    </div>
                    <div className={styles.legend}>
                        <div className={styles.legendItem}>
                            <span
                                className={styles.legendColor}
                                style={{ background: AXIS.x }}
                            />
                            <span>X — body</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span
                                className={styles.legendColor}
                                style={{ background: AXIS.y }}
                            />
                            <span>Y — body</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span
                                className={styles.legendColor}
                                style={{ background: AXIS.z }}
                            />
                            <span>Z — body (camera)</span>
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
