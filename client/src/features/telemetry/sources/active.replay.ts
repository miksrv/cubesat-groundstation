/**
 * The recorded half of the build-time swap. See `index.ts`.
 *
 * The recording is imported eagerly and on purpose: it is the one thing the
 * static build cannot do without, and fetching it would need a server for
 * exactly the case that is supposed to need none.
 */

import recording from '../recordings/placeholder.json'
import type { TelemetrySource } from '../source'

import { loadRecording } from './load'
import { ReplaySource } from './replay'

export const createSource = (): TelemetrySource =>
    new ReplaySource(loadRecording(recording as unknown as Record<string, unknown>))
