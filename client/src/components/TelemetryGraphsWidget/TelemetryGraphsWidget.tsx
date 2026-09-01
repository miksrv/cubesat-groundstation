import React, { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { TelemetryRecord } from '../../features/telemetry/types'
import { chartColors } from '../../styles/chartColors'
import { createChartTooltip, valueFormatters } from '../../styles/chartTooltip'

import styles from './TelemetryGraphsWidget.module.scss'

interface Props {
    history: TelemetryRecord[]
    isLoading: boolean
}

interface MiniChartProps {
    title: string
    color: string
    /** Chronological, and honestly gappy: a null is a reading the satellite
     *  withheld, drawn as a break in the line rather than a dive to zero. */
    data: Array<[Date, number | null]>
    valueFormatter: (v: number | null) => string
}

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/**
 * Four charts share the card's width, so each one gets barely 200 px of axis —
 * room for three or four labels, not for one per sample. How much of a
 * timestamp is worth printing depends on how wide the window is: seconds carry
 * the information on a walk that spans minutes, and are noise once the mission
 * is long enough that the hour is what distinguishes two points.
 */
const axisTimeFormat = (data: Array<[Date, number | null]>): string => {
    if (data.length < 2) {
        return '{HH}:{mm}:{ss}'
    }
    const span = data[data.length - 1][0].getTime() - data[0][0].getTime()
    if (span < 10 * MINUTE) {
        return '{HH}:{mm}:{ss}'
    }
    if (span < DAY) {
        return '{HH}:{mm}'
    }
    return '{dd}.{MM}\n{HH}:{mm}'
}

const MiniChart: React.FC<MiniChartProps> = React.memo(({ title, color, data, valueFormatter }) => {
    const ref = useRef<HTMLDivElement>(null)
    const chart = useRef<echarts.ECharts | null>(null)

    useEffect(() => {
        if (ref.current && !chart.current) {
            chart.current = echarts.init(ref.current, 'dark')
        }
        const observer = new ResizeObserver(() => chart.current?.resize())
        if (ref.current) {
            observer.observe(ref.current)
        }
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        return () => {
            chart.current?.dispose()
            chart.current = null
        }
    }, [])

    const timeFormat = useMemo(() => axisTimeFormat(data), [data])

    const option = useMemo(() => {
        const twoLineLabels = timeFormat.includes('\n')

        return {
            backgroundColor: 'transparent',
            // Room on the right for the last label's second half, and a taller
            // gutter when the format wraps onto a date line.
            grid: { top: 8, right: 14, bottom: twoLineLabels ? 30 : 20, left: 34 },
            xAxis: {
                type: 'time',
                // `splitNumber` asks for few ticks; `hideOverlap` is what
                // actually guarantees it, dropping any label that would collide
                // with one already drawn instead of stacking them into a smear.
                splitNumber: 3,
                axisLabel: {
                    color: '#3a3a3a',
                    fontSize: 9,
                    hideOverlap: true,
                    formatter: timeFormat
                },
                axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)', width: 1 } }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: '#3a3a3a', fontSize: 9 },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)', width: 1 } },
                scale: true
            },
            series: [
                {
                    // The tooltip prints `seriesName`; without one ECharts
                    // invents "series0" and every chart's tooltip claims to be
                    // the same nameless line.
                    name: title,
                    type: 'line',
                    data,
                    smooth: true,
                    lineStyle: { color, width: 1 },
                    itemStyle: { color },
                    areaStyle: { color: `${color}26` },
                    symbol: 'none'
                }
            ],
            tooltip: createChartTooltip({ dateFormat: 'full', valueFormatter: (v) => valueFormatter(v) })
        }
    }, [data, title, color, valueFormatter, timeFormat])

    useEffect(() => {
        chart.current?.setOption(option, { notMerge: false })
    }, [option])

    const latestValue = data.length > 0 ? data[data.length - 1][1] : null

    return (
        <div className={styles.miniChart}>
            <div className={styles.miniHeader}>
                <span className={styles.miniTitle}>{title}</span>
                <span
                    className={styles.miniValue}
                    style={{ color }}
                >
                    {valueFormatter(latestValue)}
                </span>
            </div>
            <div
                ref={ref}
                className={styles.miniCanvas}
            />
        </div>
    )
})
MiniChart.displayName = 'MiniChart'

const TelemetryGraphsWidget: React.FC<Props> = React.memo(({ history, isLoading }) => {
    const showSkeleton = isLoading && history.length === 0

    // The source hands history newest-first; the charts want the newest 50 in
    // chronological order. `slice(-50)` here once charted the *oldest* rows of
    // the window while claiming to be live.
    const recent = useMemo(() => history.slice(0, 50).reverse(), [history])

    const series = useMemo(
        () => ({
            // Nulls stay nulls: `?? 0` would draw a withheld reading as a dive
            // to zero — a battery "at 0 %" that was never measured. ECharts
            // breaks the line at a null, which is what a gap in the data is.
            voltage: recent.map((r) => [new Date(r.timestamp), r.voltage] as [Date, number | null]),
            temperature: recent.map((r) => [new Date(r.timestamp), r.temperature] as [Date, number | null]),
            // RSSI used to be charted here. Nothing on this satellite measures
            // signal strength as telemetry — Meshtastic reports SNR on a message
            // that has already arrived, and nothing else. Battery charge is a real
            // series and the one an operator actually watches on a walk.
            battery: recent.map((r) => [new Date(r.timestamp), r.battery] as [Date, number | null]),
            cpu: recent.map((r) => [new Date(r.timestamp), r.cpuPercent] as [Date, number | null])
        }),
        [recent]
    )

    return (
        <Container
            title='Telemetry Graphs'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '260px', width: '100%' }} />}
            {!showSkeleton && (
                <div className={styles.grid}>
                    <MiniChart
                        title='Battery Voltage'
                        color={chartColors.blue[0]}
                        data={series.voltage}
                        valueFormatter={valueFormatters.voltage}
                    />
                    {/* Three thermometers fly on this satellite — the SoC die, the
                        BNO055's die and the SEN0501's air reading. `temperature` is
                        the last of those, and an unqualified "Temperature" left the
                        chart claiming all three. */}
                    <MiniChart
                        title='Temperature (SEN0501)'
                        color={chartColors.orange[0]}
                        data={series.temperature}
                        valueFormatter={valueFormatters.temperature}
                    />
                    <MiniChart
                        title='Battery'
                        color={chartColors.green[0]}
                        data={series.battery}
                        valueFormatter={valueFormatters.battery}
                    />
                    <MiniChart
                        title='CPU Usage'
                        color={chartColors.red[0]}
                        data={series.cpu}
                        valueFormatter={valueFormatters.percent}
                    />
                </div>
            )}
        </Container>
    )
})

TelemetryGraphsWidget.displayName = 'TelemetryGraphsWidget'
export default TelemetryGraphsWidget
