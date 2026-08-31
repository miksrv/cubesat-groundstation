/**
 * The satellite's export format, translated into this app's shapes.
 *
 * Its own module so that both halves of the build-time swap can use it without
 * either one pulling the other in — `index.ts` explains why that matters.
 */

import { decodeMission, decodeTelemetry, num, str } from '../decode'
import type { RadioEvent } from '../types'

import type { Recording } from './replay'

/** One `radio_log` row as an export carries it: `t` for the instant, `sent`
 *  as SQLite's 0/1. Rows that cannot name a direction are dropped, exactly as
 *  DHS refuses them on the recording side. */
const radioEvent = (row: Record<string, unknown>): RadioEvent | null => {
    const direction = row.direction
    if (direction !== 'rx' && direction !== 'tx') {
        return null
    }
    const sent = num(row.sent)
    return {
        timestamp: num(row.t) ?? 0,
        direction,
        kind: str(row.kind),
        text: str(row.text),
        bytes: num(row.bytes),
        sender: str(row.sender),
        snr: num(row.snr),
        rssi: num(row.rssi),
        hops: num(row.hops),
        sent: sent == null ? null : sent !== 0
    }
}

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
    }),
    radio: ((raw.radio ?? []) as unknown[])
        .map((row) => radioEvent(row as Record<string, unknown>))
        .filter((event): event is RadioEvent => event != null)
})
