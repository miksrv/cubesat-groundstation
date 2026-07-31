import type { MissionEvent } from '../../features/telemetry/types'
import { render, screen } from '../../test-utils'

import MissionEventsWidget from './MissionEventsWidget'

import '@testing-library/jest-dom'

const mockEvents: MissionEvent[] = [
    {
        id: 1,
        timestamp: '2026-01-01T12:00:00Z',
        type: 'deployment',
        severity: 'success',
        message: 'Deployment sequence started',
        meta: null
    },
    {
        id: 2,
        timestamp: '2026-01-01T12:01:00Z',
        type: 'state_transition',
        severity: 'info',
        message: 'OBC state changed: BOOT → NOMINAL',
        meta: null
    }
]

describe('MissionEventsWidget', () => {
    it('renders event messages', () => {
        render(
            <MissionEventsWidget
                events={mockEvents}
                isLoading={false}
            />
        )
        expect(screen.getByText('Deployment sequence started')).toBeInTheDocument()
        expect(screen.getByText('OBC state changed: BOOT → NOMINAL')).toBeInTheDocument()
    })

    it('shows an empty state when there are no events', () => {
        render(
            <MissionEventsWidget
                events={[]}
                isLoading={false}
            />
        )
        expect(screen.getByText('No events yet')).toBeInTheDocument()
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
