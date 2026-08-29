/**
 * Generates the placeholder recording the static demo replays.
 *
 * **This is a stand-in, and it is meant to be thrown away.** The demo is
 * supposed to replay a real walk exported from the satellite —
 * `GET /api/missions/<id>/export` — because a recording shows what the hardware
 * actually did, while a generator only ever shows what somebody thought it
 * would do. Nothing has run on the Raspberry Pi yet, so there is no export to
 * bundle; this file fills the gap and should be replaced by the first real one.
 *
 * What it does copy faithfully is the *shape*, including the awkward parts,
 * because those are what the widgets have to handle:
 *
 *   - `yaw` is null for the first third: the BNO055 reports a constant until
 *     the magnetometer reaches calib 3, and the satellite withholds it rather
 *     than publish the constant.
 *   - `uv_index` is null throughout: the SEN0501 board revision is unknown, and
 *     two revisions read one register with formulas that disagree by forty.
 *   - The fix drops for a stretch, and the coordinates go stale rather than
 *     null — which is why a track is drawn from rows where `fix` is true.
 *
 * Run: node scripts/make-placeholder-recording.mjs
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/features/telemetry/recordings/placeholder.json')

const START = Date.parse('2026-08-24T07:00:00Z') / 1000
const TELEMETRY_CADENCE = 30 // seconds, DHS in NOMINAL
const ATTITUDE_CADENCE = 1 // seconds, dhs.attitude_min_interval_sec
const MINUTES = 30
const ROWS = (MINUTES * 60) / TELEMETRY_CADENCE

// A walk north-east from a point in Moscow, about a metre a second.
const LAT0 = 55.7558
const LON0 = 37.6173

const iso = (epoch) => new Date(epoch * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')
const round = (value, places) => Number(value.toFixed(places))

// Deterministic noise: a committed fixture that changes on every run makes
// every diff unreadable and every screenshot a lie about the last one.
let seed = 20260824
const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
}

const quaternionAt = (t) => {
    // A slow tumble plus a hand's wobble — enough that interpolation between
    // 1 Hz samples has something to interpolate.
    const yaw = (t / 40) * Math.PI * 2
    const wobble = Math.sin(t / 7) * 0.12
    const half = yaw / 2
    return {
        w: round(Math.cos(half) * Math.cos(wobble), 5),
        x: round(Math.sin(wobble) * 0.8, 5),
        y: round(Math.sin(wobble) * 0.3, 5),
        z: round(Math.sin(half) * Math.cos(wobble), 5)
    }
}

const telemetry = []
for (let index = 0; index < ROWS; index += 1) {
    const t = index * TELEMETRY_CADENCE
    const at = START + t
    // The fix drops between minutes 12 and 16 — under a bridge, in a bag.
    const hasFix = t < 12 * 60 || t > 16 * 60
    const travelled = hasFix ? t : 12 * 60
    const quat = quaternionAt(t)
    const calibMag = t < MINUTES * 20 ? 1 : 3
    telemetry.push({
        id: index + 1,
        timestamp: iso(at),
        mission_id: 1,
        profile: 'FLIGHT',
        obc_state: 'NOMINAL',
        battery: round(94 - (t / (MINUTES * 60)) * 11, 2),
        voltage: round(4.12 - (t / (MINUTES * 60)) * 0.24, 3),
        external_power: 0,
        roll: round(Math.sin(t / 11) * 6, 2),
        pitch: round(Math.cos(t / 13) * 4, 2),
        // Withheld until the magnetometer is calibrated. Not a zero.
        yaw: calibMag === 3 ? round(((t / 40) * 360) % 360, 2) : null,
        quat_w: quat.w,
        quat_x: quat.x,
        quat_y: quat.y,
        quat_z: quat.z,
        imu_temp: round(31 + Math.sin(t / 300) * 1.5, 2),
        accel_x: round((random() - 0.5) * 0.08, 3),
        accel_y: round((random() - 0.5) * 0.08, 3),
        accel_z: round(0.98 + (random() - 0.5) * 0.05, 3),
        gyro_x: round((random() - 0.5) * 3, 3),
        gyro_y: round((random() - 0.5) * 3, 3),
        gyro_z: round(8 + (random() - 0.5) * 2, 3),
        calib_status: JSON.stringify({ sys: 3, gyro: 3, accel: 3, mag: calibMag }),
        lat: round(LAT0 + travelled * 0.0000075, 6),
        lon: round(LON0 + travelled * 0.0000121, 6),
        alt: round(156 + Math.sin(t / 200) * 4, 1),
        speed: hasFix ? round(1.1 + (random() - 0.5) * 0.5, 2) : 0,
        fix: hasFix ? 1 : 0,
        satellites: hasFix ? 20 + Math.round(random() * 4) : 0,
        temperature: round(22.5 + Math.sin(t / 400) * 1.8, 2),
        humidity: round(46 + Math.cos(t / 350) * 5, 1),
        pressure: round(1012.4 + Math.sin(t / 600) * 0.9, 1),
        light: round(380 + Math.sin(t / 90) * 240 + random() * 60, 1),
        // Withheld: the SEN0501 board revision is unknown.
        uv_index: null,
        cpu_percent: round(11 + random() * 9, 1),
        ram_percent: round(38 + random() * 4, 1),
        swap_percent: 0,
        disk_percent: round(24 + t / 6000, 1),
        uptime_seconds: 3600 + t,
        cpu_temperature: round(46 + Math.sin(t / 250) * 3 + random() * 1.5, 1)
    })
}

const attitude = []
for (let t = 0; t < MINUTES * 60; t += ATTITUDE_CADENCE) {
    const quat = quaternionAt(t)
    attitude.push({ t: round(START + t, 1), quat_w: quat.w, quat_x: quat.x, quat_y: quat.y, quat_z: quat.z })
}

const last = telemetry[telemetry.length - 1]
const recording = {
    _placeholder: 'Generated by scripts/make-placeholder-recording.mjs. Replace with a real export.',
    mission: {
        id: 1,
        label: 'walk to work',
        profile: 'FLIGHT',
        started_at: telemetry[0].timestamp,
        ended_at: last.timestamp,
        end_reason: 'profile_change',
        rows: telemetry.length,
        first_fix_at: telemetry[0].timestamp,
        distance_m: round(MINUTES * 60 * 1.1, 1),
        notes: null,
        purged_at: null
    },
    telemetry,
    attitude
}

writeFileSync(OUT, `${JSON.stringify(recording)}\n`)
console.log(`${OUT}: ${telemetry.length} rows, ${attitude.length} attitude samples`)
