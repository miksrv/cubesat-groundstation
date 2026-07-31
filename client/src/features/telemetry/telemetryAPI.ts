import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

import type { CommandName, CommandResponse, MissionEvent, OrbitState, TelemetryRecord, WeatherInfo } from './types'

type LatestResponse = TelemetryRecord
interface HistoryResponse {
    count: number
    records: TelemetryRecord[]
}
interface EventsResponse {
    count: number
    records: MissionEvent[]
}

export const telemetryApi = createApi({
    reducerPath: 'telemetryApi',
    baseQuery: fetchBaseQuery({ baseUrl: '/api/cubesat' }),
    tagTypes: ['Telemetry', 'Events'],
    endpoints: (builder) => ({
        getLatest: builder.query<LatestResponse, void>({
            query: () => '/telemetry/latest',
            providesTags: ['Telemetry']
        }),
        getHistory: builder.query<HistoryResponse, number>({
            query: (limit = 100) => `/telemetry/history?limit=${limit}`,
            providesTags: ['Telemetry']
        }),
        getEvents: builder.query<EventsResponse, number>({
            query: (limit = 50) => `/events?limit=${limit}`,
            providesTags: ['Events']
        }),
        getOrbit: builder.query<OrbitState, void>({
            query: () => '/orbit'
        }),
        getWeather: builder.query<WeatherInfo, void>({
            query: () => 'https://api.meteo.miksoft.pro/current'
        }),
        sendCommand: builder.mutation<CommandResponse, CommandName>({
            query: (command) => ({
                url: '/commands',
                method: 'POST',
                body: { command }
            }),
            invalidatesTags: ['Telemetry', 'Events']
        })
    })
})

export const {
    useGetLatestQuery,
    useGetHistoryQuery,
    useGetEventsQuery,
    useGetOrbitQuery,
    useGetWeatherQuery,
    useSendCommandMutation
} = telemetryApi
