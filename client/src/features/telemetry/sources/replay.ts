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

import { liveStateFromRow } from '../fromRow'
import type { AttitudeUpdate, ConnectionState, SourceCapabilities, TelemetrySource } from '../source'
import type {
    Command,
    CommandEcho,
    LiveState,
    MissionDetail,
    MissionSummary,
    Photo,
    PhotoFile,
    PhotoRefusal,
    RadioEvent,
    TelemetryRecord,
    TelemetrySnapshot
} from '../types'
import { EMPTY_LIVE_STATE } from '../types'

/** A multiplier on the compression below: how much further the playhead moves
 *  per tick. It does *not* change the tick rate — a fast replay should not
 *  hammer the event loop, it should take longer strides. */
const DEFAULT_SPEED = 1

/** How often the clock ticks, in ms of wall time. Fixed, whatever the speed. */
const TICK_MS = 250

/**
 * How many seconds of satellite time one tick advances — a tenfold compression
 * at 250 ms a tick.
 *
 * **There is one clock, and this is it.** There used to be two: telemetry walked
 * one row per second and attitude walked one sample per second, so after a
 * minute of watching the orientation on screen was from satellite-second 60
 * while the ADCS status beside it was from satellite-second 1800. Nothing said
 * so, because nothing in the widgets compared the two — until `NorthEstimator`
 * did, refused every pair as thousands of seconds apart, and left the compass
 * ring permanently unlettered in the demo. `GravityFrameCheck` was quietly
 * pairing mismatched samples the whole time as well.
 *
 * The number is a compromise between two things the recording wants at once. Ten
 * times is fast enough that a 30 s telemetry cadence lands a fresh row every 3 s
 * — a dashboard stepping once every 30 s reads as frozen — and slow enough that
 * the placeholder's tumble (a revolution per 40 s of satellite time) stays a
 * rotation rather than a blur. It also divides 30 exactly, so the playhead lands
 * *on* row timestamps rather than beside them, which is what lets an attitude
 * sample and an ADCS status be the same moment and be reconciled.
 */
const PLAYHEAD_STEP_S = 2.5

export interface Recording {
    mission: MissionSummary
    telemetry: TelemetryRecord[]
    attitude: Array<{
        t: number
        quaternion: { w: number | null; x: number | null; y: number | null; z: number | null }
    }>
    /** The mission's radio traffic, ascending in `timestamp`. Empty for a
     *  recording made before `radio_log` existed — not the same as a silent
     *  radio, and `capabilities.radio` says which this is. */
    radio: RadioEvent[]
}

export class ReplaySource implements TelemetrySource {
    public readonly kind = 'replay' as const
    public readonly label = 'recorded mission'
    /**
     * No commands. A recording cannot be told to take a photograph, and a
     * button that silently does nothing is worse than one that is not there —
     * the UI asks this rather than assuming, and hides the console.
     */
    public readonly capabilities: SourceCapabilities

    private timer: ReturnType<typeof setInterval> | null = null
    /** Satellite epoch seconds. Null until the first tick, which starts it at
     *  the beginning of the recording rather than a tick's worth in. */
    private playhead: number | null = null
    /** How many telemetry rows the playhead has passed. Also what
     *  `recentTelemetry` means by "already replayed". */
    private cursor = 0
    private attitudeCursor = 0
    private radioCursor = 0
    private state: LiveState = { ...EMPTY_LIVE_STATE }
    private readonly listeners = new Set<(state: LiveState) => void>()
    private readonly attitudeListeners = new Set<(sample: AttitudeUpdate) => void>()
    private readonly radioListeners = new Set<(event: RadioEvent) => void>()

    public constructor(
        private readonly recording: Recording,
        private readonly speed: number = DEFAULT_SPEED
    ) {
        this.capabilities = {
            commands: false,
            archive: true,
            photos: false,
            // Declared from what the recording actually holds: an export made
            // before radio_log existed has no traffic to replay, and a widget
            // fed by it could only ever be empty.
            radio: recording.radio.length > 0
        }
    }

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

    public subscribeSnapshots(_listener: (snapshot: TelemetrySnapshot) => void): () => void {
        // Snapshots are answers to `get_telemetry`, and a recording cannot be
        // asked — `send` rejects, so nothing can be waiting on this channel.
        return () => undefined
    }

    public subscribePhotoRefusals(_listener: (refusal: PhotoRefusal) => void): () => void {
        // A refusal answers a command, and a recording cannot be commanded —
        // same reasoning as subscribeSnapshots.
        return () => undefined
    }

    public subscribeConnection(listener: (state: ConnectionState) => void): () => void {
        // A recording has no transport to lose: the answer is online, once.
        listener('online')
        return () => undefined
    }

    public async listPhotos(_missionId: number): Promise<PhotoFile[]> {
        // Same reason as subscribePhotos: there is no backend to fetch an
        // image from, so listing names would promise pixels that cannot come.
        return []
    }

    public photoUrl(_photo: Photo): string | null {
        return null
    }

    public subscribeRadio(listener: (event: RadioEvent) => void): () => void {
        this.radioListeners.add(listener)
        this.start()
        return () => {
            this.radioListeners.delete(listener)
            this.stopIfIdle()
        }
    }

    public subscribeCommands(_listener: (echo: CommandEcho) => void): () => void {
        // A recording has no command bus: nothing was published while it played
        // back, and inventing traffic would put words in a satellite's mouth.
        // The console's own lines still appear; the bus lines simply do not.
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
            })),
            radio: this.recording.radio
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
        this.radioListeners.clear()
    }

    // ── the replay ──────────────────────────────────────────────────────────

    private start(): void {
        if (this.timer != null || this.span() == null) {
            return
        }
        this.step()
        this.timer = setInterval(() => this.step(), TICK_MS)
    }

    private stop(): void {
        if (this.timer != null) {
            clearInterval(this.timer)
            this.timer = null
        }
    }

    private stopIfIdle(): void {
        if (this.listeners.size === 0 && this.attitudeListeners.size === 0 && this.radioListeners.size === 0) {
            this.stop()
        }
    }

    /**
     * The stretch of satellite time the recording covers.
     *
     * Both channels, not just the rows: an export can carry attitude past its
     * last telemetry row, and looping on the rows alone would cut that tail off
     * every lap. Null for a recording with nothing in it, which is what stops
     * the clock before it starts.
     */
    private span(): { from: number; to: number } | null {
        const rows = this.recording.telemetry
        const samples = this.recording.attitude
        const starts: number[] = []
        const ends: number[] = []
        if (rows.length > 0) {
            starts.push(epoch(rows[0].timestamp))
            ends.push(epoch(rows[rows.length - 1].timestamp))
        }
        if (samples.length > 0) {
            starts.push(samples[0].t)
            ends.push(samples[samples.length - 1].t)
        }
        return starts.length === 0 ? null : { from: Math.min(...starts), to: Math.max(...ends) }
    }

    /** One tick of the one clock: move the playhead, then bring every channel up
     *  to where it now is. */
    private step(): void {
        const span = this.span()
        if (span == null) {
            return
        }
        if (this.playhead == null) {
            this.playhead = span.from
        } else {
            this.playhead += PLAYHEAD_STEP_S * this.speed
            if (this.playhead > span.to) {
                // A new lap. Everything rewinds together, because everything is
                // driven by this one number.
                this.playhead = span.from
                this.cursor = 0
                this.radioCursor = 0
                this.attitudeCursor = 0
            }
        }
        this.stepTelemetry(this.playhead)
        this.stepRadio(this.playhead)
        this.stepAttitude(this.playhead)
    }

    /** The newest row at or before the playhead, published once when it is
     *  crossed. Rows the playhead skipped over are counted but not published:
     *  the state they would set is superseded by the one that follows. */
    private stepTelemetry(playhead: number): void {
        const rows = this.recording.telemetry
        let crossed = false
        while (this.cursor < rows.length && epoch(rows[this.cursor].timestamp) <= playhead) {
            this.cursor += 1
            crossed = true
        }
        if (!crossed) {
            return
        }
        this.state = liveStateFromRow(rows[this.cursor - 1], this.recording.mission, {
            played: this.cursor,
            total: rows.length
        })
        this.listeners.forEach((listener) => listener(this.state))
    }

    /** Emit every radio event up to the playhead — the table stays in step
     *  with the charts, on the same compressed clock. */
    private stepRadio(playhead: number): void {
        const events = this.recording.radio
        while (this.radioCursor < events.length && events[this.radioCursor].timestamp <= playhead) {
            const event = events[this.radioCursor]
            this.radioCursor += 1
            this.radioListeners.forEach((listener) => listener(event))
        }
    }

    /**
     * The attitude sample at or before the playhead, with **its own** timestamp.
     *
     * Not the playhead's: the sample was measured when it was measured, and
     * re-stamping it to now is exactly the fabrication that would let
     * `NorthEstimator` reconcile a pair that has no business being reconciled.
     * A step that divides the telemetry cadence means the two agree to the second
     * whenever a row is crossed, which is when the pairing is admissible.
     */
    private stepAttitude(playhead: number): void {
        const samples = this.recording.attitude
        while (this.attitudeCursor + 1 < samples.length && samples[this.attitudeCursor + 1].t <= playhead) {
            this.attitudeCursor += 1
        }
        const sample = samples[this.attitudeCursor]
        if (sample == null || sample.t > playhead) {
            return
        }
        const { w, x, y, z } = sample.quaternion
        if (w == null || x == null || y == null || z == null) {
            return
        }
        this.attitudeListeners.forEach((listener) => listener({ t: sample.t, w, x, y, z }))
    }
}

/** Seconds, from a row's ISO timestamp. 0 for one that will not parse — the same
 *  answer the previous code gave, and a row with no readable time cannot be
 *  placed on a playhead at all. */
const epoch = (timestamp: string): number => Date.parse(timestamp) / 1000 || 0
