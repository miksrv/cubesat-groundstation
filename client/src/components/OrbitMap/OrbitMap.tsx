import React, { useMemo } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { TelemetryRecord } from '../../features/telemetry/types'

import 'leaflet/dist/leaflet.css'
import styles from './OrbitMap.module.scss'

interface Props {
    latest: TelemetryRecord | null
    history: TelemetryRecord[]
    isLoading: boolean
}

// Custom satellite icon
const satelliteIcon = L.divIcon({
    className: styles.satelliteIcon,
    html: `<div class="${styles.satelliteMarker}">
        <span class="${styles.satellitePulse}"></span>
        <span class="${styles.satelliteCore}">🛰️</span>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
})

// Component to update map center when position changes
const MapUpdater: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
    const map = useMap()

    React.useEffect(() => {
        map.setView([lat, lng], map.getZoom(), { animate: true })
    }, [lat, lng, map])

    return null
}

const OrbitMap: React.FC<Props> = React.memo(({ latest, history, isLoading }) => {
    const showSkeleton = isLoading && !latest

    // Current position
    const currentLat = latest?.latitude ?? 0
    const currentLng = latest?.longitude ?? 0
    const currentAlt = latest?.altitude ?? 0

    // Build ground track from history
    const groundTrack = useMemo(() => {
        if (history.length < 2) {
            return []
        }

        const points: Array<[number, number]> = []
        let prevLng: number | null = null

        // Process points and handle antimeridian crossing
        history.forEach((record) => {
            if (record.latitude != null && record.longitude != null) {
                const lat = record.latitude
                const lng = record.longitude

                // Detect antimeridian crossing (jump > 180 degrees)
                if (prevLng != null && Math.abs(lng - prevLng) > 180) {
                    // Insert a break by adding null (we'll split into segments later)
                    points.push([lat, lng])
                } else {
                    points.push([lat, lng])
                }
                prevLng = lng
            }
        })

        return points
    }, [history])

    // Split track into segments at antimeridian crossings
    const trackSegments = useMemo(() => {
        if (groundTrack.length < 2) {
            return []
        }

        const segments: Array<Array<[number, number]>> = []
        let currentSegment: Array<[number, number]> = []

        groundTrack.forEach((point, i) => {
            if (i > 0) {
                const prevPoint = groundTrack[i - 1]
                // Check for antimeridian crossing
                if (Math.abs(point[1] - prevPoint[1]) > 180) {
                    // Save current segment and start new one
                    if (currentSegment.length > 0) {
                        segments.push(currentSegment)
                    }
                    currentSegment = [point]
                } else {
                    currentSegment.push(point)
                }
            } else {
                currentSegment.push(point)
            }
        })

        if (currentSegment.length > 0) {
            segments.push(currentSegment)
        }

        return segments
    }, [groundTrack])

    // Calculate footprint circle (simplified - actual footprint depends on altitude and elevation angle)
    const footprintRadius = useMemo(() => {
        // Simplified calculation: visible radius ≈ sqrt(2 * R * h + h²)
        // where R = Earth radius (6371 km), h = altitude
        const earthRadius = 6371 // km
        const altKm = currentAlt // assuming altitude is in km
        if (altKm <= 0) {
            return 500 // default 500km radius
        }

        // Approximate ground coverage radius
        const radius = Math.sqrt(2 * earthRadius * altKm + altKm * altKm)
        return Math.min(radius, 3000) // cap at 3000km
    }, [currentAlt])

    // Ground stations (example positions)
    const groundStations = useMemo(
        () => [
            { name: 'Mission Control', lat: 51.7727, lng: 55.0988 }, // Orenburg, Russia
            { name: 'Tracking Station', lat: 43.238, lng: 76.9458 } // Almaty, Kazakhstan
        ],
        []
    )

    if (showSkeleton) {
        return (
            <Container
                title='Orbit Track'
                className={styles.panel}
            >
                <Skeleton style={{ height: '300px', width: '100%' }} />
            </Container>
        )
    }

    return (
        <Container
            title='Orbit Track'
            className={styles.panel}
        >
            <div className={styles.mapWrapper}>
                <MapContainer
                    center={[currentLat, currentLng]}
                    zoom={3}
                    className={styles.map}
                    scrollWheelZoom={false}
                    worldCopyJump={true}
                    attributionControl={false}
                >
                    <TileLayer url='https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' />

                    <MapUpdater
                        lat={currentLat}
                        lng={currentLng}
                    />

                    {/* Ground Track */}
                    {trackSegments.map((segment, idx) => (
                        <Polyline
                            key={`track-${idx}`}
                            positions={segment}
                            pathOptions={{
                                color: '#3b82f6',
                                weight: 2,
                                opacity: 0.7,
                                dashArray: '5, 5'
                            }}
                        />
                    ))}

                    {/* Footprint circle */}
                    {currentLat !== 0 && currentLng !== 0 && (
                        <CircleMarker
                            center={[currentLat, currentLng]}
                            radius={footprintRadius / 50} // Scale for visibility
                            pathOptions={{
                                color: '#22c55e',
                                fillColor: '#22c55e',
                                fillOpacity: 0.1,
                                weight: 1
                            }}
                        />
                    )}

                    {/* Satellite position */}
                    {currentLat !== 0 && currentLng !== 0 && (
                        <Marker
                            position={[currentLat, currentLng]}
                            icon={satelliteIcon}
                        >
                            <Tooltip
                                permanent
                                direction='top'
                                offset={[0, -20]}
                                className={styles.tooltip}
                            >
                                <div className={styles.tooltipContent}>
                                    <div>Alt: {currentAlt?.toFixed(1)} km</div>
                                </div>
                            </Tooltip>
                        </Marker>
                    )}

                    {/* Ground stations */}
                    {groundStations.map((station) => (
                        <CircleMarker
                            key={station.name}
                            center={[station.lat, station.lng]}
                            radius={6}
                            pathOptions={{
                                color: '#f97316',
                                fillColor: '#f97316',
                                fillOpacity: 0.8,
                                weight: 2
                            }}
                        >
                            <Tooltip
                                direction='top'
                                offset={[0, -5]}
                            >
                                {station.name}
                            </Tooltip>
                        </CircleMarker>
                    ))}
                </MapContainer>
            </div>

            <div className={styles.info}>
                <div className={styles.coords}>
                    <div className={styles.coord}>
                        <span>LAT</span>
                        <b>{currentLat?.toFixed(4) ?? '—'}°</b>
                    </div>
                    <div className={styles.coord}>
                        <span>LON</span>
                        <b>{currentLng?.toFixed(4) ?? '—'}°</b>
                    </div>
                    <div className={styles.coord}>
                        <span>ALT</span>
                        <b>{currentAlt?.toFixed(1) ?? '—'} km</b>
                    </div>
                </div>
                <div className={styles.legend}>
                    <div className={styles.legendItem}>
                        <span
                            className={styles.legendLine}
                            style={{ borderColor: '#3b82f6' }}
                        />
                        <span>Ground Track</span>
                    </div>
                    <div className={styles.legendItem}>
                        <span
                            className={styles.legendDot}
                            style={{ background: '#f97316' }}
                        />
                        <span>Ground Stations</span>
                    </div>
                </div>
            </div>
        </Container>
    )
})

OrbitMap.displayName = 'OrbitMap'
export default OrbitMap
