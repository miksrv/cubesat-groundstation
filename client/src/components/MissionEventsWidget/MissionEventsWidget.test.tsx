import type { ObservedEvent } from '../../features/events/observed'
import { render, screen } from '../../test-utils'

import MissionEventsWidget from './MissionEventsWidget'

import '@testing-library/jest-dom'

/**
 * What the page witnessed, not what a backend stored. The satellite keeps no
 * events table — this log is built from state transitions seen since the tab
 * was opened.
 */
const mockEvents: ObservedEvent[] = [
    { id: '1-1', at: 1767268800, severity: 'success', message: 'mission 42 opened' },
    { id: '2-1', at: 1767268860, severity: 'info', message: 'mission state BOOT -> NOMINAL' }
]

describe('MissionEventsWidget', () => {
    it('renders event messages', () => {
        render(
            <MissionEventsWidget
                events={mockEvents}
                isLoading={false}
            />
        )
        expect(screen.getByText('mission 42 opened')).toBeInTheDocument()
        expect(screen.getByText('mission state BOOT -> NOMINAL')).toBeInTheDocument()
    })

    it('shows an empty state when there are no events', () => {
        render(
            <MissionEventsWidget
                events={[]}
                isLoading={false}
            />
        )
        expect(screen.getByText('Nothing observed since this page was opened')).toBeInTheDocument()
    })

    it('shows skeleton when loading with no events', () => {
        const { container } = render(
            <MissionEventsWidget
                events={[]}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
