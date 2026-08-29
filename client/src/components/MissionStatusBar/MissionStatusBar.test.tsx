import type { OrbitState } from '../../features/orbit/simulate'
import { emptyLiveState, mockLiveState, mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import MissionStatusBar from './MissionStatusBar'

import '@testing-library/jest-dom'

const mockRecord = { ...mockTelemetryRecord, uptimeSeconds: 90061 }

/** Simulated: this satellite has no orbit. See features/orbit/simulate.ts. */
const mockOrbit: OrbitState = {
    simulated: true,
    orbitType: 'LEO (simulated)',
    altitudeKm: 420,
    inclinationDeg: 51.64,
    periodMin: 92.9,
    raanDeg: 247.4,
    aopDeg: 96.3,
    trueAnomalyDeg: 45.32,
    latDeg: 12.3,
    lonDeg: -45.6,
    eclipse: false,
    orbitNumber: 245,
    nextPassSeconds: 454,
    groundStation: { name: 'Moscow', lat: 55.7558, lon: 37.6173 }
}

describe('MissionStatusBar', () => {
    it('renders the mission state the satellite reported', () => {
        render(
            <MissionStatusBar
                live={mockLiveState}
                latest={mockRecord}
                orbit={mockOrbit}
                isLoading={false}
                isError={false}
            />
        )
        expect(screen.getAllByText('NOMINAL').length).toBeGreaterThan(0)
    })

    it('renders the formatted mission time from the recorded uptime', () => {
        render(
            <MissionStatusBar
                live={mockLiveState}
                latest={mockRecord}
                orbit={mockOrbit}
                isLoading={false}
                isError={false}
            />
        )
        expect(screen.getByText('T+01:01:01:01')).toBeInTheDocument()
    })

    it('renders the orbit number and ground station name', () => {
        render(
            <MissionStatusBar
                live={mockLiveState}
                latest={mockRecord}
                orbit={mockOrbit}
                isLoading={false}
                isError={false}
            />
        )
        expect(screen.getByText('#245')).toBeInTheDocument()
        expect(screen.getByText('Moscow')).toBeInTheDocument()
    })

    it('shows OFFLINE link status when isError=true', () => {
        render(
            <MissionStatusBar
                live={mockLiveState}
                latest={mockRecord}
                orbit={mockOrbit}
                isLoading={false}
                isError={true}
            />
        )
        expect(screen.getByText('OFFLINE')).toBeInTheDocument()
    })

    it('renders placeholders when there is no data yet', () => {
        render(
            <MissionStatusBar
                live={emptyLiveState}
                latest={null}
                orbit={null}
                isLoading={false}
                isError={false}
            />
        )
        expect(screen.getAllByText('UNKNOWN').length).toBeGreaterThan(0)
    })
})
