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
})
