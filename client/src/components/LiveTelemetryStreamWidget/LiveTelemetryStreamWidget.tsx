import React, { useEffect, useRef, useState } from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { TelemetryRecord } from '../../features/telemetry/types'

import styles from './LiveTelemetryStreamWidget.module.scss'

interface Props {
    latest: TelemetryRecord | null
    isLoading: boolean
}

const MAX_LINES = 200

interface StreamLine {
    time: string
    message: string
}

/**
 * A row of `telemetry`, printed. The old version had a `Comms RSSI` line —
 * nothing on this satellite measures signal strength as telemetry, so it is
 * gone rather than dashed out; what the radio does report is on the link panel.
 *
 * **Newest first, and that is a change made deliberately on 2026-09-01.** This
 * panel used to append at the bottom and auto-scroll, the console idiom — while
 * `Mission Events` and `Radio Link Log` beside it both prepend. Three logs on
 * one page reading in two directions is a trap for whoever is watching, and the
 * page is not a terminal: every widget here is a fixed-height box, so the newest
 * line has to be the one that needs no scrolling to see. The one real terminal
 * on the page, `Mission Console`, keeps bottom-append — it has a prompt at the
 * bottom, and typing into a box that grows upwards is a different mistake.
 *
 * A tick's worth of fields keeps its own order inside the block that is
 * inserted: newest *block* on top, but battery still above CPU inside it.
 * Reversing the fields as well would put "Row ID" first, which is nobody's
 * reading order.
 */
const buildLines = (r: TelemetryRecord): StreamLine[] => {
    const t = new Date(r.timestamp).toLocaleTimeString(undefined, { hour12: false })
    const rows: Array<[string, string | number | null | undefined]> = [
        ['EPS Battery Voltage', r.voltage != null ? `${r.voltage.toFixed(3)} V` : null],
        ['EPS Battery Level', r.battery != null ? `${r.battery.toFixed(1)}%` : null],
        ['ADCS Roll', r.roll != null ? `${r.roll.toFixed(2)}°` : null],
        ['ADCS Pitch', r.pitch != null ? `${r.pitch.toFixed(2)}°` : null],
        ['ADCS Fix', r.gnss.fix === true ? `${r.gnss.satellites ?? 0} satellites` : 'none'],
        ['OBC CPU Usage', r.cpuPercent != null ? `${r.cpuPercent.toFixed(1)}%` : null],
        ['OBC RAM Usage', r.ramPercent != null ? `${r.ramPercent.toFixed(1)}%` : null],
        ['OBC State', r.obcState],
        ['Row ID', r.id]
    ]
    return rows
        .filter(([, value]) => value != null)
        .map(([label, value]) => ({ time: t, message: `${label}: ${value}` }))
}

const LiveTelemetryStreamWidget: React.FC<Props> = React.memo(({ latest, isLoading }) => {
    const [lines, setLines] = useState<StreamLine[]>([])
    const [paused, setPaused] = useState(false)
    const lastIdRef = useRef<number | null>(null)

    useEffect(() => {
        if (!latest || paused || latest.id === lastIdRef.current) {
            return
        }
        lastIdRef.current = latest.id
        // The newest tick on top, trimmed from the tail — the oldest lines are
        // the ones to lose.
        setLines((prev) => [...buildLines(latest), ...prev].slice(0, MAX_LINES))
    }, [latest, paused])

    const showSkeleton = isLoading && lines.length === 0

    return (
        <Container
            title='Live Telemetry Stream'
            className={styles.panel}
            action={
                !showSkeleton && (
                    <button
                        type='button'
                        className={styles.pauseButton}
                        onClick={() => setPaused((p) => !p)}
                    >
                        {paused ? 'RESUME' : 'PAUSE'}
                    </button>
                )
            }
        >
            {showSkeleton && <Skeleton style={{ height: '220px', width: '100%' }} />}
            {!showSkeleton && (
                <div className={styles.stream}>
                    {lines.length === 0 && <div className={styles.empty}>Waiting for telemetry…</div>}
                    {lines.map((line, idx) => (
                        <div
                            key={idx}
                            className={styles.line}
                        >
                            <span className={styles.time}>{line.time}</span> {line.message}
                        </div>
                    ))}
                </div>
            )}
        </Container>
    )
})

LiveTelemetryStreamWidget.displayName = 'LiveTelemetryStreamWidget'
export default LiveTelemetryStreamWidget
