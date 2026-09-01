/**
 * The wire, decoded once.
 *
 * Everything the satellite sends is snake_case JSON with explicit nulls; the
 * rest of this app speaks camelCase and the types in `types.ts`. That
 * translation happens here and nowhere else, for one reason: a field decoded in
 * two places eventually gets decoded two ways.
 *
 * **A missing key and a null are the same thing, and neither is a zero.** The
 * satellite goes out of its way to withhold a value it cannot justify — a null
 * `yaw` means the magnetometer is not calibrated, a null `uv_index` means the
 * board revision is unknown. `?? 0` anywhere below would undo all of that and
 * hand a chart a confident wrong number.
 */

import type {
    AdcsStatus,
    CalibStatus,
    CommsStatus,
    DhsStatus,
    EpsStatus,
    GnssFix,
    HostStatus,
    MissionSummary,
    NetworkMode,
    ObcStatus,
    PayloadStatus,
    Photo,
    PhotoOverlay,
    PhotoRefusal,
    Profile,
    Quaternion,
    RadioEvent,
    ScienceData,
    SubsystemHealth,
    TelemetryRecord,
    TelemetrySnapshot,
    Vector3
} from './types'

type Raw = Record<string, unknown>

const asRecord = (value: unknown): Raw => (typeof value === 'object' && value != null ? (value as Raw) : {})

/** A number, or null for anything that is not one. `true` is not 1 here: a
 *  boolean arriving where a reading was expected is unknown, not one. */
export const num = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null

export const bool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null)

export const str = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const vector = (value: unknown): Vector3 => {
    const v = asRecord(value)
    return { x: num(v.x), y: num(v.y), z: num(v.z) }
}

const quaternion = (value: unknown): Quaternion => {
    const q = asRecord(value)
    return { w: num(q.w), x: num(q.x), y: num(q.y), z: num(q.z) }
}

const calib = (value: unknown): CalibStatus | null => {
    if (typeof value !== 'object' || value == null) {
        return null
    }
    const c = value as Raw
    return { sys: num(c.sys), gyro: num(c.gyro), accel: num(c.accel), mag: num(c.mag) }
}

const gnss = (value: unknown): GnssFix => {
    const g = asRecord(value)
    return {
        lat: num(g.lat),
        lon: num(g.lon),
        alt: num(g.alt),
        speed: num(g.speed),
        fix: bool(g.fix),
        satellites: num(g.satellites)
    }
}

const PROFILES: Profile[] = ['HOSTED', 'DEMO', 'EXPO', 'FLIGHT', 'DIAG', 'MAINTENANCE']

/**
 * A profile name this build knows, or null.
 *
 * Validated rather than cast, because profiles are data on the satellite:
 * `profiles.yaml` can name one this build has never heard of, and a dashboard
 * that rendered it as a known state would be wrong in a way nothing catches.
 */
export const profile = (value: unknown): Profile | null =>
    PROFILES.includes(value as Profile) ? (value as Profile) : null

/**
 * A mission-state name, verbatim — deliberately the opposite treatment from
 * {@link profile}. The state machine lives on the satellite and it is the
 * authority on its own vocabulary; a build that validated the name would
 * freeze on the previous state the day the satellite grows a new one. The
 * classifiers judge an unrecognized name UNKNOWN (see `MISSION_STATES`), but
 * the page still shows what the satellite actually said.
 */
export const missionState = (value: unknown): string | null => {
    const state = str(value)
    return state !== '' ? state : null
}

// ── the status topics ───────────────────────────────────────────────────────

/** A list of service names, or null for anything that is not one — a payload
 *  missing the field entirely (an older satellite) must read as "unknown",
 *  never as "nothing is watched", which would render every subsystem OFF. */
const serviceList = (value: unknown): string[] | null =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : null

const subsystemHealth = (value: unknown): SubsystemHealth | null => {
    const raw = asRecord(value)
    const watched = serviceList(raw.watched)
    const lost = serviceList(raw.lost)
    return watched != null && lost != null ? { watched, lost } : null
}

export const decodeObc = (raw: Raw): ObcStatus | null => {
    const status = missionState(raw.status)
    if (status == null) {
        return null
    }
    return {
        timestamp: num(raw.timestamp) ?? 0,
        status,
        profile: profile(raw.profile),
        cadenceScale: num(raw.cadence_scale),
        persistence: (str(raw.persistence) as ObcStatus['persistence']) ?? null,
        missionLabel: str(raw.mission_label),
        subsystems: subsystemHealth(raw.subsystems)
    }
}

export const decodeEps = (raw: Raw): EpsStatus => ({
    timestamp: num(raw.timestamp) ?? 0,
    batteryPercent: num(raw.battery_percent),
    voltage: num(raw.voltage),
    externalPower: bool(raw.external_power),
    chargeRate: num(raw.charge_rate)
})

export const decodeAdcs = (raw: Raw): AdcsStatus => ({
    timestamp: num(raw.timestamp) ?? 0,
    roll: num(raw.roll),
    pitch: num(raw.pitch),
    yaw: num(raw.yaw),
    quaternion: quaternion(raw.quaternion),
    calibStatus: calib(raw.calib_status),
    imuTemp: num(raw.imu_temp),
    accel: vector(raw.accel_g),
    gyro: vector(raw.gyro_dps),
    gnss: gnss(raw.gnss)
})

export const decodeScience = (raw: Raw): ScienceData => ({
    timestamp: num(raw.timestamp) ?? 0,
    temperature: num(raw.temperature),
    humidity: num(raw.humidity),
    pressure: num(raw.pressure),
    light: num(raw.light),
    uvIndex: num(raw.uv_index),
    uvRaw: num(raw.uv_raw)
})

export const decodePayload = (raw: Raw): PayloadStatus => {
    const sensor = asRecord(raw.sensor)
    const camera = asRecord(raw.camera)
    const storage = asRecord(raw.storage)
    const missionPhotos = asRecord(raw.mission_photos)
    return {
        timestamp: num(raw.timestamp) ?? 0,
        sensor: raw.sensor
            ? {
                  device: str(sensor.device),
                  present: sensor.present === true,
                  readings: num(sensor.readings),
                  lastRead: num(sensor.last_read)
              }
            : null,
        camera: raw.camera ? { device: str(camera.device), present: camera.present === true } : null,
        storage: raw.storage
            ? {
                  freeMb: num(storage.free_mb),
                  minFreeMb: num(storage.min_free_mb),
                  blocked: storage.blocked === true
              }
            : null,
        missionPhotos: raw.mission_photos
            ? {
                  active: missionPhotos.active === true,
                  intervalSec: num(missionPhotos.interval_sec),
                  frames: num(missionPhotos.frames) ?? 0,
                  reason: str(missionPhotos.reason)
              }
            : null,
        missionId: num(raw.mission_id),
        photoDir: str(raw.photo_dir)
    }
}

export const decodeDhs = (raw: Raw): DhsStatus => {
    const mission = asRecord(raw.mission)
    const attitude = asRecord(raw.attitude)
    const radio = asRecord(raw.radio)
    const photos = asRecord(raw.photos)
    return {
        timestamp: num(raw.timestamp) ?? 0,
        recording: raw.recording === true,
        database: str(raw.database),
        mission:
            raw.mission && num(mission.id) != null
                ? {
                      id: num(mission.id) as number,
                      label: str(mission.label),
                      startedAt: str(mission.started_at) ?? '',
                      rows: num(mission.rows) ?? 0
                  }
                : null,
        rows: num(raw.rows),
        dbSizeBytes: num(raw.db_size_bytes),
        lastWrite: num(raw.last_write),
        retentionDays: num(raw.retention_days),
        attitude: raw.attitude
            ? {
                  written: num(attitude.written) ?? 0,
                  buffered: num(attitude.buffered) ?? 0,
                  minIntervalSec: num(attitude.min_interval_sec) ?? 0
              }
            : null,
        radio: raw.radio
            ? {
                  written: num(radio.written) ?? 0,
                  buffered: num(radio.buffered) ?? 0
              }
            : null,
        photos: raw.photos
            ? {
                  freeMb: num(photos.free_mb),
                  minFreeMb: num(photos.min_free_mb)
              }
            : null
    }
}

export const decodeComms = (raw: Raw): CommsStatus => {
    const radio = asRecord(raw.radio)
    return {
        timestamp: num(raw.timestamp) ?? 0,
        radio: raw.radio ? { present: radio.present === true, node: str(radio.node), region: str(radio.region) } : null,
        loraEnabled: raw.lora_enabled === true,
        loraListening: raw.lora_listening === true,
        lastUplink: num(raw.last_uplink)
    }
}

/**
 * A radio event, or null for a payload that cannot name its direction — a log
 * entry that cannot say whether the satellite was talking or listening is not
 * an entry, and DHS refuses the same shape on the recording side.
 */
export const decodeRadio = (raw: Raw): RadioEvent | null => {
    const direction = raw.direction
    if (direction !== 'rx' && direction !== 'tx') {
        return null
    }
    return {
        timestamp: num(raw.timestamp) ?? 0,
        direction,
        kind: str(raw.kind),
        text: str(raw.text),
        bytes: num(raw.bytes),
        sender: str(raw.sender),
        snr: num(raw.snr),
        rssi: num(raw.rssi),
        hops: num(raw.hops),
        sent: bool(raw.sent)
    }
}

/** `{}` means COMMS has heard nothing on that topic yet — not a payload of
 *  zeros, so it decodes to null rather than through the block's decoder. */
const nonEmpty = (value: unknown): Raw | null => {
    const record = asRecord(value)
    return Object.keys(record).length > 0 ? record : null
}

export const decodeSnapshot = (raw: Raw): TelemetrySnapshot => {
    const eps = nonEmpty(raw.eps)
    const adcs = nonEmpty(raw.adcs)
    const science = nonEmpty(raw.payload)
    const system = nonEmpty(raw.system)
    return {
        timestamp: num(raw.timestamp) ?? 0,
        requestId: str(raw.request_id),
        obcState: missionState(raw.obc_state),
        profile: profile(raw.profile),
        missionId: num(raw.mission_id),
        eps: eps ? decodeEps(eps) : null,
        adcs: adcs ? decodeAdcs(adcs) : null,
        science: science ? decodeScience(science) : null,
        system: system
            ? {
                  cpuPercent: num(system.cpu_percent),
                  ramPercent: num(system.ram_percent),
                  swapPercent: num(system.swap_percent),
                  diskPercent: num(system.disk_percent),
                  uptimeSeconds: num(system.uptime_seconds),
                  cpuTemperature: num(system.cpu_temperature)
              }
            : null
    }
}

const NETWORK_MODES: NetworkMode[] = ['client', 'ap', 'off', 'unknown']

export const decodeHost = (raw: Raw): HostStatus => {
    const network = asRecord(raw.network)
    const units = asRecord(raw.units)
    const mode = str(network.mode)
    return {
        timestamp: num(raw.timestamp) ?? 0,
        profile: profile(raw.profile),
        profileRequested: str(raw.profile_requested),
        network: raw.network
            ? {
                  mode: NETWORK_MODES.includes(mode as NetworkMode) ? (mode as NetworkMode) : 'unknown',
                  ssid: str(network.ssid),
                  clients: num(network.clients)
              }
            : null,
        units: Object.fromEntries(Object.entries(units).map(([unit, state]) => [unit, str(state) ?? 'unknown'])),
        governor: str(raw.governor),
        errors: Array.isArray(raw.errors) ? raw.errors.filter((e): e is string => typeof e === 'string') : [],
        ttlExpiresAt: num(raw.ttl_expires_at)
    }
}

const photoOverlay = (value: unknown): PhotoOverlay | null => {
    if (typeof value !== 'object' || value == null) {
        return null
    }
    const overlay = value as Raw
    const at = num(asRecord(overlay.position).at)
    return {
        capturedAt: str(overlay.captured_at),
        missionState: str(overlay.mission_state),
        position: overlay.position ? { ...gnss(overlay.position), at } : null,
        width: num(overlay.width),
        height: num(overlay.height)
    }
}

export const decodePhoto = (raw: Raw): Photo | null => {
    const kind = str(raw.kind)
    const common = {
        timestamp: num(raw.timestamp) ?? 0,
        file: str(raw.file),
        path: str(raw.path) ?? '',
        sizeBytes: num(raw.size_bytes),
        missionId: num(raw.mission_id),
        overlay: photoOverlay(raw.overlay)
    }
    if (kind === 'photo') {
        return {
            ...common,
            kind: 'photo',
            photoBase64: str(raw.photo_base64) ?? ''
        }
    }
    if (kind === 'mission_frame') {
        // The wire is the satellite's vocabulary, and this field has cost us
        // once already: an earlier build expected `timelapse_frame`, a name of
        // this repository's own invention, and silently dropped every frame.
        // The satellite renamed `timelapse` to `mission_frame` on 2026-09-01,
        // when a mission started photographing itself instead of being asked to.
        return { ...common, kind: 'mission_frame', sequence: num(raw.sequence) }
    }
    // Branch on `kind`, never on the presence of a blob — a variant this build
    // has not heard of is dropped rather than guessed at. The refusal shape
    // (`status: "ERROR"`, no kind) is not a photograph and leaves by
    // `decodePhotoRefusal` instead.
    return null
}

export const decodePhotoRefusal = (raw: Raw): PhotoRefusal | null => {
    if (str(raw.status) !== 'ERROR') {
        return null
    }
    return {
        timestamp: num(raw.timestamp) ?? 0,
        requestId: str(raw.request_id),
        reason: str(raw.reason)
    }
}

// ── the archive ─────────────────────────────────────────────────────────────

/** One row of `telemetry`, as the dashboard's REST hands it over. */
export const decodeTelemetry = (raw: Raw): TelemetryRecord => ({
    id: num(raw.id) ?? 0,
    timestamp: str(raw.timestamp) ?? '',
    // Null where a row belongs to no mission: since 2026-09-01 DEMO and EXPO
    // record nothing, and their rows reach the charts from the satellite's
    // in-memory ring rather than from the database. Coercing that to 0 would
    // name a mission that does not exist.
    missionId: num(raw.mission_id),
    profile: profile(raw.profile),
    obcState: missionState(raw.obc_state),
    battery: num(raw.battery),
    voltage: num(raw.voltage),
    // Stored as 0/1: SQLite has no boolean, and the column is null when unknown.
    externalPower: raw.external_power == null ? null : raw.external_power === 1,
    roll: num(raw.roll),
    pitch: num(raw.pitch),
    yaw: num(raw.yaw),
    quaternion: { w: num(raw.quat_w), x: num(raw.quat_x), y: num(raw.quat_y), z: num(raw.quat_z) },
    calibStatus: typeof raw.calib_status === 'string' ? calib(JSON.parse(raw.calib_status)) : calib(raw.calib_status),
    imuTemp: num(raw.imu_temp),
    accel: { x: num(raw.accel_x), y: num(raw.accel_y), z: num(raw.accel_z) },
    gyro: { x: num(raw.gyro_x), y: num(raw.gyro_y), z: num(raw.gyro_z) },
    gnss: {
        lat: num(raw.lat),
        lon: num(raw.lon),
        alt: num(raw.alt),
        speed: num(raw.speed),
        fix: raw.fix == null ? null : raw.fix === 1,
        satellites: num(raw.satellites)
    },
    temperature: num(raw.temperature),
    humidity: num(raw.humidity),
    pressure: num(raw.pressure),
    light: num(raw.light),
    uvIndex: num(raw.uv_index),
    cpuPercent: num(raw.cpu_percent),
    ramPercent: num(raw.ram_percent),
    swapPercent: num(raw.swap_percent),
    diskPercent: num(raw.disk_percent),
    uptimeSeconds: num(raw.uptime_seconds),
    cpuTemperature: num(raw.cpu_temperature)
})

export const decodeMission = (raw: Raw): MissionSummary => ({
    id: num(raw.id) ?? 0,
    label: str(raw.label),
    profile: profile(raw.profile) ?? 'HOSTED',
    startedAt: str(raw.started_at) ?? '',
    endedAt: str(raw.ended_at),
    endReason: (str(raw.end_reason) as MissionSummary['endReason']) ?? null,
    rows: num(raw.rows),
    firstFixAt: str(raw.first_fix_at),
    distanceM: num(raw.distance_m),
    notes: str(raw.notes),
    purgedAt: str(raw.purged_at)
})
