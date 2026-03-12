import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

import type { TelemetryRecord } from './types'

interface LatestResponse extends TelemetryRecord {}
interface HistoryResponse {
    count: number
    records: TelemetryRecord[]
}

// Transform raw API response to convert string values to numbers
const transformRecord = (raw: Record<string, unknown>): TelemetryRecord => ({
    id: Number(raw.id),
    timestamp: String(raw.timestamp),
    battery: raw.battery != null ? Number(raw.battery) : null,
    voltage: raw.voltage != null ? Number(raw.voltage) : null,
    external_power: raw.external_power != null ? Number(raw.external_power) : null,
    roll: raw.roll != null ? Number(raw.roll) : null,
    pitch: raw.pitch != null ? Number(raw.pitch) : null,
    yaw: raw.yaw != null ? Number(raw.yaw) : null,
    imu_temp: raw.imu_temp != null ? Number(raw.imu_temp) : null,
    accel_x: raw.accel_x != null ? Number(raw.accel_x) : null,
    accel_y: raw.accel_y != null ? Number(raw.accel_y) : null,
    accel_z: raw.accel_z != null ? Number(raw.accel_z) : null,
    gyro_x: raw.gyro_x != null ? Number(raw.gyro_x) : null,
    gyro_y: raw.gyro_y != null ? Number(raw.gyro_y) : null,
    gyro_z: raw.gyro_z != null ? Number(raw.gyro_z) : null,
    temperature: raw.temperature != null ? Number(raw.temperature) : null,
    humidity: raw.humidity != null ? Number(raw.humidity) : null,
    pressure: raw.pressure != null ? Number(raw.pressure) : null,
    cpu_percent: raw.cpu_percent != null ? Number(raw.cpu_percent) : null,
    ram_percent: raw.ram_percent != null ? Number(raw.ram_percent) : null,
    swap_percent: raw.swap_percent != null ? Number(raw.swap_percent) : null,
    disk_percent: raw.disk_percent != null ? Number(raw.disk_percent) : null,
    uptime_seconds: raw.uptime_seconds != null ? Number(raw.uptime_seconds) : null,
    cpu_temperature: raw.cpu_temperature != null ? Number(raw.cpu_temperature) : null,
    obc_state: raw.obc_state != null ? String(raw.obc_state) : null,
    latitude: raw.latitude != null ? Number(raw.latitude) : null,
    longitude: raw.longitude != null ? Number(raw.longitude) : null,
    altitude: raw.altitude != null ? Number(raw.altitude) : null,
    raw_json: raw.raw_json != null ? String(raw.raw_json) : null
})

export const telemetryApi = createApi({
    reducerPath: 'telemetryApi',
    baseQuery: fetchBaseQuery({ baseUrl: '/api/cubesat' }),
    endpoints: (builder) => ({
        getLatest: builder.query<LatestResponse, void>({
            query: () => '/telemetry/latest',
            transformResponse: (response: Record<string, unknown>) => transformRecord(response)
        }),
        getHistory: builder.query<HistoryResponse, number>({
            query: (limit = 100) => `/telemetry/history?limit=${limit}`,
            transformResponse: (response: { count: number; records: Record<string, unknown>[] }) => ({
                count: response.count,
                records: response.records.map(transformRecord)
            })
        })
    })
})

export const { useGetLatestQuery, useGetHistoryQuery } = telemetryApi
