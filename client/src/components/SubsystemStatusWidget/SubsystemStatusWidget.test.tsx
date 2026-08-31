import { emptyLiveState, mockLiveState, mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import SubsystemStatusWidget from './SubsystemStatusWidget'

import '@testing-library/jest-dom'

describe('SubsystemStatusWidget', () => {
    it('renders a row per subsystem, DHS included', () => {
        render(
            <SubsystemStatusWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        for (const name of ['OBC', 'EPS', 'ADCS', 'PAYLOAD', 'DHS', 'COMMS']) {
            expect(screen.getByText(name)).toBeInTheDocument()
        }
    })

    it('keeps the why on the row as a tooltip', () => {
        // Half of the amber states here are the satellite behaving correctly — a
        // withheld heading, a profile that records nothing — so a colour on its
        // own would be a warning about right behaviour. The detail moved off the
        // row face into `title` to keep two columns; it must still be there.
        render(
            <SubsystemStatusWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getByTitle('23 satellites')).toBeInTheDocument()
        expect(screen.getByTitle('mission 42')).toBeInTheDocument()
    })

    it('shows FAIL for a subsystem OBC declared lost, and OFF for one the profile never started', () => {
        const obc = {
            ...mockLiveState.obc!,
            profile: 'HOSTED' as const,
            subsystems: { watched: ['comms', 'eps'], lost: ['comms'] }
        }
        render(
            <SubsystemStatusWidget
                live={{ ...mockLiveState, obc, adcs: null, payload: null, dhs: null, science: null }}
                latest={null}
                isLoading={false}
            />
        )
        expect(screen.getByText('FAIL')).toBeInTheDocument()
        expect(screen.getAllByText('OFF')).toHaveLength(3)
    })

    it('shows skeleton when loading with no data', () => {
        const { container } = render(
            <SubsystemStatusWidget
                live={emptyLiveState}
                latest={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
