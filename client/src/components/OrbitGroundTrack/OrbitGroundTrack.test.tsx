import type { OrbitState } from '../../features/orbit/simulate'
import { mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import OrbitGroundTrack from './OrbitGroundTrack'

import '@testing-library/jest-dom'

const mockOrbit: OrbitState = {
    simulated: true,
    orbitType: 'LEO (simulated)',
    altitudeKm: 506,
    inclinationDeg: 97.45,
    periodMin: 94.6,
    raanDeg: 100,
    aopDeg: 80,
    trueAnomalyDeg: 45,
    eclipse: true,
    latDeg: 12.3,
    lonDeg: -45.6,
    orbitNumber: 245,
    groundStation: { name: 'ORENBURG, RUSSIA', lat: 51.7727, lon: 55.0988 },
    nextPassSeconds: 454
}

/** A fixed instant, so the subsolar readout is a value and not a moving target.
 *  Noon UTC in early September: the Sun is over 7.8° N and, the equation of time
 *  being near zero that week, almost exactly on the Greenwich meridian. */
const SUN_INSTANT = Date.parse('2026-09-02T12:00:00Z') / 1000

describe('OrbitGroundTrack', () => {
    it('renders the panel title and the (mocked) canvas once the lazy scene resolves', async () => {
        render(
            <OrbitGroundTrack
                latest={mockTelemetryRecord}
                history={[mockTelemetryRecord]}
                orbit={mockOrbit}
                sunInstant={SUN_INSTANT}
                isLoading={false}
            />
        )
        expect(screen.getByText('Orbit & Ground Track')).toBeInTheDocument()
        expect(await screen.findByTestId('r3f-canvas')).toBeInTheDocument()
    })

    it('renders the eclipse flag and the simulated true anomaly', async () => {
        render(
            <OrbitGroundTrack
                latest={mockTelemetryRecord}
                history={[mockTelemetryRecord]}
                orbit={mockOrbit}
                sunInstant={SUN_INSTANT}
                isLoading={false}
            />
        )
        await screen.findByTestId('r3f-canvas')
        expect(screen.getByText('YES')).toBeInTheDocument()
        // The simulation propagates a circular orbit from the clock and nothing
        // more; a beta angle would be precision about a fiction.
        expect(screen.getByText('45.0°')).toBeInTheDocument()
    })

    it('prints the subsolar point for the instant it was given', async () => {
        render(
            <OrbitGroundTrack
                latest={mockTelemetryRecord}
                history={[mockTelemetryRecord]}
                orbit={mockOrbit}
                sunInstant={SUN_INSTANT}
                isLoading={false}
            />
        )
        await screen.findByTestId('r3f-canvas')
        // Where the Sun actually was at that moment — the widget prints the
        // same number the globe is shaded from, so a terminator nailed to a
        // constant (which is what this replaced) cannot pass.
        expect(screen.getByText('7.8°N 0.1°W')).toBeInTheDocument()
    })

    it('still dates the sky while the orbital readouts are blank', async () => {
        // What a mission replay looks like: the Dashboard withholds the
        // simulated orbit but still says which afternoon is on screen.
        render(
            <OrbitGroundTrack
                latest={mockTelemetryRecord}
                history={[mockTelemetryRecord]}
                orbit={null}
                sunInstant={Date.parse('2026-06-21T08:24:00Z') / 1000}
                isLoading={false}
            />
        )
        await screen.findByTestId('r3f-canvas')
        expect(screen.getByText('23.4°N 54.4°E')).toBeInTheDocument()
    })

    it('shows skeleton when loading with no data', () => {
        const { container } = render(
            <OrbitGroundTrack
                latest={null}
                history={[]}
                orbit={null}
                sunInstant={SUN_INSTANT}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
