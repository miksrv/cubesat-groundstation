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
        // link. What COMMS publishes is whether the node answered, which channel
        // it takes commands from and whether the scheduled beacon runs — so that
        // is what the panel shows.
        expect(screen.getByText('answered')).toBeInTheDocument()
        expect(screen.getByText('!698204b0')).toBeInTheDocument()
        expect(screen.getByText('Beacon')).toBeInTheDocument()
        expect(screen.getByText('Listening')).toBeInTheDocument()
    })

    it('names the mesh channel commands must arrive on', () => {
        // The fault this row exists for: a ground node one index out transmits
        // perfectly, receives perfectly and is never answered, because since
        // 2026-09-03 the satellite acts only on uplinks from its own channel.
        // Nothing else on the page would show it.
        render(
            <GroundStationLinkMap
                adcs={mockAdcs}
                comms={{ ...mockComms, commandChannel: 3 }}
                host={mockHost}
                isLoading={false}
            />
        )
        expect(screen.getByText('Cmd channel')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('withholds the command channel a satellite too old to filter never sent', () => {
        render(
            <GroundStationLinkMap
                adcs={mockAdcs}
                comms={{ ...mockComms, commandChannel: null }}
                host={mockHost}
                isLoading={false}
            />
        )
        // A dash, not a zero: channel 0 is the public primary, and claiming the
        // satellite takes commands there would be the opposite of the truth.
        expect(screen.getByText('Cmd channel').parentElement).toHaveTextContent('—')
        expect(screen.getByText('Cmd channel').parentElement).not.toHaveTextContent('0')
    })

    it('shows a beacon that is off as off, and the receiver as still listening and answering', () => {
        // The DEMO/EXPO case since 2026-09-01: the profile starts the beacon off,
        // and this panel is where an operator checks whether the satellite is
        // quiet (a setting) or deaf (a different profile entirely). The two rows
        // must not read the same — and since 2026-09-03 the quiet one is
        // narrower than it was: the beacon rations the schedule, while a command
        // is answered on the listening half alone. `Transmitting: no` said the
        // satellite would not speak, which it does.
        render(
            <GroundStationLinkMap
                adcs={mockAdcs}
                comms={{ ...mockComms, beaconEnabled: false, loraListening: true }}
                host={mockHost}
                isLoading={false}
            />
        )
        // By label, not by value: `off` is also what the Wi-Fi row reads in
        // FLIGHT, and the two say entirely different things.
        expect(screen.getByText('Beacon').parentElement).toHaveTextContent('Beaconoff')
        expect(screen.getByText('yes — answers commands')).toBeInTheDocument()
        expect(screen.queryByText('Transmitting')).not.toBeInTheDocument()
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
