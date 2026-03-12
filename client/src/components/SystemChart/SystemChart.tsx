import React, { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'

import type { TelemetryRecord } from '../../features/telemetry/types'

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
        if (showSkeleton) return

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
            data: r.map((d) => [new Date(d.timestamp.replace(' ', 'T')), (d[key] as number | null) ?? 0]),
            areaStyle: { color: `${color}40` },
            lineStyle: { color },
            symbol: 'none',
            smooth: true
        })

        return {
            backgroundColor: 'transparent',
            legend: {
                data: ['CPU%', 'RAM%', 'Swap%', 'Disk%'],
                textStyle: { color: '#94a3b8', fontSize: 9 },
                top: 0
            },
            grid: { top: 32, right: 8, bottom: 28, left: 38 },
            xAxis: {
                type: 'time',
                axisLabel: { color: '#94a3b8', fontSize: 9 },
                axisLine: { lineStyle: { color: '#2d3548' } }
            },
            yAxis: {
                type: 'value',
                max: 100,
                axisLabel: {
                    color: '#94a3b8',
                    fontSize: 9,
                    formatter: '{value}%'
                },
                splitLine: { lineStyle: { color: '#2d3548' } }
            },
            series: [
                mkSeries('CPU%', 'cpu_percent', '#ef4444'),
                mkSeries('RAM%', 'ram_percent', '#3b82f6'),
                mkSeries('Swap%', 'swap_percent', '#f59e0b'),
                mkSeries('Disk%', 'disk_percent', '#10b981')
            ],
            tooltip: { trigger: 'axis' }
        }
    }, [history])

    useEffect(() => {
        if (!showSkeleton && chart.current) {
            chart.current.setOption(option, { notMerge: false })
        }
    }, [option, showSkeleton])

    return (
        <div className={styles.panel}>
            <h3 className={styles.title}>💻 System</h3>
            {showSkeleton && <div className={styles.skeleton} />}
            <div
                ref={chartRef}
                className={styles.chart}
                style={{ display: showSkeleton ? 'none' : 'block' }}
            />
            <div className={styles.meta}>
                <span>
                    CPU Temp:{' '}
                    <b>{latest?.cpu_temperature != null ? Number(latest.cpu_temperature).toFixed(1) : '—'}°C</b>
                </span>
                <span>
                    Uptime: <b>{fmtUptime(latest?.uptime_seconds)}</b>
                </span>
            </div>
        </div>
    )
})

SystemChart.displayName = 'SystemChart'
export default SystemChart
