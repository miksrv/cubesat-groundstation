import { mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import PayloadWidget from './PayloadWidget'

import '@testing-library/jest-dom'

describe('PayloadWidget', () => {
    it('renders camera status, image count/resolution and science mode', () => {
        render(
            <PayloadWidget
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getByText('READY')).toBeInTheDocument()
        expect(screen.getByText('1284')).toBeInTheDocument()
        expect(screen.getByText('1280x720')).toBeInTheDocument()
        expect(screen.getByText('Disabled')).toBeInTheDocument()
        expect(screen.getByText('1.23 W')).toBeInTheDocument()
    })

    it('shows skeleton when loading with no data', () => {
        const { container } = render(
            <PayloadWidget
                latest={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
