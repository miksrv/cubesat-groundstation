import React, { Suspense } from 'react'

import { GizmoHelper, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'

import type { AttitudeUpdate } from '../../features/telemetry/source'
import type { AdcsStatus } from '../../features/telemetry/types'

import CubeSatModel from './CubeSatModel'
import FrameCheckProbe from './FrameCheckProbe'
import HeadingProbe from './HeadingProbe'
import type { FrameCheck, HeadingFix } from './sceneContract'
import { OPENING_VIEWPOINT } from './sceneContract'
import WorldAxesGizmo from './WorldAxesGizmo'
import WorldReference from './WorldReference'

interface Props {
    attitudeRef: React.MutableRefObject<AttitudeUpdate | null>
    /** The whole status, not just the acceleration: the two audits in this
     *  chunk need the accelerometer, the published heading, the calibration
     *  that says whether that heading is a measurement, and the turn rate. */
    adcs: AdcsStatus | null
    /** Owned by the widget, because the same verdict is also spelled out on the
     *  canvas wrapper in plain DOM. Passed back down so the world reference can
     *  dim. */
    frameCheck: FrameCheck
    onFrameCheck: (check: FrameCheck) => void
    /** Owned by the widget for the same reason: the compass ring reads it here
     *  and the wrapper's title reads it there. */
    heading: HeadingFix
    onHeading: (fix: HeadingFix) => void
    /** Owned by the widget, where the switch for it is. Off means the corner
     *  triad is not drawn — and with it goes the only way back to an
     *  axis-aligned camera station, which is why it is on until asked. */
    showGizmo: boolean
    /** Owned by the widget for the same reason. Off means no floor, no grid, no
     *  horizon rim and no compass letters — and so no *picture* of either
     *  verdict. The words for both stay on the canvas wrapper, which is why
     *  hiding it withholds nothing. */
    showGround: boolean
}

// Canvas lives inside this component (not the other way around) so the whole
// chunk mounts as one unit once loaded — see the OrbitGroundTrack widget for
// why mounting Canvas eagerly with a lazy child behind Suspense causes WebGL
// context loss under React.StrictMode in development.
const Satellite3DScene: React.FC<Props> = ({
    attitudeRef,
    adcs,
    frameCheck,
    onFrameCheck,
    heading,
    onHeading,
    showGizmo,
    showGround
}) => {
    return (
        <>
            {/* Outside the Canvas on purpose: both audits are arithmetic on
                telemetry, not scene objects, and they have no business on the
                render loop. They are in this chunk only because they need
                three.js. */}
            <FrameCheckProbe
                attitudeRef={attitudeRef}
                accel={adcs?.accel ?? null}
                onCheck={onFrameCheck}
            />
            <HeadingProbe
                attitudeRef={attitudeRef}
                adcs={adcs}
                onFix={onHeading}
            />
            <Canvas
                camera={{ position: [...OPENING_VIEWPOINT], fov: 40 }}
                gl={{ powerPreference: 'default' }}
            >
                <Suspense fallback={null}>
                    <ambientLight intensity={0.45} />
                    <directionalLight
                        position={[3, 4, 2]}
                        intensity={1.3}
                    />
                    {/*
                        The Stars backdrop that used to sit here is gone. It was
                        an unanchored sphere around the camera, so it read
                        through the grid and filled the space *below* the floor
                        with sky — which is precisely the reference the ground
                        plane is here to give. A plain dark background loses
                        nothing, and the horizon reads.
                    */}
                    {showGround && (
                        <WorldReference
                            status={frameCheck.status}
                            heading={heading}
                        />
                    )}
                    <CubeSatModel
                        attitudeRef={attitudeRef}
                        accel={adcs?.accel ?? null}
                    />
                    {/* Once the camera has been dragged, this is what still
                        says which way the world is — and, because its heads are
                        clickable, the only control that puts the camera back on
                        an axis: Z for overhead, X and Y for the two side-on
                        eyes. Top-right, because the attitude indicator holds the
                        opposite corner of the same canvas.

                        It draws the *sensor's* world frame — Z up, as both the
                        BNO055 and Blender have it — in the cube's own three
                        colours, so the corner triad and the triad on the body
                        are the same three axes seen twice. `WorldAxesGizmo` says
                        why that cannot be drei's `GizmoViewport`. */}
                    {showGizmo && (
                        <GizmoHelper
                            alignment='top-right'
                            // Unequal on purpose, to come out equal on screen.
                            // The margin places the gizmo's *origin*, and only
                            // the three positive ends are drawn, so the cluster
                            // is not centred on that origin: from the default
                            // station the topmost head (Z) reaches 37 px up
                            // while the rightmost (X) reaches 31 px across, so
                            // equal margins leave the right gap ~6 px wider than
                            // the top one — which reads as the gizmo floating
                            // away from the right edge. Taking that 6 px off the
                            // horizontal margin squares them up. Exact only for
                            // the station the widget opens on: the heads swing
                            // once the viewer drags, and no fixed margin can
                            // follow them.
                            margin={[46, 52]}
                        >
                            <WorldAxesGizmo />
                        </GizmoHelper>
                    )}
                    {/* The only camera control besides the gizmo's heads: drag
                        to orbit, wheel to zoom. Nothing puts the camera back to
                        where it opened — the gizmo's three stations are the way
                        back from a stray drag, and they keep the viewer's zoom. */}
                    <OrbitControls
                        // GizmoHelper reaches for the default controls when an
                        // axis head is clicked, and throws outright if nothing
                        // has claimed the slot.
                        makeDefault
                        enableZoom
                        enablePan={false}
                        minDistance={1.5}
                        // Far enough to frame the whole ground disc from the
                        // Top station: the compass letters sit on its rim, and
                        // at 6 the rim was never all in view at once.
                        maxDistance={9}
                    />
                </Suspense>
            </Canvas>
        </>
    )
}

export default Satellite3DScene
