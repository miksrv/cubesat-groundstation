import React, { useEffect, useState } from 'react'

import { useObservedEvents } from '../../features/events/useObservedEvents'
import { useOrbit } from '../../features/orbit/useOrbit'
import { useSunInstant } from '../../features/orbit/useSunInstant'
import type { TelemetryRecord } from '../../features/telemetry/types'
import { EMPTY_LIVE_STATE } from '../../features/telemetry/types'
import { getSource, useCameraShot, useConnection, useLiveState, useRadioLog } from '../../features/telemetry/useSource'
import { useReplayShot } from '../../features/timeline/useReplayShot'
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
 * instead of the live ones, and the 3D scene reads the timeline's attitude ref.
 *
 * **The set of widgets never changes.** An earlier version removed the ones fed
 * by the live link for the duration of a replay, on the argument that showing
 * them against a past clock would mix two nows. The argument was right and the
 * remedy was wrong: the grid rebuilt itself on entering and leaving a replay,
 * which is a worse thing to do to somebody watching than any of it. So every
 * widget stays where it is, and each one is given the replayed equivalent of
 * what it shows — the mission's own events, its own radio traffic, its own
 * photographs at the playhead. Where a recording holds no equivalent, the widget
 * says so rather than showing the live value: `host_status` has no columns in
 * `telemetry`, so the Wi-Fi half of the link panel is honestly blank in a replay.
 *
 * The two that command rather than display — the console and the quick commands
 * — stay on the page and are **disabled**: there is no present to command while
 * a past afternoon is on screen, and a button that quietly published into the
 * live satellite would be the worst of the three options.
 */
const Dashboard: React.FC = () => {
    const live = useLiveState()
    // The transport's own state, shown even during a replay: the replay is a
    // past mission, but the connection is this page's present.
    const connection = useConnection()
    const orbit = useOrbit()
    const events = useObservedEvents(live)
    const radio = useRadioLog()
    const timeline = useTimeline()
    // The newest photograph, by whichever channel has one — the live message,
    // or one fetch into the open mission's directory. DHS owns the mission id.
    const shot = useCameraShot(live.dhs?.mission?.id ?? null)
    // And the frame a replayed mission had taken by the playhead: the last one
    // whose moment has passed, never the nearest, because a photograph shown
    // before it was taken puts the satellite somewhere it had not reached.
    const replayShot = useReplayShot(timeline.detail?.mission.id ?? null, timeline.playhead)

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
    // Which sky the globe is shaded with. The live view and the `yarn demo`
    // replay draw the viewer's present; a mission off the timeline draws its own
    // afternoon, so the terminator crosses its track where it actually did.
    // `useSunInstant` carries the argument for that split.
    const sunInstant = useSunInstant(replaying ? timeline.playhead : null)
    // One clock: while the timeline is active every widget reads its instant.
    // Before the mission's first row the replayed state is honestly empty —
    // nothing had been recorded yet — never the live satellite's present.
    const shown = replaying ? (timeline.state ?? EMPTY_LIVE_STATE) : live
    const shownHistory = replaying ? timeline.rows : history
    // The mission's own log, derived from its rows by the same diff the live
    // log uses — see useTimeline. The satellite keeps no events table, and this
    // is why it does not need one.
    const shownEvents = replaying ? timeline.events : events
    const shownRadio = replaying ? timeline.radio : radio
    const shownShot = replaying ? replayShot : shot

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
                connection={connection}
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
                <div className={styles.rowTop}>
                    <Satellite3DView
                        adcs={shown.adcs}
                        isLoading={connecting}
                        attitude={replaying ? timeline.attitudeRef : undefined}
                    />
                    <OrbitGroundTrack
                        latest={latest}
                        history={shownHistory}
                        orbit={replaying ? null : orbit}
                        sunInstant={sunInstant}
                        isLoading={connecting}
                    />
                    {/* The mission's own position, and — in a replay — nothing
                        for the Wi-Fi half: `host_status` has no columns in the
                        telemetry table, so a recording cannot say what the
                        network was doing. Blank is the honest answer; the live
                        values would be this afternoon's, next to a track from
                        last week. */}
                    <GroundStationLinkMap
                        adcs={shown.adcs}
                        comms={shown.comms}
                        host={shown.host}
                        isLoading={connecting}
                    />
                    <div className={styles.rightStack}>
                        <SubsystemStatusWidget
                            live={shown}
                            latest={latest}
                            isLoading={connecting}
                        />
                        {/* In a replay this is the mission's own photography:
                            a frame every five minutes, changing as the playhead
                            reaches each one. On a source with no photographs at
                            all the widget stays and its empty state says why. */}
                        <CameraViewWidget
                            shot={shownShot}
                            photosAvailable={getSource().capabilities.photos}
                            isLoading={connecting}
                        />
                    </div>
                </div>
                <div className={styles.rowSubsystems}>
                    <PowerSystemWidget
                        eps={shown.eps}
                        obc={shown.obc}
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
                        obc={shown.obc}
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
                        obc={shown.obc}
                        isLoading={connecting}
                    />
                </div>
                <div className={styles.rowGraphs}>
                    <TelemetryGraphsWidget
                        history={shownHistory}
                        isLoading={connecting}
                    />
                    <MissionEventsWidget
                        events={shownEvents}
                        isLoading={false}
                    />
                </div>
                {/* Orbit Info sits last so its column lines up with the Flight
                    Recorder in the row below — the two narrow cards share one
                    edge instead of staggering the grid. */}
                <div className={styles.rowStream}>
                    <LiveTelemetryStreamWidget
                        latest={latest}
                        isLoading={connecting}
                    />
                    {/* Fed by `shown`, so in a replay the diagram draws the
                        subsystems that were reporting when the row was written
                        rather than the ones reporting now. */}
                    <MqttBusMonitorWidget live={shown} />
                    {/* The orbital view is a simulation of *now*, so a replay
                        has none to show and the panel says it is waiting rather
                        than animating a position unrelated to the track beside
                        it. */}
                    <OrbitInfoWidget orbit={replaying ? null : orbit} />
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
                <div className={`${styles.rowRadio} ${!getSource().capabilities.radio ? styles.rowSolo : ''}`}>
                    {getSource().capabilities.radio && (
                        <RadioLinkLogWidget
                            events={shownRadio}
                            emptyMessage={
                                replaying
                                    ? 'This mission recorded no radio traffic — it may predate the radio log.'
                                    : undefined
                            }
                        />
                    )}
                    <FlightRecorderWidget
                        dhs={shown.dhs}
                        obc={shown.obc}
                        isLoading={connecting}
                    />
                </div>
                <div className={styles.rowConsole}>
                    {/* Both stay on the page and are disabled during a replay.
                        `live` and the live host metrics, not `shown`: if the
                        console did answer a query it would be answering about
                        the satellite, and it must not describe a past
                        afternoon in the present tense. Disabled is what keeps
                        that from arising. */}
                    <MissionConsoleWidget
                        live={live}
                        latest={history[0] ?? null}
                        disabled={replaying}
                    />
                    <QuickCommandsWidget disabled={replaying} />
                    <RecentAlertsWidget
                        events={shownEvents}
                        isLoading={false}
                    />
                </div>
            </main>
        </div>
    )
}

export default Dashboard
