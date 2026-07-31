import { mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import ADCSWidget from './ADCSWidget'

import '@testing-library/jest-dom'

describe('ADCSWidget', () => {
    it('renders roll, pitch and yaw', () => {
        render(
            <ADCSWidget
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getByText('2.31°')).toBeInTheDocument()
        expect(screen.getByText('-1.24°')).toBeInTheDocument()
        expect(screen.getByText('5.67°')).toBeInTheDocument()
    })

    it('shows skeleton when loading with no data', () => {
        const { container } = render(
            <ADCSWidget
                latest={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
