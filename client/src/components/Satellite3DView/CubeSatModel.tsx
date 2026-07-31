import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { Line, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

import type { TelemetryRecord } from '../../features/telemetry/types'
import { chartColors } from '../../styles/chartColors'

interface Props {
    latest: TelemetryRecord | null
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

const AccelVector: React.FC<{ latest: TelemetryRecord | null }> = ({ latest }) => {
    const accel =
        latest?.accel_x != null && latest?.accel_y != null && latest?.accel_z != null
            ? new THREE.Vector3(latest.accel_x, latest.accel_y, latest.accel_z)
            : null

    if (!accel || accel.lengthSq() < 1e-8) {
        return null
    }

    // Mock accelerometer readings are tiny fractions of a g, far too small to
    // scale by magnitude and still be visible — show direction only, at a
    // fixed length (shorter than the body axes so it doesn't crowd them out).
    const end = accel
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

const CubeSatModel: React.FC<Props> = ({ latest }) => {
    const groupRef = useRef<THREE.Group>(null)
    const targetQuat = useRef(new THREE.Quaternion())

    const target = useMemo(() => {
        const euler = new THREE.Euler(
            THREE.MathUtils.degToRad(latest?.roll ?? 0),
            THREE.MathUtils.degToRad(latest?.pitch ?? 0),
            THREE.MathUtils.degToRad(latest?.yaw ?? 0),
            'XYZ'
        )
        return new THREE.Quaternion().setFromEuler(euler)
    }, [latest?.roll, latest?.pitch, latest?.yaw])

    useFrame((_, delta) => {
        if (!groupRef.current) {
            return
        }
        targetQuat.current.copy(target)
        groupRef.current.quaternion.slerp(targetQuat.current, Math.min(1, delta * 3))
    })

    return (
        <group ref={groupRef}>
            <Body />
            <AxisTripod />
            <AccelVector latest={latest} />
        </group>
    )
}

export default CubeSatModel
