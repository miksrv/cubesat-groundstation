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
    decodeScience,
    decodeTelemetry,
    num,
    str
} from '../decode'
import type { AttitudeUpdate, SourceCapabilities, TelemetrySource } from '../source'
import type { Command, LiveState, MissionDetail, MissionSummary, Photo, TelemetryRecord } from '../types'
import { EMPTY_LIVE_STATE } from '../types'

/** Mirrors `cubesat/common/topics.py`. Kept as one table for the same reason it
 *  is one table there: a topic spelled out at a call site is a topic that
 *  eventually gets spelled differently at another one. */
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
    heartbeat: 'cubesat/heartbeat'
} as const

const SUBSCRIBED = Object.values(TOPICS).filter((topic) => topic !== TOPICS.command)

export interface LiveOptions {
    /** e.g. `ws://cubesat.local:9001`. */
    brokerUrl: string
    /** Base path of the dashboard's read-only REST. */
    apiBase: string
}

export class LiveSource implements TelemetrySource {
    public readonly kind = 'live' as const
    public readonly label = 'satellite'
    public readonly capabilities: SourceCapabilities = { commands: true, archive: true, photos: true }

    private client: MqttClient | null = null
    private state: LiveState = { ...EMPTY_LIVE_STATE }
    private readonly listeners = new Set<(state: LiveState) => void>()
    private readonly attitudeListeners = new Set<(sample: AttitudeUpdate) => void>()
    private readonly photoListeners = new Set<(photo: Photo) => void>()

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
        client.on('connect', () => client.subscribe(SUBSCRIBED, { qos: 0 }))
        client.on('message', (topic, payload) => this.onMessage(topic, payload))
        this.client = client
        return client
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
                // decodeObc returns null for a state this build cannot name.
                // Keeping the previous one beats rendering a satellite with no
                // state at all.
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
            case TOPICS.payloadStatus:
                return this.patch({ payload: decodePayload(raw) })
            case TOPICS.payloadData:
                return this.patch({ science: decodeScience(raw) })
            case TOPICS.dhsStatus:
                return this.patch({ dhs: decodeDhs(raw) })
            case TOPICS.commsStatus:
                return this.patch({ comms: decodeComms(raw) })
            case TOPICS.payloadPhoto: {
                const photo = decodePhoto(raw)
                if (photo) {
                    this.photoListeners.forEach((listener) => listener(photo))
                }
                return
            }
            case TOPICS.heartbeat: {
                const service = str(raw.service) ?? str(raw.client_id)
                if (service) {
                    this.patch({
                        heartbeats: { ...this.state.heartbeats, [service]: num(raw.timestamp) ?? 0 }
                    })
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
