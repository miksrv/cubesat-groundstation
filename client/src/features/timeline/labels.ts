/**
 * How a mission and a playhead are written out for a human.
 *
 * One home for these because two things now render the same facts: the timeline
 * bar, which shows the mission being replayed, and the archive dialog, which
 * shows every mission there is. A second copy of `durationLabel` is a second
 * place for "running" to become "in progress" in one of them only.
 *
 * Everything here keeps the project's rule about withheld values: a null stays
 * null and comes back as null, never as a zero or a dash invented at this
 * layer. The caller decides what an absent value looks like, because only the
 * caller knows whether there is room to explain it.
 */

import type { MissionSummary } from '../telemetry/types'

const pad = (n: number): string => n.toString().padStart(2, '0')

/** Mission-relative time: `T+MM:SS`, growing hours only when a mission has
 *  them — a 50-minute walk should not read `T+00:50:00`. */
export const missionTime = (seconds: number): string => {
    const whole = Math.max(0, Math.floor(seconds))
    const hours = Math.floor(whole / 3600)
    const minutes = Math.floor((whole % 3600) / 60)
    const rest = whole % 60
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`
}

export const utcClock = (epoch: number): string => {
    const date = new Date(epoch * 1000)
    return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`
}

export const startedAtLabel = (iso: string): string => iso.replace('T', ' ').replace('Z', ' UTC')

export const durationLabel = (mission: MissionSummary): string | null => {
    if (!mission.endedAt) {
        return 'running'
    }
    const seconds = (Date.parse(mission.endedAt) - Date.parse(mission.startedAt)) / 1000
    return Number.isFinite(seconds) ? missionTime(seconds) : null
}

/** Null stays null: a mission with no fix walked no measurable distance, and
 *  the satellite says so by withholding the number rather than writing 0. */
export const distanceLabel = (metres: number | null): string | null => {
    if (metres == null) {
        return null
    }
    return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres.toFixed(0)} m`
}

/** `end_reason` as the recorder wrote it, spaced for reading. `interrupted`
 *  is the one worth noticing before pressing play: power was lost mid-mission
 *  and the closing timestamp is the last row's, not a shutdown's. */
export const endReasonLabel = (reason: string | null): string | null => reason?.replace(/_/g, ' ') ?? null
