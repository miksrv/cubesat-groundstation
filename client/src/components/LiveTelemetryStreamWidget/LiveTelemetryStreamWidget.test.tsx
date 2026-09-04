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
        expect(screen.getByText(/EPS Battery Voltage: 3.759 V/)).toBeInTheDocument()
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

    it("puts the newest tick on top, and keeps a tick's fields in reading order", () => {
        // Three logs on one page must not read in two directions. The fields
        // inside one tick keep their own order — reversing those as well would
        // put "Row ID" first, which is nobody's reading order.
        const { rerender } = render(
            <LiveTelemetryStreamWidget
                latest={{ ...mockTelemetryRecord, id: 1, voltage: 4.1 }}
                isLoading={false}
            />
        )
        rerender(
            <LiveTelemetryStreamWidget
                latest={{ ...mockTelemetryRecord, id: 2, voltage: 3.9 }}
                isLoading={false}
            />
        )
        const lines = screen.getAllByText(/EPS Battery Voltage/).map((node) => node.textContent)
        expect(lines[0]).toContain('3.900 V')
        expect(lines[1]).toContain('4.100 V')

        const withinTick = screen.getAllByText(/EPS Battery Voltage|OBC CPU Usage/).map((n) => n.textContent)
        expect(withinTick[0]).toContain('EPS Battery Voltage')
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
