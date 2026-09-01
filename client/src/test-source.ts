/**
 * A source the tests drive by hand.
 *
 * The whole data layer is one interface with several implementations, so a test
 * needs neither a broker nor a server — it installs this, pushes a state, and
 * asserts what the widgets drew. That is the property the interface exists for,
 * and this file is the cheapest possible proof that it holds.
 */

import type { AttitudeUpdate, ConnectionState, SourceCapabilities, TelemetrySource } from './features/telemetry/source'
import type {
    AttitudeSample,
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
} from './features/telemetry/types'
import { EMPTY_LIVE_STATE } from './features/telemetry/types'
import { setSource } from './features/telemetry/useSource'

export class FakeSource implements TelemetrySource {
    public readonly kind = 'live' as const
    public readonly label = 'test'
    public capabilities: SourceCapabilities = { commands: true, archive: true, photos: true, radio: true }

    /** Everything `send` was called with, in order. */
    public readonly sent: Command[] = []
    public history: TelemetryRecord[] = []
    public missions: MissionSummary[] = []
    /** What `loadMission` hands back as a mission's telemetry, oldest first —
     *  the archive's order, which is the reverse of `history`'s. */
    public missionTelemetry: TelemetryRecord[] = []
    /** What `loadMission` hands back as the attitude track, ascending in t. */
    public missionAttitude: AttitudeSample[] = []
    /** What `loadMission` hands back as the mission's radio traffic, ascending. */
    public missionRadio: RadioEvent[] = []
    /** Set to make `recentTelemetry` reject, as an unreachable archive does. */
    public archiveError: Error | null = null
    /** What `listPhotos` hands back, oldest first — the archive's order. */
    public photos: PhotoFile[] = []

    private state: LiveState = { ...EMPTY_LIVE_STATE }
    private connection: ConnectionState = 'online'
    private readonly listeners = new Set<(state: LiveState) => void>()
    private readonly connectionListeners = new Set<(state: ConnectionState) => void>()
    private readonly attitudeListeners = new Set<(sample: AttitudeUpdate) => void>()
    private readonly photoListeners = new Set<(photo: Photo) => void>()
    private readonly photoRefusalListeners = new Set<(refusal: PhotoRefusal) => void>()
    private readonly radioListeners = new Set<(event: RadioEvent) => void>()
    private readonly commandListeners = new Set<(echo: CommandEcho) => void>()
    private readonly snapshotListeners = new Set<(snapshot: TelemetrySnapshot) => void>()

    public subscribe(listener: (state: LiveState) => void): () => void {
        this.listeners.add(listener)
        listener(this.state)
        return () => {
            this.listeners.delete(listener)
        }
    }

    public subscribeConnection(listener: (state: ConnectionState) => void): () => void {
        this.connectionListeners.add(listener)
        listener(this.connection)
        return () => {
            this.connectionListeners.delete(listener)
        }
    }

    public subscribeAttitude(listener: (sample: AttitudeUpdate) => void): () => void {
        this.attitudeListeners.add(listener)
        return () => {
            this.attitudeListeners.delete(listener)
        }
    }

    public subscribePhotos(listener: (photo: Photo) => void): () => void {
        this.photoListeners.add(listener)
        return () => {
            this.photoListeners.delete(listener)
        }
    }

    public subscribePhotoRefusals(listener: (refusal: PhotoRefusal) => void): () => void {
        this.photoRefusalListeners.add(listener)
        return () => {
            this.photoRefusalListeners.delete(listener)
        }
    }

    public subscribeRadio(listener: (event: RadioEvent) => void): () => void {
        this.radioListeners.add(listener)
        return () => {
            this.radioListeners.delete(listener)
        }
    }

    public subscribeCommands(listener: (echo: CommandEcho) => void): () => void {
        this.commandListeners.add(listener)
        return () => {
            this.commandListeners.delete(listener)
        }
    }

    public subscribeSnapshots(listener: (snapshot: TelemetrySnapshot) => void): () => void {
        this.snapshotListeners.add(listener)
        return () => {
            this.snapshotListeners.delete(listener)
        }
    }

    public async recentTelemetry(limit: number): Promise<TelemetryRecord[]> {
        if (this.archiveError) {
            throw this.archiveError
        }
        return this.history.slice(0, limit)
    }

    public async listMissions(): Promise<MissionSummary[]> {
        return this.missions
    }

    public async loadMission(id: number): Promise<MissionDetail> {
        const mission = this.missions.find((m) => m.id === id)
        if (!mission) {
            throw new Error(`no mission ${id}`)
        }
        return {
            mission,
            telemetry: this.missionTelemetry,
            attitude: this.missionAttitude,
            radio: this.missionRadio
        }
    }

    public async listPhotos(_missionId: number): Promise<PhotoFile[]> {
        if (this.archiveError) {
            throw this.archiveError
        }
        return this.photos
    }

    public photoUrl(photo: Photo): string | null {
        return photo.missionId != null && photo.file != null ? `/api/photos/${photo.missionId}/${photo.file}` : null
    }

    public async send(command: Command): Promise<void> {
        if (!this.capabilities.commands) {
            throw new Error('this is a recording — there is no satellite to command')
        }
        this.sent.push(command)
    }

    public close(): void {
        this.listeners.clear()
        this.connectionListeners.clear()
        this.attitudeListeners.clear()
        this.photoListeners.clear()
        this.photoRefusalListeners.clear()
        this.radioListeners.clear()
        this.snapshotListeners.clear()
    }

    // ── what a test drives ──────────────────────────────────────────────────

    /** Push a new live state, as the broker would. */
    public emit(state: LiveState): void {
        this.state = state
        this.listeners.forEach((listener) => listener(state))
    }

    /** Change the transport's state, as a lost or restored broker would. */
    public emitConnection(state: ConnectionState): void {
        this.connection = state
        this.connectionListeners.forEach((listener) => listener(state))
    }

    public emitAttitude(sample: AttitudeUpdate): void {
        this.attitudeListeners.forEach((listener) => listener(sample))
    }

    public emitPhoto(photo: Photo): void {
        this.photoListeners.forEach((listener) => listener(photo))
    }

    public emitPhotoRefusal(refusal: PhotoRefusal): void {
        this.photoRefusalListeners.forEach((listener) => listener(refusal))
    }

    public emitSnapshot(snapshot: TelemetrySnapshot): void {
        this.snapshotListeners.forEach((listener) => listener(snapshot))
    }

    public emitRadio(event: RadioEvent): void {
        this.radioListeners.forEach((listener) => listener(event))
    }

    /** A command crossing `cubesat/command` — this page's, or anybody's. */
    public emitCommand(echo: CommandEcho): void {
        this.commandListeners.forEach((listener) => listener(echo))
    }
}

/** Install a fresh fake as the process-wide source. Call from `beforeEach`. */
export const installFakeSource = (): FakeSource => {
    const fake = new FakeSource()
    setSource(fake)
    return fake
}
