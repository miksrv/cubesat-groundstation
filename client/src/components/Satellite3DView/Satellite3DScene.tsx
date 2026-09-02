import React, { Suspense, useEffect, useRef } from 'react'

import { GizmoHelper, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'

import type { AttitudeUpdate } from '../../features/telemetry/source'
import type { AdcsStatus } from '../../features/telemetry/types'

import CubeSatModel from './CubeSatModel'
import FrameCheckProbe from './FrameCheckProbe'
import HeadingProbe from './HeadingProbe'
import type { FrameCheck, HeadingFix, ViewpointRequest } from './sceneContract'
import { RESET_VIEWPOINT } from './sceneContract'
import WorldAxesGizmo from './WorldAxesGizmo'
import WorldReference from './WorldReference'

interface Props {
    attitudeRef: React.MutableRefObject<AttitudeUpdate | null>
    /** The whole status, not just the acceleration: the two audits in this
     *  chunk need the accelerometer, the published heading, the calibration
     *  that says whether that heading is a measurement, and the turn rate. */
    adcs: AdcsStatus | null
    /** The viewer's latest press of Reset. Owned by the widget so the button can
     *  live in the panel header without this chunk leaking into the main
     *  bundle. */
    viewpoint: ViewpointRequest
    /** Owned by the widget, because the same verdict is also spelled out on the
     *  canvas wrapper in plain DOM. Passed back down so the world reference can
     *  dim. */
    frameCheck: FrameCheck
    onFrameCheck: (check: FrameCheck) => void
    /** Owned by the widget for the same reason: the compass ring reads it here
     *  and the wrapper's title reads it there. */
    heading: HeadingFix
    onHeading: (fix: HeadingFix) => void
}

/**
 * OrbitControls plus the one fixed camera station.
 *
 * A component of its own, inside the Canvas, because the controls ref has to be
 * populated in the same commit that the effect reads it — r3f renders these
 * children into its own React root, so an effect in the outer component would
 * fire against a ref that is still null.
 */
const CameraRig: React.FC<{ viewpoint: ViewpointRequest }> = ({ viewpoint }) => {
    const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null)

    useEffect(() => {
        const instance = controls.current
        if (!instance) {
            return
        }
        // Snapped, not tweened: a tween would fight the viewer's own drag for
        // its whole duration, and the point of the button is to end an argument
        // about where the camera is, not to start one. (The gizmo tweens, and
        // should — it is answering a different question.)
        instance.object.position.set(...RESET_VIEWPOINT)
        instance.target.set(0, 0, 0)
        instance.update()
    }, [viewpoint])

    return (
        <OrbitControls
            ref={controls}
            // GizmoHelper reaches for the default controls when an axis head is
            // clicked, and throws outright if nothing has claimed the slot.
            makeDefault
            enableZoom
            enablePan={false}
            minDistance={1.5}
            // Far enough to frame the whole ground disc from the Top station:
            // the compass letters sit on its rim, and at 6 the rim was never
            // all in view at once.
            maxDistance={9}
        />
    )
}

// Canvas lives inside this component (not the other way around) so the whole
// chunk mounts as one unit once loaded — see the OrbitGroundTrack widget for
// why mounting Canvas eagerly with a lazy child behind Suspense causes WebGL
// context loss under React.StrictMode in development.
const Satellite3DScene: React.FC<Props> = ({
    attitudeRef,
    adcs,
    viewpoint,
    frameCheck,
    onFrameCheck,
    heading,
    onHeading
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
                camera={{ position: [...RESET_VIEWPOINT], fov: 40 }}
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
                    <WorldReference
                        status={frameCheck.status}
                        heading={heading}
                    />
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
                    <GizmoHelper
                        alignment='top-right'
                        // Unequal on purpose, to come out equal on screen. The
                        // margin places the gizmo's *origin*, and only the three
                        // positive ends are drawn, so the cluster is not centred
                        // on that origin: from the default station the topmost
                        // head (Z) reaches 37 px up while the rightmost (X)
                        // reaches 31 px across, so equal margins leave the right
                        // gap ~6 px wider than the top one — which reads as the
                        // gizmo floating away from the right edge. Taking that
                        // 6 px off the horizontal margin squares them up. Exact
                        // only for the station the widget opens on: the heads
                        // swing once the viewer drags, and no fixed margin can
                        // follow them.
                        margin={[46, 52]}
                    >
                        <WorldAxesGizmo />
                    </GizmoHelper>
                    <CameraRig viewpoint={viewpoint} />
                </Suspense>
            </Canvas>
        </>
    )
}

export default Satellite3DScene
