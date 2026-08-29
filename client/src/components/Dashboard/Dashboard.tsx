import React, { useEffect, useState } from 'react'

import { useObservedEvents } from '../../features/events/useObservedEvents'
import { useOrbit } from '../../features/orbit/useOrbit'
import type { TelemetryRecord } from '../../features/telemetry/types'
import { getSource, useLiveState } from '../../features/telemetry/useSource'
import ADCSWidget from '../ADCSWidget/ADCSWidget'
import GroundStationLinkMap from '../GroundStationLinkMap/GroundStationLinkMap'
import LiveTelemetryStreamWidget from '../LiveTelemetryStreamWidget/LiveTelemetryStreamWidget'
import MissionConsoleWidget from '../MissionConsoleWidget/MissionConsoleWidget'
import MissionEventsWidget from '../MissionEventsWidget/MissionEventsWidget'
import MissionStatusBar from '../MissionStatusBar/MissionStatusBar'
import MqttBusMonitorWidget from '../MqttBusMonitorWidget/MqttBusMonitorWidget'
import OBCSystemWidget from '../OBCSystemWidget/OBCSystemWidget'
import OrbitGroundTrack from '../OrbitGroundTrack/OrbitGroundTrack'
import OrbitInfoWidget from '../OrbitInfoWidget/OrbitInfoWidget'
import PayloadWidget from '../PayloadWidget/PayloadWidget'
import PowerSystemWidget from '../PowerSystemWidget/PowerSystemWidget'
import QuickCommandsWidget from '../QuickCommandsWidget/QuickCommandsWidget'
import RecentAlertsWidget from '../RecentAlertsWidget/RecentAlertsWidget'
import Satellite3DView from '../Satellite3DView/Satellite3DView'
import SubsystemStatusWidget from '../SubsystemStatusWidget/SubsystemStatusWidget'
import TelemetryGraphsWidget from '../TelemetryGraphsWidget/TelemetryGraphsWidget'
import ThermalSystemWidget from '../ThermalSystemWidget/ThermalSystemWidget'
import WeatherWidget from '../WeatherWidget/WeatherWidget'

import styles from './Dashboard.module.scss'

/** How many recorded rows the charts draw. */
const HISTORY_ROWS = 200

/**
 * How often the recorded history is re-read.
 *
 * Not a polling interval for the *live* view — that arrives by subscription and
 * costs nothing to keep current. This is only for what the satellite records
 * rather than publishes: the host's CPU, RAM and disk, and the chart history.
 * DHS writes one row every 30 s in `NOMINAL`, so asking much faster than that
 * would re-read the same rows.
 */
const HISTORY_REFRESH_MS = 30_000

/**
 * The one place data is fetched.
 *
 * Every widget below takes plain props and none of them knows where the numbers
 * came from — which is what lets the same code run against the satellite, a
 * mission replayed out of the archive, and a recording bundled with a static
 * build that has no backend at all.
 *
 * Two channels, deliberately different in kind:
 *
 *   - **Live state** arrives by subscription. On the satellite that is the
 *     broker replaying its retained messages the moment the page connects, so a
 *     freshly opened tab knows the profile, the battery and the mission without
 *     waiting for a poll.
 *   - **Recorded rows** are fetched, because CPU, RAM, disk and any history at
 *     all exist only in what DHS wrote down.
 *
 * Attitude is a third channel and it is not here on purpose: it goes into a ref
 * inside `Satellite3DView`, because 2 Hz through this component would re-render
 * the whole tree for a value only the WebGL scene consumes.
 */
const Dashboard: React.FC = () => {
    const live = useLiveState()
    const orbit = useOrbit()
    const events = useObservedEvents(live)

    const [history, setHistory] = useState<TelemetryRecord[]>([])
    const [historyError, setHistoryError] = useState(false)
    const [historyLoaded, setHistoryLoaded] = useState(false)

    useEffect(() => {
        let cancelled = false
        const read = async () => {
            try {
                const rows = await getSource().recentTelemetry(HISTORY_ROWS)
                if (!cancelled) {
                    setHistory(rows)
                    setHistoryError(false)
                }
            } catch {
                // Survivable: the live view is a separate channel and keeps
                // working. Only the charts and the host metrics go stale, and
                // saying so beats blanking a dashboard that is still correct.
                if (!cancelled) {
                    setHistoryError(true)
                }
            } finally {
                if (!cancelled) {
                    setHistoryLoaded(true)
                }
            }
        }
        void read()
        const timer = setInterval(() => void read(), HISTORY_REFRESH_MS)
        return () => {
            cancelled = true
            clearInterval(timer)
        }
    }, [])

    // Newest first, as the source returns them.
    const latest = history[0] ?? null
    // Nothing has arrived on any topic yet — as opposed to a satellite that is
    // reporting and simply has no mission open.
    const connecting = live.obc == null && !historyLoaded

    return (
        <div className={styles.dashboard}>
            <MissionStatusBar
                live={live}
                latest={latest}
                orbit={orbit}
                isLoading={connecting}
                isError={historyError}
            />
            {historyError && (
                <div className={styles.errorBanner}>
                    ⚠ The recorded history is unreachable — live telemetry is unaffected
                </div>
            )}
            <main className={styles.grid}>
                <div className={styles.rowTop}>
                    <Satellite3DView
                        adcs={live.adcs}
                        isLoading={connecting}
                    />
                    <OrbitGroundTrack
                        latest={latest}
                        history={history}
                        orbit={orbit}
                        isLoading={connecting}
                    />
                    <GroundStationLinkMap
                        adcs={live.adcs}
                        comms={live.comms}
                        isLoading={connecting}
                    />
                    <div className={styles.rightStack}>
                        <SubsystemStatusWidget
                            live={live}
                            latest={latest}
                            isLoading={connecting}
                        />
                        <WeatherWidget />
                    </div>
                </div>
                <div className={styles.rowSubsystems}>
                    <PowerSystemWidget
                        eps={live.eps}
                        isLoading={connecting}
                    />
                    <ThermalSystemWidget
                        latest={latest}
                        adcs={live.adcs}
                        science={live.science}
                        isLoading={connecting}
                    />
                    <ADCSWidget
                        adcs={live.adcs}
                        isLoading={connecting}
                    />
                    <OBCSystemWidget
                        live={live}
                        latest={latest}
                        isLoading={connecting}
                    />
                    <PayloadWidget
                        payload={live.payload}
                        science={live.science}
                        isLoading={connecting}
                    />
                </div>
                <div className={styles.rowGraphs}>
                    <TelemetryGraphsWidget
                        history={history}
                        isLoading={connecting}
                    />
                    <MissionEventsWidget
                        events={events}
                        isLoading={false}
                    />
                </div>
                <div className={styles.rowStream}>
                    <LiveTelemetryStreamWidget
                        latest={latest}
                        isLoading={connecting}
                    />
                    <OrbitInfoWidget orbit={orbit} />
                    <MqttBusMonitorWidget live={live} />
                </div>
                <div className={styles.rowConsole}>
                    <MissionConsoleWidget
                        live={live}
                        latest={latest}
                    />
                    <QuickCommandsWidget />
                    <RecentAlertsWidget
                        events={events}
                        isLoading={false}
                    />
                </div>
            </main>
        </div>
    )
}

export default Dashboard
