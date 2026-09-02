import React from 'react'

import { Billboard, Text } from '@react-three/drei'

import { chartColors } from '../../styles/chartColors'

import type { HeadingFix } from './sceneContract'
import { compassPoints } from './sceneContract'

/**
 * The compass: N / E / S / W around the rim of the ground disc — **only** when
 * the satellite is publishing a heading and that heading has been reconciled
 * with the attitude quaternion. See `worldFrame.ts` ({@link NorthEstimator})
 * for how north is derived and what would disprove it, and `sceneContract.ts`
 * ({@link compassPoints}) for the rule that decides whether there are any
 * letters at all. On every other status this component draws nothing: the disc
 * and its horizon rim are `WorldReference`'s, and they are there regardless.
 *
 * Everything here is **scene-world and stays outside the rotating group**. The
 * disc is the thing the satellite turns *above*; a compass that rotated with
 * the body would be a compass that always pointed the same way.
 *
 * It sits on the ground disc rather than on a ring of its own through the body,
 * where an earlier version put it. That ring was on screen from the default
 * station, which the disc's rim is not — but it was a second circle with no
 * physical meaning, floating at the body's own height, and the viewer reads
 * the gridded disc as the compass dial anyway. So the letters go where they are
 * looked for. The cost is that the rim only comes into frame once the camera
 * is pulled back or sent to the Top station, and `Satellite3DScene` allows the
 * zoom-out that needs.
 */

/** Ticks lie flat on the disc and point inward from the rim, so they read as
 *  graduations of the disc rather than as things standing on it. Fractions of
 *  the disc radius, so the disc can be resized without the compass following
 *  a stale number. */
const TICK_INNER = 0.93
const CARDINAL_TICK_INNER = 0.86
/** Where a letter's centre sits: inside the rim, clear of the ticks. */
const LABEL_RADIUS = 0.78
/** Letters float a little above the disc so the grid lines and the tick under
 *  them do not run through the glyph — three strokes with a line drawn across
 *  them is enough to make an N read as its own mirror image. It did, once. */
const LABEL_LIFT = 0.16
/** Sized for the distance the rim is seen from, which is a good deal further
 *  than the body ever is. */
const LABEL_SIZE = 0.34

/** Above the rim ring (+0.004) and the contact shadow (+0.006), so neither
 *  z-fights the ticks. */
const TICK_LIFT = 0.009

/**
 * Drawn after the disc, whatever the camera does.
 *
 * The floor is a translucent mesh, and three.js orders translucent meshes by
 * the distance of their *centres* from the camera. Seen obliquely the disc's
 * centre is nearer than its far rim, so the disc is painted after — over — a
 * letter standing on that rim, and at 92 % opacity the letter all but
 * vanishes. Lifting the letter does not help: the sort is by centre, not by
 * pixel. A render order above the floor's default of zero does, and it is
 * harmless where it is not needed, because the letters are above the floor
 * and the depth test still hides them behind the body.
 */
const RENDER_ORDER = 1

const CARDINAL_COLOR = chartColors.cyan[0]
const NORTH_COLOR = chartColors.red[1]

interface Props {
    heading: HeadingFix
    /** The disc this compass is drawn on. Owned by `WorldReference`: the floor
     *  is the only thing that knows where the ground is, and this component
     *  draws against it rather than claiming a ground of its own. */
    groundY: number
    groundRadius: number
}

/** A direction at a scene azimuth, in the sense `sceneAzimuth` uses: a
 *  right-handed rotation about +Y carries +X onto (cos θ, 0, −sin θ). */
const at = (angleRad: number, radius: number, y: number): [number, number, number] => [
    Math.cos(angleRad) * radius,
    y,
    -Math.sin(angleRad) * radius
]

const CompassRing: React.FC<Props> = ({ heading, groundY, groundRadius }) => {
    const points = compassPoints(heading)
    if (points.length === 0) {
        return null
    }

    return (
        <group>
            {points.map((point) => {
                const north = point.bearing === 0
                const inner = north ? CARDINAL_TICK_INNER : TICK_INNER
                const color = north ? NORTH_COLOR : CARDINAL_COLOR
                const tickLength = groundRadius * (1 - inner)
                return (
                    <group key={point.label}>
                        <mesh
                            position={at(point.angleRad, groundRadius - tickLength / 2, groundY + TICK_LIFT)}
                            rotation={[0, point.angleRad, 0]}
                            renderOrder={RENDER_ORDER}
                        >
                            <boxGeometry args={[tickLength, 0.004, north ? 0.07 : 0.04]} />
                            <meshBasicMaterial
                                color={color}
                                transparent
                            />
                        </mesh>
                        {/* Billboarded on purpose. The letter's *position* on
                            the disc is the claim about direction; its facing is
                            only legibility, and a letter lying flat on the
                            ground is edge-on — unreadable — from the two
                            side-on stations. */}
                        <Billboard position={at(point.angleRad, groundRadius * LABEL_RADIUS, groundY + LABEL_LIFT)}>
                            <Text
                                fontSize={LABEL_SIZE}
                                color={color}
                                anchorX='center'
                                anchorY='middle'
                                renderOrder={RENDER_ORDER}
                            >
                                {point.label}
                            </Text>
                        </Billboard>
                    </group>
                )
            })}
        </group>
    )
}

export default CompassRing
