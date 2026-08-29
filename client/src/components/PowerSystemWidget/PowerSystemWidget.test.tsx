import { mockEps } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import PowerSystemWidget from './PowerSystemWidget'

import '@testing-library/jest-dom'

describe('PowerSystemWidget', () => {
    it('renders battery level, voltage and charge rate', () => {
        render(
            <PowerSystemWidget
                eps={mockEps}
                isLoading={false}
            />
        )
        // Twice: the row and the status footer, which says the same number as
        // its reason.
        expect(screen.getAllByText('87.5 %').length).toBeGreaterThan(0)
        expect(screen.getByText('4.123 V')).toBeInTheDocument()
        // Signed percent per hour from the gauge's CRATE register: negative is
        // draining. It replaced a current and a wattage that were derived from a
        // field no sensor on this satellite produces.
        expect(screen.getByText('-0.21 %/h')).toBeInTheDocument()
    })

    it('shows the power source the satellite reported', () => {
        render(
            <PowerSystemWidget
                eps={{ ...mockEps, externalPower: true }}
                isLoading={false}
            />
        )
        expect(screen.getByText('Mains')).toBeInTheDocument()
    })

    it('is not alarmed by a low battery that is plugged in and charging', () => {
        // On mains there is no power emergency: the satellite suppresses its own
        // power-driven descents while external power is present and the charge
        // rate is not still falling, and the dashboard must not contradict it.
        render(
            <PowerSystemWidget
                eps={{ ...mockEps, batteryPercent: 8, externalPower: true, chargeRate: 4.2 }}
                isLoading={false}
            />
        )
        expect(screen.getByText(/on mains/)).toBeInTheDocument()
    })

    it('shows skeleton when loading with no data', () => {
        const { container } = render(
            <PowerSystemWidget
                eps={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
