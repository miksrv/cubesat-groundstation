import * as THREE from 'three'

/**
 * Convert a lat/lon (degrees) to a point on a sphere of the given radius,
 * using the standard three.js equirectangular-texture convention (matches
 * how earth_day/earth_night textures are UV-mapped onto a SphereGeometry).
 */
export const latLonToVector3 = (lat: number, lon: number, radius: number): THREE.Vector3 => {
    const phi = ((90 - lat) * Math.PI) / 180
    const theta = ((lon + 180) * Math.PI) / 180

    return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    )
}
