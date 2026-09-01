import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { AdcsStatus, LiveState, ObcStatus } from '../../features/telemetry/types'
import { applyObcVerdict, getAdcsStatus } from '../../utils/subsystemStatus'
import StatRow from '../common/StatRow/StatRow'
import StatusBadge from '../common/StatusBadge/StatusBadge'

import styles from './ADCSWidget.module.scss'

interface Props {
    adcs: AdcsStatus | null
    /** For OBC's verdict on the service itself: a subsystem the profile never
     *  started earns "OFF", not the dash of a page still waiting for data. */
    obc: ObcStatus | null
    isLoading: boolean
}

const fmtDeg = (v: number | null | undefined): string => (v != null ? `${v.toFixed(2)}°` : '—')
const fmtRate = (v: number | null | undefined): string => (v != null ? `${v.toFixed(2)}°/s` : '—')

const ADCSWidget: React.FC<Props> = React.memo(({ adcs, obc, isLoading }) => {
    const showSkeleton = isLoading && !adcs
    const live: LiveState = {
        host: null,
        obc,
        eps: null,
        adcs,
        payload: null,
        science: null,
        dhs: null,
        comms: null
    }
    const status = applyObcVerdict(getAdcsStatus(live), live)
    const mag = adcs?.calibStatus?.mag ?? null

    return (
        <Container
            title='ADCS'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '200px', width: '100%' }} />}
            {!showSkeleton && (
                <div className={styles.body}>
                    <StatRow
                        label='Roll'
                        value={fmtDeg(adcs?.roll)}
                        mono
                    />
                    <StatRow
                        label='Pitch'
                        value={fmtDeg(adcs?.pitch)}
                        mono
                    />
                    {/*
                      Yaw is null until the magnetometer reaches calibration 3, and
                      that is worth explaining rather than dashing out: below it the
                      BNO055 reports a *constant*, so the satellite withholds the
                      value instead of publishing confident nonsense. A bare "—"
                      here reads as a broken sensor, which is the wrong story.
                    */}
                    <StatRow
                        label='Yaw'
                        value={adcs?.yaw != null ? fmtDeg(adcs.yaw) : 'withheld — magnetometer'}
                        mono={adcs?.yaw != null}
                    />
                    <StatRow
                        label='Magnetometer calib'
                        value={mag != null ? `${mag}/3` : '—'}
                        mono
                        accent={mag != null && mag < 3 ? 'orange' : 'default'}
                    />
                    <StatRow
                        label='Angular Rate X'
                        value={fmtRate(adcs?.gyro.x)}
                        mono
                    />
                    <StatRow
                        label='Angular Rate Y'
                        value={fmtRate(adcs?.gyro.y)}
                        mono
                    />
                    <StatRow
                        label='Angular Rate Z'
                        value={fmtRate(adcs?.gyro.z)}
                        mono
                    />
                    {/* "last known" carries the honesty in two words: the
                        coordinates below are real, just not current. */}
                    <StatRow
                        label='GNSS'
                        value={
                            adcs?.gnss.fix === true
                                ? `fix, ${adcs.gnss.satellites ?? 0} satellites`
                                : 'no fix — last known'
                        }
                        accent={adcs?.gnss.fix === true ? 'default' : 'orange'}
                    />
                    {/* The last known position, like everything in the gnss
                        block — the row above says whether it is current. */}
                    <StatRow
                        label='Latitude'
                        value={adcs?.gnss.lat != null ? `${adcs.gnss.lat.toFixed(5)}°` : '—'}
                        mono
                    />
                    <StatRow
                        label='Longitude'
                        value={adcs?.gnss.lon != null ? `${adcs.gnss.lon.toFixed(5)}°` : '—'}
                        mono
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

ADCSWidget.displayName = 'ADCSWidget'
export default ADCSWidget
