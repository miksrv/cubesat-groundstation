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

    it('draws no line to a node it has not been heard from', () => {
        // The point of the panel: it says what is on the air, rather than
        // decorating the page with a fixed picture. The line *is* the traffic,
        // so a silent node gets none — a dimmed or frozen one would still
        // assert a flow and only whisper that it had stopped.
        const { container } = render(<MqttBusMonitorWidget live={emptyLiveState} />)
        // Nothing has arrived at all, so the only line left is DASHBOARD's,
        // which this page being on screen proves. The lines are the diagram's
        // only <path> elements.
        expect(container.querySelectorAll('path')).toHaveLength(1)
        // The chips stay: the services are on this bus either way.
        for (const service of ['EPS', 'PAYLOAD', 'ADCS', 'DHS', 'HOSTD', 'COMMS']) {
            expect(screen.getByText(service)).toBeInTheDocument()
        }
    })

    it('labels the hub as the satellite, not as OBC', () => {
        // OBC is one of the services on the bus (and drawn as one); the cube in
        // the middle is the machine they all live on.
        render(<MqttBusMonitorWidget live={mockLiveState} />)
        expect(screen.getByText('CubeSat')).toBeInTheDocument()
        // The OBC chip is the only OBC on the diagram now.
        expect(screen.getAllByText('OBC')).toHaveLength(1)
    })

    it('colours a service name with the verdict the Subsystem Status widget shows', () => {
        // Two panels naming the same subsystem must not disagree about it. ADCS
        // below is WARN for the reason the satellite intends — the BNO055
        // reports a constant until calib 3, so yaw is withheld — and the amber
        // has to reach this diagram too.
        const adcs = {
            ...mockLiveState.adcs!,
            calibStatus: { sys: 1, gyro: 3, accel: 3, mag: 1 }
        }
        const comms = { ...mockLiveState.comms!, radio: { present: false, node: null, region: null } }
        // No `subsystems`, so nothing is overridden and each row is judged from
        // its own status message; DHS is silent, which is UNKNOWN, not a fault.
        const obc = { ...mockLiveState.obc!, subsystems: null }
        const { container } = render(<MqttBusMonitorWidget live={{ ...mockLiveState, adcs, comms, obc, dhs: null }} />)
        expect(screen.getByText('ADCS')).toHaveClass('chipLabelWarn')
        // The radio did not answer, which is a fault and not a withholding.
        expect(screen.getByText('COMMS')).toHaveClass('chipLabelFail')
        // OK stays plain white — colour here means "look at this one", and
        // painting every nominal service green would spend that signal.
        expect(screen.getByText('EPS')).toHaveClass('chipLabel')
        expect(screen.getByText('EPS').getAttribute('class')).not.toMatch(/chipLabel(Warn|Fail|Off|Unknown)/)
        // Nothing reported is grey, and says so on hover rather than in green.
        expect(screen.getByText('DHS')).toHaveClass('chipLabelUnknown')
        // And DHS, the NO DATA row, loses its line entirely — the same answer
        // the diagram gives a stopped unit, because in both cases there is
        // nothing on the wire. Its name and chip are still there to say so.
        expect(container.querySelectorAll('path')).toHaveLength(7)
    })

    it('greys out and unlinks a service the profile never started', () => {
        // OFF and NO DATA are different findings — the name's colour keeps them
        // apart in the widget's other test — but they agree about the line: a
        // pulse out of a stopped unit would be inventing traffic just the same.
        const obc = {
            ...mockLiveState.obc!,
            profile: 'HOSTED' as const,
            subsystems: { watched: ['comms', 'eps'], lost: [] }
        }
        const hosted = { ...mockLiveState, obc, adcs: null, payload: null, dhs: null, science: null }
        const { container } = render(<MqttBusMonitorWidget live={hosted} />)
        // ADCS, PAYLOAD and DHS are off in HOSTED; their labels go grey and
        // their lines are gone.
        expect(container.querySelectorAll('.chipLabelOff')).toHaveLength(3)
        // COMMS, EPS, OBC, HOSTD and DASHBOARD are all reporting, so five
        // pulsing lines are left and the three stopped units have none.
        expect(container.querySelectorAll('.pulseLine')).toHaveLength(5)
        expect(container.querySelectorAll('path')).toHaveLength(5)
    })
})
