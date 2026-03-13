import type { TelemetryRecord } from '../../features/telemetry/types'
import { render, screen } from '../../test-utils'

import GPSPanel from './GPSPanel'

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

const makeRecord = (overrides: Partial<TelemetryRecord> = {}): TelemetryRecord => ({
    id: 1,
    timestamp: '2024-01-01T12:00:00Z',
    battery: 85,
    voltage: 4.1,
    external_power: 1,
    roll: 0,
    pitch: 0,
    yaw: 0,
    imu_temp: 25,
    accel_x: 0,
    accel_y: 0,
    accel_z: 0,
    gyro_x: 0,
    gyro_y: 0,
    gyro_z: 0,
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
    latitude: 55.7558,
    longitude: 37.6173,
    altitude: 420.5,
    ...overrides
})

describe('GPSPanel', () => {
    it('renders the GPS panel title', () => {
        render(
            <GPSPanel
                latest={makeRecord()}
                history={[]}
                isLoading={false}
            />
        )
        expect(screen.getByText(/GPS/)).toBeInTheDocument()
    })

    it('shows skeleton when isLoading=true and latest is null', () => {
        const { container } = render(
            <GPSPanel
                latest={null}
                history={[]}
                isLoading={true}
            />
        )
        const skeleton = container.querySelector('[data-testid="skeleton"]')
        expect(skeleton).toBeInTheDocument()
    })

    it('displays LAT, LON, and ALT labels', () => {
        render(
            <GPSPanel
                latest={makeRecord()}
                history={[]}
                isLoading={false}
            />
        )
        expect(screen.getByText('LAT')).toBeInTheDocument()
        expect(screen.getByText('LON')).toBeInTheDocument()
        expect(screen.getByText('ALT')).toBeInTheDocument()
    })

    it('renders without crashing when history is empty', () => {
        render(
            <GPSPanel
                latest={makeRecord()}
                history={[]}
                isLoading={false}
            />
        )
        expect(screen.getByText(/GPS/)).toBeInTheDocument()
    })
})
