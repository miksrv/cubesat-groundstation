/**
 * One interface, several places the numbers can come from.
 *
 * The four things this dashboard has to be are the same picture with different
 * plumbing behind it: live on the satellite, replaying a mission out of the
 * satellite's archive, replaying one out of a file with no backend at all, and
 * — later — reading a Meshtastic receiver on a laptop's USB port. The widgets
 * must not be able to tell which.
 *
 * So the interface is **domain-level**. "Give me the live state", "list the
 * missions", "load this one". Never "GET this path" or "subscribe to that
 * topic": the moment a transport word appears here, the static build has to
 * implement an HTTP client that talks to nothing.
 *
 * A source is picked once, at startup, from build-time configuration. There is
 * deliberately no `if (demo)` inside a widget — that variant breaks every time
 * somebody edits the live path, and nobody notices until it is deployed.
 */

import type {
    Command,
    LiveState,
    MissionDetail,
    MissionSummary,
    Photo,
    PhotoFile,
    PhotoRefusal,
    RadioEvent,
    TelemetryRecord,
    TelemetrySnapshot
} from './types'

export type SourceKind = 'live' | 'replay'

/**
 * The state of the transport itself — not of the satellite. `connecting` is
 * the moment after the page opened, before the first connect or failure;
 * after that it is `online`/`offline` as the connection comes and goes. This
 * is the only fact the transport knows with certainty about itself, which is
 * why the channel carries nothing more: "the broker is unreachable" and "the
 * satellite is silent" are different findings, and only the first one is the
 * transport's to make.
 */
export type ConnectionState = 'connecting' | 'online' | 'offline'

/** What a source can do. Capabilities differ; the UI asks rather than assumes. */
export interface SourceCapabilities {
    /** Whether {@link TelemetrySource.send} does anything. False on a replay:
     *  a recording cannot be commanded, and a button that silently does nothing
     *  is worse than one that is not there. */
    commands: boolean
    /** Whether the mission archive is reachable. */
    archive: boolean
    /** Whether photographs arrive. */
    photos: boolean
    /** Whether radio traffic arrives — false on a replay, so the radio table
     *  is not rendered as a widget that can only ever be empty. */
    radio: boolean
}

export interface TelemetrySource {
    readonly kind: SourceKind
    /** Shown in the UI so it is never a mystery which of these is running. */
    readonly label: string
    readonly capabilities: SourceCapabilities

    /**
     * Start producing live state. Returns the unsubscribe.
     *
     * Called with the whole state on every change rather than with a delta:
     * the object is small, the widgets are pure in it, and a delta protocol is
     * a second place for the two sides to disagree about what changed.
     */
    subscribe(listener: (state: LiveState) => void): () => void

    /**
     * The transport's own state, called immediately with the current value and
     * then on every change. Deliberately outside {@link LiveState}: everything
     * there is something the satellite published, and this is the one fact the
     * page knows without the satellite — a broker that is down must be
     * distinguishable from a satellite that has not published yet.
     */
    subscribeConnection(listener: (state: ConnectionState) => void): () => void

    /**
     * Attitude, at the rate it is measured, **outside the state object**.
     *
     * Deliberately its own channel. Orientation arrives at 2 Hz, and putting it
     * through the same path as everything else means a store update and a React
     * render sixty times a minute for a value that drives one imperative
     * three.js scene. Subscribe here, write to a ref, and interpolate.
     */
    subscribeAttitude(listener: (sample: AttitudeUpdate) => void): () => void

    /** Photographs as they arrive. */
    subscribePhotos(listener: (photo: Photo) => void): () => void

    /**
     * The camera saying no, from the same topic the photographs arrive on.
     * A response, not a state: a refusal answers one button press, and whoever
     * pressed it is the thing waiting — without this channel a refused
     * `take_photo` produces no feedback at all and reads as a dead camera.
     */
    subscribePhotoRefusals(listener: (refusal: PhotoRefusal) => void): () => void

    /**
     * COMMS' answers to `get_telemetry`, as they arrive on `cubesat/comms/data`.
     * A response channel, not a state: the bundle exists because some ground
     * client asked, and the console that asked is the thing waiting on it.
     */
    subscribeSnapshots(listener: (snapshot: TelemetrySnapshot) => void): () => void

    /**
     * Radio transactions as they happen — every message heard and every
     * transmission attempted, from `cubesat/comms/radio`. A replay source
     * emits nothing here (the bundled recording predates the radio log);
     * whether the channel exists at all is `capabilities.radio`.
     */
    subscribeRadio(listener: (event: RadioEvent) => void): () => void

    /**
     * The most recent telemetry rows, newest first.
     *
     * Needed as well as {@link subscribe} because two things a dashboard shows
     * are not on any status topic: the host's own CPU, RAM and disk, which only
     * DHS records, and any history at all. So "live" here means the retained
     * MQTT state for what the subsystems publish, and the newest recorded row
     * for what only the recorder collects — up to one DHS cadence stale, which
     * is what those numbers are.
     */
    recentTelemetry(limit: number): Promise<TelemetryRecord[]>

    listMissions(): Promise<MissionSummary[]>

    /** One mission with its detail. Rejects if the archive is unreachable; a
     *  mission whose detail was purged resolves with empty arrays and a
     *  `purgedAt` on the summary, which is a different thing and must render
     *  differently. */
    loadMission(id: number): Promise<MissionDetail>

    /**
     * The photographs a mission has on disk, oldest first — the order the
     * satellite lists them in, which is chronological because the names embed
     * the UTC capture time. Names and fetchable URLs, never pixels: a page
     * that just opened wants the newest image, not the whole directory.
     */
    listPhotos(missionId: number): Promise<PhotoFile[]>

    /**
     * Where this photograph's pixels can be fetched, or null when they cannot
     * be: a frame filed under `unfiled/` (the satellite serves only photos
     * filed under a mission), or a source with no backend at all. This is how
     * a timelapse frame — announced by metadata only — becomes an image.
     */
    photoUrl(photo: Photo): string | null

    /** Publish a ground command. Rejects when {@link SourceCapabilities.commands}
     *  is false, rather than resolving as though it had been sent. */
    send(command: Command): Promise<void>

    /** Release the transport. */
    close(): void
}

/** What the attitude channel carries: a quaternion and when it was measured. */
export interface AttitudeUpdate {
    /** Epoch seconds, from the ADCS payload — when the IMU was read. */
    t: number
    w: number
    x: number
    y: number
    z: number
}

/** Nothing to command, nothing to fetch. The floor every source starts from. */
export const NO_CAPABILITIES: SourceCapabilities = {
    commands: false,
    archive: false,
    photos: false,
    radio: false
}
