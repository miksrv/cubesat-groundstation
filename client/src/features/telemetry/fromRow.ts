/**
 * One recorded telemetry row, rendered as the live state it once was.
 *
 * Two replays need this mapping — the bundled recording that is the public
 * demo, and the mission timeline replaying a row out of the archive — and the
 * widgets must not be able to tell either from the satellite. So the mapping
 * exists once, here, and both callers use it: a second copy would drift on the
 * first edit, and the drift would show up as a widget that renders live but
 * not replayed.
 *
 * Everything a row does not carry is null, never derived. A telemetry row is
 * what DHS wrote down, and a replay shows what happened — inventing the fields
 * the recorder does not keep would put numbers on screen the satellite never
 * measured.
 */

import type { AdcsStatus, LiveState, MissionSummary, TelemetryRecord } from './types'
import { EMPTY_LIVE_STATE } from './types'

/** Where the replay stands in the recording, for the DHS panel's counters. */
export interface ReplayProgress {
    /** Rows replayed so far — what the recorder's row count read at this row. */
    played: number
    /** Rows the recording holds in total. */
    total: number
}

export const liveStateFromRow = (
    row: TelemetryRecord,
    mission: MissionSummary,
    progress: ReplayProgress
): LiveState => {
    const at = Date.parse(row.timestamp) / 1000 || 0
    return {
        ...EMPTY_LIVE_STATE,
        obc: {
            timestamp: at,
            status: row.obcState ?? 'NOMINAL',
            profile: row.profile,
            cadenceScale: 1,
            persistence: 'mission_db',
            missionLabel: mission.label,
            // Justified, not invented: a mission records only under profiles
            // that run all five services, and a row whose state is not SAFE
            // exists because none of them was lost when it was written — OBC
            // would have latched SAFE otherwise. What the row cannot vouch for
            // is the radio hardware, which is why COMMS still renders UNKNOWN:
            // an export records the link's process, never its device.
            subsystems: { watched: ['adcs', 'comms', 'dhs', 'eps', 'payload'], lost: [] }
        },
        eps: {
            timestamp: at,
            batteryPercent: row.battery,
            voltage: row.voltage,
            externalPower: row.externalPower,
            // Not recorded as a column — it lives in raw_json, which an
            // export does not carry. Withheld rather than derived from two
            // battery readings, which would be a rate this satellite never
            // measured.
            chargeRate: null
        },
        adcs: adcsFromRow(row, at),
        science: {
            timestamp: at,
            temperature: row.temperature,
            humidity: row.humidity,
            pressure: row.pressure,
            light: row.light,
            uvIndex: row.uvIndex,
            uvRaw: null
        },
        dhs: {
            timestamp: at,
            recording: true,
            database: null,
            mission: {
                id: mission.id,
                label: mission.label,
                startedAt: mission.startedAt,
                rows: progress.played
            },
            rows: progress.total,
            dbSizeBytes: null,
            lastWrite: at,
            retentionDays: null,
            attitude: null,
            radio: null,
            photos: null
        }
    }
}

const adcsFromRow = (row: TelemetryRecord, at: number): AdcsStatus => ({
    timestamp: at,
    roll: row.roll,
    pitch: row.pitch,
    yaw: row.yaw,
    quaternion: row.quaternion,
    calibStatus: row.calibStatus,
    imuTemp: row.imuTemp,
    accel: row.accel,
    gyro: row.gyro,
    gnss: row.gnss
})
