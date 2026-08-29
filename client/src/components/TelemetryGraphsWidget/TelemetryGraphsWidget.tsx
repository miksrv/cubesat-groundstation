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
    data: Array<[Date, number]>
    valueFormatter: (v: number | null) => string
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

    const option = useMemo(
        () => ({
            backgroundColor: 'transparent',
            grid: { top: 8, right: 8, bottom: 20, left: 34 },
            xAxis: {
                type: 'time',
                axisLabel: { color: '#3a3a3a', fontSize: 9 },
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
        }),
        [data, color, valueFormatter]
    )

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

    const recent = useMemo(() => history.slice(-50), [history])

    const series = useMemo(
        () => ({
            voltage: recent.map((r) => [new Date(r.timestamp), r.voltage ?? 0] as [Date, number]),
            temperature: recent.map((r) => [new Date(r.timestamp), r.temperature ?? 0] as [Date, number]),
            // RSSI used to be charted here. Nothing on this satellite measures
            // signal strength as telemetry — Meshtastic reports SNR on a message
            // that has already arrived, and nothing else. Battery charge is a real
            // series and the one an operator actually watches on a walk.
            battery: recent.map((r) => [new Date(r.timestamp), r.battery ?? 0] as [Date, number]),
            cpu: recent.map((r) => [new Date(r.timestamp), r.cpuPercent ?? 0] as [Date, number])
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
                    <MiniChart
                        title='Temperature'
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
