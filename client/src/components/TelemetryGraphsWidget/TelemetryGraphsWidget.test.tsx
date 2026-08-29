import { mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import TelemetryGraphsWidget from './TelemetryGraphsWidget'

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

describe('TelemetryGraphsWidget', () => {
    it('renders all four mini chart titles', () => {
        render(
            <TelemetryGraphsWidget
                history={[mockTelemetryRecord]}
                isLoading={false}
            />
        )
        expect(screen.getByText('Battery Voltage')).toBeInTheDocument()
        expect(screen.getByText('Temperature')).toBeInTheDocument()
        // RSSI is gone: nothing on this satellite measures signal strength as
        // telemetry. Battery charge is a real series and the one an operator
        // watches on a walk.
        expect(screen.getByText('Battery')).toBeInTheDocument()
        expect(screen.getByText('CPU Usage')).toBeInTheDocument()
    })

    it('shows skeleton when loading with empty history', () => {
        const { container } = render(
            <TelemetryGraphsWidget
                history={[]}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
