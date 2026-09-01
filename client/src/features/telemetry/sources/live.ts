/**
 * The satellite itself: MQTT over WebSockets, plus REST for the archive.
 *
 * **The browser talks to the broker directly.** `mosquitto` carries a WebSocket
 * listener on 9001 and the dashboard service serves this page; there is no
 * MQTT-to-WebSocket bridge in the satellite's code, so there is none to fall
 * out of step with the topic list either. Subscribing also replays every
 * retained message, which is exactly what a page that has just been opened
 * needs — the current profile, battery and mission arrive before the first
 * poll would have.
 *
 * **Commands go over the same connection, not over REST.** `cubesat/command` is
 * the one topic the broker's ACL lets a browser write, and it is the same topic
 * a laptop, the `cubesat` CLI and an uplink relayed off the radio all use.
 * Nothing downstream knows which it was, and that property is worth more than a
 * private endpoint would be.
 *
 * The ACL is why the rest of this file publishes nothing else. `cubesat/host/command`
 * is HOSTD's inbox and HOSTD runs as root; `cubesat/+/status` is the telemetry
 * OBC makes decisions from, and a forged `eps_status` at 4 % would walk the
 * satellite into `CRITICAL`. Both are refused by the broker — this code simply
 * never asks.
 */

import type { MqttClient } from 'mqtt'
import mqtt from 'mqtt'

import {
    decodeAdcs,
    decodeComms,
    decodeDhs,
    decodeEps,
    decodeHost,
    decodeMission,
    decodeObc,
    decodePayload,
    decodePhoto,
    decodePhotoRefusal,
    decodeRadio,
    decodeScience,
    decodeSnapshot,
    decodeTelemetry,
    num,
    str
} from '../decode'
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

/** Mirrors `cubesat/common/topics.py`. Kept as one table for the same reason it
 *  is one table there: a topic spelled out at a call site is a topic that
 *  eventually gets spelled differently at another one.
 *
 *  `cubesat/heartbeat` is deliberately absent. It is OBC's raw material, and
 *  OBC's finished verdict already arrives on `obc_status.subsystems`
 *  (`watched`/`lost`); a dashboard reading the heartbeats too would be a
 *  second, competing opinion about liveness — one with worse information,
 *  since it cannot know the profile's grace periods. */
const TOPICS = {
    command: 'cubesat/command',
    hostStatus: 'cubesat/host/status',
    obcStatus: 'cubesat/obc/status',
    epsStatus: 'cubesat/eps/status',
    adcsStatus: 'cubesat/adcs/status',
    payloadStatus: 'cubesat/payload/status',
    payloadData: 'cubesat/payload/data',
    payloadPhoto: 'cubesat/payload/photo',
    dhsStatus: 'cubesat/dhs/status',
    commsStatus: 'cubesat/comms/status',
    commsData: 'cubesat/comms/data',
    commsRadio: 'cubesat/comms/radio'
} as const

/**
 * Everything on the bus, `cubesat/command` included.
 *
 * That topic used to be excluded — a page publishing onto it had no reason to
 * hear itself. It is subscribed since 2026-09-01 because the console shows the
 * command traffic rather than each widget narrating its own button: what crosses
 * this topic is also what a phone, the CLI and an uplink relayed off the radio
 * put there, and that is worth seeing. The browser ACL already permits
 * `read cubesat/#`.
 */
const SUBSCRIBED = Object.values(TOPICS)

export interface LiveOptions {
    /** e.g. `ws://cubesat.local:9001`. */
    brokerUrl: string
    /** Base path of the dashboard's read-only REST. */
    apiBase: string
}

export class LiveSource implements TelemetrySource {
    public readonly kind = 'live' as const
    public readonly label = 'satellite'
    public readonly capabilities: SourceCapabilities = {
        commands: true,
        archive: true,
        photos: true,
        radio: true
    }

    private client: MqttClient | null = null
    private state: LiveState = { ...EMPTY_LIVE_STATE }
    private connection: ConnectionState = 'connecting'
    private readonly listeners = new Set<(state: LiveState) => void>()
    private readonly connectionListeners = new Set<(state: ConnectionState) => void>()
    private readonly attitudeListeners = new Set<(sample: AttitudeUpdate) => void>()
    private readonly photoListeners = new Set<(photo: Photo) => void>()
    private readonly photoRefusalListeners = new Set<(refusal: PhotoRefusal) => void>()
    private readonly radioListeners = new Set<(event: RadioEvent) => void>()
    private readonly commandListeners = new Set<(echo: CommandEcho) => void>()
    private readonly snapshotListeners = new Set<(snapshot: TelemetrySnapshot) => void>()

    public constructor(private readonly options: LiveOptions) {}

    public subscribe(listener: (state: LiveState) => void): () => void {
        this.listeners.add(listener)
        this.connect()
        // Whatever is already known, immediately: a widget mounting after the
        // retained messages arrived must not wait for the next publish, and
        // `adcs_status` is not retained at all — nothing would come for it.
        listener(this.state)
        return () => {
            this.listeners.delete(listener)
        }
    }

    public subscribeConnection(listener: (state: ConnectionState) => void): () => void {
        this.connectionListeners.add(listener)
        this.connect()
        listener(this.connection)
        return () => {
            this.connectionListeners.delete(listener)
        }
    }

    public subscribeAttitude(listener: (sample: AttitudeUpdate) => void): () => void {
        this.attitudeListeners.add(listener)
        this.connect()
        return () => {
            this.attitudeListeners.delete(listener)
        }
    }

    public subscribePhotos(listener: (photo: Photo) => void): () => void {
        this.photoListeners.add(listener)
        this.connect()
        return () => {
            this.photoListeners.delete(listener)
        }
    }

    public subscribePhotoRefusals(listener: (refusal: PhotoRefusal) => void): () => void {
        this.photoRefusalListeners.add(listener)
        this.connect()
        return () => {
            this.photoRefusalListeners.delete(listener)
        }
    }

    public subscribeRadio(listener: (event: RadioEvent) => void): () => void {
        this.radioListeners.add(listener)
        this.connect()
        return () => {
            this.radioListeners.delete(listener)
        }
    }

    public subscribeCommands(listener: (echo: CommandEcho) => void): () => void {
        this.commandListeners.add(listener)
        this.connect()
        return () => {
            this.commandListeners.delete(listener)
        }
    }

    public subscribeSnapshots(listener: (snapshot: TelemetrySnapshot) => void): () => void {
        this.snapshotListeners.add(listener)
        this.connect()
        return () => {
            this.snapshotListeners.delete(listener)
        }
    }

    public async recentTelemetry(limit: number): Promise<TelemetryRecord[]> {
        const body = await this.get<{ records: unknown[] }>(`/telemetry?limit=${limit}`)
        return (body.records ?? []).map((row) => decodeTelemetry(row as Record<string, unknown>))
    }

    public async listMissions(): Promise<MissionSummary[]> {
        const body = await this.get<{ missions: unknown[] }>('/missions')
        return (body.missions ?? []).map((row) => decodeMission(row as Record<string, unknown>))
    }

    public async loadMission(id: number): Promise<MissionDetail> {
        const body = await this.get<Record<string, unknown>>(`/missions/${id}`)
        return {
            mission: decodeMission((body.mission ?? {}) as Record<string, unknown>),
            telemetry: ((body.telemetry ?? []) as unknown[]).map((row) =>
                decodeTelemetry(row as Record<string, unknown>)
            ),
            // radio_log names its time column `t`, as attitude does — the
            // recorder's own epoch, not the ISO second telemetry rows carry.
            // Mapped to `timestamp` here so a recorded event and a live one are
            // the same shape by the time any widget sees them.
            radio: ((body.radio ?? []) as unknown[]).flatMap((row) => {
                const event = row as Record<string, unknown>
                const decoded = decodeRadio({ ...event, timestamp: event.t })
                return decoded ? [decoded] : []
            }),
            attitude: ((body.attitude ?? []) as unknown[]).map((row) => {
                const sample = row as Record<string, unknown>
                return {
                    t: num(sample.t) ?? 0,
                    quaternion: {
                        w: num(sample.quat_w),
                        x: num(sample.quat_x),
                        y: num(sample.quat_y),
                        z: num(sample.quat_z)
                    },
                    gyro: { x: num(sample.gyro_x), y: num(sample.gyro_y), z: num(sample.gyro_z) }
                }
            })
        }
    }

    public async listPhotos(missionId: number): Promise<PhotoFile[]> {
        const body = await this.get<{ photos: unknown[] }>(`/missions/${missionId}/photos`)
        return (body.photos ?? []).flatMap((row) => {
            const name = str((row as Record<string, unknown>).name)
            // The URL is built against this source's own API base rather than
            // taken from the wire: the listing's `url` field is relative to
            // the satellite's HTTP root, which is only the same origin when
            // the page came from the satellite itself.
            return name ? [{ name, url: `${this.options.apiBase}/photos/${missionId}/${name}` }] : []
        })
    }

    public photoUrl(photo: Photo): string | null {
        return photo.missionId != null && photo.file != null
            ? `${this.options.apiBase}/photos/${photo.missionId}/${photo.file}`
            : null
    }

    public async send(command: Command): Promise<void> {
        const client = this.connect()
        const payload = JSON.stringify({
            command: command.command,
            ...(command.params ? { params: command.params } : {}),
            ...(command.requestId ? { request_id: command.requestId } : {})
        })
        await new Promise<void>((resolve, reject) => {
            client.publish(TOPICS.command, payload, { qos: 1 }, (error) => (error ? reject(error) : resolve()))
        })
    }

    public close(): void {
        this.client?.end(true)
        this.client = null
    }

    // ── the connection ──────────────────────────────────────────────────────

    private connect(): MqttClient {
        if (this.client) {
            return this.client
        }
        const client = mqtt.connect(this.options.brokerUrl, {
            // Reconnecting is the normal case, not the exception: EXPO is the
            // satellite's own access point and a phone walks out of range of it.
            reconnectPeriod: 2000,
            clean: true
        })
        client.on('connect', () => {
            client.subscribe(SUBSCRIBED, { qos: 0 })
            this.setConnection('online')
        })
        // `close` fires on every failed reconnect attempt too, which is what
        // keeps the state honest while the broker stays away; setConnection
        // only notifies on an actual change.
        client.on('close', () => this.setConnection('offline'))
        client.on('offline', () => this.setConnection('offline'))
        // Listened to so a transport error is never an unhandled event; the
        // `close` that follows it is what drives the state.
        client.on('error', () => undefined)
        client.on('message', (topic, payload) => this.onMessage(topic, payload))
        this.client = client
        return client
    }

    private setConnection(next: ConnectionState): void {
        if (this.connection === next) {
            return
        }
        this.connection = next
        this.connectionListeners.forEach((listener) => listener(next))
    }

    private onMessage(topic: string, payload: Uint8Array): void {
        let raw: Record<string, unknown>
        try {
            raw = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>
        } catch {
            // A malformed payload is dropped, never rendered. Nothing on this
            // bus is worth taking the page down for.
            return
        }
        switch (topic) {
            case TOPICS.obcStatus: {
                const obc = decodeObc(raw)
                // Null only for a payload with no status string at all — a
                // state name this build has not heard of decodes fine and
                // renders verbatim; the satellite is the authority on its own
                // state machine.
                if (obc) {
                    this.patch({ obc })
                }
                return
            }
            case TOPICS.hostStatus:
                return this.patch({ host: decodeHost(raw) })
            case TOPICS.epsStatus:
                return this.patch({ eps: decodeEps(raw) })
            case TOPICS.adcsStatus: {
                const adcs = decodeAdcs(raw)
                // Attitude leaves by its own door as well as into the state: the
                // 3D scene wants every sample at 2 Hz and must not cost a store
                // update to get one.
                const { w, x, y, z } = adcs.quaternion
                if (w != null && x != null && y != null && z != null) {
                    const sample: AttitudeUpdate = { t: adcs.timestamp, w, x, y, z }
                    this.attitudeListeners.forEach((listener) => listener(sample))
                }
                return this.patch({ adcs })
            }
            case TOPICS.command: {
                const name = str(raw.command)
                if (name == null) {
                    // Not a command, whatever else it is. Dropped rather than
                    // printed: this topic is open to every ground client, so a
                    // malformed payload is somebody else's typo, not an event.
                    return
                }
                const params = raw.params
                const echo: CommandEcho = {
                    at: Date.now() / 1000,
                    command: name,
                    params:
                        params != null && typeof params === 'object' && !Array.isArray(params)
                            ? (params as Record<string, unknown>)
                            : null
                }
                this.commandListeners.forEach((listener) => listener(echo))
                return
            }
            case TOPICS.payloadStatus:
                return this.patch({ payload: decodePayload(raw) })
            case TOPICS.payloadData:
                return this.patch({ science: decodeScience(raw) })
            case TOPICS.dhsStatus:
                return this.patch({ dhs: decodeDhs(raw) })
            case TOPICS.commsStatus:
                return this.patch({ comms: decodeComms(raw) })
            case TOPICS.commsData: {
                // A response, not a state: COMMS publishes this only because a
                // ground client asked, and whoever asked is subscribed here.
                const snapshot = decodeSnapshot(raw)
                this.snapshotListeners.forEach((listener) => listener(snapshot))
                return
            }
            case TOPICS.commsRadio: {
                // A stream, not a state: like photographs, each event leaves by
                // its own door and nothing of it lives in LiveState — a "last
                // packet" field would be stale the moment it was rendered.
                const event = decodeRadio(raw)
                if (event) {
                    this.radioListeners.forEach((listener) => listener(event))
                }
                return
            }
            case TOPICS.payloadPhoto: {
                const photo = decodePhoto(raw)
                if (photo) {
                    this.photoListeners.forEach((listener) => listener(photo))
                    return
                }
                const refusal = decodePhotoRefusal(raw)
                if (refusal) {
                    this.photoRefusalListeners.forEach((listener) => listener(refusal))
                }
                return
            }
            default:
                return
        }
    }

    private patch(change: Partial<LiveState>): void {
        this.state = { ...this.state, ...change }
        this.listeners.forEach((listener) => listener(this.state))
    }

    private async get<T>(path: string): Promise<T> {
        const response = await fetch(`${this.options.apiBase}${path}`)
        if (!response.ok) {
            throw new Error(`${path}: ${response.status} ${response.statusText}`)
        }
        return (await response.json()) as T
    }
}
