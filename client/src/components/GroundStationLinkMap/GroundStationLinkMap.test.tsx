import { mockAdcs, mockComms, mockHost } from '../../test-fixtures'
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
                host={mockHost}
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
                host={null}
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
                host={mockHost}
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

    it('shows the Wi-Fi half of the link, which HOSTD owns', () => {
        // In FLIGHT the Wi-Fi is off, in EXPO the satellite is its own access
        // point — until these rows existed the page could not tell the two apart.
        render(
            <GroundStationLinkMap
                adcs={mockAdcs}
                comms={mockComms}
                host={{
                    ...mockHost,
                    network: { mode: 'ap', ssid: 'CubeSat', clients: 3 }
                }}
                isLoading={false}
            />
        )
        expect(screen.getByText('access point')).toBeInTheDocument()
        expect(screen.getByText('CubeSat')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('renders the map container and ground station marker', () => {
        render(
            <GroundStationLinkMap
                adcs={mockAdcs}
                comms={mockComms}
                host={mockHost}
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
                host={mockHost}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).not.toBeInTheDocument()
    })
})
