import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import type { MissionSummary } from '../../features/telemetry/types'
import { installFakeSource } from '../../test-source'

import MissionArchiveDialog from './MissionArchiveDialog'

import '@testing-library/jest-dom'

const mission: MissionSummary = {
    id: 8,
    label: null,
    profile: 'DEMO',
    startedAt: '2026-08-29T01:48:41Z',
    endedAt: '2026-08-29T02:39:53Z',
    endReason: 'shutdown',
    rows: 78,
    firstFixAt: '2026-08-29T01:48:41Z',
    distanceM: 33.9,
    notes: null,
    purgedAt: null
}

const open = (overrides: Partial<React.ComponentProps<typeof MissionArchiveDialog>> = {}) => {
    const props = {
        missions: [mission],
        onPick: jest.fn(),
        onDelete: jest.fn(async () => undefined),
        onClose: jest.fn(),
        ...overrides
    }
    render(<MissionArchiveDialog {...props} />)
    return props
}

describe('MissionArchiveDialog', () => {
    beforeEach(() => {
        installFakeSource()
    })

    it('lists what a mission recorded, and replays the one that is picked', () => {
        const props = open()
        expect(screen.getByText(/2026-08-29 01:48:41 UTC/)).toBeInTheDocument()
        expect(screen.getByText(/78 rows/)).toBeInTheDocument()
        // The two most informative traits for choosing a recording: how far it
        // travelled, and why it ended.
        expect(screen.getByText(/34 m/)).toBeInTheDocument()
        expect(screen.getByText(/shutdown/)).toBeInTheDocument()

        fireEvent.click(screen.getByText('REPLAY'))
        expect(props.onPick).toHaveBeenCalledWith(8)
    })

    it('shows a walk in kilometres and an interruption in words', () => {
        open({ missions: [{ ...mission, distanceM: 2340, endReason: 'interrupted' }] })
        expect(screen.getByText(/2\.3 km/)).toBeInTheDocument()
        expect(screen.getByText(/interrupted/)).toBeInTheDocument()
    })

    it('withholds the distance of a mission that never had a fix', () => {
        // Null, not zero: an indoor DEMO did not travel zero metres, it has no
        // track at all — so no distance fragment is rendered.
        open({ missions: [{ ...mission, distanceM: null }] })
        expect(screen.queryByText(/\d+ m ·/)).not.toBeInTheDocument()
        expect(screen.getByText(/78 rows/)).toBeInTheDocument()
    })

    it('marks a purged mission rather than showing it as empty', () => {
        open({ missions: [{ ...mission, purgedAt: '2026-09-29T00:00:00Z' }] })
        expect(screen.getByText(/detail purged/)).toBeInTheDocument()
    })

    it('says the archive is empty, and why a demonstration leaves it that way', () => {
        open({ missions: [] })
        expect(screen.getByText(/The archive holds no missions yet/)).toBeInTheDocument()
    })

    it('says the missions are loading, which is not the same as none', () => {
        open({ missions: null })
        expect(screen.getByText('Loading missions…')).toBeInTheDocument()
    })

    it('asks before erasing, and erases nothing until it is confirmed', async () => {
        const props = open()
        fireEvent.click(screen.getByText('DELETE'))

        expect(screen.getByText(/Erase #8 and its photographs\?/)).toBeInTheDocument()
        expect(props.onDelete).not.toHaveBeenCalled()

        fireEvent.click(screen.getByText('ERASE'))
        await waitFor(() => expect(props.onDelete).toHaveBeenCalledWith(8))
    })

    it('backs out of a confirmation without touching the satellite', () => {
        const props = open()
        fireEvent.click(screen.getByText('DELETE'))
        fireEvent.click(screen.getByText('KEEP'))

        expect(props.onDelete).not.toHaveBeenCalled()
        expect(screen.getByText('REPLAY')).toBeInTheDocument()
    })

    it("shows the satellite's own reason when it refuses, and keeps the mission", async () => {
        // EXPO, or the mission currently being recorded. The satellite is the
        // half that knows which — paraphrasing it here would put a second,
        // worse explanation in front of the operator.
        const onDelete = jest.fn(async () => {
            throw new Error('deleting a mission is not permitted in EXPO')
        })
        open({ onDelete })
        fireEvent.click(screen.getByText('DELETE'))
        fireEvent.click(screen.getByText('ERASE'))

        expect(await screen.findByRole('alert')).toHaveTextContent('not permitted in EXPO')
        // Still confirmable: the operator can switch profile and press again.
        expect(screen.getByText('ERASE')).toBeInTheDocument()
    })

    it('offers no delete at all against a source that cannot delete', () => {
        // A recording opened with no satellite behind it. A button that can
        // only fail is worse than one that is not there.
        const fake = installFakeSource()
        fake.capabilities = { ...fake.capabilities, deleteMissions: false }
        open()
        expect(screen.queryByText('DELETE')).not.toBeInTheDocument()
        expect(screen.getByText('REPLAY')).toBeInTheDocument()
    })

    it('closes on the button, on Escape, and on the page behind it', () => {
        const props = open()
        fireEvent.click(screen.getByLabelText('Close the mission archive'))
        expect(props.onClose).toHaveBeenCalledTimes(1)

        fireEvent.keyDown(document, { key: 'Escape' })
        expect(props.onClose).toHaveBeenCalledTimes(2)

        fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
        expect(props.onClose).toHaveBeenCalledTimes(3)
    })

    it('does not close when a click inside the panel bubbles out', () => {
        const props = open()
        fireEvent.click(screen.getByRole('dialog'))
        expect(props.onClose).not.toHaveBeenCalled()
    })
})
