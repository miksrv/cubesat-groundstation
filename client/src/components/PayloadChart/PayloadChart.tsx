import React, { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { TelemetryRecord } from '../../features/telemetry/types'
import { chartColors } from '../../styles/chartColors'
import { createChartTooltip } from '../../styles/chartTooltip'

import styles from './PayloadChart.module.scss'

interface Props {
    history: TelemetryRecord[]
    isLoading: boolean
}

const PayloadChart: React.FC<Props> = React.memo(({ history, isLoading }) => {
    const chartRef = useRef<HTMLDivElement>(null)
    const chart = useRef<echarts.ECharts | null>(null)

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
        return {
            backgroundColor: 'transparent',
            legend: {
                type: 'plain',
                orient: 'horizontal',
                itemWidth: 20,
                itemHeight: 2,
                textStyle: { color: '#94a3b8', fontSize: 12 },
                top: 0
            },
            grid: { top: 32, right: 55, bottom: 28, left: 45 },
            xAxis: {
                type: 'time',
                axisLabel: { color: '#94a3b8', fontSize: 10 },
                axisLine: { lineStyle: { color: '#2d3548' } }
            },
            yAxis: [
                {
                    type: 'value',
                    name: '°C / %',
                    nameTextStyle: { color: chartColors.red[0], fontSize: 10 },
                    axisLabel: { color: chartColors.red[0], fontSize: 10 },
                    splitLine: { lineStyle: { color: '#2d3548' } },
                    scale: true
                },
                {
                    type: 'value',
                    name: 'hPa',
                    nameTextStyle: { color: chartColors.purple[0], fontSize: 10 },
                    axisLabel: { color: chartColors.purple[0], fontSize: 10 },
                    splitLine: { show: false },
                    scale: true
                }
            ],
            series: [
                {
                    name: 'Temp (°C)',
                    type: 'line',
                    data: r.map((d) => [new Date(d.timestamp), d.temperature ?? 0]),
                    lineStyle: { color: chartColors.red[0], width: 1 },
                    itemStyle: { color: chartColors.red[0] },
                    symbol: 'none',
                    smooth: true
                },
                {
                    name: 'Humidity (%)',
                    type: 'line',
                    data: r.map((d) => [new Date(d.timestamp), d.humidity ?? 0]),
                    lineStyle: { color: chartColors.stellar[0], width: 1 },
                    itemStyle: { color: chartColors.stellar[0] },
                    symbol: 'none',
                    smooth: true
                },
                {
                    name: 'Pressure (hPa)',
                    type: 'line',
                    yAxisIndex: 1,
                    data: r.map((d) => [new Date(d.timestamp), d.pressure ?? 0]),
                    lineStyle: { color: chartColors.purple[0], width: 1 },
                    itemStyle: { color: chartColors.purple[0] },
                    symbol: 'none',
                    smooth: true
                }
            ],
            tooltip: createChartTooltip({
                dateFormat: 'full',
                valueFormatter: (v, name) => {
                    if (v == null) {
                        return '—'
                    }
                    if (name.includes('Temp')) {
                        return `${v.toFixed(1)}°C`
                    }
                    if (name.includes('Humidity')) {
                        return `${v.toFixed(1)}%`
                    }
                    if (name.includes('Pressure')) {
                        return `${v.toFixed(1)} hPa`
                    }
                    return v.toFixed(2)
                }
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
            title='🌡 Payload'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '200px', width: '100%' }} />}
            <div
                ref={chartRef}
                className={styles.chart}
                style={{ display: showSkeleton ? 'none' : 'block' }}
            />
        </Container>
    )
})

PayloadChart.displayName = 'PayloadChart'
export default PayloadChart
