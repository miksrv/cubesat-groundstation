import React, { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'

import type { TelemetryRecord } from '../../features/telemetry/types'

import styles from './EPSPanel.module.scss'

interface Props {
    latest: TelemetryRecord | null
    history: TelemetryRecord[]
    isLoading: boolean
}

const EPSPanel: React.FC<Props> = React.memo(({ latest, history, isLoading }) => {
    const gaugeRef = useRef<HTMLDivElement>(null)
    const lineRef = useRef<HTMLDivElement>(null)
    const gaugeChart = useRef<echarts.ECharts | null>(null)
    const lineChart = useRef<echarts.ECharts | null>(null)

    const showSkeleton = isLoading && !latest

    useEffect(() => {
        if (showSkeleton) return

        if (gaugeRef.current && !gaugeChart.current) {
            gaugeChart.current = echarts.init(gaugeRef.current, 'dark')
        }
        if (lineRef.current && !lineChart.current) {
            lineChart.current = echarts.init(lineRef.current, 'dark')
        }
        const observer = new ResizeObserver(() => {
            gaugeChart.current?.resize()
            lineChart.current?.resize()
        })
        if (gaugeRef.current) {
            observer.observe(gaugeRef.current)
        }
        if (lineRef.current) {
            observer.observe(lineRef.current)
        }
        return () => {
            observer.disconnect()
        }
    }, [showSkeleton])

    useEffect(() => {
        return () => {
            gaugeChart.current?.dispose()
            lineChart.current?.dispose()
        }
    }, [])

    const battery = latest?.battery ?? 0
    const batteryColor = battery > 50 ? '#10b981' : battery > 20 ? '#f59e0b' : '#ef4444'

    const gaugeOption = useMemo(
        () => ({
            backgroundColor: 'transparent',
            series: [
                {
                    type: 'gauge',
                    min: 0,
                    max: 100,
                    axisLine: {
                        lineStyle: {
                            width: 12,
                            color: [
                                [0.2, '#ef4444'],
                                [0.5, '#f59e0b'],
                                [1, '#10b981']
                            ]
                        }
                    },
                    pointer: { itemStyle: { color: batteryColor } },
                    detail: {
                        valueAnimation: true,
                        formatter: '{value}%',
                        color: batteryColor,
                        fontSize: 16
                    },
                    data: [{ value: battery, name: 'Battery' }],
                    title: { offsetCenter: [0, '70%'], color: '#94a3b8', fontSize: 11 }
                }
            ]
        }),
        [battery, batteryColor]
    )

    const lineOption = useMemo(
        () => ({
            backgroundColor: 'transparent',
            grid: { top: 10, right: 8, bottom: 22, left: 38 },
            xAxis: {
                type: 'time',
                axisLabel: { color: '#94a3b8', fontSize: 9 },
                axisLine: { lineStyle: { color: '#2d3548' } }
            },
            yAxis: {
                type: 'value',
                name: 'V',
                nameTextStyle: { color: '#94a3b8', fontSize: 9 },
                axisLabel: { color: '#94a3b8', fontSize: 9 },
                splitLine: { lineStyle: { color: '#2d3548' } }
            },
            series: [
                {
                    type: 'line',
                    data: history.slice(-50).map((r) => [new Date(r.timestamp.replace(' ', 'T')), r.voltage ?? 0]),
                    smooth: true,
                    lineStyle: { color: '#3b82f6' },
                    areaStyle: { color: 'rgba(59,130,246,0.15)' },
                    symbol: 'none'
                }
            ],
            tooltip: { trigger: 'axis' }
        }),
        [history]
    )

    useEffect(() => {
        if (!showSkeleton && gaugeChart.current) {
            gaugeChart.current.setOption(gaugeOption, { notMerge: false })
        }
    }, [gaugeOption, showSkeleton])

    useEffect(() => {
        if (!showSkeleton && lineChart.current) {
            lineChart.current.setOption(lineOption, { notMerge: false })
        }
    }, [lineOption, showSkeleton])

    return (
        <div className={styles.panel}>
            <h3 className={styles.title}>⚡ EPS</h3>
            {showSkeleton && <div className={styles.skeleton} />}
            <div
                ref={gaugeRef}
                className={styles.gauge}
                style={{ display: showSkeleton ? 'none' : 'block' }}
            />
            <div
                ref={lineRef}
                className={styles.chart}
                style={{ display: showSkeleton ? 'none' : 'block' }}
            />
            {!showSkeleton && (
                <div className={styles.info}>
                    <span>
                        Voltage: <b>{latest?.voltage != null ? Number(latest.voltage).toFixed(1) : '—'} V</b>
                    </span>
                    <span className={latest?.external_power ? styles.on : styles.off}>
                        {latest?.external_power ? '🔌 External ON' : '🔋 Battery Only'}
                    </span>
                </div>
            )}
        </div>
    )
})

EPSPanel.displayName = 'EPSPanel'
export default EPSPanel
