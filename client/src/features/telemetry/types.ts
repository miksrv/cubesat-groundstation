export interface TelemetryRecord {
    id: number
    timestamp: string
    battery: number | null
    voltage: number | null
    external_power: number | null
    roll: number | null
    pitch: number | null
    yaw: number | null
    imu_temp: number | null
    accel_x: number | null
    accel_y: number | null
    accel_z: number | null
    gyro_x: number | null
    gyro_y: number | null
    gyro_z: number | null
    temperature: number | null
    humidity: number | null
    pressure: number | null
    cpu_percent: number | null
    ram_percent: number | null
    swap_percent: number | null
    disk_percent: number | null
    uptime_seconds: number | null
    cpu_temperature: number | null
    obc_state: string | null
    latitude: number | null
    longitude: number | null
    altitude: number | null
    raw_json: string | null
}
