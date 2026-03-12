import React, { useState, useEffect } from 'react';
import styles from './Header.module.scss';
import type { TelemetryRecord } from '../../features/telemetry/types';

interface Props {
  latest: TelemetryRecord | null;
  isLoading: boolean;
  isError: boolean;
}

const OBC_COLORS: Record<string, string> = {
  NOMINAL: '#10b981',
  SCIENCE: '#3b82f6',
  DEPLOY: '#f59e0b',
  LOW_POWER: '#f59e0b',
  SAFE: '#ef4444',
  BOOT: '#94a3b8',
};

const Header: React.FC<Props> = ({ latest, isLoading, isError }) => {
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    setCountdown(30);
    const interval = setInterval(
      () => setCountdown((c) => (c <= 1 ? 30 : c - 1)),
      1000,
    );
    return () => clearInterval(interval);
  }, [latest]);

  const obcState = latest?.obc_state ?? 'UNKNOWN';
  const obcColor = OBC_COLORS[obcState] ?? '#94a3b8';

  return (
    <header className={styles.header}>
      <div className={styles.title}>
        <span className={styles.icon}>🛰</span>
        <h1>CubeSat Ground Station</h1>
      </div>
      <div className={styles.status}>
        <span className={styles.badge} style={{ backgroundColor: obcColor }}>
          {obcState}
        </span>
        {latest && (
          <span className={styles.ts}>
            {new Date(latest.timestamp).toLocaleTimeString()}
          </span>
        )}
        <span
          className={`${styles.dot} ${isError ? styles.dotError : styles.dotLive}`}
        />
        {!isError && (
          <span className={styles.countdown}>↻ {countdown}s</span>
        )}
        {isLoading && <span className={styles.loading}>Syncing…</span>}
        {isError && <span className={styles.errorText}>API Offline</span>}
      </div>
    </header>
  );
};

export default Header;
