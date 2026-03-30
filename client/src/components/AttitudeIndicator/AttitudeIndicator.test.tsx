import type { TelemetryRecord } from '../../features/telemetry/types'
import { render, screen } from '../../test-utils'

import AttitudeIndicator from './AttitudeIndicator'

import '@testing-library/jest-dom'

// Mock canvas context
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    closePath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    scale: jest.fn(),
    createRadialGradient: jest.fn(() => ({
        addColorStop: jest.fn()
    })),
    fillText: jest.fn()
})) as jest.Mock

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

describe('AttitudeIndicator', () => {
    it('renders the Attitude 3D panel title', () => {
        render(
            <AttitudeIndicator
                latest={makeRecord()}
                isLoading={false}
            />
        )
        expect(screen.getByText(/Attitude 3D/)).toBeInTheDocument()
    })

    it('shows skeleton when isLoading=true and latest is null', () => {
        const { container } = render(
            <AttitudeIndicator
                latest={null}
                isLoading={true}
            />
        )
        const skeleton = container.querySelector('[data-testid="skeleton"]')
        expect(skeleton).toBeInTheDocument()
    })

    it('displays roll, pitch, and yaw values', () => {
        render(
            <AttitudeIndicator
                latest={makeRecord({ roll: 15.3, pitch: -8.7, yaw: 120.5 })}
                isLoading={false}
            />
        )

        expect(screen.getByText('Roll (X)')).toBeInTheDocument()
        expect(screen.getByText('15.3°')).toBeInTheDocument()
        expect(screen.getByText('Pitch (Y)')).toBeInTheDocument()
        expect(screen.getByText('-8.7°')).toBeInTheDocument()
        expect(screen.getByText('Yaw (Z)')).toBeInTheDocument()
        expect(screen.getByText('120.5°')).toBeInTheDocument()
    })

    it('displays dash when values are null', () => {
        render(
            <AttitudeIndicator
                latest={makeRecord({ roll: null, pitch: null, yaw: null })}
                isLoading={false}
            />
        )

        const dashValues = screen.getAllByText('—°')
        expect(dashValues).toHaveLength(3)
    })

    it('displays legend items', () => {
        render(
            <AttitudeIndicator
                latest={makeRecord()}
                isLoading={false}
            />
        )

        expect(screen.getByText('X axis')).toBeInTheDocument()
        expect(screen.getByText('Y axis')).toBeInTheDocument()
        expect(screen.getByText('Z axis')).toBeInTheDocument()
    })

    it('renders canvas element', () => {
        const { container } = render(
            <AttitudeIndicator
                latest={makeRecord()}
                isLoading={false}
            />
        )

        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
    })

    it('does not show skeleton when data is available even if loading', () => {
        const { container } = render(
            <AttitudeIndicator
                latest={makeRecord()}
                isLoading={true}
            />
        )

        const skeleton = container.querySelector('[data-testid="skeleton"]')
        expect(skeleton).not.toBeInTheDocument()
    })
})

