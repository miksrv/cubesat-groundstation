import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import styles from './ADCSPanel.module.scss';
import type { TelemetryRecord } from '../../features/telemetry/types';

interface Props {
  latest: TelemetryRecord | null;
  history: TelemetryRecord[];
  isLoading: boolean;
}

const ADCSPanel: React.FC<Props> = React.memo(({ latest, history, isLoading }) => {
  const gyroRef = useRef<HTMLDivElement>(null);
  const gyroChart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (gyroRef.current) {
      gyroChart.current = echarts.init(gyroRef.current, 'dark');
    }
    const observer = new ResizeObserver(() => gyroChart.current?.resize());
    if (gyroRef.current) observer.observe(gyroRef.current);
    return () => {
      observer.disconnect();
      gyroChart.current?.dispose();
    };
  }, []);

  const gyroOption = useMemo(() => {
    const recent = history.slice(-50);
    return {
      backgroundColor: 'transparent',
      legend: {
        data: ['Gyro X', 'Gyro Y', 'Gyro Z'],
        textStyle: { color: '#94a3b8', fontSize: 9 },
        top: 0,
      },
      grid: { top: 28, right: 8, bottom: 22, left: 42 },
      xAxis: {
        type: 'time',
        axisLabel: { color: '#94a3b8', fontSize: 9 },
        axisLine: { lineStyle: { color: '#2d3548' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8', fontSize: 9 },
        splitLine: { lineStyle: { color: '#2d3548' } },
      },
      series: [
        {
          name: 'Gyro X',
          type: 'line',
          data: recent.map((r) => [r.timestamp, r.gyro_x ?? 0]),
          lineStyle: { color: '#ef4444' },
          symbol: 'none',
          smooth: true,
        },
        {
          name: 'Gyro Y',
          type: 'line',
          data: recent.map((r) => [r.timestamp, r.gyro_y ?? 0]),
          lineStyle: { color: '#10b981' },
          symbol: 'none',
          smooth: true,
        },
        {
          name: 'Gyro Z',
          type: 'line',
          data: recent.map((r) => [r.timestamp, r.gyro_z ?? 0]),
          lineStyle: { color: '#3b82f6' },
          symbol: 'none',
          smooth: true,
        },
      ],
      tooltip: { trigger: 'axis' },
    };
  }, [history]);

  useEffect(() => {
    gyroChart.current?.setOption(gyroOption, { notMerge: false });
  }, [gyroOption]);

  if (isLoading && !latest) {
    return (
      <div className={styles.panel}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>🧭 ADCS</h3>
      <div className={styles.orientation}>
        {(
          [
            ['Roll', latest?.roll],
            ['Pitch', latest?.pitch],
            ['Yaw', latest?.yaw],
          ] as [string, number | null | undefined][]
        ).map(([label, val]) => (
          <div key={label} className={styles.metric}>
            <span className={styles.label}>{label}</span>
            <span className={styles.value}>
              {val != null ? Number(val).toFixed(1) : '—'}°
            </span>
          </div>
        ))}
      </div>
      <div ref={gyroRef} className={styles.chart} />
      <div className={styles.imuTemp}>
        IMU Temp: <b>{latest?.imu_temp?.toFixed(1) ?? '—'}°C</b>
      </div>
    </div>
  );
});

ADCSPanel.displayName = 'ADCSPanel';
export default ADCSPanel;
