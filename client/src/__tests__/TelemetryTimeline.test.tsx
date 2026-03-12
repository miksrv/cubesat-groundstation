import '@testing-library/jest-dom'
import React from 'react'
import { render, screen } from '../test-utils'
import TelemetryTimeline from '../components/TelemetryTimeline/TelemetryTimeline'
import type { TelemetryRecord } from '../features/telemetry/types'

const makeRecord = (id: number): TelemetryRecord => ({
  id,
  timestamp: `2024-01-01T12:0${id}:00Z`,
  battery: 80,
  voltage: 4.0,
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
  altitude: 400,
  raw_json: null,
})

describe('TelemetryTimeline', () => {
  it('shows "No telemetry data yet" when history is empty and not loading', () => {
    render(<TelemetryTimeline history={[]} isLoading={false} />)
    expect(screen.getByText('No telemetry data yet')).toBeInTheDocument()
  })

  it('renders the correct number of rows matching history length', () => {
    const history = [makeRecord(1), makeRecord(2), makeRecord(3)]
    const { container } = render(<TelemetryTimeline history={history} isLoading={false} />)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(3)
  })

  it('shows a skeleton element when isLoading=true and history is empty', () => {
    const { container } = render(<TelemetryTimeline history={[]} isLoading={true} />)
    // The skeleton div is rendered instead of the table
    const skeleton = container.querySelector('[class*="skeleton"]')
    expect(skeleton).toBeInTheDocument()
  })
})
