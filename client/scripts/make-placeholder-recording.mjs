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
 *     than publish the constant. Once it has a value it is a real compass
 *     bearing — clockwise from north, derived from the same turn the quaternion
 *     carries — because the dashboard reconciles the two against each other and
 *     a heading invented independently of the orientation cannot be reconciled
 *     with anything.
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

/**
 * Degrees the satellite has turned about its own up axis, counter-clockwise seen
 * from above — the sense a quaternion and a scene azimuth both use, and the
 * opposite of the sense a compass bearing uses. One revolution per 40 s.
 */
const turnedDeg = (t) => ((t / 40) * 360) % 360

/** Degrees per second of that turn, for the gyro to agree with. */
const TURN_RATE_DEG_S = 360 / 40

/**
 * The magnetic bearing of the sensor world frame's +X axis, in degrees.
 *
 * A *choice*, and only because this recording is synthetic: the number is what
 * `NorthEstimator` exists to measure rather than assume, so writing it down here
 * is writing down the answer the estimator has to recover. Deliberately not zero
 * — a zero would let an estimator that ignored the offset altogether pass, and
 * "the sensor's world +X happens to be magnetic north" is exactly the assumption
 * `worldFrame.ts` refuses to make.
 */
const NORTH_OFFSET_DEG = 42

/**
 * What the BNO055 would publish as `EUL_HEADING`: a compass bearing, degrees
 * **clockwise** from magnetic north.
 *
 * It has to be derived from the same turn the quaternion carries, or the two
 * disagree — and they did. This generator used to publish the counter-clockwise
 * turn angle verbatim as `yaw`, which reads as a bearing running the wrong way
 * round: `NorthEstimator` folds `yaw + azimuth`, so instead of a constant it got
 * twice the turn angle, 180° of scatter, and the demo's compass ring correctly
 * refused to letter itself. Bearings run clockwise, so the turn is subtracted.
 */
const headingAt = (t) => (((NORTH_OFFSET_DEG - turnedDeg(t)) % 360) + 360) % 360

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
        yaw: calibMag === 3 ? round(headingAt(t), 2) : null,
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
        // The rate of the turn the quaternion actually describes, not a number
        // near it: a gyro that disagreed with the orientation it accompanies is
        // the same inconsistency the heading had.
        gyro_z: round(TURN_RATE_DEG_S + (random() - 0.5) * 2, 3),
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

// ── the radio session log ────────────────────────────────────────────────────
//
// What COMMS would have put on `cubesat/comms/radio` during this walk, in the
// shape `radio_log` stores it: a beacon every 60 s (NOMINAL), two uplinked
// queries with their acks ten seconds later, and one transmission that failed
// mid-walk — the row the widget marks red, because a send that never left is
// on the record, not hidden. Byte counts are real byte counts of the lines.

const utf8 = (text) => Buffer.byteLength(text, 'utf-8')

/** A beacon line as comms/beacon.py assembles one, from this walk's own numbers. */
const beaconLine = (t, extra = []) => {
    const hasFix = t < 12 * 60 || t > 16 * 60
    const travelled = hasFix ? t : 12 * 60
    const fields = [
        `t=${START + t}`,
        'st=NOMINAL',
        ...extra,
        'pr=FLIGHT',
        `b=${round(94 - (t / (MINUTES * 60)) * 11, 1)}`,
        `v=${round(4.12 - (t / (MINUTES * 60)) * 0.24, 2)}`,
        'ep=0'
    ]
    if (hasFix && extra.length === 0) {
        fields.push(
            `lat=${round(LAT0 + travelled * 0.0000075, 4)}`,
            `lon=${round(LON0 + travelled * 0.0000121, 4)}`,
            `alt=${round(156 + Math.sin(t / 200) * 4, 0)}`,
            `sat=${20 + Math.round(random() * 4)}`
        )
    }
    fields.push('m=1')
    return `CSAT ${fields.join(' ')}`
}

const tx = (t, kind, text, sent = 1) => ({
    t: START + t,
    direction: 'tx',
    kind,
    text,
    bytes: utf8(text),
    sender: null,
    snr: null,
    rssi: null,
    hops: null,
    sent
})

const rx = (t, text) => ({
    t: START + t,
    direction: 'rx',
    kind: null,
    text,
    bytes: utf8(text),
    sender: '!e2f1a4c8',
    // The ground station drifting to the edge of the link as the walk moves
    // away: SNR and RSSI degrade a little, hops stay 0 — heard directly.
    snr: round(7.5 - (t / (MINUTES * 60)) * 4 + (random() - 0.5), 2),
    rssi: Math.round(-88 - (t / (MINUTES * 60)) * 14 + (random() - 0.5) * 4),
    hops: 0,
    sent: null
})

const radio = []
for (let t = 0; t < MINUTES * 60; t += 60) {
    // Minute 14: mid-bridge, one transmit that never left — a brownout on the
    // transmit current spike. The schedule retries next wake, as COMMS does.
    radio.push(tx(t, 'beacon', beaconLine(t), t === 14 * 60 ? 0 : 1))
}
// A ground station asking where the satellite is, and the answer riding an
// out-of-schedule beacon ten seconds later, per the radio command contract.
radio.push(rx(8 * 60 + 13, '!pos'))
radio.push(
    tx(
        8 * 60 + 23,
        'ack',
        beaconLine(8 * 60 + 23, [
            're=pos',
            `lat=${round(LAT0 + (8 * 60 + 23) * 0.0000075, 4)}`,
            `lon=${round(LON0 + (8 * 60 + 23) * 0.0000121, 4)}`,
            'fix=1',
            'age=2',
            `alt=${round(156 + Math.sin((8 * 60 + 23) / 200) * 4, 0)}`,
            'sat=22'
        ])
    )
)
radio.push(rx(21 * 60 + 41, '!sys'))
radio.push(
    tx(21 * 60 + 51, 'ack', beaconLine(21 * 60 + 51, ['re=sys', 'cpu=13', 'ram=39', 'disk=24', 'up=1.4h', 'tc=47.2']))
)
radio.sort((a, b) => a.t - b.t)

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
    attitude,
    radio
}

writeFileSync(OUT, `${JSON.stringify(recording)}\n`)
console.log(`${OUT}: ${telemetry.length} rows, ${attitude.length} attitude samples, ${radio.length} radio events`)
