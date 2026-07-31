import { mockTelemetryRecord } from '../../test-fixtures'
import { fireEvent, render, screen } from '../../test-utils'

import LiveTelemetryStreamWidget from './LiveTelemetryStreamWidget'

import '@testing-library/jest-dom'

describe('LiveTelemetryStreamWidget', () => {
    it('renders a log line derived from the latest record', () => {
        render(
            <LiveTelemetryStreamWidget
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getByText(/EPS Battery Voltage: 8.14 V/)).toBeInTheDocument()
    })

    it('shows a waiting message when there is no data yet', () => {
        render(
            <LiveTelemetryStreamWidget
                latest={null}
                isLoading={false}
            />
        )
        expect(screen.getByText('Waiting for telemetry…')).toBeInTheDocument()
    })

    it('toggles pause/resume label on click', () => {
        render(
            <LiveTelemetryStreamWidget
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        const button = screen.getByRole('button', { name: 'PAUSE' })
        fireEvent.click(button)
        expect(screen.getByRole('button', { name: 'RESUME' })).toBeInTheDocument()
    })
})
