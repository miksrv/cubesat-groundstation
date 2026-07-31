import type { OrbitState, TelemetryRecord } from '../../features/telemetry/types'
import { render, screen } from '../../test-utils'

import MissionStatusBar from './MissionStatusBar'

import '@testing-library/jest-dom'

const mockRecord: TelemetryRecord = {
    id: 1,
    timestamp: '2024-01-01T12:00:00Z',
    battery: 85,
    voltage: 4.1,
    external_power: 1,
    battery_current: 0.63,
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
    camera_status: 'READY',
    image_count: 10,
    image_resolution: '1280x720',
    sensor_status: 'NOMINAL',
    science_mode: false,
    payload_power_watts: 1.2,
    cpu_percent: 10,
    ram_percent: 30,
    swap_percent: 0,
    disk_percent: 20,
    uptime_seconds: 90061, // 1d 01:01:01
    cpu_temperature: 45,
    boot_count: 1,
    obc_temperature: 25,
    eps_temperature: 25,
    battery_temperature: 20,
    payload_temperature: 22,
    rssi: -60,
    snr: 15,
    uplink_bps: 9600,
    downlink_bps: 9600,
    latency_ms: 100,
    packet_loss_pct: 0.1,
    obc_state: 'NOMINAL',
    latitude: 51.5,
    longitude: -0.1,
    altitude: 400,
    speed_kms: 7.6
}

const mockOrbit: OrbitState = {
    orbit_type: 'LEO',
    altitude_km: 506,
    inclination_deg: 97.45,
    period_min: 94.6,
    raan_deg: 100,
    aop_deg: 80,
    true_anomaly_deg: 45,
    eclipse: false,
    beta_angle_deg: 30,
    orbit_number: 245,
    ground_station: { name: 'ORENBURG, RUSSIA', lat: 51.7727, lon: 55.0988 },
    next_pass_seconds: 454
}

describe('MissionStatusBar', () => {
    it('renders mission status derived from telemetry', () => {
        render(
            <MissionStatusBar
                latest={mockRecord}
                orbit={mockOrbit}
                isLoading={false}
                isError={false}
            />
        )
        expect(screen.getAllByText('NOMINAL').length).toBeGreaterThan(0)
    })

    it('renders the formatted mission time from uptime_seconds', () => {
        render(
            <MissionStatusBar
                latest={mockRecord}
                orbit={mockOrbit}
                isLoading={false}
                isError={false}
            />
        )
        expect(screen.getByText('T+01:01:01:01')).toBeInTheDocument()
    })

    it('renders the orbit number and ground station name', () => {
        render(
            <MissionStatusBar
                latest={mockRecord}
                orbit={mockOrbit}
                isLoading={false}
                isError={false}
            />
        )
        expect(screen.getByText('#245')).toBeInTheDocument()
        expect(screen.getByText('ORENBURG, RUSSIA')).toBeInTheDocument()
    })

    it('shows OFFLINE link status when isError=true', () => {
        render(
            <MissionStatusBar
                latest={mockRecord}
                orbit={mockOrbit}
                isLoading={false}
                isError={true}
            />
        )
        expect(screen.getByText('OFFLINE')).toBeInTheDocument()
    })

    it('renders placeholders when there is no data yet', () => {
        render(
            <MissionStatusBar
                latest={null}
                orbit={null}
                isLoading={false}
                isError={false}
            />
        )
        expect(screen.getAllByText('UNKNOWN').length).toBeGreaterThan(0)
    })
})
