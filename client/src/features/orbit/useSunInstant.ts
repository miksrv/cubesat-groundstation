import { useEffect, useState } from 'react'

/**
 * Which instant the daylight on the globe is drawn for.
 *
 * The rule, in one place, because it is the only thing about the terminator
 * that is a decision rather than arithmetic:
 *
 *   - the live satellite, and the `yarn demo` replay, draw **now**. The demo
 *     replays a walk that happened on some past afternoon, but nobody watching
 *     it is being shown that afternoon's sky — they are being shown a globe,
 *     and a globe whose night sits somewhere other than where the viewer's own
 *     night sits reads as broken. What the recording supplies is the satellite;
 *     the Earth around it is the viewer's present;
 *   - a mission opened from the timeline draws **the mission's own instant**.
 *     There the past afternoon is the point: the scrubber, the T+ clock and the
 *     UTC clock beside it all say so, and shading that mission's track with
 *     tonight's terminator would put the walk in a dark it did not happen in.
 *
 * So: pass the playhead while a mission is being replayed, null otherwise.
 */

/** How often the wall clock is re-read. The subsolar point moves 0.25° of
 *  longitude a minute, so a minute's staleness is a quarter of a degree — far
 *  below what a terminator drawn 64 segments to a sphere can show, and this
 *  re-renders the scene, so it should not be a per-second affair. */
const TICK_MS = 30_000

export const useSunInstant = (missionInstant: number | null): number => {
    const [now, setNow] = useState(() => Date.now() / 1000)

    // Kept ticking even while a mission is on screen, so leaving the replay
    // shows the present rather than the moment the replay was opened.
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now() / 1000), TICK_MS)
        return () => clearInterval(timer)
    }, [])

    return missionInstant ?? now
}
