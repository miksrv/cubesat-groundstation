import React from 'react';
import styles from './Dashboard.module.scss';
import Header from '../Header/Header';
import EPSPanel from '../EPSPanel/EPSPanel';
import ADCSPanel from '../ADCSPanel/ADCSPanel';
import GPSPanel from '../GPSPanel/GPSPanel';
import PayloadChart from '../PayloadChart/PayloadChart';
import SystemChart from '../SystemChart/SystemChart';
import TelemetryTimeline from '../TelemetryTimeline/TelemetryTimeline';
import { useGetLatestQuery, useGetHistoryQuery } from '../../features/telemetry/telemetryAPI';

const Dashboard: React.FC = () => {
  const {
    data: latestData,
    isLoading: latestLoading,
    isError: latestError,
  } = useGetLatestQuery(undefined, { pollingInterval: 30000 });

  const {
    data: historyData,
    isLoading: historyLoading,
  } = useGetHistoryQuery(100, { pollingInterval: 30000 });

  const latest = latestData?.data ?? null;
  const history = historyData?.records ?? [];

  return (
    <div className={styles.dashboard}>
      <Header latest={latest} isLoading={latestLoading} isError={latestError} />
      {latestError && (
        <div className={styles.errorBanner}>
          ⚠ Unable to reach API — polling continues every 30s
        </div>
      )}
      <main className={styles.grid}>
        <div className={styles.row1}>
          <EPSPanel latest={latest} history={history} isLoading={latestLoading} />
          <ADCSPanel latest={latest} history={history} isLoading={latestLoading} />
          <GPSPanel latest={latest} history={history} isLoading={latestLoading} />
        </div>
        <div className={styles.row2}>
          <PayloadChart history={history} isLoading={historyLoading} />
          <SystemChart history={history} isLoading={historyLoading} />
        </div>
        <div className={styles.row3}>
          <TelemetryTimeline history={history} isLoading={historyLoading} />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
