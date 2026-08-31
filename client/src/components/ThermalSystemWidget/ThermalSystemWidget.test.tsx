import { mockAdcs, mockScience, mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import ThermalSystemWidget from './ThermalSystemWidget'

import '@testing-library/jest-dom'

describe('ThermalSystemWidget', () => {
    it('renders the three temperatures this satellite actually measures', () => {
        // The SoC die, the IMU die and the air. There are no per-subsystem
        // thermometers on the boards, so the old OBC/EPS/battery/payload rows
        // were four plausible numbers with nothing behind them.
        render(
            <ThermalSystemWidget
                history={[]}
                latest={mockTelemetryRecord}
                adcs={mockAdcs}
                science={mockScience}
                isLoading={false}
            />
        )
        expect(screen.getByText('55.0°C')).toBeInTheDocument()
        expect(screen.getByText('34.5°C')).toBeInTheDocument()
        expect(screen.getByText('23.4°C')).toBeInTheDocument()
    })

    it('shows skeleton when loading with no data', () => {
        const { container } = render(
            <ThermalSystemWidget
                history={[]}
                latest={null}
                adcs={null}
                science={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
