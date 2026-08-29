/**
 * A mission log the dashboard keeps for itself.
 *
 * **The satellite has no events table.** It publishes state, and its services
 * log to `/var/log/cubesat/`; there is nothing to fetch and nothing to page
 * through. The previous version of this dashboard read `/api/events` from the
 * PHP backend, which invented them.
 *
 * So the log is built here, out of transitions this page actually witnessed:
 * the mission state changing, a profile being applied, a mission opening or
 * closing, the radio going quiet, a device falling silent. That has one honest
 * limitation and it has to be visible in the UI — **it starts when the page
 * does.** Reload the tab and the log is empty, because nothing recorded it.
 * Anything older lives in the satellite's own logs.
 */

import type { LiveState } from '../telemetry/types'

export type EventSeverity = 'info' | 'success' | 'warning' | 'critical'

export interface ObservedEvent {
    id: string
    /** Epoch seconds, from the payload that caused it. */
    at: number
    severity: EventSeverity
    message: string
}

/** Mission states that are themselves worth logging loudly. */
const STATE_SEVERITY: Record<string, EventSeverity> = {
    CRITICAL: 'critical',
    SAFE: 'warning',
    LOW_POWER: 'warning',
    DEPLOY: 'info',
    NOMINAL: 'success',
    SCIENCE: 'success'
}

/** Enough to fill the panel and to stop an all-night EXPO growing without end. */
export const MAX_EVENTS = 200

const event = (at: number, severity: EventSeverity, message: string, seq: number): ObservedEvent => ({
    id: `${at.toFixed(3)}-${seq}`,
    at,
    severity,
    message
})

/**
 * Everything that changed between two live states, as log lines.
 *
 * Pure, and takes both sides explicitly, so the caller owns the history and
 * this stays testable without a broker or a clock.
 */
export const diffStates = (previous: LiveState | null, next: LiveState): ObservedEvent[] => {
    const out: ObservedEvent[] = []
    let seq = 0

    if (next.obc && previous?.obc?.status !== next.obc.status) {
        out.push(
            event(
                next.obc.timestamp,
                STATE_SEVERITY[next.obc.status] ?? 'info',
                previous?.obc
                    ? `mission state ${previous.obc.status} -> ${next.obc.status}`
                    : `mission state ${next.obc.status}`,
                (seq += 1)
            )
        )
    }

    if (next.host && previous?.host?.profile !== next.host.profile && next.host.profile) {
        out.push(event(next.host.timestamp, 'info', `profile ${next.host.profile} applied`, (seq += 1)))
    }

    // A profile that applied only partly is the case host_status exists to make
    // visible: `profile` is what was achieved and `profile_requested` what was
    // asked for, and the difference is the whole debugging story of a failed
    // switch.
    if (
        next.host?.profileRequested &&
        next.host.profile != null &&
        next.host.profileRequested !== next.host.profile &&
        previous?.host?.profileRequested !== next.host.profileRequested
    ) {
        out.push(
            event(
                next.host.timestamp,
                'warning',
                `${next.host.profileRequested} applied only partly - still running ${next.host.profile}`,
                (seq += 1)
            )
        )
    }

    const wasRecording = previous?.dhs?.recording ?? false
    if (next.dhs && next.dhs.recording !== wasRecording) {
        out.push(
            event(
                next.dhs.timestamp,
                next.dhs.recording ? 'success' : 'info',
                next.dhs.recording ? `mission ${next.dhs.mission?.id ?? '?'} opened` : 'mission closed',
                (seq += 1)
            )
        )
    }

    if (next.comms && previous?.comms && previous.comms.loraEnabled !== next.comms.loraEnabled) {
        // Quiet is not deaf, and saying which is the point of logging it at all.
        out.push(
            event(
                next.comms.timestamp,
                'info',
                next.comms.loraEnabled
                    ? 'radio transmitting'
                    : next.comms.loraListening
                      ? 'radio silenced - still listening'
                      : 'radio off',
                (seq += 1)
            )
        )
    }

    if (next.comms && previous?.comms && previous.comms.lastUplink !== next.comms.lastUplink) {
        out.push(event(next.comms.timestamp, 'success', 'uplink received', (seq += 1)))
    }

    if (next.payload?.storage?.blocked && !previous?.payload?.storage?.blocked) {
        out.push(
            event(
                next.payload.timestamp,
                'warning',
                `card full - captures refused (${next.payload.storage.freeMb?.toFixed(0) ?? '?'} MB free)`,
                (seq += 1)
            )
        )
    }

    for (const device of ['sensor', 'camera'] as const) {
        const was = previous?.payload?.[device]?.present
        const now = next.payload?.[device]?.present
        if (was != null && now != null && was !== now) {
            out.push(
                event(
                    next.payload?.timestamp ?? 0,
                    now ? 'success' : 'warning',
                    `${device} ${now ? 'answered' : 'went silent'}`,
                    (seq += 1)
                )
            )
        }
    }

    return out
}
