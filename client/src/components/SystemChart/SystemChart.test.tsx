import type { TelemetryRecord } from '../../features/telemetry/types'
import { render, screen } from '../../test-utils'

import SystemChart from './SystemChart'

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

const makeRecord = (id: number): TelemetryRecord => ({
    id,
    timestamp: `2024-01-01T12:0${id}:00Z`,
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
    cpu_percent: 15.5,
    ram_percent: 42.3,
    swap_percent: 5.0,
    disk_percent: 35.8,
    uptime_seconds: 86400,
    cpu_temperature: 48.5,
    obc_state: 'NOMINAL',
    latitude: 51.5,
    longitude: -0.1,
    altitude: 400
})

describe('SystemChart', () => {
    it('renders the System panel title', () => {
        render(
            <SystemChart
                history={[makeRecord(1)]}
                isLoading={false}
            />
        )
        expect(screen.getByText(/System/)).toBeInTheDocument()
    })

    it('shows skeleton when isLoading=true and history is empty', () => {
        const { container } = render(
            <SystemChart
                history={[]}
                isLoading={true}
            />
        )
        const skeleton = container.querySelector('[class*="skeleton"]')
        expect(skeleton).toBeInTheDocument()
    })

    it('renders without crashing when history is empty and not loading', () => {
        render(
            <SystemChart
                history={[]}
                isLoading={false}
            />
        )
        expect(screen.getByText(/System/)).toBeInTheDocument()
    })

    it('displays CPU Temp and Uptime labels with data', () => {
        render(
            <SystemChart
                history={[makeRecord(1)]}
                isLoading={false}
            />
        )
        expect(screen.getByText(/CPU Temp/)).toBeInTheDocument()
        expect(screen.getByText(/Uptime/)).toBeInTheDocument()
    })
})
