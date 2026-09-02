import React, { useMemo } from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { AdcsStatus, ScienceData, TelemetryRecord } from '../../features/telemetry/types'
import { chartColors } from '../../styles/chartColors'
import type { StatusLevel } from '../../utils/subsystemStatus'
import Sparkline from '../common/Sparkline/Sparkline'
import StatRow from '../common/StatRow/StatRow'
import StatusBadge from '../common/StatusBadge/StatusBadge'

import styles from './ThermalSystemWidget.module.scss'

/** The window the SoC-temperature sparkline draws — same as Telemetry Graphs. */
const SPARK_ROWS = 50

interface Props {
    /** The newest recorded row — the Pi's own SoC temperature lives only there. */
    latest: TelemetryRecord | null
    /** Recorded rows, newest first, for the SoC-temperature trend. */
    history: TelemetryRecord[]
    adcs: AdcsStatus | null
    science: ScienceData | null
    isLoading: boolean
}

const fmt = (v: number | null | undefined): string => (v != null ? `${v.toFixed(1)}°C` : '—')

/**
 * Thresholds for the Raspberry Pi's SoC, which is the only one of these three
 * that can actually get into trouble: it throttles at 80 °C and the others are
 * ambient readings.
 */
const getThermalStatus = (cpu: number | null): StatusLevel => {
    if (cpu == null) {
        return 'UNKNOWN'
    }
    if (cpu > 80) {
        return 'FAIL'
    }
    if (cpu > 70) {
        return 'WARN'
    }
    return 'OK'
}

/**
 * Four per-subsystem temperatures used to be shown here — OBC, EPS, battery and
 * payload. **This satellite has three thermometers, not four, and none of them
 * is on a subsystem board.** The SoC reports its own die temperature, the
 * BNO055 reports its, and the SEN0501 measures the air. Rows for the others
 * were four plausible numbers with nothing behind them.
 */
const ThermalSystemWidget: React.FC<Props> = React.memo(({ latest, history, adcs, science, isLoading }) => {
    const showSkeleton = isLoading && !latest && !adcs && !science
    const cpu = latest?.cpuTemperature ?? null
    const status = getThermalStatus(cpu)
    const cpuTrend = useMemo(
        () =>
            history
                .slice(0, SPARK_ROWS)
                .reverse()
                .map((row) => row.cpuTemperature),
        [history]
    )

    return (
        <Container
            title='Temperatures'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '180px', width: '100%' }} />}
            {!showSkeleton && (
                <div className={styles.body}>
                    <StatRow
                        label='CPU (SoC die)'
                        value={fmt(cpu)}
                        mono
                        accent={status === 'FAIL' ? 'red' : status === 'WARN' ? 'orange' : 'default'}
                    />
                    <StatRow
                        label='IMU (BNO055 die)'
                        value={fmt(adcs?.imuTemp)}
                        mono
                    />
                    <StatRow
                        label='Ambient (SEN0501)'
                        value={fmt(science?.temperature)}
                        mono
                    />
                    <StatRow
                        label='Humidity'
                        value={science?.humidity != null ? `${science.humidity.toFixed(1)} %` : '—'}
                        mono
                    />
                    <StatRow
                        label='Pressure'
                        value={science?.pressure != null ? `${science.pressure.toFixed(1)} hPa` : '—'}
                        mono
                    />
                    {/* Cyan, deliberately not orange or red: in this card those
                        are the WARN/FAIL accents, and a trend line wearing a
                        status colour would read as an alarm that is not there. */}
                    <div className={styles.trend}>
                        <Sparkline
                            values={cpuTrend}
                            color={chartColors.cyan[0]}
                        />
                    </div>
                    <div className={styles.footer}>
                        <span className={styles.footerLabel}>
                            {cpu != null ? 'SoC throttles at 80°C' : 'no recorded row yet'}
                        </span>
                        <StatusBadge
                            status={status}
                            label={status === 'OK' ? 'NOMINAL' : undefined}
                        />
                    </div>
                </div>
            )}
        </Container>
    )
})

ThermalSystemWidget.displayName = 'ThermalSystemWidget'
export default ThermalSystemWidget
