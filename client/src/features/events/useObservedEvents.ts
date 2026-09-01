import { useEffect, useRef, useState } from 'react'

import type { LiveState } from '../telemetry/types'
import { getSource } from '../telemetry/useSource'

import type { ObservedEvent } from './observed'
import { diffStates, MAX_EVENTS, photoRefusalAlert, radioAlert } from './observed'

/**
 * The log of what this page has seen, newest first.
 *
 * It starts empty on every load, deliberately and visibly - see `observed.ts`.
 * Nothing here reaches back before the tab was opened, because nothing recorded
 * it: the satellite keeps no events table.
 *
 * Three feeds, one log: transitions between live states, plus the two streams
 * that are not state at all and would never show up in a diff — the radio
 * (a failed transmission) and the camera (a refused capture) — which have to
 * be listened for.
 */
export const useObservedEvents = (live: LiveState): ObservedEvent[] => {
    const [events, setEvents] = useState<ObservedEvent[]>([])
    const previous = useRef<LiveState | null>(null)

    useEffect(() => {
        const fresh = diffStates(previous.current, live)
        previous.current = live
        if (fresh.length > 0) {
            setEvents((current) => [...fresh.reverse(), ...current].slice(0, MAX_EVENTS))
        }
    }, [live])

    // Distinct from diffStates' per-diff numbering, so two failures inside one
    // second still get distinct event ids. Shared by both streams for the same
    // reason.
    const streamSeq = useRef(0)

    useEffect(
        () =>
            getSource().subscribeRadio((radio) => {
                const alert = radioAlert(radio, (streamSeq.current += 1) + 1000)
                if (alert != null) {
                    setEvents((current) => [alert, ...current].slice(0, MAX_EVENTS))
                }
            }),
        []
    )

    useEffect(
        () =>
            getSource().subscribePhotoRefusals((refusal) => {
                const alert = photoRefusalAlert(refusal, (streamSeq.current += 1) + 1000)
                setEvents((current) => [alert, ...current].slice(0, MAX_EVENTS))
            }),
        []
    )

    return events
}
