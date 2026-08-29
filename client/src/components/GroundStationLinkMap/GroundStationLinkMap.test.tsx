import { mockAdcs, mockComms } from '../../test-fixtures'
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
                adcs={mockAdcs}
                comms={mockComms}
                isLoading={false}
            />
        )
        expect(screen.getAllByText(/Ground Station Link/).length).toBeGreaterThan(0)
    })

    it('shows skeleton when isLoading=true and latest is null', () => {
        const { container } = render(
            <GroundStationLinkMap
                adcs={null}
                comms={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })

    it('displays comms link stats from the latest record', () => {
        render(
            <GroundStationLinkMap
                adcs={mockAdcs}
                comms={mockComms}
                isLoading={false}
            />
        )
        // RSSI, SNR, latency and packet loss are gone. None of them is telemetry
        // on this satellite: the radio is a Heltec running Meshtastic, which does
        // its own framing and retries and reports none of it back over the serial
        // link. What COMMS publishes is whether the node answered and whether it
        // may transmit — so that is what the panel shows.
        expect(screen.getByText('answered')).toBeInTheDocument()
        expect(screen.getByText('!698204b0')).toBeInTheDocument()
        expect(screen.getByText('Transmitting')).toBeInTheDocument()
        expect(screen.getByText('Listening')).toBeInTheDocument()
    })

    it('renders the map container and ground station marker', () => {
        render(
            <GroundStationLinkMap
                adcs={mockAdcs}
                comms={mockComms}
                isLoading={false}
            />
        )
        expect(screen.getByTestId('map-container')).toBeInTheDocument()
        expect(screen.getAllByText('ORENBURG, RUSSIA').length).toBeGreaterThan(0)
    })

    it('does not show skeleton when data is available even if loading', () => {
        const { container } = render(
            <GroundStationLinkMap
                adcs={mockAdcs}
                comms={mockComms}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).not.toBeInTheDocument()
    })
})
