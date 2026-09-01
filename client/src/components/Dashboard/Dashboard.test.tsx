import { act } from 'react'

import type { MissionSummary, TelemetryRecord } from '../../features/telemetry/types'
import { mockLiveState, mockTelemetryRecord } from '../../test-fixtures'
import type { FakeSource } from '../../test-source'
import { installFakeSource } from '../../test-source'
import { fireEvent, render, screen, waitFor } from '../../test-utils'

import Dashboard from './Dashboard'

import '@testing-library/jest-dom'

jest.mock('echarts', () => ({
    init: jest.fn(() => ({
        setOption: jest.fn(),
        resize: jest.fn(),
        dispose: jest.fn()
    }))
}))

global.ResizeObserver = jest.fn(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
}))

describe('Dashboard', () => {
    let source: FakeSource

    beforeEach(() => {
        source = installFakeSource()
    })

    it('renders all panel titles', () => {
        render(<Dashboard />)
        expect(screen.getByText(/Subsystem Status/)).toBeInTheDocument()
        expect(screen.getByText('Electrical Power System')).toBeInTheDocument()
        expect(screen.getByText(/Temperatures/)).toBeInTheDocument()
        expect(screen.getAllByText(/^ADCS$/).length).toBeGreaterThan(1)
        expect(screen.getByText('On-Board Computer')).toBeInTheDocument()
        expect(screen.getAllByText(/^Payload$/).length).toBeGreaterThan(0)
        expect(screen.getByText('Flight Recorder')).toBeInTheDocument()
        expect(screen.getByText(/Telemetry Graphs/)).toBeInTheDocument()
        expect(screen.getAllByText(/Ground Station Link/).length).toBeGreaterThan(0)
        expect(screen.getByText(/Orbit & Ground Track/)).toBeInTheDocument()
        expect(screen.getByText(/Mission Events/)).toBeInTheDocument()
        expect(screen.getByText(/Live Telemetry Stream/)).toBeInTheDocument()
        expect(screen.getByText(/MQTT Bus Monitor/)).toBeInTheDocument()
        expect(screen.getAllByText(/Mission Console/).length).toBeGreaterThan(0)
        expect(screen.getByText(/Quick Commands/)).toBeInTheDocument()
        expect(screen.getByText(/Recent Alerts/)).toBeInTheDocument()
        expect(screen.getByText('3D Satellite View')).toBeInTheDocument()
        expect(screen.getByText(/Orbit Info/)).toBeInTheDocument()
        // WeatherWidget is hidden, not deleted: it was filler for an empty
        // slot, and the Flight Recorder that took its place is telemetry.
        expect(screen.queryByText(/Weather/)).not.toBeInTheDocument()
    })

    it('draws what the source pushes, with no polling involved', async () => {
        // The live view is a subscription, not a fetch: on the satellite this is
        // the broker replaying its retained messages the moment the page
        // connects, so a freshly opened tab knows the state without waiting.
        render(<Dashboard />)
        source.emit(mockLiveState)
        await waitFor(() => expect(screen.getAllByText('NOMINAL').length).toBeGreaterThan(0))
    })

    it("surfaces HOSTD's own errors, which used to reach nobody but the journal", async () => {
        render(<Dashboard />)
        source.emit({
            ...mockLiveState,
            host: { ...mockLiveState.host!, errors: ['unit cubesat@adcs.service failed to start'] }
        })
        await waitFor(() =>
            expect(screen.getByText(/HOSTD: unit cubesat@adcs\.service failed to start/)).toBeInTheDocument()
        )
    })

    it('says the broker is gone instead of impersonating a silent satellite', async () => {
        // Before the connection channel existed, a dead broker and a satellite
        // that had not published yet rendered identically. The stale state
        // stays on screen — it is the last thing the satellite said — but the
        // link badge reports what the transport knows.
        render(<Dashboard />)
        source.emit(mockLiveState)
        await waitFor(() => expect(screen.getByText('ACTIVE')).toBeInTheDocument())
        source.emitConnection('offline')
        await waitFor(() => expect(screen.getByText('OFFLINE')).toBeInTheDocument())
        expect(screen.getAllByText('NOMINAL').length).toBeGreaterThan(0)
    })

    it('keeps the live view when the recorded history is unreachable', async () => {
        // Two channels of different kinds. Losing the archive costs the charts
        // and the host metrics; it must not blank a dashboard that is otherwise
        // still correct.
        source.archiveError = new Error('archive down')
        render(<Dashboard />)
        source.emit(mockLiveState)
        await waitFor(() => expect(screen.getByText(/recorded history is unreachable/)).toBeInTheDocument())
        expect(screen.getAllByText('NOMINAL').length).toBeGreaterThan(0)
    })

    it('draws a history whose rows belong to no mission at all', async () => {
        // DEMO and EXPO record nothing (satellite Q7): DHS publishes each
        // assembled row, DASHBOARD keeps them in a ring, and /api/telemetry
        // serves that. Those rows have a null mission_id and an id that is only
        // a position in the ring — and the host metrics, which live in no status
        // message, reach the page this way and no other.
        source.history = [
            { ...mockTelemetryRecord, id: 2, missionId: null, cpuPercent: 37, ramPercent: 41 },
            { ...mockTelemetryRecord, id: 1, missionId: null, cpuPercent: 31 }
        ]
        render(<Dashboard />)
        source.emit(mockLiveState)
        await waitFor(() => expect(screen.getByText('37%')).toBeInTheDocument())
        expect(screen.queryByText(/recorded history is unreachable/)).not.toBeInTheDocument()
    })

    // ── replaying a recorded mission ────────────────────────────────────────
    //
    // The satellite records only in FLIGHT and DIAG, so in DEMO and EXPO the
    // archive holds past trips while the live view runs from the broker and the
    // charts from the in-memory ring. Replaying one of those trips must not
    // rearrange the page: the same widgets stay in the same places, the two that
    // command are disabled, and leaving the replay puts everything back.

    const START = Date.parse('2026-08-24T07:00:00Z') / 1000

    const recordedMission: MissionSummary = {
        id: 11,
        label: 'walk to work',
        profile: 'FLIGHT',
        startedAt: '2026-08-24T07:00:00Z',
        endedAt: '2026-08-24T07:02:00Z',
        endReason: 'profile_change',
        rows: 3,
        firstFixAt: '2026-08-24T07:00:00Z',
        distanceM: 412.5,
        notes: null,
        purgedAt: null
    }

    const rowAt = (offset: number, extra: Partial<TelemetryRecord> = {}): TelemetryRecord => ({
        ...mockTelemetryRecord,
        id: offset,
        missionId: recordedMission.id,
        timestamp: new Date((START + offset) * 1000).toISOString().replace('.000Z', 'Z'),
        ...extra
    })

    const startReplay = async () => {
        source.missions = [recordedMission]
        source.missionTelemetry = [rowAt(0), rowAt(30, { obcState: 'SCIENCE' }), rowAt(60)]
        render(<Dashboard />)
        source.emit(mockLiveState)
        fireEvent.click(screen.getByText('MISSION ARCHIVE'))
        await waitFor(() => expect(screen.getByText(/#11 walk to work/)).toBeInTheDocument())
        fireEvent.click(screen.getByText(/#11 walk to work/))
        await waitFor(() => expect(screen.getByText('REPLAY')).toBeInTheDocument())
    }

    it('keeps every widget in place while a mission replays', async () => {
        // The grid rebuilding itself on entering a replay is a worse thing to do
        // to somebody watching than any argument about mixing two clocks.
        await startReplay()
        for (const title of [
            /Subsystem Status/,
            /MQTT Bus Monitor/,
            /Mission Events/,
            /Recent Alerts/,
            /Quick Commands/,
            /Flight Recorder/,
            /Orbit Info/,
            /Onboard Camera/
        ]) {
            expect(screen.getAllByText(title).length).toBeGreaterThan(0)
        }
        expect(screen.getAllByText(/Ground Station Link/).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Mission Console/).length).toBeGreaterThan(0)
    })

    it('disables the console and the quick commands during a replay', async () => {
        // There is no present to command while a past afternoon is on screen.
        await startReplay()
        expect(screen.getByPlaceholderText(/commands are off/)).toBeDisabled()
        expect(screen.getByText('TAKE PHOTO')).toBeDisabled()
        expect(screen.getByText('SAFE MODE')).toBeDisabled()
    })

    it('gives the console and the commands back on leaving the replay', async () => {
        await startReplay()
        fireEvent.click(screen.getByText('✕ LIVE'))
        await waitFor(() => expect(screen.queryByText('REPLAY')).not.toBeInTheDocument())
        expect(screen.getByPlaceholderText('Type a command…')).not.toBeDisabled()
        expect(screen.getByText('TAKE PHOTO')).not.toBeDisabled()
        // And the live state is back on screen, not the replayed row.
        expect(screen.getAllByText('NOMINAL').length).toBeGreaterThan(0)
    })

    it('shows the replayed mission state, not the live one', async () => {
        await startReplay()
        // The playhead opens at the mission's first row, whose state is NOMINAL;
        // scrubbing to the second reaches the SCIENCE row.
        fireEvent.change(screen.getByLabelText('Mission time'), { target: { value: String(START + 30) } })
        await waitFor(() => expect(screen.getAllByText('SCIENCE').length).toBeGreaterThan(0))
    })

    it("builds the replayed mission's event log from its own rows", async () => {
        // The satellite keeps no events table, and should not: an event is a
        // reading of telemetry, and the reading belongs where the telemetry is
        // displayed — which is also what lets the backend-less demo show them.
        await startReplay()
        fireEvent.change(screen.getByLabelText('Mission time'), { target: { value: String(START + 30) } })
        await waitFor(() => expect(screen.getAllByText(/mission state NOMINAL -> SCIENCE/).length).toBeGreaterThan(0))
    })

    it("replays the mission's own radio traffic rather than the live link", async () => {
        source.missionRadio = [
            {
                timestamp: START + 10,
                direction: 'tx',
                kind: 'beacon',
                text: 'CSAT t=1 st=NOMINAL',
                bytes: 24,
                sender: null,
                snr: null,
                rssi: null,
                hops: null,
                sent: true
            }
        ]
        await startReplay()
        // Live traffic arrives while the replay is on screen and must not appear
        // in it: the log belongs to the mission being replayed.
        act(() => {
            source.emitRadio({
                timestamp: Date.now() / 1000,
                direction: 'rx',
                kind: null,
                text: '!ping from now',
                bytes: 5,
                sender: '!abc',
                snr: 5,
                rssi: -90,
                hops: 0,
                sent: null
            })
        })
        fireEvent.change(screen.getByLabelText('Mission time'), { target: { value: String(START + 30) } })
        await waitFor(() => expect(screen.getByText('CSAT t=1 st=NOMINAL')).toBeInTheDocument())
        expect(screen.queryByText('!ping from now')).not.toBeInTheDocument()
    })

    it('shows the last photograph whose moment has passed, never a later one', async () => {
        // A frame shown before it was taken puts the satellite somewhere it had
        // not reached yet.
        source.photos = [
            { name: 'frame_20260824_070000_0001.jpg', url: '/api/photos/11/frame_20260824_070000_0001.jpg' },
            { name: 'frame_20260824_070100_0002.jpg', url: '/api/photos/11/frame_20260824_070100_0002.jpg' }
        ]
        await startReplay()
        // The frame taken at the mission's first second, not the one a minute in.
        await waitFor(() => expect(screen.getByAltText(/frame_20260824_070000_0001/)).toBeInTheDocument())
        expect(screen.queryByAltText(/frame_20260824_070100_0002/)).not.toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Mission time'), { target: { value: String(START + 60) } })
        await waitFor(() => expect(screen.getByAltText(/frame_20260824_070100_0002/)).toBeInTheDocument())
    })
})
