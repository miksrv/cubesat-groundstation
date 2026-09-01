/**
 * What each subsystem looks like from the outside.
 *
 * Rewritten against what the satellite actually publishes, and the change is
 * not cosmetic: this used to derive health from one flat telemetry row, which
 * meant a subsystem whose *process had died* looked identical to one that had
 * simply not been polled yet.
 *
 * Two rules the satellite's own design imposes here, and they are worth
 * knowing before adding a check:
 *
 * **A heartbeat proves a process, never its hardware.** Every service on that
 * satellite is written to log a silent device and stay up — deliberately, so
 * that OBC reacts to missing telemetry rather than to a vanished process. So a
 * heartbeat alone earns nothing better than UNKNOWN here; a subsystem is OK
 * because its *status message* said a device answered.
 *
 * **Null means withheld, and it is not a fault.** `yaw` is null until the
 * magnetometer is calibrated, `uv_index` until the board revision is known.
 * Those are the satellite refusing to invent a number, and reading them as
 * degradation would put a red light on correct behaviour.
 */

import type { LiveState, MissionState, TelemetryRecord } from '../features/telemetry/types'
import { MISSION_STATES } from '../features/telemetry/types'

/**
 * `FAIL` is OBC's verdict, not this file's: a service the profile expects
 * whose heartbeats stopped. `OFF` is the opposite finding from the same data —
 * the profile never started it, so its silence is correct behaviour. `UNKNOWN`
 * is only the moment before the evidence arrives: a page that just connected,
 * a satellite too old to publish `subsystems`.
 */
export type StatusLevel = 'OK' | 'WARN' | 'FAIL' | 'OFF' | 'UNKNOWN'

export type SubsystemKey = 'OBC' | 'EPS' | 'ADCS' | 'PAYLOAD' | 'DHS' | 'COMMS'

export interface SubsystemStatus {
    key: SubsystemKey
    label: string
    status: StatusLevel
    /** One line saying *why*, so a colour is never the whole message. */
    detail: string
}

/** Worse-of comparator: FAIL > WARN > OK > OFF > UNKNOWN. */
export const worse = (a: StatusLevel, b: StatusLevel): StatusLevel => {
    const rank: Record<StatusLevel, number> = { UNKNOWN: 0, OFF: 1, OK: 2, WARN: 3, FAIL: 4 }
    return rank[a] >= rank[b] ? a : b
}

/** Battery thresholds, from the satellite's own power policy. */
const BATTERY_SAFE = 25
const BATTERY_CRITICAL = 10

export const getEpsStatus = (live: LiveState): SubsystemStatus => {
    const eps = live.eps
    if (!eps || eps.batteryPercent == null) {
        return { key: 'EPS', label: 'EPS', status: 'UNKNOWN', detail: 'no battery reading yet' }
    }
    const charge = `${eps.batteryPercent.toFixed(1)} %`
    // On mains there is no power emergency. The satellite suppresses its own
    // power-driven descents while external power is present, and a dashboard
    // shouting CRITICAL at a satellite that is plugged in and charging would be
    // shouting about the wrong thing.
    if (eps.externalPower === true && (eps.chargeRate == null || eps.chargeRate >= 0)) {
        return { key: 'EPS', label: 'EPS', status: 'OK', detail: `${charge}, on mains` }
    }
    if (eps.batteryPercent < BATTERY_CRITICAL) {
        return { key: 'EPS', label: 'EPS', status: 'FAIL', detail: `${charge} — shutdown range` }
    }
    if (eps.batteryPercent < BATTERY_SAFE) {
        return { key: 'EPS', label: 'EPS', status: 'WARN', detail: `${charge} on battery` }
    }
    return { key: 'EPS', label: 'EPS', status: 'OK', detail: charge }
}

export const getAdcsStatus = (live: LiveState): SubsystemStatus => {
    const adcs = live.adcs
    if (!adcs) {
        // adcs_status is not retained, so a freshly connected page has nothing
        // until the next publish — 0.5 s in NOMINAL. Silence beyond that means
        // the service is not running, which the profile may well intend.
        return { key: 'ADCS', label: 'ADCS', status: 'UNKNOWN', detail: 'no orientation published' }
    }
    const mag = adcs.calibStatus?.mag ?? null
    if (mag != null && mag < 3) {
        // Not a fault: the BNO055 reports a constant below calib 3 and the
        // satellite withholds yaw rather than publish it. Worth surfacing,
        // because "no heading" otherwise looks like a broken sensor.
        return {
            key: 'ADCS',
            label: 'ADCS',
            status: 'WARN',
            detail: `magnetometer calib ${mag}/3 — heading withheld`
        }
    }
    if (adcs.gnss.fix !== true) {
        return { key: 'ADCS', label: 'ADCS', status: 'WARN', detail: 'no GNSS fix' }
    }
    return { key: 'ADCS', label: 'ADCS', status: 'OK', detail: `${adcs.gnss.satellites ?? 0} satellites` }
}

/** Mission states that are themselves the warning. */
const DESCENT: Record<string, StatusLevel> = {
    LOW_POWER: 'WARN',
    SAFE: 'WARN',
    CRITICAL: 'FAIL'
}

export const getObcStatus = (live: LiveState, latest: TelemetryRecord | null): SubsystemStatus => {
    const obc = live.obc
    if (!obc) {
        return { key: 'OBC', label: 'OBC', status: 'UNKNOWN', detail: 'no state published' }
    }
    const descent = DESCENT[obc.status]
    if (descent) {
        return { key: 'OBC', label: 'OBC', status: descent, detail: `state ${obc.status}` }
    }
    // The state name is rendered wherever the satellite says it, but a name
    // this build cannot classify must not be pronounced healthy — OK below is
    // a claim, and it is only earned by a state on the known list.
    if (!MISSION_STATES.includes(obc.status as MissionState)) {
        return { key: 'OBC', label: 'OBC', status: 'UNKNOWN', detail: `unrecognized state ${obc.status}` }
    }
    // CPU and RAM are not on any status topic — only DHS records them — so this
    // is the newest recorded row, up to one DHS cadence old. Absent while no
    // mission is being recorded, which is not a fault either.
    const cpu = latest?.cpuPercent ?? null
    const ram = latest?.ramPercent ?? null
    if (cpu != null && ram != null && (cpu > 95 || ram > 95)) {
        return { key: 'OBC', label: 'OBC', status: 'WARN', detail: `cpu ${cpu.toFixed(0)} %, ram ${ram.toFixed(0)} %` }
    }
    return { key: 'OBC', label: 'OBC', status: 'OK', detail: `state ${obc.status}` }
}

export const getPayloadStatus = (live: LiveState): SubsystemStatus => {
    const payload = live.payload
    if (!payload) {
        // A replayed row carries no payload_status, but its science columns are
        // the sensor's own readings — evidence the device answered, which is
        // exactly what `present` would have said.
        if (live.science) {
            return { key: 'PAYLOAD', label: 'PAYLOAD', status: 'OK', detail: 'science data recorded' }
        }
        return { key: 'PAYLOAD', label: 'PAYLOAD', status: 'UNKNOWN', detail: 'not reporting' }
    }
    // `present` is the result of a real transaction with the device — which is
    // exactly what makes it worth checking, and what a heartbeat cannot say.
    const dead = [
        payload.sensor && !payload.sensor.present ? 'sensor' : null,
        payload.camera && !payload.camera.present ? 'camera' : null
    ].filter(Boolean)
    if (payload.storage?.blocked) {
        return {
            key: 'PAYLOAD',
            label: 'PAYLOAD',
            status: 'WARN',
            detail: `card full — captures refused (${payload.storage.freeMb?.toFixed(0) ?? '?'} MB free)`
        }
    }
    if (dead.length > 0) {
        // One dead device degrades the payload; it does not silence it. The
        // science keeps flowing with a broken camera, and vice versa.
        return { key: 'PAYLOAD', label: 'PAYLOAD', status: 'WARN', detail: `${dead.join(' and ')} silent` }
    }
    return { key: 'PAYLOAD', label: 'PAYLOAD', status: 'OK', detail: 'sensor and camera answered' }
}

export const getDhsStatus = (live: LiveState): SubsystemStatus => {
    const dhs = live.dhs
    if (!dhs) {
        return { key: 'DHS', label: 'DHS', status: 'UNKNOWN', detail: 'not reporting' }
    }
    if (dhs.attitude && dhs.attitude.buffered > 0) {
        // The number that says a card has stopped accepting writes while the
        // recorder is still, correctly, alive.
        return {
            key: 'DHS',
            label: 'DHS',
            status: 'WARN',
            detail: `${dhs.attitude.buffered} samples held — writes failing`
        }
    }
    if (dhs.radio && dhs.radio.buffered > 0) {
        // The same claim for the radio log: events heard but not yet on disk.
        return {
            key: 'DHS',
            label: 'DHS',
            status: 'WARN',
            detail: `${dhs.radio.buffered} radio events held — writes failing`
        }
    }
    if (!dhs.recording) {
        // Not a fault, and not unknown either: DHS reported in, its database
        // answers, there is simply no mission to record yet — STANDBY, or a
        // fresh DEPLOY. A recorder that is healthy and idle is healthy.
        return { key: 'DHS', label: 'DHS', status: 'OK', detail: 'idle — no mission open' }
    }
    return { key: 'DHS', label: 'DHS', status: 'OK', detail: `mission ${dhs.mission?.id ?? '?'}` }
}

export const getCommsStatus = (live: LiveState): SubsystemStatus => {
    const comms = live.comms
    if (!comms) {
        return { key: 'COMMS', label: 'COMMS', status: 'UNKNOWN', detail: 'not reporting' }
    }
    if (comms.radio && !comms.radio.present) {
        return { key: 'COMMS', label: 'COMMS', status: 'FAIL', detail: 'radio did not answer' }
    }
    // Quiet is not deaf, and the two are different states. A profile that
    // silences the transmitter while the receiver keeps listening is the way
    // back into a satellite in SAFE — not a degradation.
    if (!comms.loraEnabled) {
        return {
            key: 'COMMS',
            label: 'COMMS',
            status: 'OK',
            detail: comms.loraListening ? 'listening, not transmitting' : 'radio off for this profile'
        }
    }
    return { key: 'COMMS', label: 'COMMS', status: 'OK', detail: comms.radio?.node ?? 'transmitting' }
}

/** The wire name OBC's watch list uses for each row of the widget. */
const SERVICE_BY_KEY: Record<Exclude<SubsystemKey, 'OBC'>, string> = {
    EPS: 'eps',
    ADCS: 'adcs',
    PAYLOAD: 'payload',
    DHS: 'dhs',
    COMMS: 'comms'
}

/**
 * OBC's verdict, laid over what the subsystem says about itself.
 *
 * The satellite is the authority on which services *should* be running: a
 * service in `lost` is a fault whatever its last status message claimed, and
 * one absent from `watched` is off because the profile says so — its silence
 * is correct behaviour, not a grey mystery. Everything in between is judged
 * from the subsystem's own status message, as before. Without `subsystems`
 * (an old recording, an old satellite) nothing is overridden.
 *
 * Exported for the per-subsystem widgets, whose footers would otherwise show
 * a grey dash for a service the profile deliberately never started — "OFF"
 * is a finding, "—" is a shrug, and the two must not look alike.
 */
export const applyObcVerdict = (status: SubsystemStatus, live: LiveState): SubsystemStatus => {
    const health = live.obc?.subsystems
    if (!health || status.key === 'OBC') {
        return status
    }
    const service = SERVICE_BY_KEY[status.key]
    if (health.lost.includes(service)) {
        return { ...status, status: 'FAIL', detail: 'expected by the profile and silent — OBC declared it lost' }
    }
    if (!health.watched.includes(service)) {
        const profile = live.obc?.profile
        return {
            ...status,
            status: 'OFF',
            detail: profile ? `not started by ${profile}` : 'not started by this profile'
        }
    }
    if (status.status === 'UNKNOWN') {
        // Watched and not lost means OBC vouches for the process — heartbeats
        // are current. That is all it vouches for: a heartbeat proves a
        // process, never its hardware, so the level honestly stays UNKNOWN
        // until a status message says a device answered.
        return { ...status, detail: `${status.detail} — process alive per OBC` }
    }
    return status
}

export const getSubsystemStatuses = (live: LiveState, latest: TelemetryRecord | null = null): SubsystemStatus[] =>
    [
        getObcStatus(live, latest),
        getEpsStatus(live),
        getAdcsStatus(live),
        getPayloadStatus(live),
        getDhsStatus(live),
        getCommsStatus(live)
    ].map((status) => applyObcVerdict(status, live))

export type MissionStatus = 'NOMINAL' | 'WARNING' | 'CRITICAL' | 'UNKNOWN'

/**
 * The headline, which is the mission state when there is one.
 *
 * Deliberately **not** the worst subsystem. The satellite has its own state
 * machine and it is the authority on how it is doing; a dashboard that
 * announced CRITICAL because the camera is unplugged would be contradicting the
 * satellite about the satellite. Subsystem colours say what is wrong; this says
 * what the satellite thinks.
 */
export const getMissionStatus = (live: LiveState): MissionStatus => {
    const state = live.obc?.status
    // Unknown covers both silence and a state this build cannot classify: the
    // headline NOMINAL is a health claim, and an unrecognized state has not
    // earned it — the badge still shows the state's real name.
    if (!state || !MISSION_STATES.includes(state as MissionState)) {
        return 'UNKNOWN'
    }
    if (state === 'CRITICAL') {
        return 'CRITICAL'
    }
    if (state === 'SAFE' || state === 'LOW_POWER') {
        return 'WARNING'
    }
    return 'NOMINAL'
}
