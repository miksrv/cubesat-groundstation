import React, { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { TelemetryRecord } from '../../features/telemetry/types'
import { chartColors } from '../../styles/chartColors'
import { createChartTooltip, valueFormatters } from '../../styles/chartTooltip'

import styles from './ADCSPanel.module.scss'

interface Props {
    latest: TelemetryRecord | null
    history: TelemetryRecord[]
    isLoading: boolean
}

const ADCSPanel: React.FC<Props> = React.memo(({ latest, history, isLoading }) => {
    const gyroRef = useRef<HTMLDivElement>(null)
    const gyroChart = useRef<echarts.ECharts | null>(null)

    const showSkeleton = isLoading && !latest

    useEffect(() => {
        if (showSkeleton) {
            return
        }

        if (gyroRef.current && !gyroChart.current) {
            gyroChart.current = echarts.init(gyroRef.current, 'dark')
        }
        const observer = new ResizeObserver(() => gyroChart.current?.resize())
        if (gyroRef.current) {
            observer.observe(gyroRef.current)
        }
        return () => {
            observer.disconnect()
        }
    }, [showSkeleton])

    useEffect(() => {
        return () => {
            gyroChart.current?.dispose()
        }
    }, [])

    const gyroOption = useMemo(() => {
        const recent = history.slice(-50)
        return {
            backgroundColor: 'transparent',
            legend: {
                type: 'plain',
                orient: 'horizontal',
                itemWidth: 20,
                itemHeight: 2,
                textStyle: { color: '#3a3a3a', fontSize: 9 },
                top: 0
            },
            grid: { top: 28, right: 8, bottom: 22, left: 42 },
            xAxis: {
                type: 'time',
                axisLabel: { color: '#3a3a3a', fontSize: 9 },
                axisLine: { lineStyle: { color: '#2d3548' } },
                scale: true
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: '#3a3a3a', fontSize: 9 },
                splitLine: { lineStyle: { color: '#2d3548' } }
            },
            series: [
                {
                    name: 'Gyro X',
                    type: 'line',
                    data: recent.map((r) => [new Date(r.timestamp), r.gyro_x ?? 0]),
                    lineStyle: { color: chartColors.red[0], width: 1 },
                    itemStyle: { color: chartColors.red[0] },
                    symbol: 'none',
                    smooth: true
                },
                {
                    name: 'Gyro Y',
                    type: 'line',
                    data: recent.map((r) => [new Date(r.timestamp), r.gyro_y ?? 0]),
                    lineStyle: { color: chartColors.green[0], width: 1 },
                    itemStyle: { color: chartColors.green[0] },
                    symbol: 'none',
                    smooth: true
                },
                {
                    name: 'Gyro Z',
                    type: 'line',
                    data: recent.map((r) => [new Date(r.timestamp), r.gyro_z ?? 0]),
                    lineStyle: { color: chartColors.blue[0], width: 1 },
                    itemStyle: { color: chartColors.blue[0] },
                    symbol: 'none',
                    smooth: true
                }
            ],
            tooltip: createChartTooltip({
                dateFormat: 'full',
                valueFormatter: (v) => valueFormatters.degrees(v)
            })
        }
    }, [history])

    useEffect(() => {
        if (!showSkeleton && gyroChart.current) {
            gyroChart.current.setOption(gyroOption, { notMerge: false })
        }
    }, [gyroOption, showSkeleton])

    return (
        <Container
            title='ADCS — Attitude'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '200px', width: '100%' }} />}
            <div
                className={styles.orientation}
                style={{ display: showSkeleton ? 'none' : 'flex' }}
            >
                {(
                    [
                        ['Roll', latest?.roll],
                        ['Pitch', latest?.pitch],
                        ['Yaw', latest?.yaw]
                    ] as Array<[string, number | null | undefined]>
                ).map(([label, val]) => (
                    <div
                        key={label}
                        className={styles.metric}
                    >
                        <span className={styles.label}>{label}</span>
                        <span className={styles.value}>{val != null ? val.toFixed(1) : '—'}°</span>
                    </div>
                ))}
            </div>
            <div
                ref={gyroRef}
                className={styles.chart}
                style={{ display: showSkeleton ? 'none' : 'block' }}
            />
            {!showSkeleton && (
                <div className={styles.imuTemp}>
                    IMU Temp: <b>{latest?.imu_temp != null ? latest.imu_temp.toFixed(1) : '—'}°C</b>
                </div>
            )}
        </Container>
    )
})

ADCSPanel.displayName = 'ADCSPanel'
export default ADCSPanel
