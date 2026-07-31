import { mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import ThermalSystemWidget from './ThermalSystemWidget'

import '@testing-library/jest-dom'

describe('ThermalSystemWidget', () => {
    it('renders each subsystem temperature and the computed max', () => {
        render(
            <ThermalSystemWidget
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getByText('26.7°C')).toBeInTheDocument() // EPS
        expect(screen.getByText('21.3°C')).toBeInTheDocument() // Battery
        expect(screen.getByText('23.1°C')).toBeInTheDocument() // Payload
        // Max of the four is 28.4 — appears twice (OBC row + Max row)
        expect(screen.getAllByText('28.4°C')).toHaveLength(2)
    })

    it('shows skeleton when loading with no data', () => {
        const { container } = render(
            <ThermalSystemWidget
                latest={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
