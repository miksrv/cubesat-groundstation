import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { TelemetryRecord } from './types';

interface LatestResponse { data: TelemetryRecord | null }
interface HistoryResponse { count: number; records: TelemetryRecord[] }

export const telemetryApi = createApi({
  reducerPath: 'telemetryApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/cubesat' }),
  endpoints: (builder) => ({
    getLatest: builder.query<LatestResponse, void>({
      query: () => '/telemetry/latest',
    }),
    getHistory: builder.query<HistoryResponse, number>({
      query: (limit = 100) => `/telemetry/history?limit=${limit}`,
    }),
  }),
});

export const { useGetLatestQuery, useGetHistoryQuery } = telemetryApi;
