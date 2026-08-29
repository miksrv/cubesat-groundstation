import { emptyLiveState, mockLiveState, mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import OBCSystemWidget from './OBCSystemWidget'

import '@testing-library/jest-dom'

describe('OBCSystemWidget', () => {
    it('renders CPU, RAM and storage from the newest recorded row', () => {
        // Not from a status topic: nothing publishes the host's own metrics, so
        // these come from what DHS wrote and are up to one cadence old.
        render(
            <OBCSystemWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getByText('34%')).toBeInTheDocument()
        expect(screen.getByText('52%')).toBeInTheDocument()
        expect(screen.getByText('41%')).toBeInTheDocument()
    })

    it('shows the mission state and profile, which say what the computer is doing', () => {
        render(
            <OBCSystemWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getAllByText('NOMINAL').length).toBeGreaterThan(0)
        expect(screen.getByText('FLIGHT')).toBeInTheDocument()
    })

    it('formats uptime as days/hours/minutes', () => {
        render(
            <OBCSystemWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        // 187562s = 2d 04h 06m
        expect(screen.getByText('2d 04h 06m')).toBeInTheDocument()
    })

    it('shows skeleton when loading with no data', () => {
        const { container } = render(
            <OBCSystemWidget
                live={emptyLiveState}
                latest={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
