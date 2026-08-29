/**
 * The source, and the hooks that read it.
 *
 * One instance for the whole page, created on first use. Every widget below
 * goes through `useLiveState`, and none of them can tell whether it is talking
 * to a satellite or to a recording — which is the property the whole
 * data-source layer exists to hold.
 */

import { useEffect, useRef, useState } from 'react'

import type { AttitudeUpdate, TelemetrySource } from './source'
import { createSource } from './sources'
import type { LiveState, Photo } from './types'
import { EMPTY_LIVE_STATE } from './types'

let singleton: TelemetrySource | null = null

export const getSource = (): TelemetrySource => {
    const current = singleton ?? createSource()
    singleton = current
    return current
}

/** Replaces the process-wide source. For tests, and for nothing else. */
export const setSource = (source: TelemetrySource | null): void => {
    singleton = source
}

/** The whole live state, re-rendering on every change. */
export const useLiveState = (): LiveState => {
    const [state, setState] = useState<LiveState>(EMPTY_LIVE_STATE)
    useEffect(() => getSource().subscribe(setState), [])
    return state
}

/**
 * Attitude, into a ref rather than into state.
 *
 * Deliberately not a `useState`. Orientation arrives at 2 Hz and drives one
 * imperative three.js scene; a dispatch and a React render per sample is a
 * frame budget spent re-rendering a tree that did not change. The scene reads
 * the ref on its own animation frame and interpolates between samples — which
 * it has to do anyway, because 1–2 Hz is slower than the eye wants.
 */
export const useAttitudeRef = (): React.MutableRefObject<AttitudeUpdate | null> => {
    const ref = useRef<AttitudeUpdate | null>(null)
    useEffect(
        () =>
            getSource().subscribeAttitude((sample) => {
                ref.current = sample
            }),
        []
    )
    return ref
}

/** The most recent photograph, or null. */
export const useLatestPhoto = (): Photo | null => {
    const [photo, setPhoto] = useState<Photo | null>(null)
    useEffect(() => getSource().subscribePhotos(setPhoto), [])
    return photo
}
