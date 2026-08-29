import React, { useMemo } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { AdcsStatus, CommsStatus } from '../../features/telemetry/types'
import StatRow from '../common/StatRow/StatRow'

import 'leaflet/dist/leaflet.css'
import styles from './GroundStationLinkMap.module.scss'

interface Props {
    adcs: AdcsStatus | null
    comms: CommsStatus | null
    isLoading: boolean
}

const GROUND_STATION = { name: 'ORENBURG, RUSSIA', lat: 51.7727, lon: 55.0988 }

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

const toRad = (deg: number): number => (deg * Math.PI) / 180
const toDeg = (rad: number): number => (rad * 180) / Math.PI

/**
 * Interpolate points along the great-circle path between two lat/lng
 * coordinates (spherical slerp), so the link line curves realistically on
 * the map instead of a naive straight line between the two points.
 */
const greatCirclePoints = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    segments = 32
): Array<[number, number]> => {
    const phi1 = toRad(lat1)
    const lambda1 = toRad(lon1)
    const phi2 = toRad(lat2)
    const lambda2 = toRad(lon2)

    const d =
        2 *
        Math.asin(
            Math.sqrt(
                Math.sin((phi2 - phi1) / 2) ** 2 +
                    Math.cos(phi1) * Math.cos(phi2) * Math.sin((lambda2 - lambda1) / 2) ** 2
            )
        )

    if (d === 0) {
        return [[lat1, lon1]]
    }

    const points: Array<[number, number]> = []
    for (let i = 0; i <= segments; i++) {
        const f = i / segments
        const a = Math.sin((1 - f) * d) / Math.sin(d)
        const b = Math.sin(f * d) / Math.sin(d)
        const x = a * Math.cos(phi1) * Math.cos(lambda1) + b * Math.cos(phi2) * Math.cos(lambda2)
        const y = a * Math.cos(phi1) * Math.sin(lambda1) + b * Math.cos(phi2) * Math.sin(lambda2)
        const z = a * Math.sin(phi1) + b * Math.sin(phi2)
        const phi = Math.atan2(z, Math.sqrt(x * x + y * y))
        const lambda = Math.atan2(y, x)
        points.push([toDeg(phi), toDeg(lambda)])
    }
    return points
}

/**
 * Split a path into segments wherever it crosses the antimeridian (a jump of
 * more than 180° in longitude between consecutive points). Leaflet draws a
 * straight line between consecutive positions on its flat projection, so an
 * unsplit path crossing ±180° would otherwise be rendered as one long line
 * stretching across the entire map instead of wrapping around the edge.
 */
const splitAtAntimeridian = (points: Array<[number, number]>): Array<Array<[number, number]>> => {
    if (points.length < 2) {
        return points.length ? [points] : []
    }

    const segments: Array<Array<[number, number]>> = []
    let current: Array<[number, number]> = [points[0]]

    for (let i = 1; i < points.length; i++) {
        const [, prevLon] = points[i - 1]
        const [, lon] = points[i]
        if (Math.abs(lon - prevLon) > 180) {
            segments.push(current)
            current = []
        }
        current.push(points[i])
    }
    segments.push(current)

    return segments.filter((segment) => segment.length > 1)
}

const GroundStationLinkMap: React.FC<Props> = React.memo(({ adcs, comms, isLoading }) => {
    const showSkeleton = isLoading && !adcs

    /*
      Only a real fix goes on the map. The GNSS sub-object always carries the
      *last known* position and never blocks the poll loop, so with no signal it
      holds stale coordinates and `fix: false` — drawing those would put the
      satellite somewhere it is not. And 0,0 is a real place in the Gulf of
      Guinea, which is exactly what this receiver reports when it has nothing.
    */
    const hasFix = adcs?.gnss.fix === true
    const currentLat = hasFix ? (adcs?.gnss.lat ?? 0) : 0
    const currentLng = hasFix ? (adcs?.gnss.lon ?? 0) : 0
    const currentAlt = hasFix ? (adcs?.gnss.alt ?? 0) : 0

    const linkSegments = useMemo(() => {
        if (currentLat === 0 && currentLng === 0) {
            return []
        }
        const points = greatCirclePoints(currentLat, currentLng, GROUND_STATION.lat, GROUND_STATION.lon)
        return splitAtAntimeridian(points)
    }, [currentLat, currentLng])

    // Simplified footprint radius: visible coverage ≈ sqrt(2 * R * h + h²)
    const footprintRadius = useMemo(() => {
        const earthRadius = 6371 // km
        if (currentAlt <= 0) {
            return 500
        }
        const radius = Math.sqrt(2 * earthRadius * currentAlt + currentAlt * currentAlt)
        return Math.min(radius, 3000)
    }, [currentAlt])

    if (showSkeleton) {
        return (
            <Container
                title='Ground Station Link'
                className={styles.panel}
            >
                <Skeleton style={{ height: '300px', width: '100%' }} />
            </Container>
        )
    }

    return (
        <Container
            title='Ground Station Link'
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

                    {linkSegments.map((segment, idx) => (
                        <Polyline
                            key={`link-${idx}`}
                            positions={segment}
                            pathOptions={{ color: '#22c55e', weight: 2, opacity: 0.8, dashArray: '6, 6' }}
                        />
                    ))}

                    {currentLat !== 0 && currentLng !== 0 && (
                        <CircleMarker
                            center={[currentLat, currentLng]}
                            radius={footprintRadius / 50}
                            pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.1, weight: 1 }}
                        />
                    )}

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

                    <CircleMarker
                        center={[GROUND_STATION.lat, GROUND_STATION.lon]}
                        radius={6}
                        pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.8, weight: 2 }}
                    >
                        <Tooltip
                            direction='top'
                            offset={[0, -5]}
                        >
                            {GROUND_STATION.name}
                        </Tooltip>
                    </CircleMarker>
                </MapContainer>
            </div>

            <div className={styles.info}>
                {/*
                  RSSI, SNR, latency, packet loss and a bitrate used to be here.
                  **None of them is telemetry on this satellite.** The radio is a
                  Heltec running Meshtastic, which does the framing, retries and
                  encryption itself and reports none of that back over the serial
                  link; SNR exists only on a message that has already arrived.
                  What COMMS does publish is whether the node answered, whether it
                  may transmit, whether it is still listening, and when an uplink
                  last landed — so that is what is shown.
                */}
                <div className={styles.coords}>
                    <div className={styles.coord}>
                        <span>Radio</span>
                        <b>{comms?.radio ? (comms.radio.present ? 'answered' : 'silent') : '—'}</b>
                    </div>
                    <div className={styles.coord}>
                        <span>Node</span>
                        <b>{comms?.radio?.node ?? '—'}</b>
                    </div>
                    <div className={styles.coord}>
                        <span>Region</span>
                        <b>{comms?.radio?.region ?? '—'}</b>
                    </div>
                    <div className={styles.coord}>
                        <span>Last uplink</span>
                        <b>
                            {comms?.lastUplink != null
                                ? new Date(comms.lastUplink * 1000).toLocaleTimeString(undefined, { hour12: false })
                                : 'none'}
                        </b>
                    </div>
                </div>
                <div className={styles.bottomRow}>
                    <div className={styles.uplinkDownlink}>
                        {/*
                          Quiet and deaf are different states, and this is the only
                          place the difference is visible: a silenced transmitter
                          that still listens is the way back into a satellite in
                          SAFE, not a fault.
                        */}
                        <StatRow
                            label='Transmitting'
                            value={comms ? (comms.loraEnabled ? 'yes' : 'no') : '—'}
                            mono
                        />
                        <StatRow
                            label='Listening'
                            value={comms ? (comms.loraListening ? 'yes' : 'no') : '—'}
                            mono
                        />
                    </div>
                    <div className={styles.legend}>
                        <div className={styles.legendItem}>
                            <span
                                className={styles.legendLine}
                                style={{ borderColor: '#22c55e' }}
                            />
                            <span>Ground Station Link</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span
                                className={styles.legendDot}
                                style={{ background: '#f97316' }}
                            />
                            <span>{GROUND_STATION.name}</span>
                        </div>
                    </div>
                </div>
            </div>
        </Container>
    )
})

GroundStationLinkMap.displayName = 'GroundStationLinkMap'
export default GroundStationLinkMap
