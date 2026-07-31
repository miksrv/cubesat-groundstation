import { mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import Satellite3DView from './Satellite3DView'

import '@testing-library/jest-dom'

describe('Satellite3DView', () => {
    it('renders the 3D satellite view panel title', () => {
        render(
            <Satellite3DView
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )
        expect(screen.getByText('3D Satellite View')).toBeInTheDocument()
    })

    it('shows skeleton when isLoading=true and latest is null', () => {
        const { container } = render(
            <Satellite3DView
                latest={null}
                isLoading={true}
            />
        )
        const skeleton = container.querySelector('[data-testid="skeleton"]')
        expect(skeleton).toBeInTheDocument()
    })

    it('displays roll, pitch, and yaw values', () => {
        render(
            <Satellite3DView
                latest={{ ...mockTelemetryRecord, roll: 15.3, pitch: -8.7, yaw: 120.5 }}
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
                latest={{ ...mockTelemetryRecord, roll: null, pitch: null, yaw: null }}
                isLoading={false}
            />
        )

        const dashValues = screen.getAllByText('—°')
        expect(dashValues).toHaveLength(3)
    })

    it('displays legend items', () => {
        render(
            <Satellite3DView
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )

        expect(screen.getByText('X — Velocity')).toBeInTheDocument()
        expect(screen.getByText('Y — Orbit Normal')).toBeInTheDocument()
        expect(screen.getByText('Z — Nadir')).toBeInTheDocument()
        expect(screen.getByText('Measured g')).toBeInTheDocument()
    })

    it('displays angular rate readout from gyro data', () => {
        render(
            <Satellite3DView
                latest={{ ...mockTelemetryRecord, gyro_x: 0.1, gyro_y: -0.2, gyro_z: 0.05 }}
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
                latest={mockTelemetryRecord}
                isLoading={false}
            />
        )

        expect(await screen.findByTestId('r3f-canvas')).toBeInTheDocument()
    })

    it('does not show skeleton when data is available even if loading', () => {
        const { container } = render(
            <Satellite3DView
                latest={mockTelemetryRecord}
                isLoading={true}
            />
        )

        const skeleton = container.querySelector('[data-testid="skeleton"]')
        expect(skeleton).not.toBeInTheDocument()
    })
})
