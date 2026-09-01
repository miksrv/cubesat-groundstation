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

    it('publishes onto cubesat/command like any other ground client', async () => {
        render(<QuickCommandsWidget />)
        screen.getByText('TAKE PHOTO').click()
        await waitFor(() => expect(source.sent).toEqual([{ command: 'take_photo' }]))
        expect(screen.getByText(/published to cubesat\/command/)).toBeInTheDocument()
    })

    it('sends set_profile with the profile as a parameter', async () => {
        render(<QuickCommandsWidget />)
        screen.getByText('EXPO').click()
        await waitFor(() => expect(source.sent).toEqual([{ command: 'set_profile', params: { profile: 'EXPO' } }]))
    })

    it('shows the vocabulary disabled when the source cannot be commanded', () => {
        // A recording has no satellite behind it. The buttons stay visible —
        // the panel still teaches what an operator could do — but disabled.
        source.capabilities = { commands: false, archive: true, photos: false, radio: false }
        render(<QuickCommandsWidget />)
        const takePhoto = screen.getByText('TAKE PHOTO')
        expect(takePhoto).toBeDisabled()
        expect(screen.getByText('EXPO')).toBeDisabled()
        takePhoto.click()
        expect(source.sent).toEqual([])
    })
})
