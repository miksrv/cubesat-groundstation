import {
    useGetEventsQuery,
    useGetHistoryQuery,
    useGetLatestQuery,
    useGetOrbitQuery,
    useGetWeatherQuery,
    useSendCommandMutation
} from '../../features/telemetry/telemetryAPI'
import { render, screen } from '../../test-utils'

import Dashboard from './Dashboard'

import '@testing-library/jest-dom'

jest.mock('../../features/telemetry/telemetryAPI', () => ({
    useGetLatestQuery: jest.fn(() => ({ data: null, isLoading: false, isError: false })),
    useGetHistoryQuery: jest.fn(() => ({ data: null, isLoading: false })),
    useGetOrbitQuery: jest.fn(() => ({ data: null, isLoading: false })),
    useGetEventsQuery: jest.fn(() => ({ data: null, isLoading: false })),
    useGetWeatherQuery: jest.fn(() => ({ data: null, isLoading: false, isError: false })),
    useSendCommandMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
    telemetryApi: {
        reducerPath: 'telemetryApi',
        reducer: (state = {}) => state,
        middleware: () => (next: (action: unknown) => unknown) => (action: unknown) => next(action)
    }
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

const mockUseGetLatestQuery = useGetLatestQuery as jest.Mock
const mockUseGetHistoryQuery = useGetHistoryQuery as jest.Mock
const mockUseGetOrbitQuery = useGetOrbitQuery as jest.Mock
const mockUseGetEventsQuery = useGetEventsQuery as jest.Mock
const mockUseGetWeatherQuery = useGetWeatherQuery as jest.Mock
const mockUseSendCommandMutation = useSendCommandMutation as jest.Mock

describe('Dashboard', () => {
    beforeEach(() => {
        mockUseGetLatestQuery.mockReturnValue({ data: null, isLoading: false, isError: false })
        mockUseGetHistoryQuery.mockReturnValue({ data: null, isLoading: false })
        mockUseGetOrbitQuery.mockReturnValue({ data: null, isLoading: false })
        mockUseGetEventsQuery.mockReturnValue({ data: null, isLoading: false })
        mockUseGetWeatherQuery.mockReturnValue({ data: null, isLoading: false, isError: false })
        mockUseSendCommandMutation.mockReturnValue([jest.fn(), { isLoading: false }])
    })

    it('renders all panel titles', () => {
        render(<Dashboard />)
        expect(screen.getByText(/Subsystem Status/)).toBeInTheDocument()
        expect(screen.getByText('Electrical Power System')).toBeInTheDocument()
        expect(screen.getByText(/Thermal System/)).toBeInTheDocument()
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

    it('shows error banner when useGetLatestQuery returns isError: true', () => {
        mockUseGetLatestQuery.mockReturnValue({ data: null, isLoading: false, isError: true })
        render(<Dashboard />)
        expect(screen.getByText(/Unable to reach API/)).toBeInTheDocument()
    })
})
