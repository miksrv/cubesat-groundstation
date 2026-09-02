import * as THREE from 'three'

import { sceneDirectionOf, WORLD_AXES } from './WorldAxesGizmo'
import { SCENE_UP } from './worldFrame'

/**
 * The corner gizmo is pixels, so what is tested is the claim underneath it: that
 * it draws the frame the satellite's quaternion is referenced to — Z up, as both
 * the BNO055 and Blender have it — and not the renderer's own Y-up axes, which is
 * what the labels `X` / `UP` / `Z` used to be admitting.
 */
describe('the corner world-axes gizmo', () => {
    const of = (label: string) => {
        const axis = WORLD_AXES.find((candidate) => candidate.label === label)
        if (!axis) {
            throw new Error(`no ${label} axis`)
        }
        return axis
    }

    it('names all three axes, with no renderer convention leaking into a label', () => {
        expect(WORLD_AXES.map((axis) => axis.label)).toStrictEqual(['X', 'Y', 'Z'])
    })

    it('stands Z up, which is what makes it the satellite frame and not three.js', () => {
        // Exactly up, not merely mostly: the gizmo is the picture a viewer reads
        // the world's orientation off, and a few degrees of slop here would be
        // invisible and wrong.
        expect(sceneDirectionOf(of('Z').sensor).angleTo(SCENE_UP)).toBeCloseTo(0, 10)
    })

    it('lays X and Y flat, so the pair reads as a ground plane', () => {
        for (const label of ['X', 'Y']) {
            expect(sceneDirectionOf(of(label).sensor).angleTo(SCENE_UP)).toBeCloseTo(Math.PI / 2, 10)
        }
    })

    it('keeps the triad right-handed — a left-handed one would mirror the satellite', () => {
        const [x, y, z] = WORLD_AXES.map((axis) => sceneDirectionOf(axis.sensor))
        // X × Y = Z for a right-handed frame. This is the property that rules out
        // "just swap two axes to get Z up", which is a reflection, not a rotation.
        expect(new THREE.Vector3().crossVectors(x, y).distanceTo(z)).toBeCloseTo(0, 10)
    })

    it('gives each axis the colour the cube gives the same axis', () => {
        // Not a hex literal here: the point is that there is one triad, so the
        // corner gizmo and the tripod on the body cannot come apart.
        const { AXIS_COLOR } = jest.requireActual<typeof import('./sceneContract')>('./sceneContract')
        expect(WORLD_AXES.map((axis) => axis.color)).toStrictEqual([AXIS_COLOR.x, AXIS_COLOR.y, AXIS_COLOR.z])
    })
})
