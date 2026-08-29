import React, { useMemo } from 'react'
import * as THREE from 'three'

import { Line, OrbitControls, Stars, useTexture } from '@react-three/drei'

import earthDayUrl from '../../assets/earth/earth_day.jpg'
import earthNightUrl from '../../assets/earth/earth_night.png'
import type { OrbitState } from '../../features/orbit/simulate'
import type { TelemetryRecord } from '../../features/telemetry/types'
import { createEarthMaterial } from '../../three/earthMaterial'
import { latLonToVector3 } from '../../three/geo'

interface Props {
    latest: TelemetryRecord | null
    history: TelemetryRecord[]
    orbit: OrbitState | null
}

const EARTH_RADIUS = 2
const EARTH_REAL_RADIUS_KM = 6371

const Earth: React.FC = () => {
    const [dayMap, nightMap] = useTexture([earthDayUrl, earthNightUrl])
    const material = useMemo(() => createEarthMaterial(dayMap, nightMap), [dayMap, nightMap])

    return (
        <mesh material={material}>
            <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        </mesh>
    )
}

/**
 * Fit the orbital plane through two real ground-track positions (on the unit
 * sphere) and return a full ring of points around that plane at the given
 * radius. Returns null if the two positions are too close together to
 * define a stable plane (near-zero cross product).
 */
const fitOrbitalPlaneRing = (
    unitP1: THREE.Vector3,
    unitP2: THREE.Vector3,
    radius: number,
    segments = 128
): THREE.Vector3[] | null => {
    const normal = new THREE.Vector3().crossVectors(unitP1, unitP2)
    if (normal.lengthSq() < 1e-6) {
        return null
    }
    normal.normalize()

    const u = unitP1.clone().normalize()
    const v = new THREE.Vector3().crossVectors(normal, u).normalize()

    const points: THREE.Vector3[] = []
    for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2
        points.push(
            new THREE.Vector3(
                radius * (Math.cos(t) * u.x + Math.sin(t) * v.x),
                radius * (Math.cos(t) * u.y + Math.sin(t) * v.y),
                radius * (Math.cos(t) * u.z + Math.sin(t) * v.z)
            )
        )
    }
    return points
}

/** Fallback ring built from the independently-simulated /orbit elements, used only when there isn't enough real ground-track data yet to fit a plane. */
const fallbackOrbitRing = (orbit: OrbitState | null, radius: number, segments = 128): THREE.Vector3[] => {
    const inclinationRad = ((orbit?.inclinationDeg ?? 51.6) * Math.PI) / 180
    const raanRad = ((orbit?.raanDeg ?? 0) * Math.PI) / 180

    const raw: THREE.Vector3[] = []
    for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2
        raw.push(new THREE.Vector3(radius * Math.cos(t), 0, radius * Math.sin(t)))
    }

    const inclineMatrix = new THREE.Matrix4().makeRotationZ(inclinationRad)
    const raanMatrix = new THREE.Matrix4().makeRotationY(raanRad)
    return raw.map((p) => p.applyMatrix4(inclineMatrix).applyMatrix4(raanMatrix))
}

interface OrbitRingProps {
    orbit: OrbitState | null
    latest: TelemetryRecord | null
    history: TelemetryRecord[]
}

const OrbitRing: React.FC<OrbitRingProps> = ({ orbit, latest, history }) => {
    const points = useMemo(() => {
        const altitudeKm = latest?.gnss.alt ?? orbit?.altitudeKm ?? 500
        const radius = EARTH_RADIUS * (1 + altitudeKm / EARTH_REAL_RADIUS_KM)

        // Fit the ring through the actual ground track (oldest vs. newest valid
        // fix gives the widest, most stable angular baseline) so it always
        // matches the real satellite position/inclination instead of the
        // independently-simulated /orbit elements.
        const validFixes = history.filter((r) => r.gnss.lat != null && r.gnss.lon != null)
        if (validFixes.length >= 2) {
            const first = validFixes[0]
            const last = validFixes[validFixes.length - 1]
            const unitP1 = latLonToVector3(first.gnss.lat!, first.gnss.lon!, 1)
            const unitP2 = latLonToVector3(last.gnss.lat!, last.gnss.lon!, 1)
            const fitted = fitOrbitalPlaneRing(unitP1, unitP2, radius)
            if (fitted) {
                return fitted
            }
        }

        return fallbackOrbitRing(orbit, radius)
    }, [orbit, latest?.gnss.alt, history])

    return (
        <Line
            points={points}
            color='#22c55e'
            transparent
            opacity={0.45}
            lineWidth={1}
        />
    )
}

const GroundTrack: React.FC<{ history: TelemetryRecord[] }> = ({ history }) => {
    const points = useMemo(() => {
        const radius = EARTH_RADIUS * 1.015
        return history
            .filter((r) => r.gnss.lat != null && r.gnss.lon != null)
            .slice(-60)
            .map((r) => latLonToVector3(r.gnss.lat!, r.gnss.lon!, radius))
    }, [history])

    if (points.length < 2) {
        return null
    }

    return (
        <Line
            points={points}
            color='#3b82f6'
            lineWidth={1.5}
        />
    )
}

const SatelliteMarker: React.FC<{ latest: TelemetryRecord | null }> = ({ latest }) => {
    if (latest?.gnss.lat == null || latest?.gnss.lon == null) {
        return null
    }
    const position = latLonToVector3(latest.gnss.lat, latest.gnss.lon, EARTH_RADIUS * 1.02)

    return (
        <mesh position={position}>
            <sphereGeometry args={[0.035, 16, 16]} />
            <meshBasicMaterial color='#22c55e' />
        </mesh>
    )
}

const EarthScene: React.FC<Props> = ({ latest, history, orbit }) => (
    <>
        <ambientLight intensity={0.15} />
        <directionalLight
            position={[3, 1, 1.5]}
            intensity={1.2}
        />
        <Stars
            radius={50}
            depth={30}
            count={2000}
            factor={2}
            fade
        />
        <Earth />
        <OrbitRing
            orbit={orbit}
            latest={latest}
            history={history}
        />
        <GroundTrack history={history} />
        <SatelliteMarker latest={latest} />
        <OrbitControls
            autoRotate
            autoRotateSpeed={0.4}
            enableZoom
            enablePan={false}
            minDistance={3}
            maxDistance={10}
        />
    </>
)

export default EarthScene
