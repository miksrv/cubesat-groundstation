import type { TelemetryRecord } from '../../features/telemetry/types'
import { render, screen } from '../../test-utils'

import PayloadChart from './PayloadChart'

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
    temperature: 22.5,
    humidity: 45.0,
    pressure: 1013.25,
    cpu_percent: 10,
    ram_percent: 30,
    swap_percent: 0,
    disk_percent: 20,
    uptime_seconds: 3600,
    cpu_temperature: 45,
    obc_state: 'NOMINAL',
    latitude: 51.5,
    longitude: -0.1,
    altitude: 400
})

describe('PayloadChart', () => {
    it('renders the Payload panel title', () => {
        render(
            <PayloadChart
                history={[makeRecord(1)]}
                isLoading={false}
            />
        )
        expect(screen.getByText(/Payload/)).toBeInTheDocument()
    })

    it('shows skeleton when isLoading=true and history is empty', () => {
        const { container } = render(
            <PayloadChart
                history={[]}
                isLoading={true}
            />
        )
        const skeleton = container.querySelector('[class*="skeleton"]')
        expect(skeleton).toBeInTheDocument()
    })

    it('renders without crashing when history is empty and not loading', () => {
        render(
            <PayloadChart
                history={[]}
                isLoading={false}
            />
        )
        expect(screen.getByText(/Payload/)).toBeInTheDocument()
    })

    it('renders without crashing with multiple history records', () => {
        render(
            <PayloadChart
                history={[makeRecord(1), makeRecord(2), makeRecord(3)]}
                isLoading={false}
            />
        )
        expect(screen.getByText(/Payload/)).toBeInTheDocument()
    })
})
