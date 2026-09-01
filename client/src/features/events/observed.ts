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

import type { StatusLevel, SubsystemKey } from '../../utils/subsystemStatus'
import { getSubsystemStatuses } from '../../utils/subsystemStatus'
import type { LiveState, PhotoRefusal, RadioEvent } from '../telemetry/types'

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

    for (const alert of subsystemAlerts(previous, next)) {
        out.push(event(alert.at, alert.severity, alert.message, (seq += 1)))
    }

    return out
}

/** The two levels worth alerting on — everything below them is routine. */
const ALERTING: ReadonlySet<StatusLevel> = new Set<StatusLevel>(['WARN', 'FAIL'])

const SEVERITY_BY_LEVEL: Record<StatusLevel, EventSeverity> = {
    FAIL: 'critical',
    WARN: 'warning',
    // Reaching OK out of WARN or FAIL is a recovery, worth a green line.
    OK: 'success',
    // A degraded service going OFF or silent is a profile change or a vanished
    // message, not a new fault — logged so the WARN does not just evaporate,
    // but quietly.
    OFF: 'info',
    UNKNOWN: 'info'
}

/**
 * Subsystem health transitions, judged by the same rules the Subsystem Status
 * widget renders — one verdict, wherever it is shown.
 *
 * Only transitions that touch WARN or FAIL make the log: the panel is called
 * Recent Alerts, and six green "OK" lines on every page load would bury the
 * one line that matters. OBC is skipped here because its degradations *are*
 * mission states, and the state transition above already logs them.
 */
const subsystemAlerts = (
    previous: LiveState | null,
    next: LiveState
): Array<{ at: number; severity: EventSeverity; message: string }> => {
    if (previous == null) {
        // The log starts when the page does: the first snapshot is a fact, not
        // a transition — the widget's own colours already show it.
        return []
    }
    const before = new Map(getSubsystemStatuses(previous).map((status) => [status.key, status.status]))
    const out: Array<{ at: number; severity: EventSeverity; message: string }> = []
    for (const status of getSubsystemStatuses(next)) {
        if (status.key === 'OBC') {
            continue
        }
        const was = before.get(status.key) ?? 'UNKNOWN'
        if (was === status.status || (!ALERTING.has(was) && !ALERTING.has(status.status))) {
            continue
        }
        out.push({
            at: subsystemTimestamp(status.key, next),
            severity: SEVERITY_BY_LEVEL[status.status],
            message: `${status.label} ${status.status} - ${status.detail}`
        })
    }
    return out
}

const subsystemTimestamp = (key: SubsystemKey, next: LiveState): number => {
    const source = {
        OBC: next.obc,
        EPS: next.eps,
        ADCS: next.adcs,
        PAYLOAD: next.payload,
        DHS: next.dhs,
        COMMS: next.comms
    }[key]
    return source?.timestamp ?? next.obc?.timestamp ?? 0
}

/**
 * The alert hiding in the radio stream: a transmission that never left the
 * radio. The Radio Link Log paints that row red, and a red row that scrolls
 * out of a bounded table without a trace in Recent Alerts is a fault the
 * operator can miss by looking away. Everything else in the stream is routine
 * traffic — received commands already surface as "uplink received".
 */
export const radioAlert = (radio: RadioEvent, seq: number): ObservedEvent | null => {
    if (radio.direction !== 'tx' || radio.sent !== false) {
        return null
    }
    return event(radio.timestamp, 'warning', `radio transmit failed${radio.kind ? ` (${radio.kind})` : ''}`, seq)
}

/**
 * The other alert that lives in a stream rather than in state: the camera
 * refusing a command. A refusal is one unretained message on
 * `cubesat/payload/photo` — the button press it answers otherwise produces
 * nothing visible at all, which reads as a dead camera rather than a
 * deliberate no.
 */
export const photoRefusalAlert = (refusal: PhotoRefusal, seq: number): ObservedEvent =>
    event(refusal.timestamp, 'warning', `capture refused - ${refusal.reason ?? 'no reason given'}`, seq)
