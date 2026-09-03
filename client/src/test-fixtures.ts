/**
 * Fixtures shaped like what the satellite really publishes.
 *
 * Values are taken from the payload examples in `cubesat-sim/README.md` rather
 * than invented, so a test that passes against these is a test that would pass
 * against the satellite. Note what that means in practice: `yaw` is present
 * only because `calibStatus.mag` is 3, `uvIndex` is null because the SEN0501
 * board revision is unknown, and the position is a real fix rather than the
 * tidy zeros this receiver reports when it has none.
 */

import type {
    AdcsStatus,
    CommsStatus,
    DhsStatus,
    EpsStatus,
    HostStatus,
    LiveState,
    ObcStatus,
    PayloadStatus,
    ScienceData,
    TelemetryRecord
} from './features/telemetry/types'

const AT = 1741863600.0

export const mockObc: ObcStatus = {
    timestamp: AT,
    status: 'NOMINAL',
    profile: 'FLIGHT',
    cadenceScale: 1.0,
    persistence: 'mission_db',
    missionLabel: 'walk to work',
    subsystems: { watched: ['adcs', 'comms', 'dhs', 'eps', 'payload'], lost: [] }
}

export const mockEps: EpsStatus = {
    timestamp: AT,
    batteryPercent: 87.5,
    voltage: 4.123,
    externalPower: false,
    chargeRate: -0.208
}

export const mockAdcs: AdcsStatus = {
    timestamp: AT,
    roll: 1.23,
    pitch: -0.45,
    yaw: 178.9,
    quaternion: { w: 0.999, x: 0.01, y: 0.02, z: 0.03 },
    calibStatus: { sys: 3, gyro: 3, accel: 3, mag: 3 },
    imuTemp: 34.5,
    accel: { x: 0.01, y: 0.02, z: 0.99 },
    gyro: { x: 0.1, y: -0.2, z: 0.05 },
    gnss: { lat: 55.7558, lon: 37.6173, alt: 156.2, speed: 0.4, fix: true, satellites: 23 }
}

export const mockScience: ScienceData = {
    timestamp: AT,
    temperature: 23.4,
    humidity: 45.2,
    pressure: 1013.0,
    light: 412.0,
    // Withheld until the board revision is known — see the file docstring.
    uvIndex: null,
    uvRaw: 14
}

export const mockPayload: PayloadStatus = {
    timestamp: AT,
    sensor: { device: 'SEN0501', present: true, readings: 148, lastRead: AT - 5 },
    camera: { device: 'Camera Module V2', present: true },
    storage: { freeMb: 21493.7, minFreeMb: 512.0, blocked: false },
    missionPhotos: { active: false, intervalSec: null, frames: 0, reason: null },
    missionId: 42,
    photoDir: '/var/lib/cubesat/photos/42'
}

export const mockDhs: DhsStatus = {
    timestamp: AT,
    recording: true,
    database: '/var/lib/cubesat/comms.db',
    mission: { id: 42, label: 'walk to work', startedAt: '2026-08-24T07:00:00Z', rows: 120 },
    rows: 1440,
    dbSizeBytes: 2_400_000,
    lastWrite: AT,
    retentionDays: 30,
    attitude: { written: 3600, buffered: 0, minIntervalSec: 1.0 },
    radio: { written: 34, buffered: 0 },
    photos: { freeMb: 21493.7, minFreeMb: 512.0 }
}

export const mockComms: CommsStatus = {
    timestamp: AT,
    radio: { present: true, node: '!698204b0', region: 'US' },
    beaconEnabled: true,
    loraListening: true,
    // `1` is the private `CubeSat` channel: the satellite's own default and the
    // value its documented payload carries.
    commandChannel: 1,
    lastUplink: AT - 200
}

export const mockHost: HostStatus = {
    timestamp: AT,
    profile: 'FLIGHT',
    profileRequested: 'FLIGHT',
    network: { mode: 'off', ssid: null, clients: null },
    units: { 'cubesat@adcs.service': 'active', 'telegram-bot.service': 'inactive' },
    governor: 'powersave',
    errors: [],
    ttlExpiresAt: AT + 36_000
}

/** A satellite reporting on every topic. */
export const mockLiveState: LiveState = {
    host: mockHost,
    obc: mockObc,
    eps: mockEps,
    adcs: mockAdcs,
    payload: mockPayload,
    science: mockScience,
    dhs: mockDhs,
    comms: mockComms
}

/** Nothing has arrived yet — the state a page is in the instant it connects. */
export const emptyLiveState: LiveState = {
    host: null,
    obc: null,
    eps: null,
    adcs: null,
    payload: null,
    science: null,
    dhs: null,
    comms: null
}

/** One row of `telemetry`, as the archive hands it over. */
export const mockTelemetryRecord: TelemetryRecord = {
    id: 1,
    timestamp: '2026-08-24T07:12:03Z',
    missionId: 42,
    profile: 'FLIGHT',
    obcState: 'NOMINAL',
    battery: 87.5,
    voltage: 4.123,
    externalPower: false,
    roll: 1.23,
    pitch: -0.45,
    yaw: 178.9,
    quaternion: { w: 0.999, x: 0.01, y: 0.02, z: 0.03 },
    calibStatus: { sys: 3, gyro: 3, accel: 3, mag: 3 },
    imuTemp: 34.5,
    accel: { x: 0.01, y: 0.02, z: 0.99 },
    gyro: { x: 0.1, y: -0.2, z: 0.05 },
    gnss: { lat: 55.7558, lon: 37.6173, alt: 156.2, speed: 0.4, fix: true, satellites: 23 },
    temperature: 23.4,
    humidity: 45.2,
    pressure: 1013.0,
    light: 412.0,
    uvIndex: null,
    cpuPercent: 34,
    ramPercent: 52,
    swapPercent: 10,
    diskPercent: 41,
    uptimeSeconds: 187562,
    cpuTemperature: 55
}
