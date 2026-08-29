/**
 * The satellite's export format, translated into this app's shapes.
 *
 * Its own module so that both halves of the build-time swap can use it without
 * either one pulling the other in — `index.ts` explains why that matters.
 */

import { decodeMission, decodeTelemetry, num } from '../decode'

import type { Recording } from './replay'

export const loadRecording = (raw: Record<string, unknown>): Recording => ({
    mission: decodeMission((raw.mission ?? {}) as Record<string, unknown>),
    telemetry: ((raw.telemetry ?? []) as unknown[]).map((row) => decodeTelemetry(row as Record<string, unknown>)),
    attitude: ((raw.attitude ?? []) as unknown[]).map((row) => {
        const sample = row as Record<string, unknown>
        return {
            t: num(sample.t) ?? 0,
            quaternion: {
                w: num(sample.quat_w),
                x: num(sample.quat_x),
                y: num(sample.quat_y),
                z: num(sample.quat_z)
            }
        }
    })
})
