import { mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import SubsystemStatusWidget from './SubsystemStatusWidget'

import '@testing-library/jest-dom'

describe('SubsystemStatusWidget', () => {
    it('renders all five subsystem rows', () => {
        render(
            <SubsystemStatusWidget
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getByText('OBC')).toBeInTheDocument()
        expect(screen.getByText('EPS')).toBeInTheDocument()
        expect(screen.getByText('ADCS')).toBeInTheDocument()
        expect(screen.getByText('PAYLOAD')).toBeInTheDocument()
        expect(screen.getByText('COMMS')).toBeInTheDocument()
    })

    it('shows skeleton when loading with no data', () => {
        const { container } = render(
            <SubsystemStatusWidget
                latest={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
