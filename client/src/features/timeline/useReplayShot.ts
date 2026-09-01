/**
 * The photograph a replayed mission had taken by the playhead.
 *
 * A mission photographs itself every five minutes while it is open, and those
 * frames are on the satellite's card under the mission's own directory — so a
 * replay can show them changing as it plays, which is most of what makes a
 * replayed walk look like a walk rather than a chart.
 *
 * **The frame shown is the last one whose moment has passed**, never the
 * nearest. Showing a photograph before it was taken would put the satellite
 * somewhere it had not reached yet, which is the same class of mistake as
 * drawing a stale GNSS fix as current — and it is the one the whole timeline
 * exists to avoid.
 *
 * The listing is fetched once per mission, not per tick: the names carry the
 * capture time, so choosing between them is arithmetic rather than a request.
 * An unreachable archive costs the photograph and nothing else — every other
 * widget keeps replaying.
 */

import { useEffect, useMemo, useState } from 'react'

import type { CameraShot, PhotoFile } from '../telemetry/types'
import { captureTimeFromName, getSource } from '../telemetry/useSource'

interface DatedPhoto extends PhotoFile {
    /** Epoch seconds from the file name, or null when it does not match. */
    at: number | null
}

export const useReplayShot = (missionId: number | null, playhead: number): CameraShot | null => {
    const [photos, setPhotos] = useState<DatedPhoto[]>([])

    useEffect(() => {
        const source = getSource()
        if (missionId == null || !source.capabilities.photos) {
            setPhotos([])
            return
        }
        let cancelled = false
        source
            .listPhotos(missionId)
            .then((listed) => {
                if (cancelled) {
                    return
                }
                // A frame whose name carries no time cannot be placed on the
                // timeline at all, so it is dropped rather than shown at the
                // wrong instant.
                const dated = listed
                    .map((photo) => ({ ...photo, at: captureTimeFromName(photo.name) }))
                    .filter((photo) => photo.at != null)
                dated.sort((left, right) => (left.at as number) - (right.at as number))
                setPhotos(dated)
            })
            .catch(() => {
                // Survivable: the widget says it has no photograph, which is
                // true of what it can reach.
                if (!cancelled) {
                    setPhotos([])
                }
            })
        return () => {
            cancelled = true
        }
    }, [missionId])

    return useMemo(() => {
        let shown: DatedPhoto | null = null
        for (const photo of photos) {
            if ((photo.at as number) > playhead) {
                break
            }
            shown = photo
        }
        if (shown == null || missionId == null) {
            return null
        }
        return {
            src: shown.url,
            kind: 'mission_frame',
            file: shown.name,
            timestamp: shown.at,
            missionId,
            // Not in the listing, and not worth a request per frame: the widget
            // renders a dash, which is honest.
            sizeBytes: null
        }
    }, [photos, playhead, missionId])
}
