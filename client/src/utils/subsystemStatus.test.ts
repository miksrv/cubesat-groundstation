import { emptyLiveState, mockLiveState, mockTelemetryRecord } from '../test-fixtures'

import {
    getAdcsStatus,
    getCommsStatus,
    getDhsStatus,
    getEpsStatus,
    getMissionStatus,
    getObcStatus,
    getPayloadStatus,
    getSubsystemStatuses,
    worse
} from './subsystemStatus'

const live = (patch: Partial<typeof mockLiveState> = {}) => ({ ...mockLiveState, ...patch })

describe('worse', () => {
    it('ranks FAIL above WARN above OK above OFF above UNKNOWN', () => {
        expect(worse('OK', 'FAIL')).toBe('FAIL')
        expect(worse('WARN', 'OK')).toBe('WARN')
        expect(worse('UNKNOWN', 'OK')).toBe('OK')
        expect(worse('OFF', 'UNKNOWN')).toBe('OFF')
        expect(worse('OK', 'OFF')).toBe('OK')
    })
})

describe('getEpsStatus', () => {
    it('is OK on the plateau, and leads its reason with the voltage', () => {
        const status = getEpsStatus(live())
        expect(status.status).toBe('OK')
        // The measured level first, the derived percentage in parentheses. The
        // order is the point: it is what says which of the two the verdict was
        // taken on.
        expect(status.detail).toBe('3.759 V (49 %)')
    })

    it("warns below the satellite's own SAFE threshold, in volts", () => {
        // 3.58 V, exactly `SAFE_VOLTS` in obc/power_policy.py. This used to
        // compare 25 %, which was not even the satellite's own number — SAFE was
        // 20 % — and by 2026-09-04 the satellite had stopped comparing a
        // percentage at all.
        const low = { ...mockLiveState.eps!, voltage: 3.57, voltageMedian: 3.57, batteryPercent: 19.3 }
        expect(getEpsStatus(live({ eps: low })).status).toBe('WARN')
    })

    it('is FAIL in the range that powers the host off', () => {
        const critical = { ...mockLiveState.eps!, voltage: 3.44, voltageMedian: 3.44, batteryPercent: 9.3 }
        expect(getEpsStatus(live({ eps: critical })).status).toBe('FAIL')
    })

    it('compares the median EPS smooths, not the raw sample', () => {
        // `reading_from` in the satellite's power policy prefers
        // `voltage_median` for a reason measured on the hardware: a camera
        // capture pulls the terminal voltage down for a single sample, and a
        // threshold in volts is sensitive to that in a way a threshold in
        // modelled percent was not. So one dipped sample must not read as SAFE.
        const dipped = { ...mockLiveState.eps!, voltage: 3.5, voltageMedian: 3.76 }
        expect(getEpsStatus(live({ eps: dipped })).status).toBe('OK')
    })

    it('falls back to the raw voltage before the median exists', () => {
        // EPS' first ticks, where one un-smoothed sample is still a measurement
        // of the pack — and the alternative is a dashboard with no verdict for
        // the first two minutes after every connect.
        const first = { ...mockLiveState.eps!, voltage: 3.44, voltageMedian: null, batteryPercent: 9.3 }
        expect(getEpsStatus(live({ eps: first })).status).toBe('FAIL')
    })

    it('is not alarmed by a gauge claiming a flat pack while the voltage sits on mains', () => {
        // This is the drift that nearly powered a plugged-in satellite off. On
        // 2026-09-03 the MAX17040/41's modelled state of charge fell at 8-10 %/h
        // for an hour while the terminal voltage held 3.806-3.809 V on mains with
        // the charge LEDs lit — so `gaugePercent` says 4 % here and the pack is
        // demonstrably fine. Nothing in this file may read that field.
        const drifting = {
            ...mockLiveState.eps!,
            voltage: 3.809,
            voltageMedian: 3.807,
            batteryPercent: 56.0,
            gaugePercent: 4.0,
            externalPower: true,
            voltageRate: 0,
            chargeRate: 0
        }
        expect(getEpsStatus(live({ eps: drifting })).status).toBe('OK')
    })

    it('still fails on mains when the voltage is falling anyway', () => {
        // The second half of the rule: without it one failed charger would
        // disable the protection for as long as the cable stays in. −197 mV/h is
        // the measured idle discharge, well past the −30 mV/h the satellite calls
        // draining.
        const failing = {
            ...mockLiveState.eps!,
            voltage: 3.41,
            voltageMedian: 3.41,
            batteryPercent: 7.9,
            externalPower: true,
            voltageRate: -197,
            chargeRate: -19.7
        }
        expect(getEpsStatus(live({ eps: failing })).status).toBe('FAIL')
    })

    it('trusts the mains pin while EPS has no slope to offer', () => {
        // Null is EPS' first 300 s and the 300 s after the pin moved, and it
        // means "not known yet". Reading it as draining would descend on a
        // satellite that has just been plugged in — the satellite itself trusts
        // the pin here, so a dashboard that did not would contradict it.
        const settling = {
            ...mockLiveState.eps!,
            voltage: 3.5,
            voltageMedian: 3.5,
            batteryPercent: 13.6,
            externalPower: true,
            voltageRate: null,
            chargeRate: null
        }
        expect(getEpsStatus(live({ eps: settling })).status).toBe('OK')
    })

    it('withholds a percentage it was not given rather than filling one in', () => {
        const noPercent = { ...mockLiveState.eps!, batteryPercent: null }
        expect(getEpsStatus(live({ eps: noPercent })).detail).toBe('3.759 V')
    })

    it('is UNKNOWN with no voltage at all, because a silent gauge is not 0 V', () => {
        expect(getEpsStatus(emptyLiveState).status).toBe('UNKNOWN')
        // A percentage on its own is no verdict either: the voltage is the
        // required field, exactly as it is in `reading_from`.
        const percentOnly = { ...mockLiveState.eps!, voltage: null, voltageMedian: null }
        expect(getEpsStatus(live({ eps: percentOnly })).status).toBe('UNKNOWN')
    })
})

describe('getAdcsStatus', () => {
    it('is OK with a fix and a calibrated magnetometer', () => {
        expect(getAdcsStatus(live()).status).toBe('OK')
    })

    it('explains a withheld heading rather than reporting a fault', () => {
        const uncalibrated = { ...mockLiveState.adcs!, yaw: null, calibStatus: { sys: 3, gyro: 3, accel: 3, mag: 1 } }
        const status = getAdcsStatus(live({ adcs: uncalibrated }))
        expect(status.status).toBe('WARN')
        expect(status.detail).toMatch(/heading withheld/)
    })

    it('is UNKNOWN before ADCS publishes, because that topic is not retained', () => {
        expect(getAdcsStatus(emptyLiveState).status).toBe('UNKNOWN')
    })
})

describe('getObcStatus', () => {
    it('reports the mission state as the reason', () => {
        expect(getObcStatus(live(), mockTelemetryRecord).detail).toBe('state NOMINAL')
    })

    it('treats a descent as the warning it is', () => {
        const safe = { ...mockLiveState.obc!, status: 'SAFE' as const }
        expect(getObcStatus(live({ obc: safe }), null).status).toBe('WARN')
        const critical = { ...mockLiveState.obc!, status: 'CRITICAL' as const }
        expect(getObcStatus(live({ obc: critical }), null).status).toBe('FAIL')
    })

    it('is OK with no recorded row at all', () => {
        // CPU and RAM come from what DHS wrote, and a profile that records
        // nothing is not a fault.
        expect(getObcStatus(live(), null).status).toBe('OK')
    })

    it('does not pronounce a state it cannot classify healthy', () => {
        // The satellite may grow a state after this build ships. The name
        // renders verbatim, but OK is a claim only a known state earns.
        const grown = { ...mockLiveState.obc!, status: 'HIBERNATE' }
        const verdict = getObcStatus(live({ obc: grown }), mockTelemetryRecord)
        expect(verdict.status).toBe('UNKNOWN')
        expect(verdict.detail).toBe('unrecognized state HIBERNATE')
    })
})

describe('getPayloadStatus', () => {
    it('is OK when both devices answered', () => {
        expect(getPayloadStatus(live()).status).toBe('OK')
    })

    it('degrades rather than fails when one device is silent', () => {
        // One dead device degrades the payload; it does not silence it. The
        // science keeps flowing with a broken camera, and vice versa.
        const noCamera = { ...mockLiveState.payload!, camera: { device: 'Camera Module V2', present: false } }
        const status = getPayloadStatus(live({ payload: noCamera }))
        expect(status.status).toBe('WARN')
        expect(status.detail).toMatch(/camera silent/)
    })

    it('reports a full card, which is why captures stopped', () => {
        const full = { ...mockLiveState.payload!, storage: { freeMb: 40, minFreeMb: 512, blocked: true } }
        expect(getPayloadStatus(live({ payload: full })).detail).toMatch(/card full/)
    })
})

describe('getDhsStatus', () => {
    it('is OK while a mission is open', () => {
        expect(getDhsStatus(live()).status).toBe('OK')
    })

    it('reports held samples, which is a card that stopped accepting writes', () => {
        const stuck = { ...mockLiveState.dhs!, attitude: { written: 10, buffered: 812, minIntervalSec: 1 } }
        expect(getDhsStatus(live({ dhs: stuck })).status).toBe('WARN')
    })

    it('reports held radio events the same way — the same claim, other track', () => {
        const stuck = { ...mockLiveState.dhs!, radio: { written: 34, buffered: 12 } }
        const status = getDhsStatus(live({ dhs: stuck }))
        expect(status.status).toBe('WARN')
        expect(status.detail).toMatch(/12 radio events held/)
    })

    it('calls a healthy recorder with no mission open OK, not a fault', () => {
        // HOSTED and MAINTENANCE record nothing by design, and DHS did report in.
        const idle = { ...mockLiveState.dhs!, recording: false, mission: null }
        const status = getDhsStatus(live({ dhs: idle }))
        expect(status.status).toBe('OK')
        expect(status.detail).toMatch(/no mission open/)
    })
})

describe('getCommsStatus', () => {
    it('is FAIL when the radio did not answer', () => {
        const dead = { ...mockLiveState.comms!, radio: { present: false, node: null, region: null } }
        expect(getCommsStatus(live({ comms: dead })).status).toBe('FAIL')
    })

    it('does not treat a stopped beacon as a fault, and does not call it silence', () => {
        // Quiet is not deaf. A profile that stops the scheduled beacon while
        // the receiver keeps listening is the way back into a satellite in
        // SAFE — and since 2026-09-03 that satellite also answers every
        // command it accepts, so `not transmitting` would be wrong as well as
        // alarming.
        const quiet = { ...mockLiveState.comms!, beaconEnabled: false, loraListening: true }
        const status = getCommsStatus(live({ comms: quiet }))
        expect(status.status).toBe('OK')
        expect(status.detail).toMatch(/beacon off — listening, answers commands/)
    })

    it('does say so when the profile has taken the radio away entirely', () => {
        const dark = { ...mockLiveState.comms!, beaconEnabled: false, loraListening: false }
        expect(getCommsStatus(live({ comms: dark })).detail).toMatch(/radio off for this profile/)
    })
})

describe('getSubsystemStatuses', () => {
    it('covers every subsystem the dashboard can see', () => {
        expect(getSubsystemStatuses(live(), mockTelemetryRecord).map((s) => s.key)).toEqual([
            'OBC',
            'EPS',
            'ADCS',
            'PAYLOAD',
            'DHS',
            'COMMS'
        ])
    })

    it('shows FAIL for a service OBC declared lost, whatever it last said about itself', () => {
        // The last retained comms_status still says the radio is fine — it is
        // retained, that is the point — but OBC watched the heartbeats stop.
        const obc = {
            ...mockLiveState.obc!,
            subsystems: { watched: ['adcs', 'comms', 'dhs', 'eps', 'payload'], lost: ['comms'] }
        }
        const comms = getSubsystemStatuses(live({ obc }), null).find((s) => s.key === 'COMMS')!
        expect(comms.status).toBe('FAIL')
        expect(comms.detail).toMatch(/lost/)
    })

    it('shows OFF, not a fault, for a service the profile never started', () => {
        // A red light on correct behaviour would be a lie: HOSTED does not run
        // ADCS, PAYLOAD or DHS, and their silence is the profile working.
        const obc = {
            ...mockLiveState.obc!,
            profile: 'HOSTED' as const,
            subsystems: { watched: ['comms', 'eps'], lost: [] }
        }
        const silent = live({ obc, adcs: null, payload: null, dhs: null, science: null })
        const byKey = Object.fromEntries(getSubsystemStatuses(silent, null).map((s) => [s.key, s]))
        expect(byKey.ADCS.status).toBe('OFF')
        expect(byKey.PAYLOAD.status).toBe('OFF')
        expect(byKey.DHS.status).toBe('OFF')
        expect(byKey.ADCS.detail).toMatch(/HOSTED/)
        expect(byKey.COMMS.status).toBe('OK')
    })

    it('overrides nothing when the satellite predates the subsystems field', () => {
        const obc = { ...mockLiveState.obc!, subsystems: null }
        const statuses = getSubsystemStatuses(live({ obc, adcs: null }), null)
        expect(statuses.find((s) => s.key === 'ADCS')!.status).toBe('UNKNOWN')
    })

    it('treats a replayed row with science columns as a payload that answered', () => {
        // An export carries no payload_status, but the science columns are the
        // sensor's own readings — evidence the device answered.
        const replay = live({ payload: null })
        expect(getSubsystemStatuses(replay, null).find((s) => s.key === 'PAYLOAD')!.status).toBe('OK')
    })

    it("keeps a watched-but-silent subsystem UNKNOWN, with OBC's vouching in the detail", () => {
        // A heartbeat proves a process, never its hardware: OBC watching comms
        // and not losing it earns a better explanation, not a better colour.
        const comms = getSubsystemStatuses(live({ comms: null }), null).find((s) => s.key === 'COMMS')!
        expect(comms.status).toBe('UNKNOWN')
        expect(comms.detail).toMatch(/process alive per OBC/)
    })
})

describe('getMissionStatus', () => {
    it("is the satellite's own state, not the worst subsystem", () => {
        // The satellite has a state machine and it is the authority on how it is
        // doing. A dashboard announcing CRITICAL because a camera is unplugged
        // would be contradicting the satellite about the satellite.
        const oneDeadDevice = {
            ...mockLiveState.payload!,
            camera: { device: 'Camera Module V2', present: false }
        }
        expect(getMissionStatus(live({ payload: oneDeadDevice }))).toBe('NOMINAL')
    })

    it('follows the state down', () => {
        expect(getMissionStatus(live({ obc: { ...mockLiveState.obc!, status: 'SAFE' } }))).toBe('WARNING')
        expect(getMissionStatus(live({ obc: { ...mockLiveState.obc!, status: 'CRITICAL' } }))).toBe('CRITICAL')
    })

    it('is UNKNOWN before OBC has published', () => {
        expect(getMissionStatus(emptyLiveState)).toBe('UNKNOWN')
    })

    it('is UNKNOWN for a state this build cannot classify', () => {
        // NOMINAL is a health claim; an unrecognized state has not earned it.
        expect(getMissionStatus(live({ obc: { ...mockLiveState.obc!, status: 'HIBERNATE' } }))).toBe('UNKNOWN')
    })
})
