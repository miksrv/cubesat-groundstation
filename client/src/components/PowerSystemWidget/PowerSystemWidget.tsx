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
 * The satellite's own estimate, formatted. **It is not computed here**
 * (2026-09-04): this row used to divide the battery percentage by the
 * percent-per-hour rate in the browser, and both halves of that have since
 * stopped being defensible. The percentage is a lookup through an inferred pack
 * curve and the rate is a voltage slope pushed through the same curve, so the
 * division was neither dimensionally honest nor the same arithmetic
 * `common/battery.py` does — it extrapolated in the percentage domain off a
 * curve it did not have, and the curve steepens exactly where the answer
 * matters. EPS publishes `time_to_empty_sec`/`time_to_full_sec` instead, and one
 * implementation of an estimate is the whole point.
 *
 * At most one of the two is ever a number: the satellite returns null whenever
 * the slope is missing, flat or pointing away from the target, which is where
 * the old row's noise floor went. Empty wins if both ever arrive — the
 * conservative reading is the one worth showing.
 *
 * `~` stays part of the value. The estimate is still an extrapolation of an
 * instantaneous slope, and the charging direction does not model the
 * constant-voltage tail, so it is optimistic about the last few points.
 */
const timeRemaining = (toEmptySec: number | null, toFullSec: number | null): string => {
    const seconds = toEmptySec ?? toFullSec
    if (seconds == null) {
        return '—'
    }
    const hours = seconds / 3600
    const span = hours >= 1 ? `~${hours.toFixed(1)} h` : `~${Math.max(1, Math.round(hours * 60))} min`
    return `${span} to ${toEmptySec != null ? 'empty' : 'full'}`
}

/**
 * The slope EPS fitted: millivolts per hour, with the percentage restatement
 * beside it when the satellite published both.
 *
 * Whole millivolts per hour, because one 1.25 mV `VCELL` step across the 600 s
 * window is already ±7.5 mV/h of fitting noise — a decimal here would be
 * precision the number does not have. Rounded before the sign is chosen so that
 * a slope inside the noise reads `0 mV/h` rather than `-0 mV/h`.
 */
const rateLine = (voltageRate: number | null, chargeRate: number | null): string => {
    if (voltageRate == null) {
        return '—'
    }
    const mv = Math.round(voltageRate)
    const volts = `${mv > 0 ? '+' : ''}${mv} mV/h`
    return chargeRate == null ? volts : `${volts} (${chargeRate > 0 ? '+' : ''}${chargeRate.toFixed(2)} %/h)`
}

/**
 * The footer's line, a couple of words at most — it shares its row with the
 * badge. `getEpsStatus().detail` leads with the voltage, which is the right
 * tooltip for the Subsystem Status widget but a duplicate here — the Battery
 * Voltage row is five lines up. SAFE and CRITICAL name the satellite's own
 * descent thresholds, and **those are volts** since 2026-09-04: 3.58 V and
 * 3.45 V, where this comment used to say 25 % and 10 %.
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
 * field. **There is no current sensor on this satellite** — the gauge has no
 * shunt and no coulomb counter at all. Multiplying a number the hardware never
 * measured by the voltage produced a wattage that looked like a measurement and
 * was not one, so both rows are gone.
 *
 * The 2026-09-04 change is the same lesson one level in. What replaced them was
 * `charge_rate`, described then as a rate "the gauge really does report" — it
 * does not. The part is a MAX17040/41 with no CRATE register, and the driver was
 * decoding the 0xFFFF an unimplemented address returns into a constant
 * −0.208 %/h. So the rate row now leads with `voltage_rate`, the millivolts per
 * hour EPS fits over the terminal voltage and the one slope the satellite's power
 * policy consults, with the percentage restatement beside it. The time-remaining
 * row comes from the satellite's own `time_to_empty_sec`/`time_to_full_sec`
 * rather than from arithmetic here: see {@link timeRemaining}.
 */
const PowerSystemWidget: React.FC<Props> = React.memo(({ eps, obc, history, isLoading }) => {
    const showSkeleton = isLoading && !eps
    const live: LiveState = { ...EMPTY, eps, obc }
    const status = applyObcVerdict(getEpsStatus(live), live)
    const batteryLevel = eps?.batteryPercent ?? null
    const voltageRate = eps?.voltageRate ?? null
    const chargeRate = eps?.chargeRate ?? null
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
                    {/*
                      The label carries "(derived)" because the value cannot: this
                      percentage is the voltage above through an *inferred* pack
                      curve, not a reading, and the row directly under a measured
                      voltage is the one place a viewer would assume otherwise.
                      A label suffix rather than a hover — nothing on this page
                      explains itself only on hover.
                    */}
                    <StatRow
                        label='Battery Level (derived)'
                        value={batteryLevel != null ? `${batteryLevel.toFixed(1)} %` : '—'}
                        mono
                        accent={status.status === 'FAIL' ? 'red' : status.status === 'WARN' ? 'orange' : 'green'}
                    />
                    {/*
                      Millivolts per hour first, because that is the slope the
                      satellite's power policy compares against −30 mV/h to decide
                      whether a plugged-in pack is really draining. The %/h beside
                      it is the same slope through the curve's local gradient — a
                      restatement for whoever thinks in percent, and shown only
                      when the satellite published both.
                    */}
                    <StatRow
                        label='Voltage Rate'
                        value={rateLine(voltageRate, chargeRate)}
                        mono
                        accent={voltageRate != null && voltageRate < 0 ? 'orange' : 'default'}
                    />
                    <StatRow
                        label='Time Remaining'
                        value={timeRemaining(eps?.timeToEmptySec ?? null, eps?.timeToFullSec ?? null)}
                        mono
                        accent={eps?.timeToEmptySec != null ? 'orange' : 'default'}
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
                    <div className={styles.trend}>
                        <Sparkline
                            values={voltageTrend}
                            color={chartColors.blue[0]}
                        />
                    </div>
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
