/**
 * The one exchange on this bus that has a reply: `delete_mission`.
 *
 * Everything else the live source publishes is fire-and-forget — a command
 * crosses `cubesat/command` and the satellite's next retained status is the
 * feedback. A delete is different because somebody is standing in front of a
 * dialog waiting to be told whether their walk is gone, and the answer comes
 * back on a **retained** topic, which means results that are not theirs arrive
 * too. The correlation that sorts those out is what this file pins.
 *
 * The broker is a fake: one object with the four methods `mqtt.connect` returns
 * and a way to push a message at the handler the source registers.
 */

import type { MqttClient } from 'mqtt'
import mqtt from 'mqtt'

import { TextDecoder, TextEncoder } from 'util'

import { LiveSource } from './live'

// jsdom ships neither, and the source decodes every broker payload with them.
Object.assign(globalThis, { TextEncoder, TextDecoder })

jest.mock('mqtt', () => ({
    __esModule: true,
    default: { connect: jest.fn() }
}))

type Handler = (topic: string, payload: Uint8Array) => void

const DHS_STATUS = 'cubesat/dhs/status'

class FakeClient {
    public readonly published: Array<{ topic: string; payload: string }> = []
    public ended = false
    private message: Handler | null = null

    public on(event: string, handler: (...args: unknown[]) => void): this {
        if (event === 'message') {
            this.message = handler as Handler
        }
        return this
    }

    public subscribe(): this {
        return this
    }

    public publish(topic: string, payload: string, _options: unknown, done: (error?: Error) => void): this {
        this.published.push({ topic, payload })
        done()
        return this
    }

    public end(): this {
        this.ended = true
        return this
    }

    /** What the broker delivers to the page. */
    public deliver(topic: string, body: unknown): void {
        this.message?.(topic, new TextEncoder().encode(JSON.stringify(body)))
    }
}

const dhsStatus = (lastDelete: unknown) => ({
    timestamp: 1_756_000_000,
    recording: false,
    last_delete: lastDelete
})

/** The `request_id` the source generated for its delete. */
const requestIdOf = (client: FakeClient): string =>
    (JSON.parse(client.published[0].payload) as { request_id: string }).request_id

describe('LiveSource.deleteMission', () => {
    let client: FakeClient
    let source: LiveSource

    beforeEach(() => {
        client = new FakeClient()
        ;(mqtt.connect as jest.Mock).mockReturnValue(client as unknown as MqttClient)
        source = new LiveSource({ brokerUrl: 'ws://localhost:9001', apiBase: '/api' })
    })

    it('asks the satellite rather than the dashboard, and names the mission', async () => {
        // There is no HTTP DELETE: the dashboard's surface is read-only by
        // construction and DHS owns the database.
        const deleting = source.deleteMission(8)
        expect(client.published[0].topic).toBe('cubesat/command')
        const sent = JSON.parse(client.published[0].payload) as Record<string, unknown>
        expect(sent.command).toBe('delete_mission')
        expect(sent.params).toStrictEqual({ mission_id: 8 })
        expect(typeof sent.request_id).toBe('string')

        client.deliver(DHS_STATUS, dhsStatus({ ok: true, request_id: sent.request_id, mission_id: 8 }))
        await expect(deleting).resolves.toBeUndefined()
    })

    it('rejects with the reason the satellite itself gave when it refuses', async () => {
        const deleting = source.deleteMission(8)
        client.deliver(
            DHS_STATUS,
            dhsStatus({
                ok: false,
                request_id: requestIdOf(client),
                mission_id: 8,
                error: 'deleting a mission is not permitted in EXPO'
            })
        )
        await expect(deleting).rejects.toThrow('not permitted in EXPO')
    })

    it('ignores a result that belongs to somebody else', async () => {
        // `dhs_status` is retained, so a page opening after another operator's
        // delete meets their answer as a matter of course. Answering our own
        // promise with it would report a mission gone that we never asked about.
        const deleting = source.deleteMission(8)
        client.deliver(DHS_STATUS, dhsStatus({ ok: false, request_id: 'del_99_abc', error: 'no mission 99' }))
        client.deliver(DHS_STATUS, dhsStatus(null))
        client.deliver(DHS_STATUS, dhsStatus({ ok: true, request_id: requestIdOf(client), mission_id: 8 }))
        await expect(deleting).resolves.toBeUndefined()
    })

    it('gives up rather than waiting for a recorder that is not running', async () => {
        // DHS does not run in every profile, and a command published to a
        // service that is not there produces exactly nothing.
        jest.useFakeTimers()
        try {
            // Caught as it is created: the rejection lands the moment the timer
            // fires, and a promise nobody is holding at that point is an
            // unhandled rejection rather than a test.
            const caught = source.deleteMission(8).catch((cause: Error) => cause)
            jest.advanceTimersByTime(20_000)
            await expect(caught).resolves.toThrow('did not answer')
        } finally {
            jest.useRealTimers()
        }
    })

    it('answers a pending delete when the connection goes away', async () => {
        // A promise that never settles is a dialog that never stops spinning.
        const deleting = source.deleteMission(8)
        source.close()
        await expect(deleting).rejects.toThrow('connection to the satellite was closed')
    })
})
