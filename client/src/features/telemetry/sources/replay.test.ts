import type { MissionSummary, RadioEvent, TelemetryRecord } from '../types'

import type { Recording } from './replay'
import { ReplaySource } from './replay'

const START = Date.parse('2026-08-24T07:00:00Z') / 1000

const mission: MissionSummary = {
    id: 1,
    label: 'walk to work',
    profile: 'FLIGHT',
    startedAt: '2026-08-24T07:00:00Z',
    endedAt: '2026-08-24T07:29:30Z',
    endReason: 'profile_change',
    rows: 2,
    firstFixAt: null,
    distanceM: null,
    notes: null,
    purgedAt: null
}

const row = (offsetSec: number, id: number): TelemetryRecord =>
    ({
        id,
        timestamp: new Date((START + offsetSec) * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        missionId: 1,
        profile: 'FLIGHT',
        obcState: 'NOMINAL',
        battery: 90,
        voltage: 4.0,
        externalPower: false,
        roll: null,
        pitch: null,
        yaw: null,
        quaternion: { w: null, x: null, y: null, z: null },
        calibStatus: null,
        imuTemp: null,
        accel: { x: null, y: null, z: null },
        gyro: { x: null, y: null, z: null },
        gnss: { lat: null, lon: null, alt: null, speed: null, fix: null, satellites: null },
        temperature: 22,
        humidity: null,
        pressure: null,
        light: null,
        uvIndex: null,
        cpuPercent: null,
        ramPercent: null,
        swapPercent: null,
        diskPercent: null,
        uptimeSeconds: null,
        cpuTemperature: null
    }) as TelemetryRecord

const radioAt = (offsetSec: number, text: string): RadioEvent => ({
    timestamp: START + offsetSec,
    direction: 'tx',
    kind: 'beacon',
    text,
    bytes: text.length,
    sender: null,
    snr: null,
    rssi: null,
    hops: null,
    sent: true
})

const recording = (radio: RadioEvent[]): Recording => ({
    mission,
    telemetry: [row(0, 1), row(30, 2)],
    attitude: [],
    radio
})

describe('ReplaySource radio replay', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it('declares the channel absent for a recording that predates radio_log', () => {
        expect(new ReplaySource(recording([])).capabilities.radio).toBe(false)
        expect(new ReplaySource(recording([radioAt(5, 'CSAT t=1')])).capabilities.radio).toBe(true)
    })

    it('emits radio events in step with the playhead, and starts over on the loop', () => {
        const source = new ReplaySource(recording([radioAt(0, 'first'), radioAt(25, 'second')]))
        const heard: string[] = []
        const stop = source.subscribeRadio((event) => heard.push(event.text ?? ''))
        // subscribeRadio alone must drive the clock: the radio table can be the
        // only subscriber and still see traffic.
        expect(heard).toEqual(['first'])

        jest.advanceTimersByTime(1000)
        expect(heard).toEqual(['first', 'second'])

        // The loop wraps: the log replays with the mission, not once ever.
        jest.advanceTimersByTime(1000)
        expect(heard).toEqual(['first', 'second', 'first'])
        stop()
    })
})
