import { emptyLiveState, mockLiveState, mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import OBCSystemWidget from './OBCSystemWidget'

import '@testing-library/jest-dom'

describe('OBCSystemWidget', () => {
    it('renders CPU, RAM, storage and swap from the newest recorded row', () => {
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
        // Swap in use means RAM already ran out once — recorded all along,
        // never shown until this row existed.
        expect(screen.getByText('10%')).toBeInTheDocument()
    })

    it('does not spend rows on values that change only with the profile', () => {
        // Cadence, persistence, the governor and the profile TTL were rows here
        // once: five near-constants made this the tallest card in the row, so
        // they are gone rather than dashed out.
        render(
            <OBCSystemWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.queryByText('×1')).not.toBeInTheDocument()
        expect(screen.queryByText('mission_db')).not.toBeInTheDocument()
        expect(screen.queryByText('powersave')).not.toBeInTheDocument()
        expect(screen.queryByText(/Profile TTL/)).not.toBeInTheDocument()
    })

    it('shows both profiles when a switch applied only partly', () => {
        // profile vs profile_requested is the whole debugging story of a failed
        // switch; collapsing the two turns it into a mystery.
        render(
            <OBCSystemWidget
                live={{
                    ...mockLiveState,
                    host: { ...mockLiveState.host!, profileRequested: 'EXPO' }
                }}
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getByText('FLIGHT — requested EXPO')).toBeInTheDocument()
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
