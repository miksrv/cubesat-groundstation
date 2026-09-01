import { mockEps, mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import PowerSystemWidget from './PowerSystemWidget'

import '@testing-library/jest-dom'

describe('PowerSystemWidget', () => {
    it('renders battery level, voltage and charge rate', () => {
        render(
            <PowerSystemWidget
                history={[]}
                eps={mockEps}
                obc={null}
                isLoading={false}
            />
        )
        // Exactly once: the footer used to repeat the same percent as its
        // reason, and now explains the badge in words instead.
        expect(screen.getAllByText('87.5 %')).toHaveLength(1)
        expect(screen.getByText('on battery')).toBeInTheDocument()
        expect(screen.getByText('4.123 V')).toBeInTheDocument()
        // Signed percent per hour from the gauge's CRATE register: negative is
        // draining. It replaced a current and a wattage that were derived from a
        // field no sensor on this satellite produces.
        expect(screen.getByText('-0.21 %/h')).toBeInTheDocument()
    })

    it('estimates time to empty from a real drain, marked as an estimate', () => {
        render(
            <PowerSystemWidget
                history={[]}
                eps={{ ...mockEps, batteryPercent: 80, chargeRate: -2.5 }}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.getByText('~32.0 h to empty')).toBeInTheDocument()
    })

    it('estimates time to full while charging', () => {
        render(
            <PowerSystemWidget
                history={[]}
                eps={{ ...mockEps, batteryPercent: 80, externalPower: true, chargeRate: 8 }}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.getByText('~2.5 h to full')).toBeInTheDocument()
    })

    it('withholds the estimate at gauge-noise rates rather than promising 400 hours', () => {
        // One CRATE LSB is 0.208 %/h. Dividing the battery by noise produces a
        // huge confident number the satellite never measured — the fixture's
        // rate is exactly one LSB, and the row says nothing instead.
        render(
            <PowerSystemWidget
                history={[]}
                eps={mockEps}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.queryByText(/to empty|to full/)).not.toBeInTheDocument()
    })

    it('shows the power source the satellite reported', () => {
        render(
            <PowerSystemWidget
                history={[]}
                eps={{ ...mockEps, externalPower: true }}
                obc={null}
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
                history={[]}
                eps={{ ...mockEps, batteryPercent: 8, externalPower: true, chargeRate: 4.2 }}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.getByText(/on mains/)).toBeInTheDocument()
    })

    it('draws the voltage trend from the recorded history', () => {
        render(
            <PowerSystemWidget
                history={[
                    { ...mockTelemetryRecord, id: 2, voltage: 4.1 },
                    { ...mockTelemetryRecord, id: 1, voltage: 4.2 }
                ]}
                eps={mockEps}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.getByTestId('sparkline')).toBeInTheDocument()
    })

    it('shows skeleton when loading with no data', () => {
        const { container } = render(
            <PowerSystemWidget
                history={[]}
                eps={null}
                obc={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
