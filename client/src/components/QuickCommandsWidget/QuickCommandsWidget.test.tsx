import { subscribeNotices } from '../../features/console/notices'
import { mockComms } from '../../test-fixtures'
import type { FakeSource } from '../../test-source'
import { installFakeSource } from '../../test-source'
import { render, screen, waitFor } from '../../test-utils'

import QuickCommandsWidget from './QuickCommandsWidget'

import '@testing-library/jest-dom'

describe('QuickCommandsWidget', () => {
    let source: FakeSource

    beforeEach(() => {
        source = installFakeSource()
    })

    it("offers the satellite's own vocabulary and nothing else", () => {
        // The old list had REBOOT_OBC and RESET_ADCS, which the satellite has
        // never implemented. A button that publishes a command nothing handles
        // teaches the operator something false about the thing they operate.
        render(<QuickCommandsWidget />)
        expect(screen.getByText('TAKE PHOTO')).toBeInTheDocument()
        expect(screen.getByText('SAFE MODE')).toBeInTheDocument()
        expect(screen.queryByText('REBOOT OBC')).not.toBeInTheDocument()
    })

    it('publishes onto cubesat/command like any other ground client, and says nothing', async () => {
        // The command reappears in the Mission Console, off the bus — one
        // transcript in the order the bus saw things, rather than each panel
        // narrating its own button.
        render(<QuickCommandsWidget />)
        screen.getByText('TAKE PHOTO').click()
        await waitFor(() => expect(source.sent).toEqual([{ command: 'take_photo' }]))
        expect(screen.queryByText(/published to cubesat\/command/)).not.toBeInTheDocument()
    })

    it('posts a failed publish into the console, which is the case that must not be silent', async () => {
        const notices: string[] = []
        const stop = subscribeNotices((text) => notices.push(text))
        source.send = async () => {
            throw new Error('broker unreachable')
        }
        render(<QuickCommandsWidget />)
        screen.getByText('TAKE PHOTO').click()
        await waitFor(() => expect(notices).toHaveLength(1))
        expect(notices[0]).toMatch(/take_photo failed: broker unreachable/)
        stop()
    })

    it('names the beacon parameter the way the satellite does since 2026-09-03', async () => {
        // `lora_enabled` until that day, and the satellite still accepts it as
        // an alias — which is a courtesy to the build deployed before it, not a
        // name a new build should be teaching. The flag rations the scheduled
        // beacon and nothing else: commands are answered either way.
        render(<QuickCommandsWidget />)
        screen.getByText('BEACON OFF').click()
        await waitFor(() =>
            expect(source.sent).toStrictEqual([{ command: 'set_comms_config', params: { beacon_enabled: false } }])
        )
    })

    it('marks which of the two beacon buttons the satellite is already at', () => {
        // The profile decides where the beacon starts — off in DEMO and EXPO —
        // so without this the panel offers two buttons and no clue which one
        // would change anything.
        render(<QuickCommandsWidget comms={{ ...mockComms, beaconEnabled: false }} />)
        expect(screen.getByText('BEACON OFF')).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByText('BEACON ON')).toHaveAttribute('aria-pressed', 'false')
    })

    it('marks neither before COMMS has said anything', () => {
        // Withhold rather than fabricate: a page that has just connected knows
        // nothing about the beacon, and guessing at the profile's default would
        // be a claim the satellite never made.
        render(<QuickCommandsWidget />)
        expect(screen.getByText('BEACON OFF')).not.toHaveAttribute('aria-pressed')
        expect(screen.getByText('BEACON ON')).not.toHaveAttribute('aria-pressed')
    })

    it('sends set_profile with the profile as a parameter', async () => {
        render(<QuickCommandsWidget />)
        screen.getByText('EXPO').click()
        await waitFor(() => expect(source.sent).toEqual([{ command: 'set_profile', params: { profile: 'EXPO' } }]))
    })

    it('shows the vocabulary disabled when the source cannot be commanded', () => {
        // A recording has no satellite behind it. The buttons stay visible —
        // the panel still teaches what an operator could do — but disabled.
        source.capabilities = { commands: false, archive: true, deleteMissions: false, photos: false, radio: false }
        render(<QuickCommandsWidget />)
        const takePhoto = screen.getByText('TAKE PHOTO')
        expect(takePhoto).toBeDisabled()
        expect(screen.getByText('EXPO')).toBeDisabled()
        takePhoto.click()
        expect(source.sent).toEqual([])
    })
})
