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

const buildLines = (r: TelemetryRecord): StreamLine[] => {
    const t = new Date(r.timestamp).toLocaleTimeString(undefined, { hour12: false })
    const rows: Array<[string, string | number | null | undefined]> = [
        ['EPS Battery Voltage', r.voltage != null ? `${r.voltage.toFixed(2)} V` : null],
        ['EPS Battery Level', r.battery != null ? `${r.battery.toFixed(1)}%` : null],
        ['ADCS Roll', r.roll != null ? `${r.roll.toFixed(2)}°` : null],
        ['ADCS Pitch', r.pitch != null ? `${r.pitch.toFixed(2)}°` : null],
        ['OBC CPU Usage', r.cpu_percent != null ? `${r.cpu_percent.toFixed(1)}%` : null],
        ['OBC RAM Usage', r.ram_percent != null ? `${r.ram_percent.toFixed(1)}%` : null],
        ['Comms RSSI', r.rssi != null ? `${r.rssi} dBm` : null],
        ['Packet ID', r.id]
    ]
    return rows
        .filter(([, value]) => value != null)
        .map(([label, value]) => ({ time: t, message: `${label}: ${value}` }))
}

const LiveTelemetryStreamWidget: React.FC<Props> = React.memo(({ latest, isLoading }) => {
    const [lines, setLines] = useState<StreamLine[]>([])
    const [paused, setPaused] = useState(false)
    const lastIdRef = useRef<number | null>(null)
    const bodyRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!latest || paused || latest.id === lastIdRef.current) {
            return
        }
        lastIdRef.current = latest.id
        setLines((prev) => [...prev, ...buildLines(latest)].slice(-MAX_LINES))
    }, [latest, paused])

    useEffect(() => {
        if (bodyRef.current) {
            bodyRef.current.scrollTop = bodyRef.current.scrollHeight
        }
    }, [lines])

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
                <div
                    ref={bodyRef}
                    className={styles.stream}
                >
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
