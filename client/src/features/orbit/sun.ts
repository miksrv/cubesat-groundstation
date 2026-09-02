/**
 * Where the Sun is, from the clock alone.
 *
 * This is the one thing on the orbital view that is **not** a fiction. The
 * orbit is simulated (see `simulate.ts` for why, at length), but the Sun is
 * not: the subsolar point at a given instant is a fact about the Earth, it
 * needs no telemetry and no ephemeris file to compute, and getting it right
 * costs about twenty lines. So the terminator on the globe is real even though
 * the satellite drawn against it is not, and the two are honest about which is
 * which.
 *
 * It used to be a constant. `earthMaterial.ts` held
 * `new THREE.Vector3(1, 0.3, 0.5)`, which works out to a subsolar point of
 * 15.0° N, 26.6° W — the Atlantic off Senegal, at about 13:46 UTC in mid-June,
 * frozen there forever. The globe does not rotate either, so Moscow was
 * permanently in daylight and Vladivostok permanently in the dark whatever the
 * hour. Nothing said so, because nothing said the shading meant anything.
 *
 * Which instant to draw is the caller's business, not this module's — see
 * `useSunInstant`. Live and the `yarn demo` replay draw the present; a mission
 * replayed off the timeline draws the afternoon it actually happened on.
 *
 * The formulae are the Astronomical Almanac's low-precision solar position
 * ("Approximate Solar Coordinates"), good to about 0.01° in declination over
 * 1950–2050 — three orders of magnitude finer than a terminator drawn 64
 * segments to a sphere can show, and traceable to something, which is the
 * standing rule for a number in this app.
 */

/** Where the Sun is directly overhead. Degrees, longitude in ±180. */
export interface SubsolarPoint {
    latDeg: number
    lonDeg: number
}

const DEG = Math.PI / 180

/** Julian days from J2000.0 (2000-01-01T12:00:00Z) — the argument every
 *  formula below is written in. */
const daysSinceJ2000 = (epochSeconds: number): number => epochSeconds / 86400 - 10957.5

const wrap360 = (degrees: number): number => ((degrees % 360) + 360) % 360
const wrap180 = (degrees: number): number => wrap360(degrees + 180) - 180

/**
 * The subsolar point at an instant.
 *
 * Declination is the "tilt of the light" — it is what puts the terminator
 * across northern Siberia in June and across the Sahara in December, and it is
 * the reason this cannot be a fixed vector with the right longitude.
 */
export const subsolarPoint = (epochSeconds: number): SubsolarPoint => {
    const n = daysSinceJ2000(epochSeconds)

    // Mean longitude and mean anomaly of the Sun.
    const meanLongitude = wrap360(280.46 + 0.9856474 * n)
    const meanAnomaly = wrap360(357.528 + 0.9856003 * n) * DEG

    // Ecliptic longitude: the mean longitude plus the equation of the centre,
    // which is the whole of why the equation of time exists.
    const eclipticLongitude = (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * DEG
    const obliquity = (23.439 - 0.0000004 * n) * DEG

    const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude))
    const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude))

    // Greenwich mean sidereal time turns a right ascension into a longitude:
    // where the Sun is in the sky becomes where it is over the ground.
    const gmstDeg = wrap360(280.46061837 + 360.98564736629 * n)

    return {
        latDeg: declination / DEG,
        lonDeg: wrap180(rightAscension / DEG - gmstDeg)
    }
}

const EARTH_RADIUS_KM = 6371

/**
 * Whether a satellite over `latDeg`/`lonDeg` at `altitudeKm` is in the Earth's
 * shadow at that instant.
 *
 * The cylindrical umbra: on the far side of the planet from the Sun *and*
 * within one Earth radius of the Earth–Sun axis. No penumbra — the partial
 * shadow is a couple of seconds of a 93-minute orbit, and this feeds a YES/NO.
 *
 * It shares one Sun with the shading on the globe deliberately. There used to
 * be two: this returned `cos(trueAnomaly) < 0` against a Sun assumed to sit at
 * longitude 0, while the shader used the frozen vector above, so the panel
 * could read "Eclipse: YES" with the satellite marker sitting in daylight.
 */
export const inEclipse = (latDeg: number, lonDeg: number, altitudeKm: number, epochSeconds: number): boolean => {
    const sun = subsolarPoint(epochSeconds)

    // Angle between the sub-satellite point and the subsolar point.
    const cosSeparation =
        Math.sin(latDeg * DEG) * Math.sin(sun.latDeg * DEG) +
        Math.cos(latDeg * DEG) * Math.cos(sun.latDeg * DEG) * Math.cos((lonDeg - sun.lonDeg) * DEG)

    const radiusKm = EARTH_RADIUS_KM + altitudeKm
    // cos of the angle past which the satellite has cleared the shadow cylinder.
    const grazing = -Math.sqrt(Math.max(0, 1 - (EARTH_RADIUS_KM / radiusKm) ** 2))

    return cosSeparation < grazing
}
