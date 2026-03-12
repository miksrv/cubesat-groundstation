import React from 'react'

import Dashboard from '../components/Dashboard/Dashboard'
import { useGetHistoryQuery, useGetLatestQuery } from '../features/telemetry/telemetryAPI'
import { render, screen } from '../test-utils'

import '@testing-library/jest-dom'

jest.mock('../features/telemetry/telemetryAPI', () => ({
    useGetLatestQuery: jest.fn(() => ({ data: null, isLoading: false, isError: false })),
    useGetHistoryQuery: jest.fn(() => ({ data: null, isLoading: false })),
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

describe('Dashboard', () => {
    beforeEach(() => {
        mockUseGetLatestQuery.mockReturnValue({ data: null, isLoading: false, isError: false })
        mockUseGetHistoryQuery.mockReturnValue({ data: null, isLoading: false })
    })

    it('renders all panel titles', () => {
        render(<Dashboard />)
        expect(screen.getByText(/EPS/)).toBeInTheDocument()
        expect(screen.getByText(/ADCS/)).toBeInTheDocument()
        expect(screen.getByText(/GPS/)).toBeInTheDocument()
        expect(screen.getByText(/System/)).toBeInTheDocument()
        expect(screen.getByText(/Telemetry Timeline/)).toBeInTheDocument()
    })

    it('shows error banner when useGetLatestQuery returns isError: true', () => {
        mockUseGetLatestQuery.mockReturnValue({ data: null, isLoading: false, isError: true })
        render(<Dashboard />)
        expect(screen.getByText(/Unable to reach API/)).toBeInTheDocument()
    })
})
