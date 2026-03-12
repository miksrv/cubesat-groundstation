import type { TelemetryRecord } from '../../features/telemetry/types'
import { render, screen } from '../../test-utils'

import ADCSPanel from './ADCSPanel'

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

describe('ADCSPanel', () => {
    it('renders the ADCS panel title', () => {
        render(
            <ADCSPanel
                latest={makeRecord()}
                history={[]}
                isLoading={false}
            />
        )
        expect(screen.getByText(/ADCS/)).toBeInTheDocument()
    })

    it('shows skeleton when isLoading=true and latest is null', () => {
        const { container } = render(
            <ADCSPanel
                latest={null}
                history={[]}
                isLoading={true}
            />
        )
        const skeleton = container.querySelector('[class*="skeleton"]')
        expect(skeleton).toBeInTheDocument()
    })

    it('displays roll, pitch, and yaw labels', () => {
        render(
            <ADCSPanel
                latest={makeRecord()}
                history={[]}
                isLoading={false}
            />
        )
        expect(screen.getByText('Roll')).toBeInTheDocument()
        expect(screen.getByText('Pitch')).toBeInTheDocument()
        expect(screen.getByText('Yaw')).toBeInTheDocument()
    })

    it('renders without crashing when history is empty', () => {
        render(
            <ADCSPanel
                latest={makeRecord()}
                history={[]}
                isLoading={false}
            />
        )
        expect(screen.getByText(/ADCS/)).toBeInTheDocument()
    })
})
