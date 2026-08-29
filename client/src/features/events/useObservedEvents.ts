import { useEffect, useRef, useState } from 'react'

import type { LiveState } from '../telemetry/types'

import type { ObservedEvent } from './observed'
import { diffStates, MAX_EVENTS } from './observed'

/**
 * The log of what this page has seen, newest first.
 *
 * It starts empty on every load, deliberately and visibly - see `observed.ts`.
 * Nothing here reaches back before the tab was opened, because nothing recorded
 * it: the satellite keeps no events table.
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

    return events
}
