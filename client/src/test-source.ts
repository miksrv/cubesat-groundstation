/**
 * A source the tests drive by hand.
 *
 * The whole data layer is one interface with several implementations, so a test
 * needs neither a broker nor a server — it installs this, pushes a state, and
 * asserts what the widgets drew. That is the property the interface exists for,
 * and this file is the cheapest possible proof that it holds.
 */

import type { AttitudeUpdate, SourceCapabilities, TelemetrySource } from './features/telemetry/source'
import type {
    Command,
    LiveState,
    MissionDetail,
    MissionSummary,
    Photo,
    TelemetryRecord
} from './features/telemetry/types'
import { EMPTY_LIVE_STATE } from './features/telemetry/types'
import { setSource } from './features/telemetry/useSource'

export class FakeSource implements TelemetrySource {
    public readonly kind = 'live' as const
    public readonly label = 'test'
    public capabilities: SourceCapabilities = { commands: true, archive: true, photos: true }

    /** Everything `send` was called with, in order. */
    public readonly sent: Command[] = []
    public history: TelemetryRecord[] = []
    public missions: MissionSummary[] = []
    /** Set to make `recentTelemetry` reject, as an unreachable archive does. */
    public archiveError: Error | null = null

    private state: LiveState = { ...EMPTY_LIVE_STATE }
    private readonly listeners = new Set<(state: LiveState) => void>()
    private readonly attitudeListeners = new Set<(sample: AttitudeUpdate) => void>()

    public subscribe(listener: (state: LiveState) => void): () => void {
        this.listeners.add(listener)
        listener(this.state)
        return () => {
            this.listeners.delete(listener)
        }
    }

    public subscribeAttitude(listener: (sample: AttitudeUpdate) => void): () => void {
        this.attitudeListeners.add(listener)
        return () => {
            this.attitudeListeners.delete(listener)
        }
    }

    public subscribePhotos(_listener: (photo: Photo) => void): () => void {
        return () => undefined
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
        return { mission, telemetry: this.history, attitude: [] }
    }

    public async send(command: Command): Promise<void> {
        if (!this.capabilities.commands) {
            throw new Error('this is a recording — there is no satellite to command')
        }
        this.sent.push(command)
    }

    public close(): void {
        this.listeners.clear()
        this.attitudeListeners.clear()
    }

    // ── what a test drives ──────────────────────────────────────────────────

    /** Push a new live state, as the broker would. */
    public emit(state: LiveState): void {
        this.state = state
        this.listeners.forEach((listener) => listener(state))
    }

    public emitAttitude(sample: AttitudeUpdate): void {
        this.attitudeListeners.forEach((listener) => listener(sample))
    }
}

/** Install a fresh fake as the process-wide source. Call from `beforeEach`. */
export const installFakeSource = (): FakeSource => {
    const fake = new FakeSource()
    setSource(fake)
    return fake
}
