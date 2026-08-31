/**
 * The timeline's pure half: which row an instant means, and which orientation.
 *
 * The boundaries are computed from the module's own constant rather than
 * repeated as literals — the same rule the satellite's suite follows, and for
 * the same reason: a test that restates a constant stops testing behaviour the
 * moment the constant legitimately changes.
 */

import type { AttitudeSample } from '../telemetry/types'

import { attitudeAt, epochOf, hasQuaternion, indexAtOrBefore, MAX_INTERPOLATION_GAP_SEC } from './playback'

const sample = (t: number, w: number, x: number, y: number, z: number): AttitudeSample => ({
    t,
    quaternion: { w, x, y, z },
    gyro: { x: null, y: null, z: null }
})

const IDENTITY = sample(100, 1, 0, 0, 0)
/** 180° about X — the far pole from identity, so a midpoint is unambiguous. */
const X_180 = sample(102, 0, 1, 0, 0)

describe('epochOf', () => {
    it('parses the archive timestamp format', () => {
        expect(epochOf('2026-08-29T01:48:41Z')).toBe(1787968121)
    })

    it('is 0 for a string that does not parse, never NaN', () => {
        expect(epochOf('not a date')).toBe(0)
    })
})

describe('indexAtOrBefore', () => {
    const times = [10, 20, 30, 40]

    it('is -1 before the first element', () => {
        expect(indexAtOrBefore(times, 9.99)).toBe(-1)
    })

    it('lands on an exact match', () => {
        expect(indexAtOrBefore(times, 20)).toBe(1)
    })

    it('holds the previous element between two', () => {
        expect(indexAtOrBefore(times, 29.9)).toBe(1)
    })

    it('holds the last element after the end', () => {
        expect(indexAtOrBefore(times, 1000)).toBe(3)
    })

    it('is -1 on an empty array', () => {
        expect(indexAtOrBefore([], 10)).toBe(-1)
    })
})

describe('hasQuaternion', () => {
    it('accepts a complete quaternion', () => {
        expect(hasQuaternion(IDENTITY)).toBe(true)
    })

    it('rejects a sample the recorder wrote with a withheld component', () => {
        expect(hasQuaternion({ ...IDENTITY, quaternion: { w: 1, x: 0, y: 0, z: null } })).toBe(false)
    })
})

describe('attitudeAt', () => {
    it('is null with nothing recorded', () => {
        expect(attitudeAt([], 100)).toBeNull()
    })

    it('is null before the first sample — nothing had been measured yet', () => {
        expect(attitudeAt([IDENTITY], 99)).toBeNull()
    })

    it('holds the last sample after the end of the recording', () => {
        const result = attitudeAt([IDENTITY, X_180], 1e9)
        expect(result).toMatchObject({ w: 0, x: 1, y: 0, z: 0 })
    })

    it('slerps to the midpoint between two samples', () => {
        // Halfway from identity to 180° about X is 90° about X:
        // (√2/2, √2/2, 0, 0).
        const result = attitudeAt([IDENTITY, X_180], 101)
        expect(result).not.toBeNull()
        expect(result?.t).toBe(101)
        expect(result?.w).toBeCloseTo(Math.SQRT1_2, 6)
        expect(result?.x).toBeCloseTo(Math.SQRT1_2, 6)
        expect(result?.y).toBeCloseTo(0, 6)
        expect(result?.z).toBeCloseTo(0, 6)
    })

    it('takes the shortest arc when the recorded signs flip', () => {
        // -q is the same rotation as q; interpolation must not swing the long
        // way round through the opposite hemisphere.
        const flipped = sample(X_180.t, -0, -1, -0, -0)
        const result = attitudeAt([IDENTITY, flipped], 101)
        expect(Math.abs(result?.w ?? 0)).toBeCloseTo(Math.SQRT1_2, 6)
        expect(Math.abs(result?.x ?? 0)).toBeCloseTo(Math.SQRT1_2, 6)
    })

    it('interpolates right up to the gap limit', () => {
        const withinGap = sample(IDENTITY.t + MAX_INTERPOLATION_GAP_SEC, 0, 1, 0, 0)
        const midpoint = IDENTITY.t + MAX_INTERPOLATION_GAP_SEC / 2
        const result = attitudeAt([IDENTITY, withinGap], midpoint)
        expect(result?.w).toBeCloseTo(Math.SQRT1_2, 6)
    })

    it('holds rather than interpolates across a recording gap', () => {
        // The recorder was not writing — SAFE, a restart, a purge boundary —
        // and a slow sweep across the silence would be a rotation the
        // satellite never made.
        const afterGap = sample(IDENTITY.t + MAX_INTERPOLATION_GAP_SEC + 0.1, 0, 1, 0, 0)
        const midway = IDENTITY.t + MAX_INTERPOLATION_GAP_SEC / 2
        const result = attitudeAt([IDENTITY, afterGap], midway)
        expect(result).toMatchObject({ t: IDENTITY.t, w: 1, x: 0, y: 0, z: 0 })
    })

    it('returns identical endpoints unchanged instead of dividing by zero', () => {
        const twin = sample(IDENTITY.t + 1, 1, 0, 0, 0)
        const result = attitudeAt([IDENTITY, twin], IDENTITY.t + 0.5)
        expect(result?.w).toBeCloseTo(1, 6)
        expect(result?.x).toBeCloseTo(0, 6)
    })
})
