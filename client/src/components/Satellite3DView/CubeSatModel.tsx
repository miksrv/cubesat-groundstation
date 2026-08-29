import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { Line, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

import type { AttitudeUpdate } from '../../features/telemetry/source'
import type { Vector3 } from '../../features/telemetry/types'
import { chartColors } from '../../styles/chartColors'

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

// Body-frame axis roles (LVLH-style convention for an earth-observation CubeSat)
const AXIS = {
    x: chartColors.red[0], // Roll — velocity / ram direction
    y: chartColors.green[0], // Pitch — orbit-normal / cross-track
    z: chartColors.blue[0] // Yaw — nadir (payload camera points this way)
}
const ACCEL_COLOR = chartColors.orange[0]

// Standard 1U CubeSat: a 10cm cube
const HALF = { x: 0.25, y: 0.25, z: 0.25 }
const AXIS_LEN = 0.85

// Plain white body — all 6 BoxGeometry faces share the same material
const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#f2f2f2', metalness: 0.1, roughness: 0.55 })

const antennaMaterial = new THREE.MeshStandardMaterial({ color: '#9aa4b2', metalness: 0.8, roughness: 0.3 })

const Body: React.FC = () => {
    const boxGeo = useMemo(() => new THREE.BoxGeometry(HALF.x * 2, HALF.y * 2, HALF.z * 2), [])

    return (
        <>
            <mesh
                geometry={boxGeo}
                material={bodyMaterial}
            />
            {/* Payload camera lens on the nadir (+Z) face */}
            <mesh position={[0, 0, HALF.z + 0.001]}>
                <circleGeometry args={[0.09, 24]} />
                <meshStandardMaterial
                    color='#05070a'
                    metalness={0.6}
                    roughness={0.2}
                />
            </mesh>
            {/* Antenna on the zenith (-Z) face, pointing away from Earth */}
            <mesh
                position={[0, 0, -HALF.z - 0.18]}
                material={antennaMaterial}
            >
                <cylinderGeometry args={[0.012, 0.012, 0.36, 8]} />
            </mesh>
            <Text
                position={[HALF.x + 0.01, 0, 0]}
                rotation={[0, Math.PI / 2, 0]}
                fontSize={0.09}
                color={AXIS.x}
                anchorX='center'
                anchorY='middle'
            >
                VEL
            </Text>
            <Text
                position={[0, HALF.y + 0.01, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.09}
                color={AXIS.y}
                anchorX='center'
                anchorY='middle'
            >
                ORB
            </Text>
            <Text
                position={[0, -0.14, HALF.z + 0.01]}
                fontSize={0.08}
                color={AXIS.z}
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
                    <Text
                        position={axis.dir.map((v) => v * 1.18) as [number, number, number]}
                        fontSize={0.11}
                        color={axis.color}
                        anchorX='center'
                        anchorY='middle'
                    >
                        {axis.label}
                    </Text>
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

    // Direction only, at a fixed length. On a satellite sitting on a desk this
    // is one g straight down and on a walk it is one g plus a little noise, so
    // scaling by magnitude would draw the same arrow every time — what is worth
    // seeing is where "down" is relative to the body.
    const end = vector
        .clone()
        .normalize()
        .multiplyScalar(AXIS_LEN * 0.6)

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
            <mesh position={end}>
                <sphereGeometry args={[0.02, 12, 12]} />
                <meshBasicMaterial color={ACCEL_COLOR} />
            </mesh>
        </>
    )
}

const CubeSatModel: React.FC<Props> = ({ attitudeRef, accel }) => {
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
