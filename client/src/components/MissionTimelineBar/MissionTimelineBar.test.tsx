import { fireEvent, render, screen } from '@testing-library/react'

import type { MissionDetail, MissionSummary } from '../../features/telemetry/types'
import type { Timeline } from '../../features/timeline/useTimeline'
import { mockTelemetryRecord } from '../../test-fixtures'

import MissionTimelineBar from './MissionTimelineBar'

import '@testing-library/jest-dom'

const mission: MissionSummary = {
    id: 8,
    label: null,
    profile: 'DEMO',
    startedAt: '2026-08-29T01:48:41Z',
    endedAt: '2026-08-29T02:39:53Z',
    endReason: 'shutdown',
    rows: 78,
    firstFixAt: '2026-08-29T01:48:41Z',
    distanceM: 33.9,
    notes: null,
    purgedAt: null
}

const START = Date.parse(mission.startedAt) / 1000
const END = Date.parse(mission.endedAt as string) / 1000

const detail: MissionDetail = {
    mission,
    telemetry: [mockTelemetryRecord],
    attitude: [],
    radio: []
}

/** A timeline the test drives by hand — the bar only renders the interface. */
const timelineStub = (overrides: Partial<Timeline>): Timeline => ({
    phase: 'idle',
    missions: null,
    detail: null,
    error: null,
    playhead: START,
    events: [],
    radio: [],
    start: START,
    end: END,
    playing: false,
    speed: 1,
    state: null,
    rows: [],
    attitudeRef: { current: null },
    open: jest.fn(),
    pick: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    seek: jest.fn(),
    cycleSpeed: jest.fn(),
    exit: jest.fn(),
    ...overrides
})

describe('MissionTimelineBar', () => {
    it('offers the archive from the live view', () => {
        const timeline = timelineStub({})
        render(<MissionTimelineBar timeline={timeline} />)
        fireEvent.click(screen.getByText('MISSION ARCHIVE'))
        expect(timeline.open).toHaveBeenCalled()
    })

    it('lists the archive, and picking a mission loads it', () => {
        const timeline = timelineStub({ phase: 'picking', missions: [mission] })
        render(<MissionTimelineBar timeline={timeline} />)
        expect(screen.getByText(/2026-08-29 01:48:41 UTC/)).toBeInTheDocument()
        expect(screen.getByText(/78 rows/)).toBeInTheDocument()
        // The two most informative traits for choosing a recording: how far it
        // travelled, and why it ended.
        expect(screen.getByText(/34 m/)).toBeInTheDocument()
        expect(screen.getByText(/shutdown/)).toBeInTheDocument()
        fireEvent.click(screen.getByText(/#8 DEMO/))
        expect(timeline.pick).toHaveBeenCalledWith(8)
    })

    it('shows a walk in kilometres and an interruption in words', () => {
        const walk = { ...mission, distanceM: 2340, endReason: 'interrupted' as const }
        const timeline = timelineStub({ phase: 'picking', missions: [walk] })
        render(<MissionTimelineBar timeline={timeline} />)
        expect(screen.getByText(/2\.3 km/)).toBeInTheDocument()
        expect(screen.getByText(/interrupted/)).toBeInTheDocument()
    })

    it('withholds the distance of a mission that never had a fix', () => {
        // Null, not zero: an indoor DEMO did not travel zero metres, it has no
        // track at all — so no distance fragment is rendered.
        const indoors = { ...mission, distanceM: null }
        const timeline = timelineStub({ phase: 'picking', missions: [indoors] })
        render(<MissionTimelineBar timeline={timeline} />)
        expect(screen.queryByText(/\d+ m ·/)).not.toBeInTheDocument()
        expect(screen.getByText(/78 rows/)).toBeInTheDocument()
    })

    it('says the archive is empty rather than showing an empty list', () => {
        const timeline = timelineStub({ phase: 'picking', missions: [] })
        render(<MissionTimelineBar timeline={timeline} />)
        expect(screen.getByText('The archive holds no missions yet')).toBeInTheDocument()
    })

    it('marks a purged mission in the picker', () => {
        const purged = { ...mission, purgedAt: '2026-09-29T00:00:00Z' }
        const timeline = timelineStub({ phase: 'picking', missions: [purged] })
        render(<MissionTimelineBar timeline={timeline} />)
        expect(screen.getByText(/detail purged/)).toBeInTheDocument()
    })

    it('shows the error and the way back', () => {
        const timeline = timelineStub({ phase: 'error', error: 'mission 8 would not load' })
        render(<MissionTimelineBar timeline={timeline} />)
        expect(screen.getByText(/mission 8 would not load/)).toBeInTheDocument()
        fireEvent.click(screen.getByText('BACK TO LIVE'))
        expect(timeline.exit).toHaveBeenCalled()
    })

    it('renders the transport for a loaded mission on one clock', () => {
        const timeline = timelineStub({
            phase: 'ready',
            detail,
            playhead: START + 65,
            playing: true
        })
        render(<MissionTimelineBar timeline={timeline} />)
        expect(screen.getByText('REPLAY')).toBeInTheDocument()
        // T+1:05 of 51:12, and the playhead as a wall clock.
        expect(screen.getByText(/T\+1:05 \/ 51:12/)).toBeInTheDocument()
        expect(screen.getByText('01:49:46 UTC')).toBeInTheDocument()

        fireEvent.click(screen.getByLabelText('Pause'))
        expect(timeline.pause).toHaveBeenCalled()

        fireEvent.change(screen.getByLabelText('Mission time'), {
            target: { value: String(START + 100) }
        })
        expect(timeline.seek).toHaveBeenCalledWith(START + 100)

        fireEvent.click(screen.getByLabelText('Playback speed'))
        expect(timeline.cycleSpeed).toHaveBeenCalled()

        fireEvent.click(screen.getByText('✕ LIVE'))
        expect(timeline.exit).toHaveBeenCalled()
    })

    it('offers play when paused', () => {
        const timeline = timelineStub({ phase: 'ready', detail, playing: false })
        render(<MissionTimelineBar timeline={timeline} />)
        fireEvent.click(screen.getByLabelText('Play'))
        expect(timeline.play).toHaveBeenCalled()
    })

    it('says why a purged mission has no transport, per the retention decision', () => {
        // The mission row outlives its rows; an empty chart would be a lie.
        const purgedDetail: MissionDetail = {
            mission: { ...mission, purgedAt: '2026-09-29T00:00:00Z' },
            telemetry: [],
            attitude: [],
            radio: []
        }
        const timeline = timelineStub({ phase: 'ready', detail: purgedDetail })
        render(<MissionTimelineBar timeline={timeline} />)
        expect(screen.getByText(/Detail removed by the retention policy/)).toBeInTheDocument()
        expect(screen.queryByLabelText('Mission time')).not.toBeInTheDocument()
    })

    it('says when a mission recorded nothing at all', () => {
        const emptyDetail: MissionDetail = { mission, telemetry: [], attitude: [], radio: [] }
        const timeline = timelineStub({ phase: 'ready', detail: emptyDetail })
        render(<MissionTimelineBar timeline={timeline} />)
        expect(screen.getByText('This mission recorded nothing to replay')).toBeInTheDocument()
        expect(screen.queryByLabelText('Mission time')).not.toBeInTheDocument()
    })
})
