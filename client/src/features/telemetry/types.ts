/**
 * The contract, and the satellite defines it.
 *
 * Every shape here is one the satellite actually produces — a column of
 * `telemetry` or `attitude`, a row of `missions`, or a documented MQTT payload.
 * The authority is `cubesat-sim`: `src/cubesat/dhs/schema.py` for the tables and
 * `README.md` → Message Payloads for the topics. When the two disagree with this
 * file, this file is wrong.
 *
 * That direction is deliberate. Real data is born on the Pi; a shape invented
 * here would leave the emulated source faithful to something that does not
 * exist, and the static demo would spend its life imitating a backend it does
 * not have.
 *
 * **Null means withheld, and it is never a zero.** The satellite refuses to
 * publish a value it cannot justify: `yaw` is null below `calib_status.mag = 3`
 * because the BNO055 reports a *constant* there rather than a poor estimate;
 * `uv_index` is null until the SEN0501 board revision is known, because two
 * revisions read one register with formulas that disagree by a factor of forty.
 * Render a null as absent. Substituting 0 re-introduces exactly the confident
 * wrong number the satellite went out of its way not to send.
 */

// ── the satellite's own vocabulary ──────────────────────────────────────────

/** What the Raspberry Pi is allowed to be. Chosen by a human, changes rarely. */
export type Profile = 'HOSTED' | 'DEMO' | 'EXPO' | 'FLIGHT' | 'DIAG' | 'MAINTENANCE'

/** What the satellite is doing inside that envelope. Chosen from its own telemetry. */
export type MissionState = 'BOOT' | 'STANDBY' | 'DEPLOY' | 'NOMINAL' | 'SCIENCE' | 'LOW_POWER' | 'SAFE' | 'CRITICAL'

export type Persistence = 'none' | 'mission_db' | 'diag_db'

export type EndReason = 'profile_change' | 'shutdown' | 'battery_critical' | 'interrupted'

export type NetworkMode = 'client' | 'ap' | 'off' | 'unknown'

// ── shared value objects ────────────────────────────────────────────────────

export interface Vector3 {
    x: number | null
    y: number | null
    z: number | null
}

export interface Quaternion {
    w: number | null
    x: number | null
    y: number | null
    z: number | null
}

/**
 * The BNO055's own view of how well it is calibrated, 0–3 per subsystem.
 *
 * Surfaced rather than hidden because it is the only thing that explains a null
 * `yaw`, and because an uncalibrated magnetometer produces confident nonsense.
 */
export interface CalibStatus {
    sys: number | null
    gyro: number | null
    accel: number | null
    mag: number | null
}

/**
 * The last known fix. Never blocks the poll loop, so with no signal it carries
 * stale coordinates and `fix: false` — draw a track from rows where `fix` is
 * true, or you will plot where the satellite was, not where it is.
 */
export interface GnssFix {
    lat: number | null
    lon: number | null
    /** Metres, from the receiver — never derived from pressure. */
    alt: number | null
    /** Metres per second. The register holds knots; the driver converts. */
    speed: number | null
    fix: boolean | null
    satellites: number | null
}

// ── the tables ──────────────────────────────────────────────────────────────

/**
 * One row of `telemetry` — everything the satellite knew at one instant.
 *
 * Written on DHS's own tick: 30 s apart in `NOMINAL`, 300 s in `LOW_POWER`. For
 * orientation at the rate it was measured, use {@link AttitudeSample} instead.
 */
export interface TelemetryRecord {
    id: number
    /** ISO-8601 UTC to the second, e.g. `2026-08-24T07:12:03Z`. */
    timestamp: string
    missionId: number
    profile: Profile | null
    obcState: MissionState | null

    /** Percent, from the MAX17048 fuel gauge. */
    battery: number | null
    voltage: number | null
    /** Mains present on the X728's PLD pin. */
    externalPower: boolean | null

    /** Degrees. `yaw` is null until the magnetometer is calibrated. */
    roll: number | null
    pitch: number | null
    yaw: number | null
    quaternion: Quaternion
    calibStatus: CalibStatus | null
    /** °C, from the IMU's own die — not the CPU's. */
    imuTemp: number | null
    /** g. */
    accel: Vector3
    /** Degrees per second. */
    gyro: Vector3

    gnss: GnssFix

    /** °C, from the SEN0501. */
    temperature: number | null
    /** Percent relative humidity. */
    humidity: number | null
    /** hPa. */
    pressure: number | null
    /** Lux. */
    light: number | null
    /** Null until the board revision is known — see the file docstring. */
    uvIndex: number | null

    cpuPercent: number | null
    ramPercent: number | null
    swapPercent: number | null
    diskPercent: number | null
    uptimeSeconds: number | null
    /** °C, the Pi's SoC. */
    cpuTemperature: number | null
}

/**
 * One row of `attitude` — orientation at the rate the IMU was read.
 *
 * Its own table because `telemetry` holds one row per DHS tick while ADCS
 * publishes at 2 Hz: every sixtieth sample would survive, and replaying a
 * hand-carried satellite from that is a slide show. Recorded at
 * `dhs.attitude_min_interval_sec` (1 s by default), which is still slower than
 * the eye wants — **interpolate between quaternions**, which is most of why the
 * satellite stores them rather than Euler angles.
 */
export interface AttitudeSample {
    /** Epoch seconds, from the ADCS payload: when the IMU was read. */
    t: number
    quaternion: Quaternion
    gyro: Vector3
}

/**
 * One recorded session. A mission opens when the state reaches `NOMINAL` under
 * a profile that permits persistence, and closes on a profile change, a
 * shutdown or `CRITICAL`.
 */
export interface MissionSummary {
    id: number
    /** Operator's label. For grouping, never for identity — two runs labelled
     *  the same are still two missions. */
    label: string | null
    profile: Profile
    startedAt: string
    /** Null while the mission is still running. */
    endedAt: string | null
    endReason: EndReason | null
    /** What the mission recorded. Keeps its historical meaning after a purge —
     *  see {@link purgedAt}. */
    rows: number | null
    firstFixAt: string | null
    /**
     * Path length in metres, summed with a noise floor under it. **Null, not
     * zero**, for a mission that never had a fix: an indoor DEMO did not travel
     * zero metres, it has no track at all.
     */
    distanceM: number | null
    notes: string | null
    /**
     * Set when the mission's detail passed the retention horizon. The row
     * survives its rows: render "detail removed by the retention policy", never
     * an empty chart. `rows` still says what it once held.
     */
    purgedAt: string | null
}

/** A mission with its detail, as a timeline replays it. */
export interface MissionDetail {
    mission: MissionSummary
    telemetry: TelemetryRecord[]
    /** Empty for a mission recorded before the `attitude` table existed, and for
     *  one whose detail has been purged. Not the same as "it never moved". */
    attitude: AttitudeSample[]
}

// ── the live view ───────────────────────────────────────────────────────────

/**
 * The live state is assembled from the retained MQTT status messages, not from
 * the database — a subsystem's status exists because a device was read, while a
 * telemetry row is what DHS made of it 30 seconds later.
 *
 * Every field is nullable and every one starts null: a dashboard that has just
 * connected knows nothing until the broker replays the retained messages, and
 * `adcs` is not retained at all, so it stays null until ADCS next publishes.
 */
export interface LiveState {
    host: HostStatus | null
    obc: ObcStatus | null
    eps: EpsStatus | null
    adcs: AdcsStatus | null
    payload: PayloadStatus | null
    science: ScienceData | null
    dhs: DhsStatus | null
    comms: CommsStatus | null
    /** Client id → the epoch seconds of its last heartbeat. */
    heartbeats: Record<string, number>
}

export const EMPTY_LIVE_STATE: LiveState = {
    host: null,
    obc: null,
    eps: null,
    adcs: null,
    payload: null,
    science: null,
    dhs: null,
    comms: null,
    heartbeats: {}
}

/**
 * OBC's own health verdict, published so the ground can tell "off because the
 * profile never started it" from "expected and silent". `watched` is the set
 * of services the active profile expects to be running (always including
 * `eps`); `lost` names the watched services whose heartbeats stopped or that
 * said goodbye — the failure OBC latches `SAFE` over. The satellite publishes
 * `lost` empty while a profile switch is settling, matching OBC's own refusal
 * to read mid-switch goodbyes as faults.
 */
export interface SubsystemHealth {
    watched: string[]
    lost: string[]
}

export interface ObcStatus {
    timestamp: number
    /** The mission state. Named `status` on the wire, not `state`. */
    status: MissionState
    profile: Profile | null
    cadenceScale: number | null
    persistence: Persistence | null
    missionLabel: string | null
    /** Null from a recording or a satellite that predates the field. */
    subsystems: SubsystemHealth | null
}

export interface EpsStatus {
    timestamp: number
    batteryPercent: number | null
    voltage: number | null
    externalPower: boolean | null
    /**
     * Signed percent per hour from the gauge's CRATE register: positive
     * charging, negative draining. It is what tells "plugged in and charging"
     * from "plugged in and still going down" without waiting for the
     * state-of-charge reading to move.
     */
    chargeRate: number | null
}

export interface AdcsStatus {
    timestamp: number
    roll: number | null
    pitch: number | null
    yaw: number | null
    quaternion: Quaternion
    calibStatus: CalibStatus | null
    imuTemp: number | null
    accel: Vector3
    gyro: Vector3
    gnss: GnssFix
}

export interface ScienceData {
    timestamp: number
    temperature: number | null
    humidity: number | null
    pressure: number | null
    light: number | null
    uvIndex: number | null
    /** The register as read. Published because the index is withheld. */
    uvRaw: number | null
}

export interface PayloadStatus {
    timestamp: number
    /** `present` is the result of a real transaction with the device — which is
     *  what distinguishes "the sensor answered" from "the process started". */
    sensor: { device: string | null; present: boolean; readings: number | null; lastRead: number | null } | null
    camera: { device: string | null; present: boolean } | null
    /** Why the satellite may have stopped taking photographs. */
    storage: { freeMb: number | null; minFreeMb: number | null; blocked: boolean } | null
    timelapse: { active: boolean; intervalSec: number | null; frames: number; reason: string | null } | null
    missionId: string | null
    photoDir: string | null
}

export interface DhsStatus {
    timestamp: number
    recording: boolean
    database: string | null
    mission: { id: number; label: string | null; startedAt: string; rows: number } | null
    rows: number | null
    dbSizeBytes: number | null
    lastWrite: number | null
    retentionDays: number | null
    attitude: { written: number; buffered: number; minIntervalSec: number } | null
    /** Same shape of claim as `attitude`: rows on disk versus rows waiting on
     *  a write that is failing. A growing `buffered` is the card refusing the
     *  radio log while the recorder is still, correctly, alive. */
    radio: { written: number; buffered: number } | null
    photos: { unfiledBytes: number | null; freeMb: number | null; minFreeMb: number | null } | null
}

/**
 * One radio transaction, from `cubesat/comms/radio` — a received message, or a
 * transmission attempt with whether it left. COMMS observes the traffic and
 * DHS records it into `radio_log`; this is the live copy of the same event.
 *
 * The two directions observe different things, so half the fields are null by
 * design: link quality exists only for what was heard (`sender`, `snr`,
 * `rssi`, `hops` — each null where the node did not report it), an outcome
 * only for what was said (`kind`, `sent` — a failed transmit arrives with
 * `sent: false` rather than being suppressed).
 */
export interface RadioEvent {
    timestamp: number
    direction: 'rx' | 'tx'
    /** tx: 'beacon', 'ack' or 'down'. Kept as a string so a kind newer than
     *  this build still renders instead of vanishing. */
    kind: string | null
    /** The line as it crossed the air, verbatim. */
    text: string | null
    bytes: number | null
    sender: string | null
    snr: number | null
    rssi: number | null
    /** Mesh hops to arrival; 0 means heard directly. */
    hops: number | null
    sent: boolean | null
}

export interface CommsStatus {
    timestamp: number
    radio: { present: boolean; node: string | null; region: string | null } | null
    /** Whether the radio may **transmit**. */
    loraEnabled: boolean
    /**
     * Whether the inbox is polled. Reported apart from {@link loraEnabled}
     * because a silenced transmitter still hears: "quiet" and "deaf" are
     * genuinely different states, and this is the only place the difference is
     * visible.
     */
    loraListening: boolean
    lastUplink: number | null
}

/**
 * COMMS' answer to `get_telemetry`, from `cubesat/comms/data` — its cache of
 * the newest message from each topic, bundled for a ground client that asked.
 * Each nested block keeps the timestamp of the message it came from; that age
 * is the only honest claim the bundle makes — it is what COMMS *heard*, not
 * what is true at the moment of asking.
 */
export interface TelemetrySnapshot {
    timestamp: number
    requestId: string | null
    obcState: MissionState | null
    profile: Profile | null
    missionId: number | null
    /** Null where COMMS has heard nothing yet — the satellite sends `{}`. */
    eps: EpsStatus | null
    adcs: AdcsStatus | null
    science: ScienceData | null
    system: {
        cpuPercent: number | null
        ramPercent: number | null
        swapPercent: number | null
        diskPercent: number | null
        uptimeSeconds: number | null
        cpuTemperature: number | null
    } | null
}

export interface HostStatus {
    timestamp: number
    /** The profile that fully applied. Null before HOSTD has applied any. */
    profile: Profile | null
    /**
     * The profile that was asked for. Differs from {@link profile} when one
     * applied only partly, and that difference is the whole debugging story of
     * a failed switch — do not collapse the two.
     */
    profileRequested: string | null
    network: { mode: NetworkMode; ssid: string | null; clients: number | null } | null
    /** Unit name → `active` / `inactive` / `unknown`. */
    units: Record<string, string>
    governor: string | null
    errors: string[]
    /** Epoch seconds at which this profile expires, or null for never. */
    ttlExpiresAt: number | null
}

// ── photographs ─────────────────────────────────────────────────────────────

/**
 * The sidecar contents, echoed on the message so a consumer can render the
 * caption without fetching the `.json` file (which the satellite's HTTP
 * deliberately does not serve). Present only when the capture asked for an
 * overlay. The position carries its own `at` timestamp because a last known
 * fix can be minutes old, and a coordinate with no age attached is exactly the
 * plausible wrong number the satellite keeps refusing to publish.
 */
export interface PhotoOverlay {
    capturedAt: string | null
    missionState: string | null
    position: (GnssFix & { at: number | null }) | null
    width: number | null
    height: number | null
}

/**
 * Branch on `kind`, never on whether a base64 blob is present. An on-demand
 * capture carries the image; a timelapse frame carries metadata only, because
 * five hundred frames through the broker would be hundreds of megabytes on a
 * bus whose job is the telemetry. The frames are on the satellite's card,
 * filed under their mission, and reachable over its REST — which is what
 * {@link Photo.file} plus the mission id name.
 */
export type Photo =
    | {
          kind: 'photo'
          timestamp: number
          /** The file name alone — what the photo endpoint wants. */
          file: string | null
          path: string
          sizeBytes: number | null
          missionId: string | null
          photoBase64: string
          overlay: PhotoOverlay | null
      }
    | {
          kind: 'timelapse'
          timestamp: number
          file: string | null
          path: string
          sizeBytes: number | null
          missionId: string | null
          sequence: number | null
          overlay: PhotoOverlay | null
      }

/** One photograph in a mission's directory, as the archive lists it. */
export interface PhotoFile {
    name: string
    /** Where the image can be fetched from, resolved against the source's own
     *  API base — never trusted from the wire. */
    url: string
}

/**
 * What the camera widget actually renders: one image with its provenance,
 * already resolved from whichever channel it came by. `photo` carried its
 * pixels over the bus; `timelapse` and `archive` are fetched from the
 * mission's directory — which is why an unfiled frame (no mission open)
 * cannot become a shot at all.
 */
export interface CameraShot {
    src: string
    kind: 'photo' | 'timelapse' | 'archive'
    file: string | null
    /** Epoch seconds of the capture, or null where only the archive listing —
     *  which carries names alone — knows of the image. */
    timestamp: number | null
    missionId: string | null
    sizeBytes: number | null
}

// ── commands ────────────────────────────────────────────────────────────────

/**
 * One vocabulary, whatever the channel. These are exactly the commands the
 * radio carries, published onto the same `cubesat/command` topic a laptop or an
 * uplink relayed by COMMS uses — nothing downstream knows which it was.
 *
 * There is deliberately no `poweroff`: `CRITICAL` is the only thing permitted
 * to power the host down, and it decides that from the battery.
 */
export type CommandName =
    | 'set_profile'
    | 'science_start'
    | 'science_stop'
    | 'safe_mode'
    | 'recover'
    | 'take_photo'
    | 'start_timelapse'
    | 'stop_timelapse'
    | 'get_telemetry'
    | 'set_comms_config'

export interface Command {
    command: CommandName
    params?: Record<string, unknown>
    requestId?: string
}
