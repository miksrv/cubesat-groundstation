/**
 * The timeline hook: one clock, and everything the replay derives from it.
 *
 * Times are computed from the mission fixture rather than repeated as
 * literals, so the tests keep testing behaviour if the fixture moves.
 */

import { act, renderHook, waitFor } from '@testing-library/react'

import { mockTelemetryRecord } from '../../test-fixtures'
import type { FakeSource } from '../../test-source'
import { installFakeSource } from '../../test-source'
import type { AttitudeSample, MissionSummary, RadioEvent, TelemetryRecord } from '../telemetry/types'

import { useTimeline } from './useTimeline'

const STARTED_AT = '2026-08-29T01:48:41Z'
const START = Date.parse(STARTED_AT) / 1000
const DURATION = 90

const mission: MissionSummary = {
    id: 8,
    label: null,
    profile: 'DEMO',
    startedAt: STARTED_AT,
    endedAt: new Date((START + DURATION) * 1000).toISOString().replace('.000Z', 'Z'),
    endReason: 'shutdown',
    rows: 3,
    firstFixAt: STARTED_AT,
    distanceM: 33.9,
    notes: null,
    purgedAt: null
}

const rowAt = (offset: number, battery: number): TelemetryRecord => ({
    ...mockTelemetryRecord,
    id: offset,
    missionId: mission.id,
    timestamp: new Date((START + offset) * 1000).toISOString().replace('.000Z', 'Z'),
    battery
})

/** Oldest first, as the archive returns a mission's rows. */
const telemetry = [rowAt(5, 80), rowAt(35, 79), rowAt(65, 78)]

const attitudeAtOffset = (offset: number, w: number, x: number): AttitudeSample => ({
    t: START + offset,
    quaternion: { w, x, y: 0, z: 0 },
    gyro: { x: null, y: null, z: null }
})

const attitude = [attitudeAtOffset(5, 1, 0), attitudeAtOffset(6, 0, 1)]

describe('useTimeline', () => {
    let source: FakeSource

    beforeEach(() => {
        jest.useFakeTimers()
        source = installFakeSource()
        source.missions = [mission]
        source.missionTelemetry = telemetry
        source.missionAttitude = attitude
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    const readyTimeline = async () => {
        const rendered = renderHook(() => useTimeline())
        act(() => rendered.result.current.open())
        await waitFor(() => expect(rendered.result.current.missions).not.toBeNull())
        act(() => rendered.result.current.pick(mission.id))
        await waitFor(() => expect(rendered.result.current.phase).toBe('ready'))
        return rendered
    }

    it('starts idle, with nothing replayed', () => {
        const { result } = renderHook(() => useTimeline())
        expect(result.current.phase).toBe('idle')
        expect(result.current.state).toBeNull()
        expect(result.current.rows).toEqual([])
    })

    it('opens the picker with the missions the archive lists', async () => {
        const { result } = renderHook(() => useTimeline())
        act(() => result.current.open())
        expect(result.current.phase).toBe('picking')
        await waitFor(() => expect(result.current.missions).toEqual([mission]))
    })

    it('reports an unreachable archive instead of an empty picker', async () => {
        source.listMissions = async () => {
            throw new Error('the archive is unreachable')
        }
        const { result } = renderHook(() => useTimeline())
        act(() => result.current.open())
        await waitFor(() => expect(result.current.phase).toBe('error'))
        expect(result.current.error).toBe('the archive is unreachable')
    })

    it('opens a mission at its start, playing', async () => {
        const { result } = await readyTimeline()
        expect(result.current.playhead).toBe(START)
        expect(result.current.playing).toBe(true)
        expect(result.current.start).toBe(START)
        expect(result.current.end).toBe(START + DURATION)
    })

    it('shows nothing before the first row rather than borrowing the live present', async () => {
        const { result } = await readyTimeline()
        // The first row is 5 s in; at the start nothing had been recorded.
        expect(result.current.state).toBeNull()
        expect(result.current.rows).toEqual([])
    })

    it('advances the playhead with wall time and derives the state from the row it reaches', async () => {
        const { result } = await readyTimeline()
        act(() => jest.advanceTimersByTime(6000))
        expect(result.current.playhead).toBeCloseTo(START + 6, 6)
        expect(result.current.state?.eps?.batteryPercent).toBe(80)
        expect(result.current.rows).toHaveLength(1)
    })

    it('steps, never interpolates, between telemetry rows', async () => {
        const { result } = await readyTimeline()
        act(() => jest.advanceTimersByTime(34_000))
        // Between the row at +5 and the row at +35 the value *is* the +5 row.
        expect(result.current.state?.eps?.batteryPercent).toBe(80)
        act(() => jest.advanceTimersByTime(1_000))
        expect(result.current.state?.eps?.batteryPercent).toBe(79)
    })

    it('grows the chart window with the playhead, newest first', async () => {
        const { result } = await readyTimeline()
        act(() => jest.advanceTimersByTime(66_000))
        expect(result.current.rows.map((row) => row.battery)).toEqual([78, 79, 80])
    })

    it('writes the interpolated attitude into the ref on the same clock', async () => {
        const { result } = await readyTimeline()
        // 5.5 s in: midway between identity at +5 and 180° about X at +6.
        act(() => jest.advanceTimersByTime(5_500))
        expect(result.current.attitudeRef.current?.w).toBeCloseTo(Math.SQRT1_2, 6)
        expect(result.current.attitudeRef.current?.x).toBeCloseTo(Math.SQRT1_2, 6)
    })

    it('pauses at the end of the mission instead of running past it', async () => {
        const { result } = await readyTimeline()
        act(() => jest.advanceTimersByTime((DURATION + 30) * 1000))
        expect(result.current.playhead).toBe(START + DURATION)
        expect(result.current.playing).toBe(false)
    })

    it('play at the end rewinds — a play button must never silently do nothing', async () => {
        const { result } = await readyTimeline()
        act(() => result.current.seek(START + DURATION))
        await waitFor(() => expect(result.current.playing).toBe(false))
        act(() => result.current.play())
        expect(result.current.playhead).toBe(START)
        expect(result.current.playing).toBe(true)
    })

    it('clamps a seek to the mission', async () => {
        const { result } = await readyTimeline()
        act(() => result.current.seek(START - 1000))
        expect(result.current.playhead).toBe(START)
        act(() => result.current.seek(START + DURATION + 1000))
        expect(result.current.playhead).toBe(START + DURATION)
    })

    it('scrubbing backwards shrinks the chart window with it', async () => {
        const { result } = await readyTimeline()
        act(() => jest.advanceTimersByTime(66_000))
        expect(result.current.rows).toHaveLength(3)
        act(() => result.current.seek(START + 10))
        expect(result.current.rows).toHaveLength(1)
    })

    it('cycles the speed and moves the playhead proportionally faster', async () => {
        // x1 to x16. A tick is 250 ms, so the step is 0.25 s x speed, and the
        // ladder stops where that step would outrun the gap between recorded
        // rows -- 30 s in FLIGHT, about 6 s in DIAG. x16 steps 4 s and skips
        // nothing; x32 would. The x10/x60 this replaced is where the rule was
        // learned: at x60 the playhead crossed two rows a tick and the charts
        // jumped rather than played.
        const { result } = await readyTimeline()
        act(() => result.current.cycleSpeed())
        expect(result.current.speed).toBe(2)
        act(() => jest.advanceTimersByTime(1_000))
        expect(result.current.playhead).toBeCloseTo(START + 2, 6)

        act(() => result.current.cycleSpeed())
        expect(result.current.speed).toBe(4)
        act(() => result.current.cycleSpeed())
        expect(result.current.speed).toBe(8)
        act(() => result.current.cycleSpeed())
        expect(result.current.speed).toBe(16)
        // The playhead keeps pace at the top of the ladder too, which is the
        // whole point of raising it.
        const before = result.current.playhead
        act(() => jest.advanceTimersByTime(1_000))
        expect(result.current.playhead).toBeCloseTo(before + 16, 6)

        // And back round: a cycled ladder, not a menu.
        act(() => result.current.cycleSpeed())
        expect(result.current.speed).toBe(1)
    })

    it("builds the mission's log from its own rows, growing with the playhead", async () => {
        // Through the very diff the live log uses: an event is a reading of
        // telemetry, so the satellite needs no events table for a replay to have
        // one — and the backend-less demo build gets them for free.
        source.missionTelemetry = [
            { ...rowAt(5, 80), obcState: 'NOMINAL' },
            { ...rowAt(35, 79), obcState: 'SCIENCE' },
            { ...rowAt(65, 78), obcState: 'NOMINAL' }
        ]
        const { result } = await readyTimeline()
        // The playhead opens at the mission's own start, which is before its
        // first row: nothing had been recorded yet, so there is nothing to log.
        expect(result.current.events).toEqual([])

        act(() => result.current.seek(START + 5))
        // The first row produces two lines, exactly as the live log does on the
        // first message it ever sees: the mission opening and the state it was
        // in. Same function, same output — that is the point of reusing it.
        expect(result.current.events.map((entry) => entry.message)).toEqual([
            'mission 8 opened',
            'mission state NOMINAL'
        ])

        act(() => result.current.seek(START + 65))
        const messages = result.current.events.map((entry) => entry.message)
        // Newest first, as every log on the page reads.
        expect(messages[0]).toBe('mission state SCIENCE -> NOMINAL')
        expect(messages).toContain('mission state NOMINAL -> SCIENCE')
    })

    it("hands over the mission's radio traffic up to the playhead and no further", async () => {
        const heard = (at: number, text: string): RadioEvent => ({
            timestamp: at,
            direction: 'rx',
            kind: null,
            text,
            bytes: text.length,
            sender: '!e2f1a4c8',
            snr: 6.25,
            rssi: -96,
            hops: 0,
            sent: null
        })
        source.missionRadio = [heard(START + 10, 'early'), heard(START + 50, 'late')]
        const { result } = await readyTimeline()
        act(() => result.current.seek(START + 20))
        expect(result.current.radio.map((entry) => entry.text)).toEqual(['early'])

        act(() => result.current.seek(START + 60))
        // Newest first: the later line leads.
        expect(result.current.radio.map((entry) => entry.text)).toEqual(['late', 'early'])
    })

    it('drops the whole replay on exit, so the live view is not left holding a past', async () => {
        const { result } = await readyTimeline()
        act(() => result.current.exit())
        expect(result.current.phase).toBe('idle')
        expect(result.current.state).toBeNull()
        expect(result.current.rows).toEqual([])
        expect(result.current.events).toEqual([])
        expect(result.current.radio).toEqual([])
        expect(result.current.attitudeRef.current).toBeNull()
        expect(result.current.speed).toBe(1)
    })

    it('opens a mission with nothing to replay paused', async () => {
        source.missionTelemetry = []
        source.missionAttitude = []
        const { result } = await readyTimeline()
        expect(result.current.playing).toBe(false)
        expect(result.current.state).toBeNull()
    })

    it('replays an interrupted mission up to the last thing it recorded', async () => {
        // A power loss closes nothing: ended_at can be null while rows exist.
        source.missions = [{ ...mission, endedAt: null, endReason: null }]
        const { result } = await readyTimeline()
        expect(result.current.end).toBe(START + 65)
    })

    it('exit drops everything and returns to live', async () => {
        const { result } = await readyTimeline()
        act(() => jest.advanceTimersByTime(10_000))
        act(() => result.current.exit())
        expect(result.current.phase).toBe('idle')
        expect(result.current.state).toBeNull()
        expect(result.current.rows).toEqual([])
        expect(result.current.attitudeRef.current).toBeNull()
        // And the clock is genuinely stopped, not ticking into a dropped state.
        act(() => jest.advanceTimersByTime(10_000))
        expect(result.current.playhead).toBe(0)
    })
})
