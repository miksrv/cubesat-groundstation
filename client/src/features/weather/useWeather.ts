/**
 * Outdoor weather, from an external service, and it has to fail visibly.
 *
 * This is the one thing on the dashboard that is not the satellite. It comes
 * from `api.meteo.miksoft.pro` over the public internet — which is fine on the
 * desk and on a static demo, and **is not available where the satellite
 * usually is**: in `EXPO` it is its own access point with no uplink, and in
 * `FLIGHT` there is no network at all.
 *
 * So the failure is a first-class state rather than a spinner that never ends.
 * A panel stuck loading reads as a broken dashboard; "no internet on this
 * profile" reads as the truth.
 */

import { useEffect, useState } from 'react'

const ENDPOINT = 'https://api.meteo.miksoft.pro/current'

/** Short, because on an offline profile this cannot succeed and the point is to
 *  stop waiting rather than to try harder. */
const TIMEOUT_MS = 4000

const REFRESH_MS = 10 * 60 * 1000

export interface WeatherInfo {
    temperature: number
    feelsLike: number
    pressure: number
    humidity: number
    dewPoint: number
    visibility: number
    uvIndex: number
    solEnergy: number
    solRadiation: number
    clouds: number
    precipitation: number
    windSpeed: number
    windGust: number
    windDeg: number
    weatherId: number
    date: string
    lastUpdated: string
    isStale: boolean
}

export interface WeatherResult {
    data: WeatherInfo | null
    isLoading: boolean
    /** True once a fetch has failed. The panel says "unreachable", not "loading". */
    isUnreachable: boolean
}

export const useWeather = (): WeatherResult => {
    const [result, setResult] = useState<WeatherResult>({
        data: null,
        isLoading: true,
        isUnreachable: false
    })

    useEffect(() => {
        let cancelled = false
        const read = async () => {
            const abort = new AbortController()
            const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)
            try {
                const response = await fetch(ENDPOINT, { signal: abort.signal })
                if (!response.ok) {
                    throw new Error(String(response.status))
                }
                const data = (await response.json()) as WeatherInfo
                if (!cancelled) {
                    setResult({ data, isLoading: false, isUnreachable: false })
                }
            } catch {
                if (!cancelled) {
                    setResult((current) => ({
                        // A previous reading is kept: an hour-old temperature is
                        // still a temperature, and better than an empty panel.
                        data: current.data,
                        isLoading: false,
                        isUnreachable: true
                    }))
                }
            } finally {
                clearTimeout(timer)
            }
        }
        void read()
        const interval = setInterval(() => void read(), REFRESH_MS)
        return () => {
            cancelled = true
            clearInterval(interval)
        }
    }, [])

    return result
}
