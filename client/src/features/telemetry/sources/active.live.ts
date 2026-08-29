/**
 * The live half of the build-time swap. See `index.ts`.
 *
 * This module and `active.replay.ts` are interchangeable: the bundler aliases
 * `#active-source` to exactly one of them, so the other is never reached and
 * never bundled. That is what keeps the MQTT client out of the static demo and
 * the recording out of the satellite's build — a runtime `if` cannot, because
 * both branches would still have to be shipped.
 */

import type { TelemetrySource } from '../source'

import { LiveSource } from './live'

const env = (name: string, fallback: string): string => {
    const value = (process.env as Record<string, string | undefined>)[name]
    return value == null || value === '' ? fallback : value
}

export const createSource = (): TelemetrySource =>
    new LiveSource({
        // Defaults to the host that served the page, which is what makes one
        // bundle work on cubesat.local, on an EXPO access point's IP, and
        // through a dev proxy without being rebuilt for each.
        brokerUrl:
            env('PUBLIC_BROKER_URL', '') ||
            (typeof window === 'undefined' ? 'ws://localhost:9001' : `ws://${window.location.hostname}:9001`),
        apiBase: env('PUBLIC_API_BASE', '/api')
    })
