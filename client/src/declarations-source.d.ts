/**
 * The build-time source swap, for the type checker.
 *
 * `#active-source` resolves to `active.live.ts` or `active.replay.ts` — see
 * `features/telemetry/sources/index.ts`. Both export the same one function, so
 * declaring it once here is the whole contract.
 */
declare module '#active-source' {
    import type { TelemetrySource } from './features/telemetry/source'

    export const createSource: () => TelemetrySource
}
