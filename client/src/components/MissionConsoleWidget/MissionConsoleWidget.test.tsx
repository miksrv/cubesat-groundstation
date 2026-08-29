import { mockLiveState, mockTelemetryRecord } from '../../test-fixtures'
import type { FakeSource } from '../../test-source'
import { installFakeSource } from '../../test-source'
import { fireEvent, render, screen } from '../../test-utils'

import MissionConsoleWidget from './MissionConsoleWidget'

import '@testing-library/jest-dom'

const runCommand = (command: string) => {
    const input = screen.getByPlaceholderText('Type a command…')
    fireEvent.change(input, { target: { value: command } })
    const form = input.closest('form')
    if (form) {
        fireEvent.submit(form)
    }
}

describe('MissionConsoleWidget', () => {
    let source: FakeSource

    beforeEach(() => {
        source = installFakeSource()
    })

    it('shows the welcome banner', () => {
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        expect(screen.getByText('CubeSat Mission Console v1.0')).toBeInTheDocument()
    })

    it('prints satellite status on the "status" command', async () => {
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('status')
        expect(await screen.findByText('Satellite Status:')).toBeInTheDocument()
    })

    it('clears the console on the "clear" command', () => {
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('clear')
        expect(screen.queryByText('CubeSat Mission Console v1.0')).not.toBeInTheDocument()
    })

    it('prints an unknown-command message for unrecognized input', async () => {
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('launch missiles')
        expect(await screen.findByText(/Unknown command: "launch missiles"/)).toBeInTheDocument()
    })

    it('publishes a real command onto cubesat/command', async () => {
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('profile expo')
        expect(await screen.findByText(/set_profile published/)).toBeInTheDocument()
        expect(source.sent).toEqual([{ command: 'set_profile', params: { profile: 'EXPO' } }])
    })

    it('refuses a profile this build does not know rather than sending it', async () => {
        // Profiles are data on the satellite, but a typo should fail here rather
        // than reach OBC and be refused there — one round trip later, over a
        // radio link, with the operator watching nothing happen.
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('profile orbit')
        expect(await screen.findByText(/Unknown profile/)).toBeInTheDocument()
        expect(source.sent).toEqual([])
    })
})
