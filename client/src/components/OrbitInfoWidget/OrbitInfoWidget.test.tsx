import type { OrbitState } from '../../features/telemetry/types'
import { render, screen } from '../../test-utils'

import OrbitInfoWidget from './OrbitInfoWidget'

import '@testing-library/jest-dom'

const mockOrbit: OrbitState = {
    orbit_type: 'LEO',
    altitude_km: 506.4,
    inclination_deg: 97.45,
    period_min: 94.62,
    raan_deg: 123.54,
    aop_deg: 87.12,
    true_anomaly_deg: 45.32,
    eclipse: false,
    beta_angle_deg: 32.1,
    orbit_number: 245,
    ground_station: { name: 'ORENBURG, RUSSIA', lat: 51.7727, lon: 55.0988 },
    next_pass_seconds: 454
}

describe('OrbitInfoWidget', () => {
    it('renders orbital elements from orbit state', () => {
        render(<OrbitInfoWidget orbit={mockOrbit} />)
        expect(screen.getByText('LEO')).toBeInTheDocument()
        expect(screen.getByText('506.4 km')).toBeInTheDocument()
        expect(screen.getByText('97.45°')).toBeInTheDocument()
        expect(screen.getByText('94.62 min')).toBeInTheDocument()
        expect(screen.getByText('123.54°')).toBeInTheDocument()
    })

    it('shows skeleton when orbit is null', () => {
        const { container } = render(<OrbitInfoWidget orbit={null} />)
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
