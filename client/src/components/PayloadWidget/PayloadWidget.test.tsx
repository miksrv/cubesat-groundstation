import { mockPayload, mockScience } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import PayloadWidget from './PayloadWidget'

import '@testing-library/jest-dom'

describe('PayloadWidget', () => {
    it('reports whether each device actually answered', () => {
        // `present` is the result of a real transaction with the device, which is
        // what separates "the sensor answered" from "the process started".
        render(
            <PayloadWidget
                payload={mockPayload}
                science={mockScience}
                isLoading={false}
            />
        )
        expect(screen.getAllByText('answered')).toHaveLength(2)
        expect(screen.getByText('412 lx')).toBeInTheDocument()
    })

    it('says why the UV index is missing rather than dashing it out', () => {
        // Two SEN0501 revisions read one raw register with formulas that disagree
        // by a factor of forty, so the satellite publishes the raw count and
        // withholds the index until the board is identified.
        render(
            <PayloadWidget
                payload={mockPayload}
                science={mockScience}
                isLoading={false}
            />
        )
        expect(screen.getByText('withheld — raw 14')).toBeInTheDocument()
    })

    it('surfaces a full card, which is why a satellite stopped taking photos', () => {
        render(
            <PayloadWidget
                payload={{
                    ...mockPayload,
                    storage: { freeMb: 41.2, minFreeMb: 512, blocked: true }
                }}
                science={mockScience}
                isLoading={false}
            />
        )
        expect(screen.getByText(/card full/)).toBeInTheDocument()
    })

    it('shows skeleton when loading with no data', () => {
        const { container } = render(
            <PayloadWidget
                payload={null}
                science={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
