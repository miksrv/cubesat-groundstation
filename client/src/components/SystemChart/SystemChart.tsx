import React, { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { TelemetryRecord } from '../../features/telemetry/types'
import { chartColors } from '../../styles/chartColors'
import { createChartTooltip, valueFormatters } from '../../styles/chartTooltip'

import styles from './SystemChart.module.scss'

interface Props {
    history: TelemetryRecord[]
    isLoading: boolean
}

const fmtUptime = (s: number | null | undefined): string => {
    if (!s) {
        return '—'
    }
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    return `${d}d ${h}h ${m}m`
}

const SystemChart: React.FC<Props> = React.memo(({ history, isLoading }) => {
    const chartRef = useRef<HTMLDivElement>(null)
    const chart = useRef<echarts.ECharts | null>(null)

    const latest = history.length > 0 ? history[history.length - 1] : null
    const showSkeleton = isLoading && history.length === 0

    useEffect(() => {
        if (showSkeleton) {
            return
        }

        if (chartRef.current && !chart.current) {
            chart.current = echarts.init(chartRef.current, 'dark')
        }
        const observer = new ResizeObserver(() => chart.current?.resize())
        if (chartRef.current) {
            observer.observe(chartRef.current)
        }
        return () => {
            observer.disconnect()
        }
    }, [showSkeleton])

    useEffect(() => {
        return () => {
            chart.current?.dispose()
        }
    }, [])

    const option = useMemo(() => {
        const r = history.slice(-100)

        const mkSeries = (name: string, key: keyof TelemetryRecord, color: string) => ({
            name,
            type: 'line',
            stack: 'total',
            data: r.map((d) => [new Date(d.timestamp), (d[key] as number | null) ?? 0]),
            areaStyle: { color: `${color}40` },
            lineStyle: { color, width: 1 },
            itemStyle: { color },
            symbol: 'none',
            smooth: true
        })

        return {
            backgroundColor: 'transparent',
            legend: {
                type: 'plain',
                orient: 'horizontal',
                textStyle: { color: '#94a3b8', fontSize: 12 },
                itemWidth: 20,
                itemHeight: 2,
                top: 0,
                icon: 'rect'
            },
            grid: { top: 32, right: 8, bottom: 28, left: 38 },
            xAxis: {
                type: 'time',
                axisLabel: { color: '#94a3b8', fontSize: 12 },
                axisLine: { lineStyle: { color: '#2d3548' } }
            },
            yAxis: {
                type: 'value',
                max: 100,
                axisLabel: {
                    color: '#94a3b8',
                    fontSize: 12,
                    formatter: '{value}%'
                },
                splitLine: { lineStyle: { color: '#2d3548' } }
            },
            series: [
                mkSeries('CPU', 'cpu_percent', chartColors.red[0]),
                mkSeries('RAM', 'ram_percent', chartColors.blue[0]),
                mkSeries('Swap', 'swap_percent', chartColors.orange[0]),
                mkSeries('Disk', 'disk_percent', chartColors.green[0])
            ],
            tooltip: createChartTooltip({
                dateFormat: 'full',
                valueFormatter: (v) => valueFormatters.percent(v)
            })
        }
    }, [history])

    useEffect(() => {
        if (!showSkeleton && chart.current) {
            chart.current.setOption(option, { notMerge: false })
        }
    }, [option, showSkeleton])

    return (
        <Container
            title='System — Resources'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '200px', width: '100%' }} />}
            <div
                ref={chartRef}
                className={styles.chart}
                style={{ display: showSkeleton ? 'none' : 'block' }}
            />
            <div className={styles.meta}>
                <span>
                    CPU Temp: <b>{latest?.cpu_temperature != null ? latest.cpu_temperature.toFixed(1) : '—'}°C</b>
                </span>
                <span>
                    Uptime: <b>{fmtUptime(latest?.uptime_seconds)}</b>
                </span>
            </div>
        </Container>
    )
})

SystemChart.displayName = 'SystemChart'
export default SystemChart
