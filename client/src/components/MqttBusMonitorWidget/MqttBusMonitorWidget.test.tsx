import { emptyLiveState, mockLiveState } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import MqttBusMonitorWidget from './MqttBusMonitorWidget'

import '@testing-library/jest-dom'

describe('MqttBusMonitorWidget', () => {
    it('names the services that are actually on this bus', () => {
        // The old diagram had a CLOUD node. There is no cloud, and the ground
        // station is this page.
        render(<MqttBusMonitorWidget live={mockLiveState} />)
        for (const service of ['EPS', 'PAYLOAD', 'ADCS', 'DHS', 'HOSTD', 'COMMS', 'DASHBOARD']) {
            expect(screen.getByText(service)).toBeInTheDocument()
        }
        expect(screen.queryByText('CLOUD')).not.toBeInTheDocument()
    })

    it('dims what has not been heard from', () => {
        // The point of the panel: it says what is on the air, rather than
        // decorating the page with a fixed picture.
        const { container } = render(<MqttBusMonitorWidget live={emptyLiveState} />)
        const dimmed = Array.from(container.querySelectorAll('path')).filter((path) => path.style.opacity === '0.25')
        expect(dimmed.length).toBeGreaterThan(0)
    })

    it('labels the hub as the satellite, not as OBC', () => {
        // OBC is one of the services on the bus (and drawn as one); the cube in
        // the middle is the machine they all live on.
        render(<MqttBusMonitorWidget live={mockLiveState} />)
        expect(screen.getByText('CubeSat')).toBeInTheDocument()
        // The OBC chip is the only OBC on the diagram now.
        expect(screen.getAllByText('OBC')).toHaveLength(1)
    })

    it('greys out and stops animating a service the profile never started', () => {
        // OFF is not "not heard from yet": the silence is the profile working,
        // and a pulsing line out of a stopped unit would be inventing traffic.
        const obc = {
            ...mockLiveState.obc!,
            profile: 'HOSTED' as const,
            subsystems: { watched: ['comms', 'eps'], lost: [] }
        }
        const hosted = { ...mockLiveState, obc, adcs: null, payload: null, dhs: null, science: null }
        const { container } = render(<MqttBusMonitorWidget live={hosted} />)
        // ADCS, PAYLOAD and DHS are off in HOSTED; their lines lose the pulse
        // animation and their labels go grey.
        expect(container.querySelectorAll('.pulseLineOff')).toHaveLength(3)
        expect(container.querySelectorAll('.chipLabelOff')).toHaveLength(3)
        // COMMS and EPS stay watched, so their lines still pulse.
        expect(container.querySelectorAll('.pulseLine')).toHaveLength(5)
    })
})
