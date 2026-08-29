import { mockLiveState } from '../../test-fixtures'
import type { FakeSource } from '../../test-source'
import { installFakeSource } from '../../test-source'
import { render, screen, waitFor } from '../../test-utils'

import Dashboard from './Dashboard'

import '@testing-library/jest-dom'

jest.mock('../../features/weather/useWeather', () => ({
    useWeather: jest.fn(() => ({ data: null, isLoading: false, isUnreachable: false }))
}))

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
        expect(screen.getByText(/Weather/)).toBeInTheDocument()
    })

    it('draws what the source pushes, with no polling involved', async () => {
        // The live view is a subscription, not a fetch: on the satellite this is
        // the broker replaying its retained messages the moment the page
        // connects, so a freshly opened tab knows the state without waiting.
        render(<Dashboard />)
        source.emit(mockLiveState)
        await waitFor(() => expect(screen.getAllByText('NOMINAL').length).toBeGreaterThan(0))
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
})
