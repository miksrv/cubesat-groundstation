/**
 * The orbit is a simulation, and this file is where that is said out loud.
 *
 * The satellite is a working model: it sits on a desk, goes to a science fair,
 * and rides to work in a backpack. It has no orbit, no inclination and no
 * ground station passes, and it never will. What it has is a GNSS receiver
 * reporting where it actually is.
 *
 * The orbital view is a **teaching aid**, and it earns its place — it is the
 * part of the display a visitor recognises. But it must never be mistaken for
 * telemetry, so:
 *
 *   - it is computed here, in the browser, from the clock. It never arrives on
 *     a topic, never comes out of the database, and no widget can confuse it
 *     with something the satellite measured;
 *   - the parameters are a real, named orbit — the ISS's, rounded — rather than
 *     numbers chosen to look plausible. A number in this app should be
 *     traceable to something, even when the something is "the ISS";
 *   - anything drawn from it is labelled as simulated in the UI.
 *
 * The real position — the one from the receiver — belongs on the map, from
 * `gnss`, and only from rows where `fix` is true.
 */

/** A simulated orbital state. Nothing here was measured. */
export interface OrbitState {
    simulated: true
    orbitType: string
    altitudeKm: number
    inclinationDeg: number
    periodMin: number
    raanDeg: number
    aopDeg: number
    trueAnomalyDeg: number
    /** Sub-satellite point, for the ground track. */
    latDeg: number
    lonDeg: number
    eclipse: boolean
    orbitNumber: number
    /** Seconds until the simulated pass over the ground station below. */
    nextPassSeconds: number
    groundStation: { name: string; lat: number; lon: number }
}

/** The ISS, rounded. A real orbit rather than invented numbers. */
const ALTITUDE_KM = 420
const INCLINATION_DEG = 51.64
const PERIOD_MIN = 92.9
const RAAN_DEG = 247.4
const AOP_DEG = 96.3

const EARTH_ROTATION_DEG_PER_MIN = 360 / (23 * 60 + 56)

/** Where the dashboard pretends the ground station is. Moscow. */
const GROUND_STATION = { name: 'Moscow', lat: 55.7558, lon: 37.6173 }

const EPOCH = Date.parse('2026-01-01T00:00:00Z') / 1000

const wrap180 = (degrees: number): number => ((((degrees + 180) % 360) + 360) % 360) - 180

/**
 * The simulated state at a moment.
 *
 * A circular orbit propagated by nothing more than elapsed time: the true
 * anomaly advances at a constant rate, latitude follows the inclination, and
 * longitude drifts westward as the Earth turns underneath. That is enough for a
 * ground track that moves the way one should, and it is deliberately not more —
 * an SGP4 propagator here would be precision about a satellite that is in
 * somebody's backpack.
 */
export const simulateOrbit = (nowSeconds: number = Date.now() / 1000): OrbitState => {
    const minutes = (nowSeconds - EPOCH) / 60
    const orbits = minutes / PERIOD_MIN
    const trueAnomalyDeg = (orbits % 1) * 360
    const anomalyRad = (trueAnomalyDeg * Math.PI) / 180
    const inclinationRad = (INCLINATION_DEG * Math.PI) / 180

    const latDeg = (Math.asin(Math.sin(inclinationRad) * Math.sin(anomalyRad)) * 180) / Math.PI
    const argument = Math.atan2(Math.cos(inclinationRad) * Math.sin(anomalyRad), Math.cos(anomalyRad))
    const lonDeg = wrap180((argument * 180) / Math.PI + RAAN_DEG - minutes * EARTH_ROTATION_DEG_PER_MIN)

    // Eclipse: crudely, the half of the orbit facing away from a Sun fixed at
    // longitude 0. Crude on purpose — a real terminator model would be
    // precision about a fiction.
    const eclipse = Math.cos(anomalyRad) < 0

    const separation = Math.abs(wrap180(GROUND_STATION.lon - lonDeg)) / 360
    return {
        simulated: true,
        orbitType: 'LEO (simulated)',
        altitudeKm: ALTITUDE_KM,
        inclinationDeg: INCLINATION_DEG,
        periodMin: PERIOD_MIN,
        raanDeg: RAAN_DEG,
        aopDeg: AOP_DEG,
        trueAnomalyDeg,
        latDeg,
        lonDeg,
        eclipse,
        orbitNumber: Math.floor(orbits),
        nextPassSeconds: Math.round(separation * PERIOD_MIN * 60),
        groundStation: GROUND_STATION
    }
}
