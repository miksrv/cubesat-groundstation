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
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.getAllByText('answered')).toHaveLength(2)
        expect(screen.getByText('412 lx')).toBeInTheDocument()
    })

    it('shows the read counter, which is the proof the sensor is measuring', () => {
        // "answered" says the device is reachable; a growing counter with a
        // recent read time says it is actually doing its job.
        render(
            <PayloadWidget
                payload={mockPayload}
                science={mockScience}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.getByText(/148 · last/)).toBeInTheDocument()
    })

    it('shows the interval of mission photography alongside its frames', () => {
        render(
            <PayloadWidget
                payload={{
                    ...mockPayload,
                    missionPhotos: { active: true, intervalSec: 30, frames: 7, reason: null }
                }}
                science={mockScience}
                obc={null}
                isLoading={false}
            />
        )
        expect(screen.getByText('running, 7 frames @ 30s')).toBeInTheDocument()
    })

    it('says why the UV index is missing rather than dashing it out', () => {
        // Two SEN0501 revisions read one raw register with formulas that disagree
        // by a factor of forty, so the satellite publishes the raw count and
        // withholds the index until the board is identified.
        render(
            <PayloadWidget
                payload={mockPayload}
                science={mockScience}
                obc={null}
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
                obc={null}
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
                obc={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
