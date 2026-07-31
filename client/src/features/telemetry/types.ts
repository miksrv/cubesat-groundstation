export interface TelemetryRecord {
    id: number
    timestamp: string
    battery: number | null
    voltage: number | null
    external_power: number | null
    battery_current: number | null
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
    camera_status: string | null
    image_count: number | null
    image_resolution: string | null
    sensor_status: string | null
    science_mode: boolean | null
    payload_power_watts: number | null
    cpu_percent: number | null
    ram_percent: number | null
    swap_percent: number | null
    disk_percent: number | null
    uptime_seconds: number | null
    cpu_temperature: number | null
    boot_count: number | null
    obc_temperature: number | null
    eps_temperature: number | null
    battery_temperature: number | null
    payload_temperature: number | null
    rssi: number | null
    snr: number | null
    uplink_bps: number | null
    downlink_bps: number | null
    latency_ms: number | null
    packet_loss_pct: number | null
    obc_state: string | null
    latitude: number | null
    longitude: number | null
    altitude: number | null
    speed_kms: number | null
}

export type EventType = 'state_transition' | 'command' | 'deployment' | 'alert' | 'info'
export type EventSeverity = 'info' | 'success' | 'warning' | 'critical'

export interface MissionEvent {
    id: number
    timestamp: string
    type: EventType
    severity: EventSeverity
    message: string
    meta: Record<string, unknown> | null
}

export interface GroundStation {
    name: string
    lat: number
    lon: number
}

export interface OrbitState {
    orbit_type: string
    altitude_km: number
    inclination_deg: number
    period_min: number
    raan_deg: number
    aop_deg: number
    true_anomaly_deg: number
    eclipse: boolean
    beta_angle_deg: number
    orbit_number: number
    ground_station: GroundStation
    next_pass_seconds: number
}

export interface WeatherInfo {
    temperature: number
    feelsLike: number
    pressure: number
    humidity: number
    dewPoint: number
    visibility: number
    uvIndex: number
    solEnergy: number
    solRadiation: number
    clouds: number
    precipitation: number
    windSpeed: number
    windGust: number
    windDeg: number
    weatherId: number
    date: string
    lastUpdated: string
    isStale: boolean
}

export type CommandName =
    | 'REFRESH_TELEMETRY'
    | 'ENABLE_SCIENCE_MODE'
    | 'DISABLE_SCIENCE_MODE'
    | 'REBOOT_OBC'
    | 'RESET_ADCS'
    | 'SAFE_MODE'

export interface CommandResponse {
    status: 'ok' | 'demo'
    message: string
    event_id: number | null
}
