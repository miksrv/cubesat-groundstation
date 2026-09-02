import React, { useMemo, useState } from 'react'
import * as THREE from 'three'

import { useGizmoContext } from '@react-three/drei'

import { AXIS_COLOR } from './sceneContract'
import { SENSOR_WORLD_TO_SCENE } from './worldFrame'

/**
 * The corner navigation gizmo: the three axes of the world frame the satellite's
 * attitude is actually referenced to, **Z up**, in the same three colours as the
 * tripod on the cube.
 *
 * **Why this is not `GizmoViewport`.** drei's gizmo draws the three axes of the
 * *three.js scene* and can only letter the three **positive** ones — its negative
 * heads take no labels at all (`GizmoViewport.js`, `hideNegativeAxes`). three.js
 * draws Y-up; the BNO055's world frame, like Blender's, is Z-up. Any proper
 * rotation carrying a Z-up frame onto a Y-up one has to send one of the two
 * horizontal axes to a *negative* scene direction — swapping two axes instead
 * would be a reflection, and would draw a left-handed satellite. `worldFrame.ts`
 * picks that one to be sensor +Y → scene −Z. So the frame the viewer needs cannot
 * be expressed by drei's component: its green head would be sitting on sensor −Y
 * with a label saying "Y", which is a sign error in the one picture that exists
 * to say which way round the world is.
 *
 * That is what the previous labels `X` / `UP` / `Z` were working around — they
 * named three.js's own axes and left the up-axis unnamed because, in the scene's
 * frame, it has no name the satellite would recognise. This component names all
 * three instead, by drawing the sensor frame rather than the renderer's.
 *
 * **Colours.** Same red / green / blue as the cube's tripod, from
 * `sceneContract`'s single triad. An earlier version made them deliberately grey
 * so that a viewer could not confuse the world axes with the body's — the
 * confusion is worth risking, and the greyed-out version threw away the reading
 * that matters: the two triads are the *same three axes*, one as the satellite
 * currently holds them and one as the world defines them, so they coincide
 * exactly when the satellite is level and facing along world X, and the angle
 * between them is what the whole picture is about. Blender colours its object
 * axes and its navigation gizmo alike for the same reason. What keeps them
 * apart is not hue: one triad is drawn on the cube and turns with it, the other
 * is pinned in the corner and turns with the camera.
 */

/** The arm, in gizmo units. Mirrors drei's own geometry so this gizmo is the
 *  same size as the one it replaces. */
const ARM_LENGTH = 0.8
const ARM_THICKNESS = 0.05
/** A `boxGeometry`'s long side. */
const ARM_AXIS = new THREE.Vector3(1, 0, 0)

/** drei's numbers, kept so the heads come out the size they always were: a 64px
 *  sprite canvas, a 16px disc in it, the letter's baseline nudged below centre. */
const HEAD_CANVAS = 64
const HEAD_DISC_RADIUS = 16
const HEAD_FONT = '18px Inter var, Arial, sans-serif'
const HEAD_BASELINE = 41
/** Dark, because the letter sits inside a saturated disc. */
const LABEL_COLOR = '#0b1014'

/**
 * The three axes of the sensor's world frame, named as the satellite names them.
 *
 * `sensor` is the direction in that frame; the scene direction is derived from it
 * through `SENSOR_WORLD_TO_SCENE` rather than written down, so this gizmo cannot
 * drift out of step with the rotation that orients the cube. If that mapping is
 * ever revised, the gizmo follows it.
 */
export const WORLD_AXES: ReadonlyArray<{
    label: string
    color: string
    sensor: readonly [number, number, number]
}> = [
    { color: AXIS_COLOR.x, label: 'X', sensor: [1, 0, 0] },
    { color: AXIS_COLOR.y, label: 'Y', sensor: [0, 1, 0] },
    { color: AXIS_COLOR.z, label: 'Z', sensor: [0, 0, 1] }
]

/** Where an axis of the sensor's world frame points in the scene. */
export const sceneDirectionOf = (sensor: readonly [number, number, number]): THREE.Vector3 =>
    new THREE.Vector3(...sensor).applyQuaternion(SENSOR_WORLD_TO_SCENE)

/** A lettered disc. Drawn into a canvas rather than laid out as `Text`, so it
 *  needs no font fetch and — being a sprite — always faces the viewer without a
 *  frame callback. */
const discTexture = (color: string, label: string): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas')
    canvas.width = HEAD_CANVAS
    canvas.height = HEAD_CANVAS
    const context = canvas.getContext('2d')
    if (context) {
        const centre = HEAD_CANVAS / 2
        context.beginPath()
        context.arc(centre, centre, HEAD_DISC_RADIUS, 0, 2 * Math.PI)
        context.closePath()
        context.fillStyle = color
        context.fill()
        context.font = HEAD_FONT
        context.textAlign = 'center'
        context.fillStyle = LABEL_COLOR
        context.fillText(label, centre, HEAD_BASELINE)
    }
    return new THREE.CanvasTexture(canvas)
}

const AxisArm: React.FC<{ direction: THREE.Vector3; color: string }> = ({ direction, color }) => {
    const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(ARM_AXIS, direction), [direction])
    const position = useMemo(() => direction.clone().multiplyScalar(ARM_LENGTH / 2), [direction])

    return (
        <mesh
            position={position}
            quaternion={quaternion}
        >
            <boxGeometry args={[ARM_LENGTH, ARM_THICKNESS, ARM_THICKNESS]} />
            <meshBasicMaterial
                color={color}
                // The gizmo is a control, not part of the lit scene: tone mapping
                // would drag its colours away from the legend swatches under the
                // canvas, which are plain CSS and cannot be tone mapped back.
                toneMapped={false}
            />
        </mesh>
    )
}

/**
 * One clickable head, and there are three of them — the positive ends only.
 *
 * Blender draws the negative ends too, as six heads in all, and this did as
 * well. They are gone on purpose: this canvas is about 290 px of the narrowest
 * column in the top row, the attitude dial already holds one corner of it, and
 * three faint extra discs in the other corner cost more of that space than the
 * view-from-behind they bought. Nothing is unreachable as a result — a drag
 * gets to any side, and the head opposite the one a viewer wants is one further
 * click away.
 */
const AxisHead: React.FC<{
    direction: THREE.Vector3
    color: string
    label: string
    onSelect: (direction: THREE.Vector3) => void
}> = ({ color, direction, label, onSelect }) => {
    const [hovered, setHovered] = useState(false)
    const texture = useMemo(() => discTexture(color, label), [color, label])

    return (
        <sprite
            position={direction}
            scale={hovered ? 1.2 : 1}
            onPointerOver={(event) => {
                event.stopPropagation()
                setHovered(true)
            }}
            onPointerOut={(event) => {
                event.stopPropagation()
                setHovered(false)
            }}
            onPointerDown={(event) => {
                event.stopPropagation()
                onSelect(direction)
            }}
        >
            <spriteMaterial
                map={texture}
                // Without it the disc's transparent corners punch a square hole
                // through the arms behind it.
                alphaTest={0.3}
                toneMapped={false}
            />
        </sprite>
    )
}

/** Matches the scale drei's own gizmo group uses, so the heads land where the
 *  `GizmoHelper` margin was tuned for them. */
const GROUP_SCALE = 40

const WorldAxesGizmo: React.FC = () => {
    const { tweenCamera } = useGizmoContext()
    // Derived once: the mapping is a module constant, so these three directions
    // are too, and re-deriving them per frame would allocate three vectors a
    // frame for a value that cannot change.
    const axes = useMemo(() => WORLD_AXES.map((axis) => ({ ...axis, direction: sceneDirectionOf(axis.sensor) })), [])

    return (
        <group scale={GROUP_SCALE}>
            {axes.map((axis) => (
                <React.Fragment key={axis.label}>
                    <AxisArm
                        color={axis.color}
                        direction={axis.direction}
                    />
                    <AxisHead
                        color={axis.color}
                        direction={axis.direction}
                        label={axis.label}
                        onSelect={tweenCamera}
                    />
                </React.Fragment>
            ))}
        </group>
    )
}

export default WorldAxesGizmo
