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

const sample = (offsetSec: number, w: number, x: number) => ({
    t: START + offsetSec,
    quaternion: { w, x, y: 0, z: 0 }
})

const recording = (radio: RadioEvent[], attitude: Array<ReturnType<typeof sample>> = []): Recording => ({
    mission,
    telemetry: [row(0, 1), row(30, 2)],
    attitude,
    radio
})

/** Satellite seconds per tick, and the wall-clock ms a tick takes. Written out
 *  rather than imported so that a change to the compression has to be a
 *  deliberate change to these expectations too. */
const STEP_S = 2.5
const TICK_MS = 250
/** Wall-clock ms to carry the playhead a given distance in satellite time. */
const wallMsFor = (satelliteSeconds: number) => (satelliteSeconds / STEP_S) * TICK_MS

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

        jest.advanceTimersByTime(wallMsFor(25))
        expect(heard).toEqual(['first', 'second'])

        // The loop wraps: the log replays with the mission, not once ever. The
        // last row is at 30 s, so the tick that lands past it rewinds.
        jest.advanceTimersByTime(wallMsFor(7.5))
        expect(heard).toEqual(['first', 'second', 'first'])
        stop()
    })
})

/**
 * One clock, which is the property the whole replay stands on.
 *
 * There used to be two — telemetry advanced a row a second, attitude a sample a
 * second — so the orientation on screen and the ADCS status beside it drifted
 * 29 s of satellite time apart every second. Nothing noticed until the dashboard
 * started reconciling the two against each other.
 */
describe('ReplaySource playhead', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it('shows the same satellite moment on both channels when a row is crossed', () => {
        // A sample on every second, as the satellite records them.
        const attitude = Array.from({ length: 31 }, (_, second) => sample(second, 1, 0))
        const source = new ReplaySource(recording([], attitude))
        const samples: number[] = []
        const rows: Array<number | null> = []
        const stopAttitude = source.subscribeAttitude((update) => samples.push(update.t))
        const stopState = source.subscribe((state) => rows.push(state.adcs?.timestamp ?? null))

        jest.advanceTimersByTime(wallMsFor(30))

        // The row at +30 s is published on the tick the playhead reaches it, and
        // the attitude sample emitted on that same tick is the one measured then.
        expect(rows[rows.length - 1]).toBe(START + 30)
        expect(samples[samples.length - 1]).toBe(START + 30)
        stopAttitude()
        stopState()
    })

    it('gives an attitude sample its own timestamp, never the playhead', () => {
        // Samples 10 s apart, so most ticks land between two of them.
        const source = new ReplaySource(recording([], [sample(0, 1, 0), sample(10, 0, 1)]))
        const seen: number[] = []
        const stop = source.subscribeAttitude((update) => seen.push(update.t))

        jest.advanceTimersByTime(wallMsFor(7.5))

        // Four ticks, playhead at 0 / 2.5 / 5 / 7.5 — and every one of them
        // reports the sample from second 0, because that is when it was measured.
        expect(seen).toEqual([START, START, START, START])
        stop()
    })

    it('publishes only the newest row the playhead has passed, but counts them all', async () => {
        // Three rows 30 s apart, and attitude running well past the last of them
        // so a long step cannot reach the end and wrap instead.
        const long: Recording = {
            mission,
            telemetry: [row(0, 1), row(30, 2), row(60, 3)],
            attitude: [sample(0, 1, 0), sample(200, 1, 0)],
            radio: []
        }
        // Speed 40 makes one tick 100 s of satellite time — past two rows at once.
        const source = new ReplaySource(long, 40)
        const states: number[] = []
        // `played` reaches the state as the mission's own row count.
        const stop = source.subscribe((state) => states.push(state.dhs?.mission?.rows ?? 0))
        const before = states.length

        jest.advanceTimersByTime(TICK_MS)

        // One notification for the tick, carrying the newest row, and the count
        // says three rows have gone by rather than two. The row at 30 s is not
        // published on its own: the state it would set is superseded in the same
        // tick, and publishing it would be a render of a moment already past.
        expect(states.length - before).toBe(1)
        expect(states[states.length - 1]).toBe(3)
        await expect(source.recentTelemetry(10)).resolves.toHaveLength(3)
        stop()
    })
})
