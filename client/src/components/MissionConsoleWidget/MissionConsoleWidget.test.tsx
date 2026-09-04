import { act } from 'react'

import { postNotice } from '../../features/console/notices'
import { mockComms, mockLiveState, mockTelemetryRecord } from '../../test-fixtures'
import type { FakeSource } from '../../test-source'
import { installFakeSource } from '../../test-source'
import { fireEvent, render, screen, waitFor } from '../../test-utils'

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

    it('says the beacon is off without claiming the satellite is silent', async () => {
        // The line read `listening only` until 2026-09-03, which promised a
        // silence the satellite does not keep: a reply to an accepted command
        // is gated on listening, not on the beacon flag. An operator reading
        // the old wording would have blamed the flag for a command that in fact
        // never arrived. The channel rides along because that is the other
        // half of the same diagnosis.
        render(
            <MissionConsoleWidget
                live={{ ...mockLiveState, comms: { ...mockComms, beaconEnabled: false } }}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('status')
        expect(
            await screen.findByText(/beacon off - listening and still answering commands, commands on ch 1/)
        ).toBeInTheDocument()
    })

    it('reports a radio the profile has taken away as off, not as a quiet beacon', async () => {
        render(
            <MissionConsoleWidget
                live={{
                    ...mockLiveState,
                    comms: { ...mockComms, beaconEnabled: false, loraListening: false }
                }}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('status')
        expect(await screen.findByText(/Radio:\s+off for this profile/)).toBeInTheDocument()
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
        expect(screen.getByText(/3\.759 V \(49%\)/)).toBeInTheDocument()
        expect(screen.getByText(/cpu 34%, ram 52%, disk 41%/)).toBeInTheDocument()
    })

    it('prints a camera refusal, which lands on cubesat/payload/photo', async () => {
        // The echo off cubesat/command says a photo was asked for; this refusal
        // is the only message saying the satellite then said no.
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
                reason: 'card full - 12 MB free, 50 MB required',
                reasonCode: 'nospace'
            })
        })
        // Both spellings of the no: the sentence carries the numbers, the code
        // is what `!photo` answered a phone in the field with, and an operator
        // comparing the two is comparing the code.
        expect(
            await screen.findByText('Camera refused: card full - 12 MB free, 50 MB required (err=nospace)')
        ).toBeInTheDocument()
    })

    it('prints the code alone where the satellite sent no sentence', async () => {
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        act(() => {
            source.emitPhotoRefusal({ timestamp: 1741863600, requestId: null, reason: null, reasonCode: 'state' })
        })
        expect(await screen.findByText('Camera refused: err=state')).toBeInTheDocument()
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
        await waitFor(() => expect(source.sent).toEqual([{ command: 'set_profile', params: { profile: 'EXPO' } }]))
        // Nothing is printed on the way out. The line appears when the command
        // comes back off the bus — see the echo tests below.
        expect(screen.queryByText(/set_profile published/)).not.toBeInTheDocument()
    })

    it('prints every command that crosses the bus, whoever sent it', async () => {
        // The console shows the traffic, not this tab's intentions: a phone, the
        // `cubesat` CLI and an uplink relayed off the radio by COMMS all publish
        // onto the same topic, and that is the visible form of "every command
        // works identically over MQTT and over LoRa".
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        act(() => {
            source.emitCommand({ at: 1741863600, command: 'set_profile', params: { profile: 'EXPO' } })
        })
        expect(await screen.findByText('→ set_profile profile=EXPO')).toBeInTheDocument()
    })

    it('prints a bus command with no parameters as the verb alone', async () => {
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        act(() => {
            source.emitCommand({ at: 1741863600, command: 'take_photo', params: null })
        })
        expect(await screen.findByText('→ take_photo')).toBeInTheDocument()
    })

    it('prints what another widget could not say for itself', async () => {
        // A publish that never reached the broker has no echo, so the panel that
        // tried posts the failure here rather than narrating it beside its own
        // buttons.
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        act(() => {
            postNotice('Quick command take_photo failed: broker unreachable')
        })
        expect(await screen.findByText(/Quick command take_photo failed/)).toBeInTheDocument()
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
        expect(screen.getByText(/beacon on\|off/)).toBeInTheDocument()
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
        await waitFor(() => expect(source.sent).toEqual([{ command: 'take_photo' }]))
    })

    it('answers a verb the satellite no longer has like any other unknown line', async () => {
        // `timelapse` was removed from the satellite on 2026-09-01 — a mission
        // photographs itself now. Keeping a spelling the satellite would answer
        // `err=unknown` to would be worse than not having it.
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('timelapse 15')
        expect(await screen.findByText(/unknown/i)).toBeInTheDocument()
        expect(source.sent).toEqual([])
    })

    it('answers bad arguments with a usage line instead of guessing', async () => {
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('restart')
        expect(await screen.findByText('usage: restart <adcs|payload|dhs|comms>')).toBeInTheDocument()
        expect(source.sent).toEqual([])
    })

    it('starts and stops the scheduled beacon with beacon on|off', async () => {
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('beacon off')
        // `beacon_enabled` since 2026-09-03: the parameter was `lora_enabled`
        // while the flag was believed to decide whether the radio transmits at
        // all. The satellite still accepts the old name as an alias, and this
        // build deliberately does not send it.
        await waitFor(() =>
            expect(source.sent).toEqual([{ command: 'set_comms_config', params: { beacon_enabled: false } }])
        )
    })

    it('still accepts the verb this one replaced', async () => {
        // `lora on|off` until 2026-09-01. Renamed because it said the wrong
        // thing — turning it off never turned the radio off — and kept accepted
        // because a command that worked last week should not read as unknown.
        render(
            <MissionConsoleWidget
                live={mockLiveState}
                latest={mockTelemetryRecord}
            />
        )
        runCommand('lora on')
        await waitFor(() =>
            expect(source.sent).toEqual([{ command: 'set_comms_config', params: { beacon_enabled: true } }])
        )
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
