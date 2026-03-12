import type { TelemetryRecord } from '../../features/telemetry/types'
import { render, screen } from '../../test-utils'

import Header from './Header'

import '@testing-library/jest-dom'

const mockRecord: TelemetryRecord = {
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
    latitude: 51.5,
    longitude: -0.1,
    altitude: 400
}

describe('Header', () => {
    it('renders the CubeSat Ground Station title', () => {
        render(
            <Header
                latest={null}
                isLoading={false}
                isError={false}
            />
        )
        expect(screen.getByText('CubeSat Ground Station')).toBeInTheDocument()
    })

    it('shows the OBC state badge when latest data is provided', () => {
        render(
            <Header
                latest={mockRecord}
                isLoading={false}
                isError={false}
            />
        )
        expect(screen.getByText('NOMINAL')).toBeInTheDocument()
    })

    it('shows "API Offline" text when isError=true', () => {
        render(
            <Header
                latest={null}
                isLoading={false}
                isError={true}
            />
        )
        expect(screen.getByText('API Offline')).toBeInTheDocument()
    })

    it('shows a countdown element when isError=false', () => {
        render(
            <Header
                latest={null}
                isLoading={false}
                isError={false}
            />
        )
        expect(screen.getByText(/↻.*s/)).toBeInTheDocument()
    })
})
