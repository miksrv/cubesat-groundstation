import type { OrbitState } from '../../features/telemetry/types'
import { mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import OrbitGroundTrack from './OrbitGroundTrack'

import '@testing-library/jest-dom'

const mockOrbit: OrbitState = {
    orbit_type: 'LEO',
    altitude_km: 506,
    inclination_deg: 97.45,
    period_min: 94.6,
    raan_deg: 100,
    aop_deg: 80,
    true_anomaly_deg: 45,
    eclipse: true,
    beta_angle_deg: 32.1,
    orbit_number: 245,
    ground_station: { name: 'ORENBURG, RUSSIA', lat: 51.7727, lon: 55.0988 },
    next_pass_seconds: 454
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

    it('renders eclipse and beta angle from orbit state', async () => {
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
        expect(screen.getByText('32.1°')).toBeInTheDocument()
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
