import React, { useEffect, useState } from 'react'

import { useObservedEvents } from '../../features/events/useObservedEvents'
import { useOrbit } from '../../features/orbit/useOrbit'
import type { TelemetryRecord } from '../../features/telemetry/types'
import { EMPTY_LIVE_STATE } from '../../features/telemetry/types'
import { getSource, useCameraShot, useLiveState } from '../../features/telemetry/useSource'
import { useTimeline } from '../../features/timeline/useTimeline'
import ADCSWidget from '../ADCSWidget/ADCSWidget'
import CameraViewWidget from '../CameraViewWidget/CameraViewWidget'
import FlightRecorderWidget from '../FlightRecorderWidget/FlightRecorderWidget'
import GroundStationLinkMap from '../GroundStationLinkMap/GroundStationLinkMap'
import LiveTelemetryStreamWidget from '../LiveTelemetryStreamWidget/LiveTelemetryStreamWidget'
import MissionConsoleWidget from '../MissionConsoleWidget/MissionConsoleWidget'
import MissionEventsWidget from '../MissionEventsWidget/MissionEventsWidget'
import MissionStatusBar from '../MissionStatusBar/MissionStatusBar'
import MissionTimelineBar from '../MissionTimelineBar/MissionTimelineBar'
import MqttBusMonitorWidget from '../MqttBusMonitorWidget/MqttBusMonitorWidget'
import OBCSystemWidget from '../OBCSystemWidget/OBCSystemWidget'
import OrbitGroundTrack from '../OrbitGroundTrack/OrbitGroundTrack'
import OrbitInfoWidget from '../OrbitInfoWidget/OrbitInfoWidget'
import PayloadWidget from '../PayloadWidget/PayloadWidget'
import PowerSystemWidget from '../PowerSystemWidget/PowerSystemWidget'
import QuickCommandsWidget from '../QuickCommandsWidget/QuickCommandsWidget'
import RadioLinkLogWidget from '../RadioLinkLogWidget/RadioLinkLogWidget'
import RecentAlertsWidget from '../RecentAlertsWidget/RecentAlertsWidget'
import Satellite3DView from '../Satellite3DView/Satellite3DView'
import SubsystemStatusWidget from '../SubsystemStatusWidget/SubsystemStatusWidget'
import TelemetryGraphsWidget from '../TelemetryGraphsWidget/TelemetryGraphsWidget'
import ThermalSystemWidget from '../ThermalSystemWidget/ThermalSystemWidget'

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
 *
 * The mission timeline replays through the same three channels: while it is
 * active, the widgets receive the state and rows derived from its one clock
 * instead of the live ones, and the 3D scene reads the timeline's attitude
 * ref. The widgets that are the *link* rather than the *mission* — the
 * console, the commands, the bus monitor, live events — leave the page for the
 * replay's duration: showing them against a past clock would mix two nows.
 */
const Dashboard: React.FC = () => {
    const live = useLiveState()
    const orbit = useOrbit()
    const events = useObservedEvents(live)
    const timeline = useTimeline()
    // The newest photograph, by whichever channel has one — the live message,
    // or one fetch into the open mission's directory. DHS owns the mission id.
    const shot = useCameraShot(live.dhs?.mission?.id ?? null)

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

    const replaying = timeline.phase === 'ready'
    // One clock: while the timeline is active every widget reads its instant.
    // Before the mission's first row the replayed state is honestly empty —
    // nothing had been recorded yet — never the live satellite's present.
    const shown = replaying ? (timeline.state ?? EMPTY_LIVE_STATE) : live
    const shownHistory = replaying ? timeline.rows : history

    // Newest first, as the source returns them.
    const latest = shownHistory[0] ?? null
    // Nothing has arrived on any topic yet — as opposed to a satellite that is
    // reporting and simply has no mission open.
    const connecting = !replaying && live.obc == null && !historyLoaded

    return (
        <div className={styles.dashboard}>
            <MissionStatusBar
                live={shown}
                latest={latest}
                orbit={replaying ? null : orbit}
                isLoading={connecting}
                isError={!replaying && historyError}
            />
            <MissionTimelineBar timeline={timeline} />
            {!replaying && historyError && (
                <div className={styles.errorBanner}>
                    ⚠ The recorded history is unreachable — live telemetry is unaffected
                </div>
            )}
            {/* HOSTD's own errors: the root process saying what it tried and
                could not do. These used to reach nobody but the journal. */}
            {!replaying && live.host != null && live.host.errors.length > 0 && (
                <div className={styles.errorBanner}>⚠ HOSTD: {live.host.errors.join(' · ')}</div>
            )}
            <main className={styles.grid}>
                <div className={`${styles.rowTop} ${replaying ? styles.rowTopReplay : ''}`}>
                    <Satellite3DView
                        adcs={shown.adcs}
                        isLoading={connecting}
                        attitude={replaying ? timeline.attitudeRef : undefined}
                    />
                    <OrbitGroundTrack
                        latest={latest}
                        history={shownHistory}
                        orbit={replaying ? null : orbit}
                        isLoading={connecting}
                    />
                    {!replaying && (
                        <GroundStationLinkMap
                            adcs={live.adcs}
                            comms={live.comms}
                            host={live.host}
                            isLoading={connecting}
                        />
                    )}
                    <div className={styles.rightStack}>
                        <SubsystemStatusWidget
                            live={shown}
                            latest={latest}
                            isLoading={connecting}
                        />
                        {/* Not during a timeline replay: a live photograph
                            against a past clock would mix two nows. On a
                            source with no photographs at all it stays, and
                            its empty state says why. */}
                        {!replaying && (
                            <CameraViewWidget
                                shot={shot}
                                photosAvailable={getSource().capabilities.photos}
                                isLoading={connecting}
                            />
                        )}
                    </div>
                </div>
                <div className={styles.rowSubsystems}>
                    <PowerSystemWidget
                        eps={shown.eps}
                        history={shownHistory}
                        isLoading={connecting}
                    />
                    <ThermalSystemWidget
                        latest={latest}
                        history={shownHistory}
                        adcs={shown.adcs}
                        science={shown.science}
                        isLoading={connecting}
                    />
                    <ADCSWidget
                        adcs={shown.adcs}
                        isLoading={connecting}
                    />
                    <OBCSystemWidget
                        live={shown}
                        latest={latest}
                        isLoading={connecting}
                    />
                    <PayloadWidget
                        payload={shown.payload}
                        science={shown.science}
                        isLoading={connecting}
                    />
                </div>
                <div className={`${styles.rowGraphs} ${replaying ? styles.rowSolo : ''}`}>
                    <TelemetryGraphsWidget
                        history={shownHistory}
                        isLoading={connecting}
                    />
                    {!replaying && (
                        <MissionEventsWidget
                            events={events}
                            isLoading={false}
                        />
                    )}
                </div>
                {/* Orbit Info sits last so its column lines up with the Flight
                    Recorder in the row below — the two narrow cards share one
                    edge instead of staggering the grid. */}
                <div className={`${styles.rowStream} ${replaying ? styles.rowSolo : ''}`}>
                    <LiveTelemetryStreamWidget
                        latest={latest}
                        isLoading={connecting}
                    />
                    {!replaying && <MqttBusMonitorWidget live={live} />}
                    {!replaying && <OrbitInfoWidget orbit={orbit} />}
                </div>
                {/* The radio session log with the flight recorder beside it —
                    what the radio is saying and what DHS is writing down are
                    the two live journals of the satellite. The row leaves
                    during a timeline replay (a past has no live link). The log
                    itself renders only where radio traffic can arrive at all:
                    a source whose recording predates radio_log declares the
                    channel absent rather than delivering an empty table, and
                    the recorder takes the full row. WeatherWidget used to sit
                    in this slot; it is hidden, not deleted — it was filler,
                    and the recorder is telemetry. */}
                {!replaying && (
                    <div className={`${styles.rowRadio} ${!getSource().capabilities.radio ? styles.rowSolo : ''}`}>
                        {getSource().capabilities.radio && <RadioLinkLogWidget />}
                        <FlightRecorderWidget
                            dhs={live.dhs}
                            isLoading={connecting}
                        />
                    </div>
                )}
                {!replaying && (
                    <div className={styles.rowConsole}>
                        <MissionConsoleWidget
                            live={live}
                            latest={history[0] ?? null}
                        />
                        <QuickCommandsWidget />
                        <RecentAlertsWidget
                            events={events}
                            isLoading={false}
                        />
                    </div>
                )}
            </main>
        </div>
    )
}

export default Dashboard
