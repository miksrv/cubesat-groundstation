import type { OrbitState } from '../../features/orbit/simulate'
import { render, screen } from '../../test-utils'

import OrbitInfoWidget from './OrbitInfoWidget'

import '@testing-library/jest-dom'

/** Simulated: this satellite has no orbit. See features/orbit/simulate.ts. */
const mockOrbit: OrbitState = {
    simulated: true,
    orbitType: 'LEO (simulated)',
    altitudeKm: 506.4,
    inclinationDeg: 97.45,
    periodMin: 94.62,
    raanDeg: 123.54,
    aopDeg: 87.12,
    trueAnomalyDeg: 45.32,
    latDeg: 12.3,
    lonDeg: -45.6,
    eclipse: false,
    orbitNumber: 245,
    nextPassSeconds: 454,
    groundStation: { name: 'Moscow', lat: 55.7558, lon: 37.6173 }
}

describe('OrbitInfoWidget', () => {
    it('renders orbital elements from orbit state', () => {
        render(<OrbitInfoWidget orbit={mockOrbit} />)
        expect(screen.getByText('LEO (simulated)')).toBeInTheDocument()
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
