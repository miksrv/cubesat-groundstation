import { mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import PowerSystemWidget from './PowerSystemWidget'

import '@testing-library/jest-dom'

describe('PowerSystemWidget', () => {
    it('renders battery level and voltage', () => {
        render(
            <PowerSystemWidget
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getByText('82.0%')).toBeInTheDocument()
        expect(screen.getByText('8.14 V')).toBeInTheDocument()
    })

    it('renders consumption in mA and W derived from battery_current', () => {
        render(
            <PowerSystemWidget
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        // battery_current = 0.63 A, voltage = 8.14 V
        expect(screen.getByText('630 mA')).toBeInTheDocument()
        expect(screen.getByText('5.13 W')).toBeInTheDocument()
    })

    it('shows external power source when external_power=1', () => {
        render(
            <PowerSystemWidget
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getByText('External')).toBeInTheDocument()
    })

    it('shows skeleton when loading with no data', () => {
        const { container } = render(
            <PowerSystemWidget
                latest={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
