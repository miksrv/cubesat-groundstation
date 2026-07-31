import { mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import OBCSystemWidget from './OBCSystemWidget'

import '@testing-library/jest-dom'

describe('OBCSystemWidget', () => {
    it('renders CPU/RAM/storage usage and boot count', () => {
        render(
            <OBCSystemWidget
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getByText('34%')).toBeInTheDocument()
        expect(screen.getByText('52%')).toBeInTheDocument()
        expect(screen.getByText('41%')).toBeInTheDocument()
        expect(screen.getByText('7')).toBeInTheDocument()
    })

    it('formats uptime_seconds as days/hours/minutes', () => {
        render(
            <OBCSystemWidget
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
                latest={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
