import React, { lazy, Suspense, useState } from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { AttitudeUpdate } from '../../features/telemetry/source'
import type { AdcsStatus } from '../../features/telemetry/types'
import { useAttitudeRef } from '../../features/telemetry/useSource'

import AttitudeIndicator from './AttitudeIndicator'
import type { FrameCheck, HeadingFix } from './sceneContract'
import { ACCEL_COLOR, AXIS_COLOR, INITIAL_FRAME_CHECK, INITIAL_HEADING_FIX, sceneNotes } from './sceneContract'

import styles from './Satellite3DView.module.scss'

interface Props {
    adcs: AdcsStatus | null
    isLoading: boolean
    /** Overrides the live attitude channel — the mission timeline hands its own
     *  interpolated orientation here, so the scene replays the archive through
     *  exactly the path it renders the satellite. Absent means live. */
    attitude?: React.MutableRefObject<AttitudeUpdate | null>
}

// The three.js/@react-three/fiber scene is a heavy WebGL bundle — load it lazily
// so it isn't in the critical path for the rest of the dashboard.
const Satellite3DScene = lazy(() => import('./Satellite3DScene'))

const fmtRate = (n: number | null | undefined): string => (n != null ? n.toFixed(2) : '—')

const Satellite3DView: React.FC<Props> = React.memo(({ adcs, isLoading, attitude }) => {
    const showSkeleton = isLoading && !adcs
    /*
      The scene reads this on its own animation frame. Deliberately not state:
      attitude arrives at 2 Hz and drives one imperative WebGL scene, so a
      dispatch and a render per sample would be a frame budget spent
      re-rendering a tree that did not change.
    */
    const liveAttitudeRef = useAttitudeRef()
    const attitudeRef = attitude ?? liveAttitudeRef

    /*
      The scene's own verdict on whether its world frame survives contact with
      the accelerometer. It lives up here because it is read twice: as the
      dimming of the horizon inside the canvas, and as the words on the wrapper
      that say why it dimmed. Updated only when the verdict changes — see
      CubeSatModel.
    */
    const [frameCheck, setFrameCheck] = useState<FrameCheck>(INITIAL_FRAME_CHECK)
    /*
      Where north is, if anywhere. Read twice for the same reason the frame
      check is: as the presence or absence of letters on the compass ring inside
      the canvas, and as the words that say why they are absent. It is derived
      from the published yaw and the quaternion together — see `worldFrame.ts` —
      never assumed, and it is `withheld` for as long as the magnetometer is
      uncalibrated.
    */
    const [heading, setHeading] = useState<HeadingFix>(INITIAL_HEADING_FIX)

    /*
      No camera control in the header. The orientation gizmo inside the canvas
      is the camera control — its heads are the axis-aligned stations, and they
      keep the viewer's zoom — see OPENING_VIEWPOINT.
    */
    return (
        <Container
            title='3D Satellite View'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '280px', width: '100%' }} />}
            {!showSkeleton && (
                <>
                    {/* The scene draws both of its verdicts rather than
                        printing them — the horizon dims when the frame is
                        unconfirmed, the compass ring loses its letters when
                        there is no north — and neither picture can say why.
                        These are the words for that, out of the way until they
                        are asked for, and absent altogether when nothing is
                        being withheld. */}
                    <div
                        className={styles.canvasWrapper}
                        title={sceneNotes(frameCheck, heading)}
                    >
                        <Suspense fallback={<Skeleton style={{ height: '100%', width: '100%' }} />}>
                            <Satellite3DScene
                                attitudeRef={attitudeRef}
                                adcs={adcs}
                                frameCheck={frameCheck}
                                onFrameCheck={setFrameCheck}
                                heading={heading}
                                onHeading={setHeading}
                            />
                        </Suspense>
                        {/* Plain DOM over the WebGL surface: roll and pitch
                            without orbiting the camera, and with no scene to
                            lose if the context goes. */}
                        <AttitudeIndicator adcs={adcs} />
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
                    {/* Named for what is on the frame, not for a mission role
                        this craft does not have. The axis directions are the
                        BNO055's, bench-verified on the assembled satellite. */}
                    <div className={styles.legend}>
                        <div className={styles.legendItem}>
                            <span
                                className={styles.legendColor}
                                style={{ background: AXIS_COLOR.x }}
                            />
                            <span>X — camera looks −X</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span
                                className={styles.legendColor}
                                style={{ background: AXIS_COLOR.y }}
                            />
                            <span>Y — right side</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span
                                className={styles.legendColor}
                                style={{ background: AXIS_COLOR.z }}
                            />
                            <span>Z — top of frame</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span
                                className={styles.legendColor}
                                style={{ background: ACCEL_COLOR }}
                            />
                            {/* Named for what the sensor reports, not for what
                                a viewer expects to see: an accelerometer at rest
                                reads specific force, so a level satellite reads
                                +1 g along its own +Z and the arrow points *up*.
                                It is neither a thrust vector nor the direction
                                of gravity, and it was being read as both. */}
                            <span>Measured g — up at rest</span>
                        </div>
                    </div>
                </>
            )}
        </Container>
    )
})

Satellite3DView.displayName = 'Satellite3DView'
export default Satellite3DView
