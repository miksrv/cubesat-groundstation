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
    it('ranks CRITICAL above WARN above OK above UNKNOWN', () => {
        expect(worse('OK', 'CRITICAL')).toBe('CRITICAL')
        expect(worse('WARN', 'OK')).toBe('WARN')
        expect(worse('UNKNOWN', 'OK')).toBe('OK')
    })
})

describe('getEpsStatus', () => {
    it('is OK at a healthy charge', () => {
        expect(getEpsStatus(live()).status).toBe('OK')
    })

    it("warns below the satellite's own SAFE threshold", () => {
        expect(getEpsStatus(live({ eps: { ...mockLiveState.eps!, batteryPercent: 20 } })).status).toBe('WARN')
    })

    it('is CRITICAL in the range that powers the host off', () => {
        expect(getEpsStatus(live({ eps: { ...mockLiveState.eps!, batteryPercent: 6 } })).status).toBe('CRITICAL')
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
        expect(getEpsStatus(live({ eps: failing })).status).toBe('CRITICAL')
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
        expect(getObcStatus(live({ obc: critical }), null).status).toBe('CRITICAL')
    })

    it('is OK with no recorded row at all', () => {
        // CPU and RAM come from what DHS wrote, and a profile that records
        // nothing is not a fault.
        expect(getObcStatus(live(), null).status).toBe('OK')
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

    it('does not call "no mission open" a fault', () => {
        // HOSTED and MAINTENANCE record nothing by design.
        const idle = { ...mockLiveState.dhs!, recording: false, mission: null }
        expect(getDhsStatus(live({ dhs: idle })).status).toBe('UNKNOWN')
    })
})

describe('getCommsStatus', () => {
    it('is CRITICAL when the radio did not answer', () => {
        const dead = { ...mockLiveState.comms!, radio: { present: false, node: null, region: null } }
        expect(getCommsStatus(live({ comms: dead })).status).toBe('CRITICAL')
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
})
