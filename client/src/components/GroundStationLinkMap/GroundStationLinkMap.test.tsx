import { mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import GroundStationLinkMap from './GroundStationLinkMap'

import '@testing-library/jest-dom'

// react-leaflet / leaflet / leaflet.css are mocked globally, see jest.config.ts moduleNameMapper

global.ResizeObserver = jest.fn(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
}))

describe('GroundStationLinkMap', () => {
    it('renders the panel title', () => {
        render(
            <GroundStationLinkMap
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getAllByText(/Ground Station Link/).length).toBeGreaterThan(0)
    })

    it('shows skeleton when isLoading=true and latest is null', () => {
        const { container } = render(
            <GroundStationLinkMap
                latest={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })

    it('displays comms link stats from the latest record', () => {
        render(
            <GroundStationLinkMap
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getByText('RSSI')).toBeInTheDocument()
        expect(screen.getByText('-63 dBm')).toBeInTheDocument()
        expect(screen.getByText('SNR')).toBeInTheDocument()
        expect(screen.getByText('17.0 dB')).toBeInTheDocument()
    })

    it('renders the map container and ground station marker', () => {
        render(
            <GroundStationLinkMap
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getByTestId('map-container')).toBeInTheDocument()
        expect(screen.getAllByText('ORENBURG, RUSSIA').length).toBeGreaterThan(0)
    })

    it('does not show skeleton when data is available even if loading', () => {
        const { container } = render(
            <GroundStationLinkMap
                latest={mockTelemetryRecord}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).not.toBeInTheDocument()
    })
})
