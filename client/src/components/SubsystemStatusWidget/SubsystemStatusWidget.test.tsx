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

    it('says why, not just what colour', () => {
        // Half of the amber states here are the satellite behaving correctly — a
        // withheld heading, a profile that records nothing — so a colour on its
        // own would be a warning about right behaviour.
        render(
            <SubsystemStatusWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getByText('23 satellites')).toBeInTheDocument()
        expect(screen.getByText('mission 42')).toBeInTheDocument()
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
