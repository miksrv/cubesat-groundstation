import { mockEps, mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import PowerSystemWidget from './PowerSystemWidget'

import '@testing-library/jest-dom'

describe('PowerSystemWidget', () => {
    it('renders the voltage, the derived level and the fitted slope', () => {
        render(
            <PowerSystemWidget
                history={[]}
                eps={mockEps}
                obc={null}
                isLoading={false}
            />
        )
        // The measurement, and the only one in the payload.
        expect(screen.getByText('3.759 V')).toBeInTheDocument()
        // Exactly once: the footer used to repeat the same figure as its reason,
        // and now explains the badge in words instead.
        expect(screen.getAllByText('48.6 %')).toHaveLength(1)
        expect(screen.getByText('on battery')).toBeInTheDocument()
        // Millivolts per hour lead, because that is the slope the satellite's
        // power policy compares; the %/h beside it is the same slope through the
        // pack curve. The old row showed only the percentage, and took it from a
        // CRATE register this part does not have.
        expect(screen.getByText('-197 mV/h (-24.62 %/h)')).toBeInTheDocument()
    })

    it("labels the level as derived, because it is a curve's answer and not a reading", () => {
        // It is the voltage above it through an inferred pack curve. Two numbers
        // stacked together read as two measurements, and only one of them is.
        render(
            <PowerSystemWidget
                history={[]}
                eps={mockEps}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.getByText('Battery Level (derived)')).toBeInTheDocument()
    })

    it("takes the time remaining from the satellite's own field, never from arithmetic here", () => {
        // The widget used to compute `battery / rate` — percent divided by
        // percent-per-hour, with no curve between them — which for this fixture
        // would land near 2 h and diverge from the satellite everywhere close to
        // the knee. Publishing a *different* estimate against an untouched
        // voltage and level is what tells the two implementations apart: only the
        // one that reads `timeToEmptySec` can produce this line.
        render(
            <PowerSystemWidget
                history={[]}
                eps={{ ...mockEps, timeToEmptySec: 3600 }}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.getByText('~1.0 h to empty')).toBeInTheDocument()
    })

    it('reports minutes under the hour, and keeps the "to full" wording on a charge', () => {
        render(
            <PowerSystemWidget
                history={[]}
                eps={{
                    ...mockEps,
                    externalPower: true,
                    voltageRate: 120,
                    chargeRate: 15,
                    timeToEmptySec: null,
                    timeToFullSec: 2700
                }}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.getByText('~45 min to full')).toBeInTheDocument()
    })

    it('withholds the time remaining when the satellite published neither estimate', () => {
        // Which is what a pack that is holding, a slope pointing away from the
        // target and EPS' first five minutes all look like. Nothing here may fill
        // that gap: the arithmetic needs the pack curve, and the curve is on the
        // satellite.
        render(
            <PowerSystemWidget
                history={[]}
                eps={{ ...mockEps, timeToEmptySec: null, timeToFullSec: null }}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.queryByText(/to empty|to full/)).not.toBeInTheDocument()
    })

    it('withholds the slope in the window where EPS has not fitted one', () => {
        // Null for the first 300 s of a session and for 300 s after the mains pin
        // moves. A dash says "not known yet"; a 0 would claim a pack measured
        // holding steady, which is the statement the satellite refuses to make.
        render(
            <PowerSystemWidget
                history={[]}
                eps={{ ...mockEps, voltageRate: null, chargeRate: null }}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.queryByText(/mV\/h/)).not.toBeInTheDocument()
    })

    it('shows a slope inside the fitting noise as zero, not as minus zero', () => {
        // One 1.25 mV VCELL step across the 600 s window is ±7.5 mV/h, so whole
        // millivolts per hour is all the precision this number has — and a pack
        // measured holding steady must read as steady rather than as a rounding
        // artefact with a sign on it.
        render(
            <PowerSystemWidget
                history={[]}
                eps={{ ...mockEps, voltageRate: -0.4, chargeRate: null, timeToEmptySec: null }}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.getByText('0 mV/h')).toBeInTheDocument()
    })

    it('shows the power source the satellite reported', () => {
        render(
            <PowerSystemWidget
                history={[]}
                eps={{ ...mockEps, externalPower: true, voltageRate: 0, chargeRate: 0, timeToEmptySec: null }}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.getByText('Mains')).toBeInTheDocument()
    })

    it('is not alarmed by a gauge claiming a low percentage while the pack sits on mains', () => {
        // The drift that nearly powered a plugged-in satellite off: on 2026-09-03
        // this gauge's modelled state of charge fell at 8-10 %/h for an hour
        // while the terminal voltage held 3.806-3.809 V with the charge LEDs lit.
        // The satellite ignores `gaugePercent` and so does this widget — a
        // dashboard deciding on it would shout CRITICAL at a satellite on a desk.
        render(
            <PowerSystemWidget
                history={[]}
                eps={{
                    ...mockEps,
                    voltage: 3.809,
                    voltageMedian: 3.807,
                    batteryPercent: 56.0,
                    gaugePercent: 8.0,
                    externalPower: true,
                    voltageRate: 0,
                    chargeRate: 0,
                    timeToEmptySec: null
                }}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.getByText(/on mains/)).toBeInTheDocument()
    })

    it('still says CRITICAL range on mains when the voltage is falling anyway', () => {
        // The other half of the mains rule: a charger that has stopped charging
        // still reads as external power, and the pin alone would disable the
        // protection for as long as the cable stays in.
        render(
            <PowerSystemWidget
                history={[]}
                eps={{
                    ...mockEps,
                    voltage: 3.41,
                    voltageMedian: 3.41,
                    batteryPercent: 7.9,
                    externalPower: true,
                    voltageRate: -197,
                    chargeRate: -19.7
                }}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.getByText('CRITICAL range')).toBeInTheDocument()
    })

    it('says below SAFE between the two voltage thresholds', () => {
        render(
            <PowerSystemWidget
                history={[]}
                eps={{ ...mockEps, voltage: 3.52, voltageMedian: 3.52, batteryPercent: 15.0 }}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.getByText('below SAFE')).toBeInTheDocument()
    })

    it('draws the voltage trend from the recorded history', () => {
        render(
            <PowerSystemWidget
                history={[
                    { ...mockTelemetryRecord, id: 2, voltage: 3.75 },
                    { ...mockTelemetryRecord, id: 1, voltage: 3.78 }
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
