import React, { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'

import type { TelemetryRecord } from '../../features/telemetry/types'

import styles from './GPSPanel.module.scss'

interface Props {
    latest: TelemetryRecord | null
    history: TelemetryRecord[]
    isLoading: boolean
}

const GPSPanel: React.FC<Props> = React.memo(({ latest, history, isLoading }) => {
    const altRef = useRef<HTMLDivElement>(null)
    const altChart = useRef<echarts.ECharts | null>(null)

    const showSkeleton = isLoading && !latest

    useEffect(() => {
        if (showSkeleton) {
            return
        }

        if (altRef.current && !altChart.current) {
            altChart.current = echarts.init(altRef.current, 'dark')
        }
        const observer = new ResizeObserver(() => altChart.current?.resize())
        if (altRef.current) {
            observer.observe(altRef.current)
        }
        return () => {
            observer.disconnect()
        }
    }, [showSkeleton])

    useEffect(() => {
        return () => {
            altChart.current?.dispose()
        }
    }, [])

    const altOption = useMemo(
        () => ({
            backgroundColor: 'transparent',
            grid: { top: 12, right: 8, bottom: 22, left: 46 },
            xAxis: {
                type: 'time',
                axisLabel: { color: '#94a3b8', fontSize: 9 },
                axisLine: { lineStyle: { color: '#2d3548' } }
            },
            yAxis: {
                type: 'value',
                name: 'km',
                nameTextStyle: { color: '#94a3b8', fontSize: 9 },
                axisLabel: { color: '#94a3b8', fontSize: 9 },
                splitLine: { lineStyle: { color: '#2d3548' } }
            },
            series: [
                {
                    type: 'line',
                    data: history.slice(-50).map((r) => [new Date(r.timestamp), r.altitude ?? 0]),
                    smooth: true,
                    lineStyle: { color: '#10b981' },
                    areaStyle: { color: 'rgba(16,185,129,0.15)' },
                    symbol: 'none'
                }
            ],
            tooltip: { trigger: 'axis' }
        }),
        [history]
    )

    useEffect(() => {
        if (!showSkeleton && altChart.current) {
            altChart.current.setOption(altOption, { notMerge: false })
        }
    }, [altOption, showSkeleton])

    const fmt = (n: number | null | undefined, d = 4) => (n != null ? n.toFixed(d) : '—')

    return (
        <div className={styles.panel}>
            <h3 className={styles.title}>🌍 GPS</h3>
            {showSkeleton && <div className={styles.skeleton} />}
            <div
                className={styles.coords}
                style={{ display: showSkeleton ? 'none' : 'flex' }}
            >
                <div className={styles.coord}>
                    <span>LAT</span>
                    <b>{fmt(latest?.latitude)}°</b>
                </div>
                <div className={styles.coord}>
                    <span>LON</span>
                    <b>{fmt(latest?.longitude)}°</b>
                </div>
                <div className={styles.coord}>
                    <span>ALT</span>
                    <b>{fmt(latest?.altitude, 1)} km</b>
                </div>
            </div>
            <div
                ref={altRef}
                className={styles.chart}
                style={{ display: showSkeleton ? 'none' : 'block' }}
            />
        </div>
    )
})

GPSPanel.displayName = 'GPSPanel'
export default GPSPanel
