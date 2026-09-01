import React, { useMemo } from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { EpsStatus, LiveState, ObcStatus, TelemetryRecord } from '../../features/telemetry/types'
import { chartColors } from '../../styles/chartColors'
import { applyObcVerdict, getEpsStatus } from '../../utils/subsystemStatus'
import Sparkline from '../common/Sparkline/Sparkline'
import StatRow from '../common/StatRow/StatRow'
import StatusBadge from '../common/StatusBadge/StatusBadge'

import styles from './PowerSystemWidget.module.scss'

/** The window the voltage sparkline draws — the same one Telemetry Graphs uses. */
const SPARK_ROWS = 50

interface Props {
    eps: EpsStatus | null
    /** For OBC's verdict on the service itself: a subsystem the profile never
     *  started earns "OFF", not the dash of a page still waiting for data. */
    obc: ObcStatus | null
    /** Recorded rows, newest first, for the voltage trend. */
    history: TelemetryRecord[]
    isLoading: boolean
}

const barColorByStatus: Record<'OK' | 'WARN' | 'FAIL' | 'OFF' | 'UNKNOWN', string> = {
    OK: 'var(--color-green)',
    WARN: 'var(--color-orange)',
    FAIL: 'var(--color-red)',
    OFF: 'var(--text-color-secondary)',
    UNKNOWN: 'var(--text-color-secondary)'
}

/**
 * One CRATE LSB is 0.208 %/h, so a reading at or under it is indistinguishable
 * from gauge noise — and dividing the battery by noise promises hundreds of
 * hours the satellite never measured. Below this floor the estimate is
 * withheld, which is this project's answer to every number it cannot justify.
 */
const RATE_NOISE_FLOOR = 0.21

/**
 * `~` is part of the value: this is an extrapolation of the instantaneous
 * rate, not a measurement — a satellite that just started charging reports a
 * rate that will not hold for the whole climb.
 */
const chargeEstimate = (battery: number | null, rate: number | null): string => {
    if (battery == null || rate == null || Math.abs(rate) < RATE_NOISE_FLOOR) {
        return '—'
    }
    const hours = rate > 0 ? (100 - battery) / rate : battery / -rate
    const span = hours >= 1 ? `~${hours.toFixed(1)} h` : `~${Math.max(1, Math.round(hours * 60))} min`
    return `${span} to ${rate > 0 ? 'full' : 'empty'}`
}

/**
 * The footer's line, a couple of words at most — it shares its row with the
 * badge. `getEpsStatus().detail` leads with the charge percent, which is the
 * right tooltip for the Subsystem Status widget but a duplicate here — the
 * Battery Level row is four lines up. SAFE and CRITICAL name the satellite's
 * own descent thresholds (25 % and 10 %).
 */
const footerLine = (status: ReturnType<typeof getEpsStatus>, eps: EpsStatus | null): string => {
    switch (status.status) {
        case 'FAIL':
            return 'CRITICAL range'
        case 'WARN':
            return 'below SAFE'
        case 'OK':
            return eps?.externalPower === true ? 'on mains' : 'on battery'
        case 'OFF':
            // OBC's verdict names the profile that never started the service.
            return status.detail
        case 'UNKNOWN':
            return 'no reading yet'
    }
}

const EMPTY: LiveState = {
    host: null,
    obc: null,
    eps: null,
    adcs: null,
    payload: null,
    science: null,
    dhs: null,
    comms: null
}

/**
 * Current and wattage used to be shown here, derived from a `battery_current`
 * field. **There is no current sensor on this satellite.** The MAX17048 is a
 * fuel gauge: it reports state of charge, voltage, and a rate of change in
 * percent per hour. Multiplying a number the hardware never measured by the
 * voltage produced a wattage that looked like a measurement and was not one, so
 * both rows are gone and `charge_rate` — which the gauge really does report —
 * is here instead.
 */
const PowerSystemWidget: React.FC<Props> = React.memo(({ eps, obc, history, isLoading }) => {
    const showSkeleton = isLoading && !eps
    const live: LiveState = { ...EMPTY, eps, obc }
    const status = applyObcVerdict(getEpsStatus(live), live)
    const batteryLevel = eps?.batteryPercent ?? null
    const rate = eps?.chargeRate ?? null
    const voltageTrend = useMemo(
        () =>
            history
                .slice(0, SPARK_ROWS)
                .reverse()
                .map((row) => row.voltage),
        [history]
    )

    return (
        <Container
            title='Electrical Power System'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '160px', width: '100%' }} />}
            {!showSkeleton && (
                <div className={styles.body}>
                    <StatRow
                        label='Battery Voltage'
                        value={eps?.voltage != null ? `${eps.voltage.toFixed(3)} V` : '—'}
                        mono
                    />
                    <StatRow
                        label='Battery Level'
                        value={batteryLevel != null ? `${batteryLevel.toFixed(1)} %` : '—'}
                        mono
                        accent={status.status === 'FAIL' ? 'red' : status.status === 'WARN' ? 'orange' : 'green'}
                    />
                    {/*
                      Signed percent per hour from the gauge's CRATE register. It is
                      what tells "plugged in and charging" from "plugged in and still
                      going down" without waiting for the charge reading to move —
                      which is why the satellite's own power policy reads it.
                    */}
                    <StatRow
                        label='Charge Rate'
                        value={rate != null ? `${rate > 0 ? '+' : ''}${rate.toFixed(2)} %/h` : '—'}
                        mono
                        accent={rate != null && rate < 0 ? 'orange' : 'default'}
                    />
                    <StatRow
                        label='Charge Estimate'
                        value={chargeEstimate(batteryLevel, rate)}
                        mono
                        accent={rate != null && rate < -RATE_NOISE_FLOOR ? 'orange' : 'default'}
                    />
                    <StatRow
                        label='Power Source'
                        value={eps?.externalPower === true ? 'Mains' : eps?.externalPower === false ? 'Battery' : '—'}
                        accent={eps?.externalPower === true ? 'main' : 'default'}
                    />
                    <div className={styles.barTrack}>
                        <div
                            className={styles.barFill}
                            style={{
                                width: `${Math.min(100, Math.max(0, batteryLevel ?? 0))}%`,
                                background: barColorByStatus[status.status]
                            }}
                        />
                    </div>
                    {/* Blue is the Battery Voltage series' own hue in Telemetry
                        Graphs — colour follows the entity across widgets. Last
                        in the card, mirroring the Temperatures layout. */}
                    <Sparkline
                        values={voltageTrend}
                        color={chartColors.blue[0]}
                    />
                    <div className={styles.footer}>
                        <span className={styles.footerLabel}>{footerLine(status, eps)}</span>
                        <StatusBadge
                            status={status.status}
                            label={status.status === 'OK' ? 'NOMINAL' : undefined}
                        />
                    </div>
                </div>
            )}
        </Container>
    )
})

PowerSystemWidget.displayName = 'PowerSystemWidget'
export default PowerSystemWidget
