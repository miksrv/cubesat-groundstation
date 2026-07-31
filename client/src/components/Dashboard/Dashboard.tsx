import React from 'react'

import {
    useGetEventsQuery,
    useGetHistoryQuery,
    useGetLatestQuery,
    useGetOrbitQuery
} from '../../features/telemetry/telemetryAPI'
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

const Dashboard: React.FC = () => {
    const {
        data: latestData,
        isLoading: latestLoading,
        isError: latestError
    } = useGetLatestQuery(undefined, { pollingInterval: 30000 })

    const { data: historyData, isLoading: historyLoading } = useGetHistoryQuery(100, { pollingInterval: 30000 })
    const { data: orbitData } = useGetOrbitQuery(undefined, { pollingInterval: 30000 })
    const { data: eventsData, isLoading: eventsLoading } = useGetEventsQuery(50, { pollingInterval: 30000 })

    const latest = latestData ?? null
    const history = historyData?.records ?? []
    const orbit = orbitData ?? null
    const events = eventsData?.records ?? []

    return (
        <div className={styles.dashboard}>
            <MissionStatusBar
                latest={latest}
                orbit={orbit}
                isLoading={latestLoading}
                isError={latestError}
            />
            {latestError && (
                <div className={styles.errorBanner}>⚠ Unable to reach API — polling continues every 30s</div>
            )}
            <main className={styles.grid}>
                <div className={styles.rowTop}>
                    <Satellite3DView
                        latest={latest}
                        isLoading={latestLoading}
                    />
                    <OrbitGroundTrack
                        latest={latest}
                        history={history}
                        orbit={orbit}
                        isLoading={historyLoading}
                    />
                    <GroundStationLinkMap
                        latest={latest}
                        isLoading={latestLoading}
                    />
                    <div className={styles.rightStack}>
                        <SubsystemStatusWidget
                            latest={latest}
                            isLoading={latestLoading}
                        />
                        <WeatherWidget />
                    </div>
                </div>
                <div className={styles.rowSubsystems}>
                    <PowerSystemWidget
                        latest={latest}
                        isLoading={latestLoading}
                    />
                    <ThermalSystemWidget
                        latest={latest}
                        isLoading={latestLoading}
                    />
                    <ADCSWidget
                        latest={latest}
                        isLoading={latestLoading}
                    />
                    <OBCSystemWidget
                        latest={latest}
                        isLoading={latestLoading}
                    />
                    <PayloadWidget
                        latest={latest}
                        isLoading={latestLoading}
                    />
                </div>
                <div className={styles.rowGraphs}>
                    <TelemetryGraphsWidget
                        history={history}
                        isLoading={historyLoading}
                    />
                    <MissionEventsWidget
                        events={events}
                        isLoading={eventsLoading}
                    />
                </div>
                <div className={styles.rowStream}>
                    <LiveTelemetryStreamWidget
                        latest={latest}
                        isLoading={latestLoading}
                    />
                    <OrbitInfoWidget orbit={orbit} />
                    <MqttBusMonitorWidget />
                </div>
                <div className={styles.rowConsole}>
                    <MissionConsoleWidget latest={latest} />
                    <QuickCommandsWidget />
                    <RecentAlertsWidget
                        events={events}
                        isLoading={eventsLoading}
                    />
                </div>
            </main>
        </div>
    )
}

export default Dashboard
