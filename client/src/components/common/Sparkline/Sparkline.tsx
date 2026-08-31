import React, { useMemo } from 'react'

import styles from './Sparkline.module.scss'

interface Props {
    /**
     * Chronological, oldest first. A null is a reading the satellite withheld
     * and renders as a **gap** in the line, never a plunge — the same rule the
     * full-size charts follow.
     */
    values: Array<number | null>
    /** The series' own hue — the same one it wears in the full-size charts. */
    color: string
}

const WIDTH = 100
const HEIGHT = 28
/** Keeps the stroke's extremes inside the viewBox. */
const PAD = 2

/** The same wash Telemetry Graphs puts under its lines (`${color}26` ≈ 15 %). */
const AREA_OPACITY = 0.15

interface Point {
    x: number
    y: number
}

/**
 * A trend, not a chart: one line over its area wash, no axes, no numbers. The
 * current value sits in the rows above it and the readable history lives in
 * Telemetry Graphs — this only answers "which way has it been going" at a
 * glance, so anything more (ticks, tooltips, a scale) would duplicate those.
 */
const Sparkline: React.FC<Props> = ({ values, color }) => {
    const paths = useMemo(() => {
        const finite = values.filter((v): v is number => v != null && Number.isFinite(v))
        if (finite.length < 2 || values.length < 2) {
            return null
        }
        const min = Math.min(...finite)
        const max = Math.max(...finite)
        const span = max - min
        // A flat series draws a centred line rather than dividing by zero.
        const y = (v: number): number =>
            span === 0 ? HEIGHT / 2 : HEIGHT - PAD - ((v - min) / span) * (HEIGHT - 2 * PAD)
        const step = WIDTH / (values.length - 1)

        // Consecutive non-null runs: each is one stroke segment and one closed
        // area polygon, so a gap stays a gap in the wash too.
        const runs: Point[][] = []
        let run: Point[] = []
        values.forEach((v, i) => {
            if (v == null || !Number.isFinite(v)) {
                if (run.length > 0) {
                    runs.push(run)
                    run = []
                }
                return
            }
            run.push({ x: i * step, y: y(v) })
        })
        if (run.length > 0) {
            runs.push(run)
        }
        const drawable = runs.filter((r) => r.length >= 2)
        if (drawable.length === 0) {
            return null
        }

        const line = drawable
            .map((r) => r.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(''))
            .join('')
        const area = drawable
            .map((r) => {
                const outline = r.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('')
                const first = r[0]
                const last = r[r.length - 1]
                return `${outline}L${last.x.toFixed(2)},${HEIGHT}L${first.x.toFixed(2)},${HEIGHT}Z`
            })
            .join('')
        return { line, area }
    }, [values])

    if (paths == null) {
        return null
    }

    return (
        <svg
            className={styles.sparkline}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio='none'
            aria-hidden='true'
            data-testid='sparkline'
        >
            <path
                d={paths.area}
                fill={color}
                fillOpacity={AREA_OPACITY}
                stroke='none'
            />
            <path
                data-testid='sparkline-line'
                d={paths.line}
                fill='none'
                stroke={color}
                strokeWidth={1.5}
                strokeLinejoin='round'
                strokeLinecap='round'
                // The viewBox stretches to the card; the stroke must not.
                vectorEffect='non-scaling-stroke'
            />
        </svg>
    )
}

export default Sparkline
