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
    it('is OK at a healthy charge', () => {
        expect(getEpsStatus(live()).status).toBe('OK')
    })

    it("warns below the satellite's own SAFE threshold", () => {
        expect(getEpsStatus(live({ eps: { ...mockLiveState.eps!, batteryPercent: 20 } })).status).toBe('WARN')
    })

    it('is FAIL in the range that powers the host off', () => {
        expect(getEpsStatus(live({ eps: { ...mockLiveState.eps!, batteryPercent: 6 } })).status).toBe('FAIL')
    })

    it('is not alarmed by a flat battery that is plugged in and charging', () => {
        // On mains there is no power emergency. The satellite suppresses its own
        // descents while external power is present and the charge rate is not
        // still falling; a dashboard shouting CRITICAL would contradict it.
        const charging = { ...mockLiveState.eps!, batteryPercent: 4, externalPower: true, chargeRate: 6.1 }
        expect(getEpsStatus(live({ eps: charging })).status).toBe('OK')
    })

    it('still warns on mains when the pack is going down anyway', () => {
        // The second half of the rule: without it one failed charger would
        // disable the protection for as long as the cable stays in.
        const failing = { ...mockLiveState.eps!, batteryPercent: 8, externalPower: true, chargeRate: -3.0 }
        expect(getEpsStatus(live({ eps: failing })).status).toBe('FAIL')
    })

    it('is UNKNOWN before EPS has said anything', () => {
        expect(getEpsStatus(emptyLiveState).status).toBe('UNKNOWN')
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

    it('does not treat a silenced transmitter as a fault', () => {
        // Quiet is not deaf. A profile that silences the transmitter while the
        // receiver keeps listening is the way back into a satellite in SAFE.
        const quiet = { ...mockLiveState.comms!, loraEnabled: false, loraListening: true }
        const status = getCommsStatus(live({ comms: quiet }))
        expect(status.status).toBe('OK')
        expect(status.detail).toMatch(/listening, not transmitting/)
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
