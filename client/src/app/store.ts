/**
 * The store, and what is no longer in it.
 *
 * RTK Query used to live here, wrapping a REST backend that has been removed.
 * The live view arrives by subscription now — see `features/telemetry/source.ts`
 * — and attitude deliberately bypasses Redux altogether: 2 Hz through a
 * dispatch would re-render the whole tree for a value only the WebGL scene
 * consumes.
 *
 * The store is kept because `Provider` is still what the UI kit and the tests
 * mount against, and because the mission timeline will want somewhere to put a
 * playhead that several widgets read. It is deliberately empty until then
 * rather than filled with state that has one consumer.
 */

import { configureStore } from '@reduxjs/toolkit'

export const store = configureStore({
    reducer: {
        // Redux requires at least one reducer. Replaced by real state the first
        // time two widgets need to agree on something.
        placeholder: (state: Record<string, never> = {}) => state
    }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
