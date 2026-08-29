/**
 * A recorded mission, played back. No backend of any kind.
 *
 * This is what the public demo runs on: a real walk exported from the
 * satellite's archive, bundled with the build, replayed in a loop. It is
 * deliberately **not** a generator. A synthetic satellite would need someone to
 * decide what plausible looks like, and every one of those decisions is a
 * chance to show something the hardware does not do — a `yaw` that always has a
 * value, a `uv_index` that is never withheld, a fix that never goes stale. What
 * a recording shows is what happened.
 *
 * It is also the whole of case 3's data layer. The page is static files on
 * ordinary hosting: no MQTT, no REST, no rewrite rules. If anything here starts
 * needing a server, the demo has stopped being a demo.
 *
 * The archive works too, from the same file — which is what makes the timeline
 * a feature of the demo rather than something only reachable on the satellite.
 */

import type { AttitudeUpdate, SourceCapabilities, TelemetrySource } from '../source'
import type { AdcsStatus, Command, LiveState, MissionDetail, MissionSummary, Photo, TelemetryRecord } from '../types'
import { EMPTY_LIVE_STATE } from '../types'

/** How fast the recording is replayed against wall time. */
const DEFAULT_SPEED = 1

/** How often the live view is stepped forward, in ms. Independent of the
 *  recording's own cadence: one telemetry row is 30 s of satellite time. */
const TICK_MS = 1000

/** How often an attitude sample is emitted, in ms. The satellite records at
 *  1 Hz and the scene interpolates; emitting faster than the recording would
 *  only repeat samples. */
const ATTITUDE_MS = 1000

export interface Recording {
    mission: MissionSummary
    telemetry: TelemetryRecord[]
    attitude: Array<{
        t: number
        quaternion: { w: number | null; x: number | null; y: number | null; z: number | null }
    }>
}

export class ReplaySource implements TelemetrySource {
    public readonly kind = 'replay' as const
    public readonly label = 'recorded mission'
    /**
     * No commands. A recording cannot be told to take a photograph, and a
     * button that silently does nothing is worse than one that is not there —
     * the UI asks this rather than assuming, and hides the console.
     */
    public readonly capabilities: SourceCapabilities = { commands: false, archive: true, photos: false }

    private timer: ReturnType<typeof setInterval> | null = null
    private attitudeTimer: ReturnType<typeof setInterval> | null = null
    private cursor = 0
    private attitudeCursor = 0
    private state: LiveState = { ...EMPTY_LIVE_STATE }
    private readonly listeners = new Set<(state: LiveState) => void>()
    private readonly attitudeListeners = new Set<(sample: AttitudeUpdate) => void>()

    public constructor(
        private readonly recording: Recording,
        private readonly speed: number = DEFAULT_SPEED
    ) {}

    public subscribe(listener: (state: LiveState) => void): () => void {
        this.listeners.add(listener)
        this.start()
        listener(this.state)
        return () => {
            this.listeners.delete(listener)
            this.stopIfIdle()
        }
    }

    public subscribeAttitude(listener: (sample: AttitudeUpdate) => void): () => void {
        this.attitudeListeners.add(listener)
        this.start()
        return () => {
            this.attitudeListeners.delete(listener)
            this.stopIfIdle()
        }
    }

    public subscribePhotos(_listener: (photo: Photo) => void): () => void {
        // An export carries no images: they are files on the satellite's card,
        // and bundling a mission's worth of them would be tens of megabytes of
        // static hosting. Declared absent in `capabilities` rather than
        // delivered empty.
        return () => undefined
    }

    public async recentTelemetry(limit: number): Promise<TelemetryRecord[]> {
        // The window that has already been replayed, so a chart grows with the
        // playhead instead of showing the satellite's future.
        const played = this.recording.telemetry.slice(0, Math.max(this.cursor, 1))
        return played.slice(-limit).reverse()
    }

    public async listMissions(): Promise<MissionSummary[]> {
        return [this.recording.mission]
    }

    public async loadMission(id: number): Promise<MissionDetail> {
        if (id !== this.recording.mission.id) {
            throw new Error(`this build carries one recorded mission (${this.recording.mission.id})`)
        }
        return {
            mission: this.recording.mission,
            telemetry: this.recording.telemetry,
            attitude: this.recording.attitude.map((sample) => ({
                t: sample.t,
                quaternion: sample.quaternion,
                gyro: { x: null, y: null, z: null }
            }))
        }
    }

    public async send(_command: Command): Promise<void> {
        // Rejected rather than resolved: the caller asked for something to
        // happen on a satellite that is not there, and pretending otherwise is
        // how a demo teaches somebody the wrong thing about the real one.
        throw new Error('this is a recording — there is no satellite to command')
    }

    public close(): void {
        this.stop()
        this.listeners.clear()
        this.attitudeListeners.clear()
    }

    // ── the replay ──────────────────────────────────────────────────────────

    private start(): void {
        if (this.timer == null && this.recording.telemetry.length > 0) {
            this.step()
            this.timer = setInterval(() => this.step(), TICK_MS / this.speed)
        }
        if (this.attitudeTimer == null && this.recording.attitude.length > 0) {
            this.attitudeTimer = setInterval(() => this.stepAttitude(), ATTITUDE_MS / this.speed)
        }
    }

    private stop(): void {
        if (this.timer != null) {
            clearInterval(this.timer)
            this.timer = null
        }
        if (this.attitudeTimer != null) {
            clearInterval(this.attitudeTimer)
            this.attitudeTimer = null
        }
    }

    private stopIfIdle(): void {
        if (this.listeners.size === 0 && this.attitudeListeners.size === 0) {
            this.stop()
        }
    }

    private step(): void {
        const rows = this.recording.telemetry
        const row = rows[this.cursor % rows.length]
        this.cursor += 1
        const at = Date.parse(row.timestamp) / 1000 || 0
        this.state = {
            ...this.state,
            obc: {
                timestamp: at,
                status: row.obcState ?? 'NOMINAL',
                profile: row.profile,
                cadenceScale: 1,
                persistence: 'mission_db',
                missionLabel: this.recording.mission.label
            },
            eps: {
                timestamp: at,
                batteryPercent: row.battery,
                voltage: row.voltage,
                externalPower: row.externalPower,
                // Not recorded as a column — it lives in raw_json, which an
                // export does not carry. Withheld rather than derived from two
                // battery readings, which would be a rate this satellite never
                // measured.
                chargeRate: null
            },
            adcs: this.adcsFrom(row, at),
            science: {
                timestamp: at,
                temperature: row.temperature,
                humidity: row.humidity,
                pressure: row.pressure,
                light: row.light,
                uvIndex: row.uvIndex,
                uvRaw: null
            },
            dhs: {
                timestamp: at,
                recording: true,
                database: null,
                mission: {
                    id: this.recording.mission.id,
                    label: this.recording.mission.label,
                    startedAt: this.recording.mission.startedAt,
                    rows: this.cursor
                },
                rows: rows.length,
                dbSizeBytes: null,
                lastWrite: at,
                retentionDays: null,
                attitude: null,
                photos: null
            }
        }
        this.listeners.forEach((listener) => listener(this.state))
    }

    private adcsFrom(row: TelemetryRecord, at: number): AdcsStatus {
        return {
            timestamp: at,
            roll: row.roll,
            pitch: row.pitch,
            yaw: row.yaw,
            quaternion: row.quaternion,
            calibStatus: row.calibStatus,
            imuTemp: row.imuTemp,
            accel: row.accel,
            gyro: row.gyro,
            gnss: row.gnss
        }
    }

    private stepAttitude(): void {
        const samples = this.recording.attitude
        const sample = samples[this.attitudeCursor % samples.length]
        this.attitudeCursor += 1
        const { w, x, y, z } = sample.quaternion
        if (w == null || x == null || y == null || z == null) {
            return
        }
        this.attitudeListeners.forEach((listener) => listener({ t: sample.t, w, x, y, z }))
    }
}
