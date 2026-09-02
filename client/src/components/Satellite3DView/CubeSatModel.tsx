import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { Billboard, Line, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

import type { AttitudeUpdate } from '../../features/telemetry/source'
import type { Vector3 } from '../../features/telemetry/types'

import { ACCEL_COLOR, AXIS_COLOR } from './sceneContract'
import { SENSOR_WORLD_TO_SCENE } from './worldFrame'

interface Props {
    /**
     * The latest attitude sample, read on the animation frame rather than passed
     * as state. Orientation arrives at 2 Hz live and 1 Hz from a recording; a
     * React render per sample would re-render this whole tree for a value only
     * the WebGL scene consumes, and the scene has to interpolate anyway.
     */
    attitudeRef: React.MutableRefObject<AttitudeUpdate | null>
    /** g, for the measured-acceleration arrow. Changes slowly enough for props. */
    accel: Vector3 | null
}

/**
 * The three body axes as the BNO055 defines them on this frame, bench-verified
 * on the assembled satellite 2026-08-28 (`cubesat-sim/src/cubesat/hal/rpi/
 * bno055.py`): **+X points away from the camera, +Y to the right side (viewed
 * from behind the camera), +Z up.**
 *
 * They carry no mission role. An earlier version of this file called them
 * VEL / ORB / CAM after an LVLH convention — a velocity vector, an orbit normal
 * and a nadir. This craft is a Raspberry Pi in a 3D-printed frame carried on a
 * walk: it has no orbit, so it has none of those three, and naming axes after
 * them made the picture unreadable as well as untrue.
 *
 * The colours are `sceneContract`'s, not this file's: the corner gizmo draws the
 * same three axes for the world frame these are measured against, and the two
 * triads have to be the same three colours or the comparison the picture invites
 * is a comparison between two different colour schemes.
 *
 *   +X — away from the camera; the camera looks along −X
 *   +Y — the right-hand side, viewed from behind the camera
 *   +Z — the top of the frame
 */
const AXIS = AXIS_COLOR

/** The axis a `coneGeometry` points along before it is turned. */
const CONE_AXIS = new THREE.Vector3(0, 1, 0)

// Standard 1U CubeSat: a 10cm cube
const HALF = { x: 0.25, y: 0.25, z: 0.25 }
const AXIS_LEN = 0.85

// Plain white body — all 6 BoxGeometry faces share the same material
const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#f2f2f2', metalness: 0.1, roughness: 0.55 })

/**
 * The rotation that lays a flat decal onto the **−X face** — the camera face —
 * the right way up.
 *
 * Both halves matter, and the second one is the one that was missing. A plane
 * geometry (and drei's `Text`) faces +Z with its own up along +Y, so a single
 * quarter turn about Y is enough to make it *face* −X — and leaves its up along
 * the body's **+Y**, which is the frame's right-hand side, not its top. The
 * lens is a circle and could not say so, but the lettering under it could and
 * did: it read bottom-to-top, and since it is the only marking on an otherwise
 * blank white cube, the whole satellite read as lying on its right side even
 * while the tripod, the horizon and `GravityFrameCheck` all agreed it was
 * level. A further quarter turn about the face normal carries the decal's up
 * onto the body's **+Z**, the top of the frame:
 *
 *     plane +Z → body −X   (the decal faces out of the camera face)
 *     plane +Y → body +Z   (its up is the top of the frame)
 *     plane +X → body −Y   (so it reads left-to-right from in front of the lens)
 *
 * Euler `XYZ` composes as Rx·Ry·Rz, which is why the turn about the normal is
 * the X entry rather than the Z one.
 */
export const CAMERA_FACE_ROTATION: [number, number, number] = [Math.PI / 2, -Math.PI / 2, 0]

const Body: React.FC = () => {
    const boxGeo = useMemo(() => new THREE.BoxGeometry(HALF.x * 2, HALF.y * 2, HALF.z * 2), [])

    return (
        <>
            <mesh
                geometry={boxGeo}
                material={bodyMaterial}
            />
            {/*
                The Raspberry Pi camera on the −X face. This is the one face the
                hardware documentation actually places something on: the sensor
                frame is defined by it ("+X points away from the camera"), so the
                lens is what fixes the drawing to the real object.

                It is laid on that face by `CAMERA_FACE_ROTATION` above, which
                is also what keeps the lettering under it the right way up —
                see there for why that is two turns and not one.

                Nothing else is drawn on the body. The satellite also carries a
                LoRa antenna, but no document in `cubesat-sim` — not the hardware
                notes, not the frame STLs — says which face it leaves from, and a
                mast drawn on a guessed face is the same invention as a nadir
                vector. It stays off until somebody measures it.
            */}
            <mesh
                position={[-(HALF.x + 0.001), 0, 0]}
                rotation={CAMERA_FACE_ROTATION}
            >
                <circleGeometry args={[0.09, 24]} />
                <meshStandardMaterial
                    color='#05070a'
                    metalness={0.6}
                    roughness={0.2}
                />
            </mesh>
            {/* Under the lens, where "under" now means the −Z side of the face
                — towards the bottom of the frame — rather than the −Y side,
                which is one of its edges. */}
            <Text
                position={[-(HALF.x + 0.002), 0, -0.155]}
                rotation={CAMERA_FACE_ROTATION}
                fontSize={0.07}
                color={AXIS.x}
                anchorX='center'
                anchorY='middle'
            >
                CAM
            </Text>
        </>
    )
}

const AxisTripod: React.FC = () => {
    const axes: Array<{ dir: [number, number, number]; color: string; label: string }> = [
        { dir: [AXIS_LEN, 0, 0], color: AXIS.x, label: 'X' },
        { dir: [0, AXIS_LEN, 0], color: AXIS.y, label: 'Y' },
        { dir: [0, 0, AXIS_LEN], color: AXIS.z, label: 'Z' }
    ]

    return (
        <>
            {axes.map((axis) => (
                <group key={axis.label}>
                    <primitive
                        object={
                            new THREE.ArrowHelper(
                                new THREE.Vector3(...axis.dir).normalize(),
                                new THREE.Vector3(0, 0, 0),
                                AXIS_LEN,
                                axis.color,
                                0.12,
                                0.07
                            )
                        }
                    />
                    {/* Billboarded, for the reason `CompassRing` billboards its
                        cardinal letters: the letter's *position* is the claim
                        about direction, its facing is only legibility. A flat
                        `Text` here inherits the body's rotation, so it lies in
                        the body's XY plane — which is edge-on, and unreadable,
                        from every camera station whenever the satellite is
                        level, i.e. nearly always. Three unreadable letters on a
                        blank white cube leave nothing to read the orientation
                        off at all. */}
                    <Billboard position={axis.dir.map((v) => v * 1.18) as [number, number, number]}>
                        <Text
                            fontSize={0.11}
                            color={axis.color}
                            anchorX='center'
                            anchorY='middle'
                        >
                            {axis.label}
                        </Text>
                    </Billboard>
                </group>
            ))}
        </>
    )
}

const AccelVector: React.FC<{ accel: Vector3 | null }> = ({ accel }) => {
    const vector =
        accel?.x != null && accel?.y != null && accel?.z != null ? new THREE.Vector3(accel.x, accel.y, accel.z) : null

    if (!vector || vector.lengthSq() < 1e-8) {
        return null
    }

    // Direction only, at a fixed length. At rest this is one g and on a walk it
    // is one g plus a footfall, so scaling by magnitude would draw the same
    // arrow every time — what is worth seeing is where the measurement points
    // relative to the body.
    //
    // It points *up*, not down: an accelerometer at rest reads specific force,
    // so a level satellite reads +1 g along its +Z. That sign is the whole basis
    // of the frame check in `worldFrame.ts`; the bench dump in
    // `cubesat-sim/docs/hardware-bno055-bmp280-imu.md` is where it comes from.
    const direction = vector.clone().normalize()
    const end = direction.clone().multiplyScalar(AXIS_LEN * 0.6)
    // A cone rather than a bead, aimed along the measurement. coneGeometry
    // points +Y, so this is the turn that carries +Y onto the direction.
    const head = new THREE.Quaternion().setFromUnitVectors(CONE_AXIS, direction)

    return (
        <>
            <Line
                points={[
                    [0, 0, 0],
                    [end.x, end.y, end.z]
                ]}
                color={ACCEL_COLOR}
                dashed
                dashSize={0.04}
                gapSize={0.03}
                lineWidth={2}
            />
            <mesh
                position={end}
                quaternion={head}
            >
                <coneGeometry args={[0.035, 0.1, 14]} />
                <meshBasicMaterial color={ACCEL_COLOR} />
            </mesh>
            {/*
                Labelled, because at rest this arrow lies *exactly* along the
                body's +Z: a level satellite reads +1 g on that axis, so the
                measurement and the blue axis are the same line, and an unlabelled
                dashed line inside another arrow reads as decoration on the axis
                rather than as a second quantity. It is not a thrust vector and it
                is not the direction of gravity — an accelerometer at rest reads
                specific force, so it points *up*. The legend under the canvas
                says so in words.

                The offset is inside the Billboard, so it is a nudge in screen
                space: the letter clears the axis line from any camera angle
                without the position being a claim about a body direction.
            */}
            <Billboard position={end}>
                <Text
                    position={[0.1, 0.04, 0]}
                    fontSize={0.1}
                    color={ACCEL_COLOR}
                    anchorX='center'
                    anchorY='middle'
                >
                    g
                </Text>
            </Billboard>
        </>
    )
}

const CubeSatModel: React.FC<Props> = ({ attitudeRef, accel }) => {
    // The drawn body's own group. Nothing outside this file reads the
    // orientation off it: what the scene shows is the slerped one below, which
    // lags the raw sample on purpose, so anything reading it would have to
    // agree to lag too.
    const groupRef = useRef<THREE.Group>(null)
    const target = useRef(new THREE.Quaternion())

    useFrame((_, delta) => {
        const sample = attitudeRef.current
        if (!groupRef.current || !sample) {
            return
        }
        // three.js orders a quaternion (x, y, z, w); the BNO055 publishes
        // (w, x, y, z). Written out rather than spread, because the two
        // conventions differ by exactly one silent rotation.
        target.current.set(sample.x, sample.y, sample.z, sample.w)
        // Then left-multiply the one frame mapping this widget has: the sample
        // is absolute, referenced to a world whose up is +Z, and three.js draws
        // in a world whose up is +Y. See `worldFrame.ts` for what that assumes,
        // what it is derived from, and what would disprove it.
        target.current.premultiply(SENSOR_WORLD_TO_SCENE)
        // Slerp toward it rather than snap. The satellite cannot sample faster —
        // the I2C bus is clamped to 10 kHz and four processes share it — so the
        // smoothness between samples is the viewer's job, and interpolating
        // quaternions is most of why the satellite publishes them at all.
        groupRef.current.quaternion.slerp(target.current, Math.min(1, delta * 4))
    })

    return (
        <group ref={groupRef}>
            <Body />
            <AxisTripod />
            <AccelVector accel={accel} />
        </group>
    )
}

export default CubeSatModel
