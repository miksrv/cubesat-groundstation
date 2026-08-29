import { mockAdcs } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import ADCSWidget from './ADCSWidget'

import '@testing-library/jest-dom'

describe('ADCSWidget', () => {
    it('renders roll, pitch and yaw', () => {
        render(
            <ADCSWidget
                adcs={mockAdcs}
                isLoading={false}
            />
        )
        expect(screen.getByText('1.23°')).toBeInTheDocument()
        expect(screen.getByText('-0.45°')).toBeInTheDocument()
        expect(screen.getByText('178.90°')).toBeInTheDocument()
    })

    it('says why yaw is missing rather than dashing it out', () => {
        // Below magnetometer calibration 3 the BNO055 reports a constant, so the
        // satellite withholds the heading. A bare "—" would read as a broken
        // sensor, which is the wrong story about correct behaviour.
        render(
            <ADCSWidget
                adcs={{ ...mockAdcs, yaw: null, calibStatus: { sys: 3, gyro: 3, accel: 3, mag: 1 } }}
                isLoading={false}
            />
        )
        expect(screen.getByText('withheld — magnetometer')).toBeInTheDocument()
        expect(screen.getByText('1/3')).toBeInTheDocument()
    })

    it('says the position is stale when there is no fix', () => {
        render(
            <ADCSWidget
                adcs={{ ...mockAdcs, gnss: { ...mockAdcs.gnss, fix: false } }}
                isLoading={false}
            />
        )
        expect(screen.getByText(/last known one/)).toBeInTheDocument()
    })

    it('shows skeleton when loading with no data', () => {
        const { container } = render(
            <ADCSWidget
                adcs={null}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
