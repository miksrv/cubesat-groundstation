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
import type { CameraShot, LiveState, Photo, PhotoFile, RadioEvent } from './types'
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

/**
 * The radio session log as it happens, newest first, bounded.
 *
 * Accumulated here rather than in `LiveState` because it is a stream, not a
 * state: there is no retained "current traffic" for a fresh page to learn, so
 * the table fills from the moment it is open. Bounded for the same reason
 * every buffer on the satellite is — a page left open overnight must not hold
 * the night's beacons.
 */
export const useRadioLog = (limit = 100): RadioEvent[] => {
    const [events, setEvents] = useState<RadioEvent[]>([])
    useEffect(
        () =>
            getSource().subscribeRadio((event) => {
                setEvents((current) => [event, ...current].slice(0, limit))
            }),
        [limit]
    )
    return events
}

/** The most recent photograph, or null. */
export const useLatestPhoto = (): Photo | null => {
    const [photo, setPhoto] = useState<Photo | null>(null)
    useEffect(() => getSource().subscribePhotos(setPhoto), [])
    return photo
}

/**
 * The newest image the satellite can show, from whichever channel has one.
 *
 * Two channels, because `payload_photo` is deliberately not retained: a page
 * open at the moment of a capture gets the message — an on-demand photo with
 * its pixels aboard, a timelapse frame as a URL into the mission's directory —
 * but a page opened five minutes later would see nothing until the next one.
 * So until a live photograph arrives, the mission's directory is asked once
 * for its newest file. An unreachable archive only costs the fallback; the
 * live channel keeps working, which is the same degradation the charts have.
 */
export const useCameraShot = (missionId: number | null): CameraShot | null => {
    const photo = useLatestPhoto()
    const [archived, setArchived] = useState<PhotoFile | null>(null)

    useEffect(() => {
        const source = getSource()
        if (!source.capabilities.photos || photo != null || missionId == null) {
            return
        }
        let cancelled = false
        source
            .listPhotos(missionId)
            .then((photos) => {
                if (!cancelled) {
                    // Newest last: the names embed the UTC capture time and
                    // the satellite lists them sorted.
                    setArchived(photos[photos.length - 1] ?? null)
                }
            })
            .catch(() => {
                // Survivable, and not worth an error state of its own: the
                // widget says "no photograph yet", which is true.
            })
        return () => {
            cancelled = true
        }
    }, [missionId, photo])

    if (photo != null) {
        const src =
            photo.kind === 'photo' && photo.photoBase64 !== ''
                ? `data:image/jpeg;base64,${photo.photoBase64}`
                : getSource().photoUrl(photo)
        if (src != null) {
            return {
                src,
                kind: photo.kind,
                file: photo.file,
                timestamp: photo.timestamp,
                missionId: photo.missionId,
                sizeBytes: photo.sizeBytes
            }
        }
        // A frame with no fetchable pixels — filed under `unfiled/`, which the
        // satellite's HTTP deliberately does not serve. Fall through to
        // whatever the archive had rather than promising an image.
    }
    if (archived != null) {
        return {
            src: archived.url,
            kind: 'archive',
            file: archived.name,
            timestamp: null,
            missionId: missionId != null ? String(missionId) : null,
            sizeBytes: null
        }
    }
    return null
}
