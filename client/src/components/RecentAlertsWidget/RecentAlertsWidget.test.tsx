import type { ObservedEvent } from '../../features/events/observed'
import { render, screen } from '../../test-utils'

import RecentAlertsWidget from './RecentAlertsWidget'

import '@testing-library/jest-dom'

const now = Date.now() / 1000

const mockEvents: ObservedEvent[] = [
    { id: '1-1', at: now, severity: 'info', message: 'radio transmitting' },
    { id: '2-1', at: now, severity: 'warning', message: 'card full - captures refused' },
    { id: '3-1', at: now, severity: 'critical', message: 'mission state SAFE -> CRITICAL' }
]

describe('RecentAlertsWidget', () => {
    it('renders only warning/critical events, not info', () => {
        render(
            <RecentAlertsWidget
                events={mockEvents}
                isLoading={false}
            />
        )
        expect(screen.getByText('card full - captures refused')).toBeInTheDocument()
        expect(screen.getByText('mission state SAFE -> CRITICAL')).toBeInTheDocument()
        expect(screen.queryByText('radio transmitting')).not.toBeInTheDocument()
    })

    it('shows an empty state when there are no alerts', () => {
        render(
            <RecentAlertsWidget
                events={[]}
                isLoading={false}
            />
        )
        expect(screen.getByText('No active alerts')).toBeInTheDocument()
    })
})
