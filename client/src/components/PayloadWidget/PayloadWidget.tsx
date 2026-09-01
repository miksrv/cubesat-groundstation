import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { LiveState, ObcStatus, PayloadStatus, ScienceData } from '../../features/telemetry/types'
import { applyObcVerdict, getPayloadStatus } from '../../utils/subsystemStatus'
import StatRow from '../common/StatRow/StatRow'
import StatusBadge from '../common/StatusBadge/StatusBadge'

import styles from './PayloadWidget.module.scss'

interface Props {
    payload: PayloadStatus | null
    science: ScienceData | null
    /** For OBC's verdict on the service itself: a subsystem the profile never
     *  started earns "OFF", not the dash of a page still waiting for data. */
    obc: ObcStatus | null
    isLoading: boolean
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
 * `present` here is not a label the satellite chose — it is the result of an
 * actual transaction with the device, which is what separates "the sensor
 * answered" from "the process started". That distinction is the whole reason
 * `payload_status` exists as a topic, and it is worth showing as such.
 *
 * The old rows for image count, resolution and payload wattage are gone: the
 * satellite counts frames of a running timelapse, not images ever taken, and
 * nothing measures the payload's power draw. What it does report — and what
 * actually explains a satellite that stopped taking pictures — is free space
 * and the reason a timelapse ended.
 */
const PayloadWidget: React.FC<Props> = React.memo(({ payload, science, obc, isLoading }) => {
    const showSkeleton = isLoading && !payload
    // `science` rides along for the same reason the Subsystem Status widget
    // sees it: a replayed row carries no payload_status, but its science
    // columns are evidence the device answered.
    const live: LiveState = { ...EMPTY, payload, science, obc }
    const status = applyObcVerdict(getPayloadStatus(live), live)
    const timelapse = payload?.timelapse ?? null

    return (
        <Container
            title='Payload'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '200px', width: '100%' }} />}
            {!showSkeleton && (
                <div className={styles.body}>
                    <StatRow
                        label='Camera'
                        value={payload?.camera ? (payload.camera.present ? 'answered' : 'silent') : '—'}
                        accent={payload?.camera?.present ? 'green' : payload?.camera ? 'orange' : 'default'}
                    />
                    <StatRow
                        label='Environment sensor'
                        value={payload?.sensor ? (payload.sensor.present ? 'answered' : 'silent') : '—'}
                        accent={payload?.sensor?.present ? 'green' : payload?.sensor ? 'orange' : 'default'}
                    />
                    {/* Not a duplicate of "answered": a counter that grows and a
                        recent read time are the proof the sensor is measuring,
                        not merely reachable. */}
                    <StatRow
                        label='Sensor reads'
                        value={
                            payload?.sensor?.readings != null
                                ? `${payload.sensor.readings}${
                                      payload.sensor.lastRead != null
                                          ? ` · last ${new Date(payload.sensor.lastRead * 1000).toLocaleTimeString(
                                                undefined,
                                                { hour12: false }
                                            )}`
                                          : ''
                                  }`
                                : '—'
                        }
                        mono
                    />
                    <StatRow
                        label='Light'
                        value={science?.light != null ? `${science.light.toFixed(0)} lx` : '—'}
                        mono
                    />
                    {/*
                      Null until the SEN0501 board revision is known: two revisions
                      read one raw register with formulas that disagree by a factor
                      of forty, so the satellite publishes the raw count and
                      withholds the index. Say which, rather than showing a dash.
                    */}
                    <StatRow
                        label='UV index'
                        value={
                            science?.uvIndex != null
                                ? science.uvIndex.toFixed(2)
                                : science?.uvRaw != null
                                  ? `withheld — raw ${science.uvRaw}`
                                  : '—'
                        }
                        mono={science?.uvIndex != null}
                    />
                    <StatRow
                        label='Timelapse'
                        value={
                            timelapse == null
                                ? '—'
                                : timelapse.active
                                  ? `running, ${timelapse.frames} frames${
                                        timelapse.intervalSec != null ? ` @ ${timelapse.intervalSec}s` : ''
                                    }`
                                  : (timelapse.reason ?? 'idle')
                        }
                        accent={timelapse?.active ? 'green' : 'default'}
                    />
                    <StatRow
                        label='Card free'
                        value={payload?.storage?.freeMb != null ? `${payload.storage.freeMb.toFixed(0)} MB` : '—'}
                        mono
                        accent={payload?.storage?.blocked ? 'red' : 'default'}
                    />
                    <div className={styles.footer}>
                        <span className={styles.footerLabel}>{status.detail}</span>
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

PayloadWidget.displayName = 'PayloadWidget'
export default PayloadWidget
