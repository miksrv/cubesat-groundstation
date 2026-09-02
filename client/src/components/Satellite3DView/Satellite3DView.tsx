import React, { lazy, Suspense, useState } from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { AttitudeUpdate } from '../../features/telemetry/source'
import type { AdcsStatus } from '../../features/telemetry/types'
import { useAttitudeRef } from '../../features/telemetry/useSource'

import AttitudeIndicator from './AttitudeIndicator'
import type { FrameCheck, HeadingFix } from './sceneContract'
import { INITIAL_FRAME_CHECK, INITIAL_HEADING_FIX, sceneNotes } from './sceneContract'

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

interface ToggleProps {
    label: string
    /** Why a viewer would turn it off — the overlays are legible, not obvious. */
    hint: string
    checked: boolean
    onChange: (next: boolean) => void
}

/**
 * One switch over the canvas' two overlays.
 *
 * A real checkbox with `role='switch'`, not a div that listens for clicks: the
 * label is the accessible name, the space bar works, and the focus ring is the
 * browser's. It is local to this widget because it is the only place in the
 * dashboard that has anything to switch.
 */
const SceneToggle: React.FC<ToggleProps> = ({ label, hint, checked, onChange }) => (
    <label
        className={styles.toggle}
        title={hint}
    >
        <input
            type='checkbox'
            role='switch'
            className={styles.toggleInput}
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
        />
        <span
            className={styles.toggleTrack}
            aria-hidden='true'
        >
            <span className={styles.toggleThumb} />
        </span>
        <span className={styles.toggleLabel}>{label}</span>
    </label>
)

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
      What is drawn *around* the satellite, rather than what is known about it.
      All three are annotations on the same small canvas — the artificial
      horizon holds one corner, the orientation gizmo the other, the ground disc
      the space the cube stands in — and on the narrowest column of the top row
      they cover a fair share of the thing they annotate. So they are
      switchable, and on by default: a viewer who has not touched anything still
      gets all three.

      No switch here withholds telemetry. Every one of the three hides something
      the widget also says in words — roll and pitch under the canvas, the axis
      names on the gizmo's own heads, both scene verdicts on the wrapper — so
      turning one off hides an annotation and never a measurement.
    */
    const [showHorizon, setShowHorizon] = useState(true)
    const [showGizmo, setShowGizmo] = useState(true)
    /*
      The ground disc is the third, and the one with a caveat: it is also where
      the scene *draws* its two verdicts — the rim dims when the frame is
      unconfirmed, the rim goes unlettered when there is no north. Taking it off
      does not silence them, because the words for both are on the canvas
      wrapper either way; it only takes away the picture of them.
    */
    const [showGround, setShowGround] = useState(true)

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
                                showGizmo={showGizmo}
                                showGround={showGround}
                            />
                        </Suspense>
                        {/* Plain DOM over the WebGL surface: roll and pitch
                            without orbiting the camera, and with no scene to
                            lose if the context goes. */}
                        {showHorizon && <AttitudeIndicator adcs={adcs} />}
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
                    {/* The three overlays, one per row. What used to be here
                        was a colour key for the body triad — three lines
                        naming axes the gizmo in the corner already labels, and
                        a fourth for the accelerometer arrow. The scene says all
                        four in the picture; these say what may be taken off it. */}
                    <div className={styles.sceneToggles}>
                        <SceneToggle
                            label='Artificial horizon'
                            hint='The dial in the top-left corner. Roll and pitch stay printed below the canvas either way.'
                            checked={showHorizon}
                            onChange={setShowHorizon}
                        />
                        <SceneToggle
                            label='Orientation gizmo'
                            hint='The axis triad in the top-right corner, whose heads are also the camera stations.'
                            checked={showGizmo}
                            onChange={setShowGizmo}
                        />
                        <SceneToggle
                            label='Ground reference'
                            hint='The grid disc under the satellite, its horizon rim and the compass letters on it. The rim is also where an unconfirmed frame and a withheld north are drawn — the wrapper still says both in words.'
                            checked={showGround}
                            onChange={setShowGround}
                        />
                    </div>
                </>
            )}
        </Container>
    )
})

Satellite3DView.displayName = 'Satellite3DView'
export default Satellite3DView
