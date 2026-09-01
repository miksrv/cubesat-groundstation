/**
 * The source, and the hooks that read it.
 *
 * One instance for the whole page, created on first use. Every widget below
 * goes through `useLiveState`, and none of them can tell whether it is talking
 * to a satellite or to a recording — which is the property the whole
 * data-source layer exists to hold.
 */

import { useEffect, useRef, useState } from 'react'

import type { AttitudeUpdate, ConnectionState, TelemetrySource } from './source'
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

/** The transport's own state. `connecting` only until the subscription's
 *  immediate callback lands, which is the same render. */
export const useConnection = (): ConnectionState => {
    const [state, setState] = useState<ConnectionState>('connecting')
    useEffect(() => getSource().subscribeConnection(setState), [])
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
 * The archive listing carries names alone, but the satellite embeds the UTC
 * capture time in each name (`photo_20260830_120000.jpg`,
 * `frame_20260830_120000_0007.jpg`) — so an archived shot's timestamp is
 * recovered from its name rather than declared unknown. A name that does not
 * match the pattern honestly yields null.
 */
export const captureTimeFromName = (name: string): number | null => {
    const match = /_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(name)
    if (match == null) {
        return null
    }
    const [, year, month, day, hour, minute, second] = match.map(Number)
    return Date.UTC(year, month - 1, day, hour, minute, second) / 1000
}

/**
 * The newest image the satellite can show, from whichever channel has one.
 *
 * Two channels. The live one carries an on-demand photo with its pixels aboard,
 * or a mission frame as a URL into the mission's directory. `payload_photo` is
 * retained as of 2026-09-01, so a page opened five minutes after a capture does
 * get the last one from the broker — but a mission's frames are metadata only,
 * and a page opened between them has nothing to show. So until a live photograph
 * arrives, the mission's directory is asked once for its newest file. An
 * unreachable archive only costs the fallback; the live channel keeps working,
 * which is the same degradation the charts have.
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
        // A frame with no fetchable pixels: a capture taken with no mission
        // open is written to the satellite's tmpfs and deleted once its pixels
        // are on the bus, so there is no URL to ask for. Fall through to
        // whatever the archive had rather than promising an image.
    }
    if (archived != null) {
        return {
            src: archived.url,
            kind: 'archive',
            file: archived.name,
            timestamp: captureTimeFromName(archived.name),
            missionId,
            sizeBytes: null
        }
    }
    return null
}
