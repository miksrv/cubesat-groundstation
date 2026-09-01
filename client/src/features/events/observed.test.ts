import { mockAdcs, mockLiveState, mockObc } from '../../test-fixtures'
import type { RadioEvent } from '../telemetry/types'

import { diffStates, photoRefusalAlert, radioAlert } from './observed'

const messages = (events: ReturnType<typeof diffStates>) => events.map((event) => event.message)

describe('subsystem alerts', () => {
    it('logs a subsystem entering WARN, with the reason', () => {
        // The demo recording's ADCS drops to magnetometer calib 1/3 and the
        // Subsystem Status widget goes orange — the alert log must say so too,
        // in the same words.
        const degraded = {
            ...mockLiveState,
            adcs: { ...mockAdcs, yaw: null, calibStatus: { sys: 3, gyro: 3, accel: 3, mag: 1 } }
        }
        const events = diffStates(mockLiveState, degraded)
        expect(messages(events)).toContain('ADCS WARN - magnetometer calib 1/3 — heading withheld')
        expect(events.find((event) => event.message.startsWith('ADCS'))?.severity).toBe('warning')
    })

    it('logs the recovery back to OK as a success', () => {
        const degraded = {
            ...mockLiveState,
            adcs: { ...mockAdcs, calibStatus: { sys: 3, gyro: 3, accel: 3, mag: 1 } }
        }
        const events = diffStates(degraded, mockLiveState)
        const recovery = events.find((event) => event.message.startsWith('ADCS OK'))
        expect(recovery?.severity).toBe('success')
    })

    it('logs a service OBC declared lost as critical', () => {
        const lost = {
            ...mockLiveState,
            obc: { ...mockObc, subsystems: { watched: ['adcs', 'comms', 'dhs', 'eps', 'payload'], lost: ['comms'] } }
        }
        const events = diffStates(mockLiveState, lost)
        const alert = events.find((event) => event.message.startsWith('COMMS FAIL'))
        expect(alert?.severity).toBe('critical')
        expect(alert?.message).toContain('OBC declared it lost')
    })

    it('stays quiet between two healthy states', () => {
        expect(diffStates(mockLiveState, mockLiveState)).toEqual([])
    })

    it('does not log the first snapshot as if it were a transition', () => {
        // The log starts when the page does: what the satellite already was is
        // shown by the widgets' colours, not invented as an event.
        const degraded = {
            ...mockLiveState,
            adcs: { ...mockAdcs, calibStatus: { sys: 3, gyro: 3, accel: 3, mag: 1 } }
        }
        expect(messages(diffStates(null, degraded)).filter((line) => line.startsWith('ADCS'))).toEqual([])
    })

    it('skips OBC: its degradations are mission states, logged as such', () => {
        const safe = { ...mockLiveState, obc: { ...mockObc, status: 'SAFE' as const } }
        const events = diffStates(mockLiveState, safe)
        expect(messages(events)).toContain('mission state NOMINAL -> SAFE')
        expect(messages(events).filter((line) => line.startsWith('OBC'))).toEqual([])
    })
})

describe('radio alerts', () => {
    const tx = (overrides: Partial<RadioEvent> = {}): RadioEvent => ({
        timestamp: 1741863600,
        direction: 'tx',
        kind: 'beacon',
        text: 'CSAT t=1741863600 st=NOMINAL',
        bytes: 28,
        sender: null,
        snr: null,
        rssi: null,
        hops: null,
        sent: false,
        ...overrides
    })

    it('turns a transmission that never left the radio into a warning', () => {
        const alert = radioAlert(tx(), 1)
        expect(alert?.severity).toBe('warning')
        expect(alert?.message).toBe('radio transmit failed (beacon)')
    })

    it('leaves successful transmissions and received traffic alone', () => {
        expect(radioAlert(tx({ sent: true }), 1)).toBeNull()
        expect(radioAlert(tx({ direction: 'rx', sent: null }), 1)).toBeNull()
    })
})

describe('photo refusal alerts', () => {
    it("turns a refused capture into a warning, in the satellite's own words", () => {
        const alert = photoRefusalAlert(
            { timestamp: 1741863600, requestId: null, reason: 'mission state LOW_POWER does not permit the camera' },
            1
        )
        expect(alert.severity).toBe('warning')
        expect(alert.message).toBe('capture refused - mission state LOW_POWER does not permit the camera')
    })

    it('still logs a refusal that arrived without a reason', () => {
        // Withhold rather than fabricate cuts both ways: the refusal happened
        // even when the sentence explaining it did not arrive.
        const alert = photoRefusalAlert({ timestamp: 1741863600, requestId: 'req-3', reason: null }, 1)
        expect(alert.message).toBe('capture refused - no reason given')
    })
})
