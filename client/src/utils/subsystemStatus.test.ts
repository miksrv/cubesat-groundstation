import type { TelemetryRecord } from '../features/telemetry/types'

import {
    getAdcsStatus,
    getCommsStatus,
    getEpsStatus,
    getMissionStatus,
    getObcStatus,
    getPayloadStatus,
    getSubsystemStatuses
} from './subsystemStatus'

const base: TelemetryRecord = {
    id: 1,
    timestamp: '2026-01-01T00:00:00Z',
    battery: 80,
    voltage: 8,
    external_power: 1,
    battery_current: 0.63,
    roll: 0,
    pitch: 0,
    yaw: 0,
    imu_temp: 25,
    accel_x: 0,
    accel_y: 0,
    accel_z: 0,
    gyro_x: 0.1,
    gyro_y: 0.1,
    gyro_z: 0.1,
    temperature: 22,
    humidity: 50,
    pressure: 1000,
    camera_status: 'READY',
    image_count: 10,
    image_resolution: '1280x720',
    sensor_status: 'NOMINAL',
    science_mode: false,
    payload_power_watts: 1,
    cpu_percent: 30,
    ram_percent: 40,
    swap_percent: 5,
    disk_percent: 30,
    uptime_seconds: 1000,
    cpu_temperature: 50,
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
    latitude: 0,
    longitude: 0,
    altitude: 500,
    speed_kms: 7.6
}

describe('subsystemStatus', () => {
    it('returns UNKNOWN for a null record', () => {
        expect(getEpsStatus(null)).toBe('UNKNOWN')
        expect(getSubsystemStatuses(null).every((s) => s.status === 'UNKNOWN')).toBe(true)
    })

    it('flags low battery as WARN/CRITICAL', () => {
        expect(getEpsStatus({ ...base, battery: 80 })).toBe('OK')
        expect(getEpsStatus({ ...base, battery: 25 })).toBe('WARN')
        expect(getEpsStatus({ ...base, battery: 10 })).toBe('CRITICAL')
    })

    it('flags high angular rates as WARN/CRITICAL', () => {
        expect(getAdcsStatus({ ...base, gyro_x: 0.2, gyro_y: 0.2, gyro_z: 0.2 })).toBe('OK')
        expect(getAdcsStatus({ ...base, gyro_x: 2, gyro_y: 0, gyro_z: 0 })).toBe('WARN')
        expect(getAdcsStatus({ ...base, gyro_x: 6, gyro_y: 0, gyro_z: 0 })).toBe('CRITICAL')
    })

    it('flags high CPU/RAM usage as WARN/CRITICAL', () => {
        expect(getObcStatus({ ...base, cpu_percent: 50, ram_percent: 50 })).toBe('OK')
        expect(getObcStatus({ ...base, cpu_percent: 90, ram_percent: 50 })).toBe('WARN')
        expect(getObcStatus({ ...base, cpu_percent: 98, ram_percent: 50 })).toBe('CRITICAL')
    })

    it('flags non-nominal sensor/camera status as WARN', () => {
        expect(getPayloadStatus({ ...base, sensor_status: 'NOMINAL', camera_status: 'READY' })).toBe('OK')
        expect(getPayloadStatus({ ...base, sensor_status: 'FAULT', camera_status: 'READY' })).toBe('WARN')
    })

    it('flags packet loss as WARN/CRITICAL', () => {
        expect(getCommsStatus({ ...base, packet_loss_pct: 0.5 })).toBe('OK')
        expect(getCommsStatus({ ...base, packet_loss_pct: 3 })).toBe('WARN')
        expect(getCommsStatus({ ...base, packet_loss_pct: 8 })).toBe('CRITICAL')
    })

    it('derives overall mission status as the worst subsystem status', () => {
        expect(getMissionStatus(base)).toBe('NOMINAL')
        expect(getMissionStatus({ ...base, battery: 10 })).toBe('CRITICAL')
        expect(getMissionStatus({ ...base, packet_loss_pct: 3 })).toBe('WARNING')
        expect(getMissionStatus(null)).toBe('UNKNOWN')
    })
})
