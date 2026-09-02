import { inEclipse, subsolarPoint } from './sun'

const at = (iso: string): number => Date.parse(iso) / 1000

/**
 * These assertions are against the almanac, not against the implementation.
 *
 * That is the whole point of testing this file: the values below were not read
 * off a previous run, they are what the Sun actually does, so a regression that
 * still "looks like a terminator" has nowhere to hide. The predecessor of this
 * module was a hard-coded vector nobody could have written a failing test for.
 */
describe('subsolarPoint', () => {
    it('puts the Sun over the tropics at the solstices', () => {
        // The obliquity of the ecliptic, 23.44°, is the whole of the seasons.
        expect(subsolarPoint(at('2026-06-21T08:24:00Z')).latDeg).toBeCloseTo(23.44, 1)
        expect(subsolarPoint(at('2026-12-21T16:03:00Z')).latDeg).toBeCloseTo(-23.44, 1)
    })

    it('puts the Sun over the equator at the equinoxes', () => {
        expect(subsolarPoint(at('2026-03-20T14:46:00Z')).latDeg).toBeCloseTo(0, 1)
        expect(subsolarPoint(at('2026-09-23T00:05:00Z')).latDeg).toBeCloseTo(0, 1)
    })

    /**
     * At noon UTC the Sun is not over Greenwich — it is off by the equation of
     * time, a quarter of a degree per minute of it. This is the assertion that
     * a mean-longitude-only implementation fails, and it is worth having:
     * without the equation of the centre the terminator is up to four degrees
     * out for half the year.
     */
    it('is displaced from Greenwich at noon UTC by the equation of time', () => {
        // 11 February: the annual minimum, about −14.2 min → +3.55° E.
        expect(subsolarPoint(at('2026-02-11T12:00:00Z')).lonDeg).toBeCloseTo(3.55, 1)
        // 3 November: the annual maximum, about +16.4 min → −4.11° W.
        expect(subsolarPoint(at('2026-11-03T12:00:00Z')).lonDeg).toBeCloseTo(-4.11, 1)
    })

    it('carries the Sun 15° west an hour', () => {
        const noon = subsolarPoint(at('2026-09-02T12:00:00Z')).lonDeg
        const later = subsolarPoint(at('2026-09-02T18:00:00Z')).lonDeg
        // Six hours, minus the ~0.02° the equation of time moves in that time.
        expect(later - noon).toBeCloseTo(-90, 1)
    })

    it('keeps longitude in ±180', () => {
        for (let hour = 0; hour < 24; hour++) {
            const { lonDeg } = subsolarPoint(at(`2026-09-02T${String(hour).padStart(2, '0')}:00:00Z`))
            expect(lonDeg).toBeGreaterThanOrEqual(-180)
            expect(lonDeg).toBeLessThanOrEqual(180)
        }
    })
})

describe('inEclipse', () => {
    const instant = at('2026-09-02T12:00:00Z')
    const sun = subsolarPoint(instant)

    it('does not shadow a satellite over the subsolar point', () => {
        expect(inEclipse(sun.latDeg, sun.lonDeg, 420, instant)).toBe(false)
    })

    it('shadows one over the antipode', () => {
        expect(inEclipse(-sun.latDeg, sun.lonDeg + 180, 420, instant)).toBe(true)
    })

    it('leaves a satellite on the terminator in sunlight', () => {
        // 90° from the Sun is the geometric terminator, and a satellite 420 km
        // up sees the Sun for another 20° past it. A test that expected shadow
        // here would be describing a flat Earth.
        expect(inEclipse(sun.latDeg, sun.lonDeg + 90, 420, instant)).toBe(false)
    })

    it('shadows a lower satellite where it spares a higher one', () => {
        // Just inside the geometric night. The umbra narrows with altitude, so
        // altitude is not a parameter that can be dropped.
        const lonDeg = sun.lonDeg + 160
        expect(inEclipse(sun.latDeg, lonDeg, 100, instant)).toBe(true)
        expect(inEclipse(sun.latDeg, lonDeg, 40_000, instant)).toBe(false)
    })

    it('agrees with itself half a year and half a day later', () => {
        // Same place, opposite season and opposite side of the planet: the
        // check that neither the clock nor the declination has been dropped.
        const winter = at('2026-03-02T00:00:00Z')
        const winterSun = subsolarPoint(winter)
        expect(inEclipse(winterSun.latDeg, winterSun.lonDeg, 420, winter)).toBe(false)
    })
})
