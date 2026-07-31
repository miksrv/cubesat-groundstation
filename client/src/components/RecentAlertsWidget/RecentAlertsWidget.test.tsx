import type { MissionEvent } from '../../features/telemetry/types'
import { render, screen } from '../../test-utils'

import RecentAlertsWidget from './RecentAlertsWidget'

import '@testing-library/jest-dom'

const mockEvents: MissionEvent[] = [
    {
        id: 1,
        timestamp: new Date().toISOString(),
        type: 'info',
        severity: 'info',
        message: 'Ground station link established',
        meta: null
    },
    {
        id: 2,
        timestamp: new Date().toISOString(),
        type: 'alert',
        severity: 'warning',
        message: 'Low Battery Warning',
        meta: null
    },
    {
        id: 3,
        timestamp: new Date().toISOString(),
        type: 'alert',
        severity: 'critical',
        message: 'Communication Lost',
        meta: null
    }
]

describe('RecentAlertsWidget', () => {
    it('renders only warning/critical events, not info', () => {
        render(
            <RecentAlertsWidget
                events={mockEvents}
                isLoading={false}
            />
        )
        expect(screen.getByText('Low Battery Warning')).toBeInTheDocument()
        expect(screen.getByText('Communication Lost')).toBeInTheDocument()
        expect(screen.queryByText('Ground station link established')).not.toBeInTheDocument()
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
