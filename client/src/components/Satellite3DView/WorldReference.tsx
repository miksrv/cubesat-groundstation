import React from 'react'
import * as THREE from 'three'

import { ContactShadows, Grid } from '@react-three/drei'

import { chartColors } from '../../styles/chartColors'

import CompassRing from './CompassRing'
import type { FrameCheckStatus, HeadingFix } from './sceneContract'

/**
 * Everything in this file is drawn in **scene-world coordinates and must stay
 * outside the rotating group**. It is the fixed world the satellite turns
 * inside; the moment any of it inherits the attitude quaternion the widget is
 * back to a cube spinning against nothing, which is the bug this exists to fix.
 */

/** How far below the body the floor sits: clear of the 0.25 half-cube and of
 *  the axis tripod when the satellite is upside down, close enough that the
 *  contact shadow still reads as contact rather than as a smudge.
 *
 *  Local to this file: the floor is the only thing that stands on these two
 *  numbers. The compass is drawn against them too, but it receives them as
 *  props rather than importing a ground of its own. */
const GROUND_Y = -0.9
const GROUND_RADIUS = 3.2

const HORIZON_OK = chartColors.grey[1]
const HORIZON_ALERT = chartColors.orange[0]

interface Props {
    /** Dims the whole reference when the frame could not be confirmed against
     *  the accelerometer. A confident floor drawn on an unconfirmed frame is a
     *  confident wrong number with a horizon painted on it. */
    status: FrameCheckStatus
    /** Whether the disc may carry compass letters, and where north is if it
     *  may. Derived, never assumed — see `worldFrame.ts`. */
    heading: HeadingFix
}

const WorldReference: React.FC<Props> = ({ status, heading }) => {
    const unverified = status === 'unverified'
    const horizonColor = unverified ? HORIZON_ALERT : HORIZON_OK
    const horizonOpacity = unverified ? 0.35 : 0.9

    return (
        <group>
            {/* An opaque floor rather than a bare grid: it gives the horizon a
                body, and it is what the contact shadow lands on. */}
            <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, GROUND_Y, 0]}
            >
                <circleGeometry args={[GROUND_RADIUS, 64]} />
                <meshBasicMaterial
                    color='#0b1014'
                    transparent
                    opacity={unverified ? 0.55 : 0.92}
                />
            </mesh>

            {/* The grid is the scale reference — one cell is half the drawn
                body, one section two body widths. drei's Grid swizzles its own
                plane flat, so it takes no rotation of its own. `fadeFrom={0}`
                measures the fade from the world origin rather than from the
                camera, so the grid always thins out towards the horizon ring
                instead of towards wherever the viewer happens to be standing. */}
            <Grid
                position={[0, GROUND_Y + 0.002, 0]}
                args={[GROUND_RADIUS * 2, GROUND_RADIUS * 2]}
                cellSize={0.25}
                cellThickness={0.5}
                cellColor={unverified ? '#242a30' : '#2b3440'}
                sectionSize={1}
                sectionThickness={1}
                sectionColor={unverified ? '#39434c' : '#41586b'}
                fadeDistance={5}
                fadeStrength={1}
                fadeFrom={0}
                side={THREE.DoubleSide}
                // A grid is not a claim about the terrain; it is a ruler.
                infiniteGrid={false}
            />

            {/* The horizon proper: the rim of the floor. This is the line the
                viewer reads tilt against, so it is the thing that dims. */}
            <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, GROUND_Y + 0.004, 0]}
            >
                <ringGeometry args={[GROUND_RADIUS - 0.025, GROUND_RADIUS, 128]} />
                <meshBasicMaterial
                    color={horizonColor}
                    transparent
                    opacity={horizonOpacity}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Cheap, and it does more for legibility than any label: a body
                that has rolled throws a shadow that is no longer square under
                it, which reads instantly and at any camera angle. It renders
                its own depth pass, so the Canvas needs no shadow map and no
                light here casts one. */}
            <ContactShadows
                position={[0, GROUND_Y + 0.006, 0]}
                scale={3.4}
                resolution={512}
                blur={2.4}
                far={2.2}
                opacity={unverified ? 0.3 : 0.6}
                color='#000000'
            />

            {/* The compass: cardinal letters and ticks around this disc's rim,
                drawn only when the magnetometer reads 3/3 *and* the published
                heading reconciles with the quaternion — below full calibration
                the BNO055 reports a constant heading, and a disc lettered from
                a constant is a compass that points the same way whichever way
                the satellite is facing. `CompassRing` says how north is found. */}
            <CompassRing
                heading={heading}
                groundY={GROUND_Y}
                groundRadius={GROUND_RADIUS}
            />
        </group>
    )
}

export default WorldReference
