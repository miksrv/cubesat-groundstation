import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import { useGetWeatherQuery } from '../../features/telemetry/telemetryAPI'

import styles from './WeatherWidget.module.scss'

/** OpenWeatherMap-style condition codes, condensed to icon + label. */
const getConditionIcon = (id: number): string => {
    if (id >= 200 && id < 300) {
        return '⛈️'
    }
    if (id >= 300 && id < 400) {
        return '🌦️'
    }
    if (id >= 500 && id < 600) {
        return '🌧️'
    }
    if (id >= 600 && id < 700) {
        return '❄️'
    }
    if (id >= 700 && id < 800) {
        return '🌫️'
    }
    if (id === 800) {
        return '☀️'
    }
    if (id === 801) {
        return '🌤️'
    }
    if (id === 802) {
        return '⛅'
    }
    if (id >= 803 && id < 900) {
        return '☁️'
    }
    return '🌡️'
}

const getConditionLabel = (id: number): string => {
    if (id >= 200 && id < 300) {
        return 'Thunderstorm'
    }
    if (id >= 300 && id < 400) {
        return 'Drizzle'
    }
    if (id >= 500 && id < 600) {
        return 'Rain'
    }
    if (id >= 600 && id < 700) {
        return 'Snow'
    }
    if (id >= 700 && id < 800) {
        return 'Fog / Haze'
    }
    if (id === 800) {
        return 'Clear sky'
    }
    if (id === 801) {
        return 'Few clouds'
    }
    if (id === 802) {
        return 'Scattered clouds'
    }
    if (id === 803) {
        return 'Broken clouds'
    }
    if (id === 804) {
        return 'Overcast clouds'
    }
    return 'Unknown'
}

const WIND_COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const getWindDirection = (deg: number): string => WIND_COMPASS[Math.round(deg / 45) % 8]

const formatUpdatedAt = (isoDate: string): string =>
    new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const WeatherWidget: React.FC = () => {
    const { data, isLoading, isError } = useGetWeatherQuery(undefined, { pollingInterval: 600000 })

    const icon = data ? getConditionIcon(data.weatherId) : '🌡️'
    const condition = data ? getConditionLabel(data.weatherId) : ''

    return (
        <Container
            title='Weather (Ground Station)'
            className={styles.panel}
        >
            {isLoading && !data && <Skeleton style={{ height: '80px', width: '100%' }} />}
            {isError && !data && <div className={styles.error}>Weather unavailable</div>}
            {data && (
                <div className={styles.body}>
                    <div className={styles.headline}>
                        <span className={styles.icon}>{icon}</span>
                        <div>
                            <div className={styles.temp}>
                                {Math.round(data.temperature)}°C
                                <span className={styles.feelsLike}>feels {Math.round(data.feelsLike)}°C</span>
                            </div>
                            <div className={styles.condition}>{condition}</div>
                        </div>
                    </div>
                    <div className={styles.details}>
                        <span>
                            Wind{' '}
                            <b>
                                {data.windSpeed.toFixed(1)} m/s {getWindDirection(data.windDeg)}
                            </b>
                        </span>
                        <span>
                            Gust <b>{data.windGust.toFixed(1)} m/s</b>
                        </span>
                        <span>
                            Humidity <b>{data.humidity}%</b>
                        </span>
                        <span>
                            Pressure <b>{data.pressure} hPa</b>
                        </span>
                        <span>
                            Dew point <b>{data.dewPoint.toFixed(1)}°C</b>
                        </span>
                        <span>
                            Clouds <b>{data.clouds}%</b>
                        </span>
                        <span>
                            UV index <b>{data.uvIndex}</b>
                        </span>
                        <span>
                            Visibility <b>{(data.visibility / 1000).toFixed(1)} km</b>
                        </span>
                        {data.precipitation > 0 && (
                            <span>
                                Precipitation <b>{data.precipitation} mm</b>
                            </span>
                        )}
                    </div>
                    <div className={styles.footer}>
                        Updated {formatUpdatedAt(data.lastUpdated)}
                        {data.isStale && <span className={styles.stale}>stale</span>}
                    </div>
                </div>
            )}
        </Container>
    )
}

export default WeatherWidget
