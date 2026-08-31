import { mockDhs } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import FlightRecorderWidget from './FlightRecorderWidget'

import '@testing-library/jest-dom'

describe('FlightRecorderWidget', () => {
    it('says which mission is being written, from the retained dhs_status', () => {
        render(
            <FlightRecorderWidget
                dhs={mockDhs}
                isLoading={false}
            />
        )
        // Twice: the Recording row, and the footer's status detail.
        expect(screen.getAllByText('mission 42').length).toBeGreaterThan(0)
        expect(screen.getByText('120')).toBeInTheDocument()
        expect(screen.getByText('2.4 MB')).toBeInTheDocument()
        expect(screen.getByText('30 days')).toBeInTheDocument()
    })

    it('renders both tracks as rows written, with held rows only when writes fail', () => {
        render(
            <FlightRecorderWidget
                dhs={mockDhs}
                isLoading={false}
            />
        )
        expect(screen.getByText('3600')).toBeInTheDocument()
        expect(screen.getByText('34')).toBeInTheDocument()
        expect(screen.queryByText(/held/)).not.toBeInTheDocument()
    })

    it('marks rows the card refused — heard, not yet on disk', () => {
        render(
            <FlightRecorderWidget
                dhs={{ ...mockDhs, radio: { written: 34, buffered: 12 } }}
                isLoading={false}
            />
        )
        expect(screen.getByText('34 (+12 held)')).toBeInTheDocument()
    })

    it('calls an idle recorder idle, never broken', () => {
        render(
            <FlightRecorderWidget
                dhs={{ ...mockDhs, recording: false, mission: null }}
                isLoading={false}
            />
        )
        expect(screen.getByText('idle')).toBeInTheDocument()
        expect(screen.getByText(/no mission open/)).toBeInTheDocument()
    })

    it('warns about unfiled photos, which retention can never remove', () => {
        render(
            <FlightRecorderWidget
                dhs={{
                    ...mockDhs,
                    photos: { unfiledBytes: 4_718_592, freeMb: 21493.7, minFreeMb: 512 }
                }}
                isLoading={false}
            />
        )
        expect(screen.getByText('4.7 MB')).toBeInTheDocument()
    })

    it('shows skeleton when loading with no data', () => {
        const { container } = render(
            <FlightRecorderWidget
                dhs={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
