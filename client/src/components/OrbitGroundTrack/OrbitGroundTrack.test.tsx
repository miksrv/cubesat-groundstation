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

describe('OrbitGroundTrack', () => {
    it('renders the panel title and the (mocked) canvas once the lazy scene resolves', async () => {
        render(
            <OrbitGroundTrack
                latest={mockTelemetryRecord}
                history={[mockTelemetryRecord]}
                orbit={mockOrbit}
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
                isLoading={false}
            />
        )
        await screen.findByTestId('r3f-canvas')
        expect(screen.getByText('YES')).toBeInTheDocument()
        // The simulation propagates a circular orbit from the clock and nothing
        // more; a beta angle would be precision about a fiction.
        expect(screen.getByText('45.0°')).toBeInTheDocument()
    })

    it('shows skeleton when loading with no data', () => {
        const { container } = render(
            <OrbitGroundTrack
                latest={null}
                history={[]}
                orbit={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
