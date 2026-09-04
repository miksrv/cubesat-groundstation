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

/**
 * The satellite on battery, from the series measured on 2026-09-03: 3.759 V at
 * idle load in `HOSTED`, falling at −197 mV/h, with the fuel gauge's own model
 * claiming 47.7 %.
 *
 * The derived fields are what the satellite's `common/battery.py` computes from
 * that voltage, not numbers picked to look plausible: 48.6 % off the inferred
 * curve, −24.62 %/h through the local gradient (8 mV per point here), and
 * 7106.4 s down to the pack's 3.0 V floor. So `batteryPercent` and
 * `gaugePercent` differ by the point that the two fields exist to record, and
 * `timeToFullSec` is null because the slope points the other way.
 */
export const mockEps: EpsStatus = {
    timestamp: AT,
    voltage: 3.759,
    voltageMedian: 3.759,
    batteryPercent: 48.6,
    gaugePercent: 47.7,
    externalPower: false,
    voltageRate: -197.0,
    chargeRate: -24.62,
    timeToEmptySec: 7106.4,
    timeToFullSec: null
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

/**
 * One row of `telemetry`, as the archive hands it over — the same instant of the
 * same satellite as {@link mockEps}, so a widget cannot be made to pass by
 * reading one and failing to read the other.
 *
 * `battery` is the curve's figure rather than the gauge's, which is what the
 * column has meant since 2026-09-04; `gaugePercent` holds what the gauge itself
 * said. The two rate columns arrived with schema migrations 6 and 7, so a row
 * really does carry them and a replay is not obliged to withhold them.
 */
export const mockTelemetryRecord: TelemetryRecord = {
    id: 1,
    timestamp: '2026-08-24T07:12:03Z',
    missionId: 42,
    profile: 'FLIGHT',
    obcState: 'NOMINAL',
    battery: 48.6,
    voltage: 3.759,
    gaugePercent: 47.7,
    externalPower: false,
    voltageRate: -197.0,
    chargeRate: -24.62,
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
