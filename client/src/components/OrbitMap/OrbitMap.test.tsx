// Mock leaflet CSS first
import type { TelemetryRecord } from '../../features/telemetry/types'
import { render, screen } from '../../test-utils'

import OrbitMap from './OrbitMap'

import '@testing-library/jest-dom'

jest.mock('leaflet/dist/leaflet.css', () => ({}))

// Mock Leaflet
jest.mock('react-leaflet', () => ({
    MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid='map-container'>{children}</div>,
    TileLayer: () => <div data-testid='tile-layer' />,
    Marker: ({ children }: { children: React.ReactNode }) => <div data-testid='marker'>{children}</div>,
    CircleMarker: ({ children }: { children: React.ReactNode }) => <div data-testid='circle-marker'>{children}</div>,
    Polyline: () => <div data-testid='polyline' />,
    Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid='tooltip'>{children}</div>,
    useMap: () => ({
        setView: jest.fn(),
        getZoom: () => 3
    })
}))

jest.mock('leaflet', () => ({
    divIcon: jest.fn(() => ({}))
}))

global.ResizeObserver = jest.fn(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
}))

const makeRecord = (overrides: Partial<TelemetryRecord> = {}): TelemetryRecord => ({
    id: 1,
    timestamp: '2024-01-01T12:00:00Z',
    battery: 85,
    voltage: 4.1,
    external_power: 1,
    roll: 10.5,
    pitch: -5.2,
    yaw: 45.0,
    imu_temp: 25,
    accel_x: 0.01,
    accel_y: -0.02,
    accel_z: 9.81,
    gyro_x: 0.001,
    gyro_y: 0.002,
    gyro_z: -0.001,
    temperature: 22,
    humidity: 50,
    pressure: 1013,
    cpu_percent: 10,
    ram_percent: 30,
    swap_percent: 0,
    disk_percent: 20,
    uptime_seconds: 3600,
    cpu_temperature: 45,
    obc_state: 'NOMINAL',
    latitude: 51.5,
    longitude: -0.1,
    altitude: 400,
    ...overrides
})

describe('OrbitMap', () => {
    it('renders the Orbit Map panel title', () => {
        render(
            <OrbitMap
                latest={makeRecord()}
                history={[]}
                isLoading={false}
            />
        )
        expect(screen.getByText(/Orbit Map/)).toBeInTheDocument()
    })

    it('shows skeleton when isLoading=true and latest is null', () => {
        const { container } = render(
            <OrbitMap
                latest={null}
                history={[]}
                isLoading={true}
            />
        )
        const skeleton = container.querySelector('[data-testid="skeleton"]')
        expect(skeleton).toBeInTheDocument()
    })

    it('displays coordinates when data is available', () => {
        render(
            <OrbitMap
                latest={makeRecord({ latitude: 45.1234, longitude: 12.5678, altitude: 420.5 })}
                history={[]}
                isLoading={false}
            />
        )

        expect(screen.getByText('LAT')).toBeInTheDocument()
        expect(screen.getByText('45.1234°')).toBeInTheDocument()
        expect(screen.getByText('LON')).toBeInTheDocument()
        expect(screen.getByText('12.5678°')).toBeInTheDocument()
        expect(screen.getByText('ALT')).toBeInTheDocument()
        expect(screen.getByText('420.5 km')).toBeInTheDocument()
    })

    it('renders map container', () => {
        render(
            <OrbitMap
                latest={makeRecord()}
                history={[]}
                isLoading={false}
            />
        )

        expect(screen.getByTestId('map-container')).toBeInTheDocument()
    })

    it('displays legend items', () => {
        render(
            <OrbitMap
                latest={makeRecord()}
                history={[]}
                isLoading={false}
            />
        )

        expect(screen.getByText('Ground Track')).toBeInTheDocument()
        expect(screen.getByText('Ground Stations')).toBeInTheDocument()
    })

    it('renders marker when position is valid', () => {
        render(
            <OrbitMap
                latest={makeRecord({ latitude: 10, longitude: 20 })}
                history={[]}
                isLoading={false}
            />
        )

        expect(screen.getByTestId('marker')).toBeInTheDocument()
    })

    it('does not show skeleton when data is available even if loading', () => {
        const { container } = render(
            <OrbitMap
                latest={makeRecord()}
                history={[]}
                isLoading={true}
            />
        )

        const skeleton = container.querySelector('[data-testid="skeleton"]')
        expect(skeleton).not.toBeInTheDocument()
    })
})
