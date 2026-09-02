import * as THREE from 'three'

import type { AttitudeUpdate } from '../../features/telemetry/source'
import type { AdcsStatus } from '../../features/telemetry/types'
import { mockAdcs } from '../../test-fixtures'

import type { HeadingFix } from './sceneContract'
import {
    compassPoints,
    FRAME_TOLERANCE_DEG,
    frameCheckLabel,
    HEADING_SPREAD_TOLERANCE_DEG,
    headingLabel,
    INITIAL_HEADING_FIX,
    sceneNotes
} from './sceneContract'
import { GravityFrameCheck, NorthEstimator, SCENE_UP, sceneAzimuth, SENSOR_WORLD_TO_SCENE } from './worldFrame'

/** Level, camera facing whichever way — the sensor's world frame is where the
 *  quaternion is identity, and the bench dump says that is the board lying flat. */
const LEVEL: AttitudeUpdate = { t: 1, w: 1, x: 0, y: 0, z: 0 }

/** What the satellite reports at rest and level: one g along its own +Z, the
 *  top of the frame. Taken from `src/test-fixtures.ts`, which is taken from the
 *  satellite's documented payload. */
const LEVEL_ACCEL = { x: 0.01, y: 0.02, z: 0.99 }

/** One long frame is enough to settle a three-second average, and it is what
 *  the exponential smoothing is supposed to do with a gap. */
const SETTLED = 5

describe('SENSOR_WORLD_TO_SCENE', () => {
    it('carries the sensor world up axis (+Z) onto the scene up axis (+Y)', () => {
        const up = new THREE.Vector3(0, 0, 1).applyQuaternion(SENSOR_WORLD_TO_SCENE)
        expect(up.angleTo(SCENE_UP)).toBeLessThan(1e-6)
    })

    it('is a rotation, not a reflection — the body stays right-handed', () => {
        const x = new THREE.Vector3(1, 0, 0).applyQuaternion(SENSOR_WORLD_TO_SCENE)
        const y = new THREE.Vector3(0, 1, 0).applyQuaternion(SENSOR_WORLD_TO_SCENE)
        const z = new THREE.Vector3(0, 0, 1).applyQuaternion(SENSOR_WORLD_TO_SCENE)
        // x cross y must give z, which is only true of a right-handed frame.
        expect(x.clone().cross(y).angleTo(z)).toBeLessThan(1e-6)
    })
})

describe('GravityFrameCheck', () => {
    it('withholds a verdict until the average has settled', () => {
        const check = new GravityFrameCheck()
        expect(check.update(LEVEL, LEVEL_ACCEL, 0.1)).toStrictEqual({ status: 'waiting', angleDeg: null })
    })

    it('withholds a verdict with no attitude sample at all', () => {
        const check = new GravityFrameCheck()
        expect(check.update(null, LEVEL_ACCEL, SETTLED)).toStrictEqual({ status: 'waiting', angleDeg: null })
    })

    it('withholds a verdict when an axis is withheld — a null is never a zero', () => {
        const check = new GravityFrameCheck()
        expect(check.update(LEVEL, { x: 0.01, y: null, z: 0.99 }, SETTLED)).toStrictEqual({
            status: 'waiting',
            angleDeg: null
        })
    })

    it('verifies the frame when a level satellite reads one g along its own +Z', () => {
        const check = new GravityFrameCheck()
        const verdict = check.update(LEVEL, LEVEL_ACCEL, SETTLED)
        expect(verdict.status).toBe('verified')
        expect(verdict.angleDeg).toBeLessThan(FRAME_TOLERANCE_DEG)
    })

    it('reports the frame unverified when the measured g comes out sideways', () => {
        const check = new GravityFrameCheck()
        // The same magnitude on the body +X axis instead: if the sensor-world
        // mapping were wrong by a quarter turn this is what a level satellite
        // would look like, and the scene must say so rather than tilt the floor.
        const verdict = check.update(LEVEL, { x: 0.99, y: 0.02, z: 0.01 }, SETTLED)
        expect(verdict.status).toBe('unverified')
        expect(verdict.angleDeg).toBeGreaterThan(FRAME_TOLERANCE_DEG)
    })

    it('withholds a verdict while the satellite is being accelerated', () => {
        const check = new GravityFrameCheck()
        // Two g up: whatever this is measuring, it is not only gravity, so
        // nothing about the world frame follows from it.
        expect(check.update(LEVEL, { x: 0, y: 0, z: 2.1 }, SETTLED).status).toBe('waiting')
    })

    it('keeps the last verdict across a frame with no data rather than flapping', () => {
        const check = new GravityFrameCheck()
        expect(check.update(LEVEL, LEVEL_ACCEL, SETTLED).status).toBe('verified')
        expect(check.update(null, null, 0.016).status).toBe('verified')
    })
})

describe('frameCheckLabel', () => {
    it('says the frame is unverified while waiting, and why', () => {
        expect(frameCheckLabel({ status: 'waiting', angleDeg: null })).toBe(
            'world frame unverified — waiting for a steady g'
        )
    })

    it('names the disagreement in degrees when the check fails', () => {
        expect(frameCheckLabel({ status: 'unverified', angleDeg: 88.4 })).toBe(
            'world frame unverified — measured g is 88° from up'
        )
    })

    it('says what verified it, not just that it is verified', () => {
        expect(frameCheckLabel({ status: 'verified', angleDeg: 2.3 })).toBe(
            'world frame verified by measured g (2° off up)'
        )
    })
})

describe('sceneAzimuth', () => {
    it('measures the angle about scene up, from scene +X, right-handed', () => {
        expect(sceneAzimuth(new THREE.Vector3(1, 0, 0))).toBeCloseTo(0, 6)
        // A right-handed quarter turn about +Y carries +X onto −Z.
        expect(sceneAzimuth(new THREE.Vector3(0, 0, -1))).toBeCloseTo(Math.PI / 2, 6)
    })

    it('refuses an azimuth for a direction with nothing left in the ground plane', () => {
        // Straight up has no compass direction, and the two components that
        // would produce one here are numerical noise.
        expect(sceneAzimuth(new THREE.Vector3(0.001, 1, -0.002))).toBeNull()
    })
})

describe('NorthEstimator', () => {
    /** Level, camera facing along the sensor world's +X — which wave 1 says is
     *  an arbitrary direction on the ground. That is the point: what follows
     *  measures which direction it is. */
    const level = (t: number): AttitudeUpdate => ({ t, w: 1, x: 0, y: 0, z: 0 })

    /** A quarter turn about the sensor world's up axis, counter-clockwise seen
     *  from above. The body's forward axis lands on the sensor world's +Y. */
    const turned = (t: number): AttitudeUpdate => ({ t, w: Math.SQRT1_2, x: 0, y: 0, z: Math.SQRT1_2 })

    /** `mockAdcs` is a calibrated magnetometer and a still satellite; only the
     *  heading and the clock move in these tests. */
    const status = (t: number, yaw: number | null, over: Partial<AdcsStatus> = {}): AdcsStatus => ({
        ...mockAdcs,
        timestamp: t,
        yaw,
        gyro: { x: 0, y: 0, z: 0 },
        ...over
    })

    /** Enough pairs to pass `NORTH_MIN_WEIGHT`, cycling through the given
     *  observations. Half a second apart, which is the satellite's own rate. */
    const feed = (
        estimator: NorthEstimator,
        steps: Array<{ sample: (t: number) => AttitudeUpdate; yaw: number | null }>,
        count = 12
    ): HeadingFix => {
        let fix: HeadingFix = INITIAL_HEADING_FIX
        for (let index = 0; index < count; index += 1) {
            const step = steps[index % steps.length]
            const t = 1000 + index * 0.5
            fix = estimator.update(step.sample(t), status(t, step.yaw), 0.5)
        }
        return fix
    }

    it('withholds north entirely while the satellite withholds its heading', () => {
        const fix = feed(new NorthEstimator(), [{ sample: level, yaw: null }])
        expect(fix).toStrictEqual({ status: 'withheld', northAngleDeg: null, spreadDeg: null })
        expect(compassPoints(fix)).toStrictEqual([])
    })

    it('withholds north when the magnetometer is short of 3/3, heading or no heading', () => {
        // The satellite should not be publishing a yaw here at all. If one ever
        // arrives anyway — an older recording, a different firmware — the
        // calibration is what decides, because below 3/3 the chip reports a
        // constant and a compass built from a constant always points one way.
        const estimator = new NorthEstimator()
        let fix: HeadingFix = INITIAL_HEADING_FIX
        for (let index = 0; index < 12; index += 1) {
            const t = 1000 + index * 0.5
            fix = estimator.update(level(t), status(t, 30, { calibStatus: { sys: 3, gyro: 3, accel: 3, mag: 2 } }), 0.5)
        }
        expect(fix.status).toBe('withheld')
        expect(compassPoints(fix)).toStrictEqual([])
    })

    it('offers no angle until there is enough evidence to average', () => {
        const fix = feed(new NorthEstimator(), [{ sample: level, yaw: 30 }], 3)
        expect(fix).toStrictEqual({ status: 'estimating', northAngleDeg: null, spreadDeg: null })
        expect(compassPoints(fix)).toStrictEqual([])
    })

    it('puts north where the published heading says it is', () => {
        // The body's forward axis is drawn along scene +X (identity attitude)
        // and the satellite says it is looking 30° east of magnetic north. So
        // north is 30° round from scene +X, in the direction a right-handed
        // rotation about scene up goes.
        const fix = feed(new NorthEstimator(), [{ sample: level, yaw: 30 }])
        expect(fix.status).toBe('fixed')
        expect(fix.northAngleDeg).toBeCloseTo(30, 3)
        expect(fix.spreadDeg).toBeLessThan(HEADING_SPREAD_TOLERANCE_DEG)
    })

    it('gets the same north from two headings a quarter turn apart', () => {
        // The satellite turns 90° counter-clockwise seen from above, so its
        // compass bearing *falls* by 90: 30 → 300. Both observations describe
        // the same north, and this is the test that would fail if the sign
        // convention assumed in `NorthEstimator` were backwards.
        const fix = feed(new NorthEstimator(), [
            { sample: level, yaw: 30 },
            { sample: turned, yaw: 300 }
        ])
        expect(fix.status).toBe('fixed')
        expect(fix.northAngleDeg).toBeCloseTo(30, 3)
        expect(compassPoints(fix).map((point) => point.label)).toStrictEqual(['N', 'E', 'S', 'W'])
    })

    it('withdraws the compass when the two sources disagree instead of picking one', () => {
        // The same quarter turn, but with the bearing *rising* — what a heading
        // running counter-clockwise would look like. The two estimates are then
        // 180° apart and there is no honest average of them.
        const fix = feed(new NorthEstimator(), [
            { sample: level, yaw: 30 },
            { sample: turned, yaw: 120 }
        ])
        expect(fix.status).toBe('inconsistent')
        expect(fix.northAngleDeg).toBeNull()
        expect(fix.spreadDeg).toBeGreaterThan(HEADING_SPREAD_TOLERANCE_DEG)
        expect(compassPoints(fix)).toStrictEqual([])
    })

    it('does not count one published sample more than once', () => {
        // A probe ticking faster than the satellite publishes sees the same
        // pair over and over; twelve looks at one sample is one observation.
        const estimator = new NorthEstimator()
        let fix: HeadingFix = INITIAL_HEADING_FIX
        for (let index = 0; index < 12; index += 1) {
            fix = estimator.update(level(1000), status(1000, 30), 0.25)
        }
        expect(fix.status).toBe('estimating')
    })

    it('drops a pair whose two halves are too far apart to describe one moment', () => {
        // Five seconds of skew while turning at 5°/s is 25° of heading error —
        // well past what the reconciliation could survive, so the pair is not
        // used at all rather than used and blamed on the frame.
        const estimator = new NorthEstimator()
        let fix: HeadingFix = INITIAL_HEADING_FIX
        for (let index = 0; index < 12; index += 1) {
            const t = 1000 + index * 0.5
            fix = estimator.update(level(t), status(t + 5, 30, { gyro: { x: 0, y: 0, z: 5 } }), 0.5)
        }
        expect(fix.status).toBe('estimating')
    })

    it('admits a live pair however fast the satellite is turning', () => {
        // Live, the attitude sample and the status are two exits from one
        // payload: zero skew, so no turn rate can put them out of step.
        const fix = feed(new NorthEstimator(), [
            { sample: level, yaw: 30 },
            { sample: turned, yaw: 300 }
        ]).status
        expect(fix).toBe('fixed')

        const spinning = new NorthEstimator()
        let verdict: HeadingFix = INITIAL_HEADING_FIX
        for (let index = 0; index < 12; index += 1) {
            const t = 1000 + index * 0.5
            const sample = index % 2 === 0 ? level : turned
            const yaw = index % 2 === 0 ? 30 : 300
            verdict = spinning.update(sample(t), status(t, yaw, { gyro: { x: 0, y: 0, z: 90 } }), 0.5)
        }
        expect(verdict.status).toBe('fixed')
    })

    it('forgets the whole reconciliation when the heading is withdrawn', () => {
        // Not a pause: the fusion engine re-references its yaw when the
        // magnetometer next calibrates, so an offset measured against the old
        // reference is an offset into a frame that no longer exists.
        const estimator = new NorthEstimator()
        expect(feed(estimator, [{ sample: level, yaw: 30 }]).status).toBe('fixed')
        expect(estimator.update(level(2000), status(2000, null), 0.5).status).toBe('withheld')
        expect(feed(estimator, [{ sample: level, yaw: 30 }], 2).status).toBe('estimating')
    })
})

describe('compassPoints', () => {
    it('draws no letters on any status but a fix', () => {
        expect(compassPoints({ status: 'withheld', northAngleDeg: null, spreadDeg: null })).toStrictEqual([])
        expect(compassPoints({ status: 'estimating', northAngleDeg: null, spreadDeg: null })).toStrictEqual([])
        expect(compassPoints({ status: 'inconsistent', northAngleDeg: null, spreadDeg: 40 })).toStrictEqual([])
    })

    it('lays the bearings out clockwise, which is the other way round from a scene angle', () => {
        const points = compassPoints({ status: 'fixed', northAngleDeg: 0, spreadDeg: 2 })
        const east = points.find((point) => point.label === 'E')
        // East is 90° clockwise from north, so it sits 90° *back* along the
        // right-handed angle about scene up.
        expect(east?.angleRad).toBeCloseTo(-Math.PI / 2, 6)
    })
})

describe('headingLabel', () => {
    it('says the magnetometer is why there is no north, not that something broke', () => {
        expect(headingLabel({ status: 'withheld', northAngleDeg: null, spreadDeg: null })).toBe(
            'heading uncalibrated — no north until the magnetometer reads 3/3'
        )
    })

    it('names the disagreement in degrees when the two sources will not reconcile', () => {
        expect(headingLabel({ status: 'inconsistent', northAngleDeg: null, spreadDeg: 41.6 })).toBe(
            'north withheld — yaw and quaternion disagree by 42°'
        )
    })

    it('says what fixed north, not just that it is fixed', () => {
        expect(headingLabel({ status: 'fixed', northAngleDeg: 12, spreadDeg: 3.2 })).toBe(
            'north from yaw and quaternion, agreeing to 3°'
        )
    })
})

describe('sceneNotes', () => {
    const VERIFIED = { status: 'verified', angleDeg: 2.3 } as const
    const FIXED = { status: 'fixed', northAngleDeg: 12, spreadDeg: 3.2 } as const

    it('says nothing at all when nothing is being withheld', () => {
        // The horizon is bright and the ring is lettered; the picture is the
        // whole message, and a tooltip on top of it would be noise.
        expect(sceneNotes(VERIFIED, FIXED)).toBeUndefined()
    })

    it('says why the compass has no letters, not merely that it has none', () => {
        expect(sceneNotes(VERIFIED, INITIAL_HEADING_FIX)).toContain(
            'heading uncalibrated — no north until the magnetometer reads 3/3'
        )
    })

    it('says why the horizon dimmed', () => {
        expect(sceneNotes({ status: 'unverified', angleDeg: 88.4 }, FIXED)).toContain(
            'world frame unverified — measured g is 88° from up'
        )
    })

    it('gives both verdicts whenever it gives either, and in the same words the scene uses', () => {
        // Half an explanation invites the reader to assume the other half. The
        // sentences are the ones `frameCheckLabel` and `headingLabel` produce —
        // there is no second wording of any of this to drift out of step.
        const check = { status: 'waiting', angleDeg: null } as const
        expect(sceneNotes(check, INITIAL_HEADING_FIX)).toBe(
            `${frameCheckLabel(check)}\n${headingLabel(INITIAL_HEADING_FIX)}`
        )
    })
})
