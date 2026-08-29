import { mockAdcs } from '../../test-fixtures'
import { installFakeSource } from '../../test-source'
import { render, screen } from '../../test-utils'

import Satellite3DView from './Satellite3DView'

import '@testing-library/jest-dom'

describe('Satellite3DView', () => {
    // The view subscribes to the attitude channel, so it needs a source. The
    // fake is the whole point of the interface: no broker, no server.
    beforeEach(() => {
        installFakeSource()
    })

    it('renders the 3D satellite view panel title', () => {
        render(
            <Satellite3DView
                adcs={mockAdcs}
                isLoading={false}
            />
        )
        expect(screen.getByText('3D Satellite View')).toBeInTheDocument()
    })

    it('shows skeleton when isLoading=true and latest is null', () => {
        const { container } = render(
            <Satellite3DView
                adcs={null}
                isLoading={true}
            />
        )
        const skeleton = container.querySelector('[data-testid="skeleton"]')
        expect(skeleton).toBeInTheDocument()
    })

    it('displays roll, pitch, and yaw values', () => {
        render(
            <Satellite3DView
                adcs={{ ...mockAdcs, roll: 15.3, pitch: -8.7, yaw: 120.5 }}
                isLoading={false}
            />
        )

        expect(screen.getByText('Roll (X)')).toBeInTheDocument()
        expect(screen.getByText('15.3°')).toBeInTheDocument()
        expect(screen.getByText('Pitch (Y)')).toBeInTheDocument()
        expect(screen.getByText('-8.7°')).toBeInTheDocument()
        expect(screen.getByText('Yaw (Z)')).toBeInTheDocument()
        expect(screen.getByText('120.5°')).toBeInTheDocument()
    })

    it('displays dash when values are null', () => {
        render(
            <Satellite3DView
                adcs={{ ...mockAdcs, roll: null, pitch: null, yaw: null }}
                isLoading={false}
            />
        )

        // Roll and pitch dash out; yaw says *why* it is missing, because below
        // magnetometer calibration 3 the BNO055 reports a constant and the
        // satellite withholds it rather than publish confident nonsense.
        expect(screen.getAllByText('—°')).toHaveLength(2)
        expect(screen.getByText('withheld')).toBeInTheDocument()
    })

    it('displays legend items', () => {
        render(
            <Satellite3DView
                adcs={mockAdcs}
                isLoading={false}
            />
        )

        expect(screen.getByText('X — body')).toBeInTheDocument()
        expect(screen.getByText('Y — body')).toBeInTheDocument()
        expect(screen.getByText('Z — body (camera)')).toBeInTheDocument()
        expect(screen.getByText('Measured g')).toBeInTheDocument()
    })

    it('displays angular rate readout from gyro data', () => {
        render(
            <Satellite3DView
                adcs={{ ...mockAdcs, gyro: { x: 0.1, y: -0.2, z: 0.05 } }}
                isLoading={false}
            />
        )

        expect(screen.getByText(/0\.10°\/s/)).toBeInTheDocument()
        expect(screen.getByText(/-0\.20°\/s/)).toBeInTheDocument()
        expect(screen.getByText(/0\.05°\/s/)).toBeInTheDocument()
    })

    it('renders the (mocked) 3D canvas once the lazy scene resolves', async () => {
        render(
            <Satellite3DView
                adcs={mockAdcs}
                isLoading={false}
            />
        )

        expect(await screen.findByTestId('r3f-canvas')).toBeInTheDocument()
    })

    it('does not show skeleton when data is available even if loading', () => {
        const { container } = render(
            <Satellite3DView
                adcs={mockAdcs}
                isLoading={true}
            />
        )

        const skeleton = container.querySelector('[data-testid="skeleton"]')
        expect(skeleton).not.toBeInTheDocument()
    })
})
