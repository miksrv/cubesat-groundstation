import { act } from 'react'

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

    it('prints the answer to "telemetry", which lands on cubesat/comms/data', async () => {
        // The command used to be write-only: the console published get_telemetry
        // and nothing subscribed to the topic the answer arrives on.
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        act(() => {
            source.emitSnapshot({
                timestamp: 1741863600,
                requestId: 'req-7',
                obcState: 'NOMINAL',
                profile: 'DEMO',
                missionId: 42,
                eps: mockLiveState.eps,
                adcs: mockLiveState.adcs,
                science: mockLiveState.science,
                system: {
                    cpuPercent: 34,
                    ramPercent: 52,
                    swapPercent: 10,
                    diskPercent: 41,
                    uptimeSeconds: 187562,
                    cpuTemperature: 55
                }
            })
        })
        expect(await screen.findByText(/COMMS telemetry cache \(request req-7\)/)).toBeInTheDocument()
        expect(screen.getByText(/4\.123 V \(88%\)/)).toBeInTheDocument()
        expect(screen.getByText(/cpu 34%, ram 52%, disk 41%/)).toBeInTheDocument()
    })

    it('prints a camera refusal, which lands on cubesat/payload/photo', async () => {
        // "photo" answers with "published to cubesat/command" — the refusal is
        // the only message saying the satellite then said no.
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        act(() => {
            source.emitPhotoRefusal({
                timestamp: 1741863600,
                requestId: null,
                reason: 'card full - 12 MB free, 50 MB required'
            })
        })
        expect(await screen.findByText('Camera refused: card full - 12 MB free, 50 MB required')).toBeInTheDocument()
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

    it('prints the full vocabulary on "help", radio queries included', async () => {
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('help')
        expect(await screen.findByText(/same lines work over the Meshtastic uplink/)).toBeInTheDocument()
        expect(screen.getByText(/lora on\|off/)).toBeInTheDocument()
        expect(screen.getByText(/pos\s+- position/)).toBeInTheDocument()
    })

    it('answers pos locally, in the radio reply syntax', async () => {
        // Over LoRa this query comes back as a beacon from COMMS' caches; here
        // the same data is already on the page, and the answer is printed in
        // the same field syntax so both channels read alike.
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('pos')
        expect(await screen.findByText(/re=pos lat=55\.7558 lon=37\.6173 fix=1/)).toBeInTheDocument()
        expect(source.sent).toEqual([])
    })

    it('answers a query with err=nodata rather than a line of zeros', async () => {
        render(
            <MissionConsoleWidget
                live={{ ...mockLiveState, adcs: null }}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('pos')
        expect(await screen.findByText('re=pos ok=0 err=nodata')).toBeInTheDocument()
    })

    it('tolerates the radio spelling with the ! prefix', async () => {
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('!photo')
        expect(await screen.findByText(/take_photo published/)).toBeInTheDocument()
        expect(source.sent).toEqual([{ command: 'take_photo' }])
    })

    it('takes the timelapse interval in seconds, like the radio does', async () => {
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('timelapse 15')
        expect(await screen.findByText(/start_timelapse published/)).toBeInTheDocument()
        expect(source.sent).toEqual([{ command: 'start_timelapse', params: { interval_sec: 15 } }])
    })

    it('answers bad arguments with a usage line instead of guessing', async () => {
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('timelapse soon')
        expect(await screen.findByText('usage: timelapse <interval seconds>|stop')).toBeInTheDocument()
        expect(source.sent).toEqual([])
    })

    it('switches the radio with lora on|off', async () => {
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('lora off')
        expect(await screen.findByText(/set_comms_config published/)).toBeInTheDocument()
        expect(source.sent).toEqual([{ command: 'set_comms_config', params: { lora_enabled: false } }])
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
