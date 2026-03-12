import '@testing-library/jest-dom'
import React from 'react'

jest.mock('echarts', () => ({
  init: jest.fn(() => ({
    setOption: jest.fn(),
    resize: jest.fn(),
    dispose: jest.fn(),
  })),
}))

global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

import { render, screen } from '../test-utils'
import EPSPanel from '../components/EPSPanel/EPSPanel'
import type { TelemetryRecord } from '../features/telemetry/types'

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
  latitude: 51.5,
  longitude: -0.1,
  altitude: 400,
  raw_json: null,
  ...overrides,
})

describe('EPSPanel', () => {
  it('renders the EPS panel when latest data is provided', () => {
    render(<EPSPanel latest={makeRecord()} history={[]} isLoading={false} />)
    expect(screen.getByText(/EPS/)).toBeInTheDocument()
  })

  it('shows "External ON" when external_power is 1', () => {
    render(<EPSPanel latest={makeRecord({ external_power: 1 })} history={[]} isLoading={false} />)
    expect(screen.getByText(/External ON/)).toBeInTheDocument()
  })

  it('shows "Battery Only" when external_power is 0', () => {
    render(<EPSPanel latest={makeRecord({ external_power: 0 })} history={[]} isLoading={false} />)
    expect(screen.getByText(/Battery Only/)).toBeInTheDocument()
  })
})
