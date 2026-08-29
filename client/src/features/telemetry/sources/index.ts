/**
 * Which source this build talks to, decided by the bundler.
 *
 * `#active-source` is an alias, resolved in `rsbuild.config.ts` to either
 * `active.live.ts` or `active.replay.ts` according to `PUBLIC_SOURCE`. The
 * module that is not chosen is never imported and never bundled, so:
 *
 *   - the public demo carries no MQTT client and talks to nothing;
 *   - the satellite's build carries no recording.
 *
 * A runtime `if` would not do this — both branches would still have to ship,
 * and a static page would contain a broker client with no broker to reach. It
 * also would not do the more important half: a widget cannot accidentally
 * depend on which one is running, because it cannot see the choice at all.
 *
 *   PUBLIC_SOURCE=live      talk to the satellite (the default)
 *   PUBLIC_SOURCE=replay    replay the bundled recording (the public demo)
 *   PUBLIC_BROKER_URL       e.g. ws://cubesat.local:9001; defaults to this host
 *   PUBLIC_API_BASE         e.g. /api
 */

export { loadRecording } from './load'
export type { Recording } from './replay'
export { createSource } from '#active-source'
