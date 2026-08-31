/**
 * The pure half of the mission timeline: given a loaded mission and one
 * instant, what was true then.
 *
 * One clock drives the whole replay — the point on the map, the attitude, the
 * charts and the values all read the same instant — so everything here is a
 * function of (recording, t) with no state of its own. The hook owns the
 * clock; this file answers questions about a moment on it.
 *
 * Two rates share that one clock, and they are different in kind:
 *
 *   - **Telemetry** is one wide row per DHS tick, 30 s apart in `NOMINAL`. The
 *     value at t is the row at or before t — a step function, never an
 *     interpolation, because "the battery was 78 %" is a reading and a value
 *     blended between two readings is not.
 *   - **Attitude** is the same track at the rate it was measured, 1 Hz, and it
 *     drives a scene the eye watches. Orientation *is* interpolated — slerp
 *     between the bracketing samples — which is most of why the satellite
 *     stores quaternions rather than Euler angles.
 */

import type { AttitudeUpdate } from '../telemetry/source'
import type { AttitudeSample } from '../telemetry/types'

/**
 * Attitude gaps longer than this are held, not interpolated. A gap means the
 * recorder was not writing — `SAFE`, a restart, a purge boundary — and a slow
 * sweep across it would be a rotation the satellite never made.
 */
export const MAX_INTERPOLATION_GAP_SEC = 5

/** ISO-8601 → epoch seconds; 0 for a string that does not parse. */
export const epochOf = (iso: string): number => Date.parse(iso) / 1000 || 0

/**
 * Index of the last element of an ascending array that is ≤ t, or -1 when t is
 * before all of them. Binary search: a mission is thousands of rows and this
 * runs on every tick of the playhead.
 */
export const indexAtOrBefore = (times: number[], t: number): number => {
    let low = 0
    let high = times.length - 1
    let found = -1
    while (low <= high) {
        const mid = (low + high) >> 1
        if (times[mid] <= t) {
            found = mid
            low = mid + 1
        } else {
            high = mid - 1
        }
    }
    return found
}

/**
 * Whether a sample's quaternion is complete. The recorder writes what ADCS
 * published, and ADCS withholds rather than fabricates — so a sample can carry
 * nulls, and a null component cannot be interpolated through.
 */
export const hasQuaternion = (sample: AttitudeSample): boolean =>
    sample.quaternion.w != null &&
    sample.quaternion.x != null &&
    sample.quaternion.y != null &&
    sample.quaternion.z != null

/**
 * Orientation at t, from samples already filtered by {@link hasQuaternion} and
 * ascending in t.
 *
 * Before the first sample there is no orientation — null, and the scene keeps
 * whatever it shows for "not yet measured" — because extending the first
 * measurement backwards would orient a satellite nobody had read yet. After
 * the last sample the last one holds: the mission ended, nothing moved since.
 */
export const attitudeAt = (samples: AttitudeSample[], t: number): AttitudeUpdate | null => {
    if (samples.length === 0) {
        return null
    }
    let low = 0
    let high = samples.length - 1
    let found = -1
    while (low <= high) {
        const mid = (low + high) >> 1
        if (samples[mid].t <= t) {
            found = mid
            low = mid + 1
        } else {
            high = mid - 1
        }
    }
    if (found < 0) {
        return null
    }
    const previous = samples[found]
    const next = samples[found + 1]
    if (next == null || next.t - previous.t > MAX_INTERPOLATION_GAP_SEC) {
        return asUpdate(previous)
    }
    const span = next.t - previous.t
    const fraction = span > 0 ? (t - previous.t) / span : 0
    return slerp(previous, next, fraction, t)
}

const asUpdate = (sample: AttitudeSample): AttitudeUpdate => ({
    t: sample.t,
    // hasQuaternion vouched for these; the assertions keep the types honest
    // without re-checking per frame.
    w: sample.quaternion.w as number,
    x: sample.quaternion.x as number,
    y: sample.quaternion.y as number,
    z: sample.quaternion.z as number
})

/**
 * Spherical interpolation between two unit quaternions.
 *
 * Written out rather than imported from three.js so this module stays pure
 * data — testable in Jest with no WebGL and importable by anything. The
 * shortest arc is taken (negating one side when the dot product is negative:
 * q and -q are the same rotation), and nearly-parallel pairs fall back to a
 * normalised lerp, where the sin() denominator loses precision.
 */
const slerp = (a: AttitudeSample, b: AttitudeSample, fraction: number, t: number): AttitudeUpdate => {
    const aw = a.quaternion.w as number
    const ax = a.quaternion.x as number
    const ay = a.quaternion.y as number
    const az = a.quaternion.z as number
    let bw = b.quaternion.w as number
    let bx = b.quaternion.x as number
    let by = b.quaternion.y as number
    let bz = b.quaternion.z as number

    let dot = aw * bw + ax * bx + ay * by + az * bz
    if (dot < 0) {
        dot = -dot
        bw = -bw
        bx = -bx
        by = -by
        bz = -bz
    }

    let scaleA: number
    let scaleB: number
    if (dot > 0.9995) {
        scaleA = 1 - fraction
        scaleB = fraction
    } else {
        const theta = Math.acos(Math.min(1, dot))
        const sinTheta = Math.sin(theta)
        scaleA = Math.sin((1 - fraction) * theta) / sinTheta
        scaleB = Math.sin(fraction * theta) / sinTheta
    }

    const w = scaleA * aw + scaleB * bw
    const x = scaleA * ax + scaleB * bx
    const y = scaleA * ay + scaleB * by
    const z = scaleA * az + scaleB * bz
    const norm = Math.hypot(w, x, y, z) || 1
    return { t, w: w / norm, x: x / norm, y: y / norm, z: z / norm }
}
