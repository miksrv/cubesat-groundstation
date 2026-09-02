import type { CameraShot } from '../../features/telemetry/types'
import { fireEvent, render, screen, within } from '../../test-utils'

import CameraViewWidget from './CameraViewWidget'

import '@testing-library/jest-dom'

const shot = (overrides: Partial<CameraShot> = {}): CameraShot => ({
    src: '/api/photos/42/photo_20260830_120000.jpg',
    kind: 'photo',
    file: 'photo_20260830_120000.jpg',
    timestamp: 1741863600,
    missionId: 42,
    sizeBytes: 245760,
    ...overrides
})

describe('CameraViewWidget', () => {
    it('says no photograph has arrived yet, rather than faking one', () => {
        render(
            <CameraViewWidget
                shot={null}
                photosAvailable={true}
                isLoading={false}
            />
        )
        expect(screen.getByText(/No photograph yet/)).toBeInTheDocument()
        expect(screen.queryByRole('img')).not.toBeInTheDocument()
        // The caption row stays, saying in words what is missing — the card
        // keeps its shape.
        expect(screen.getByText('no photo data')).toBeInTheDocument()
    })

    it('says a recording carries no photographs, which is not a silent camera', () => {
        render(
            <CameraViewWidget
                shot={null}
                photosAvailable={false}
                isLoading={false}
            />
        )
        expect(screen.getByText(/recording carries no photographs/)).toBeInTheDocument()
    })

    it('renders the image with its provenance in the caption', () => {
        render(
            <CameraViewWidget
                shot={shot()}
                photosAvailable={true}
                isLoading={false}
            />
        )
        const image = screen.getByRole('img')
        expect(image).toHaveAttribute('src', '/api/photos/42/photo_20260830_120000.jpg')
        expect(screen.getByText('PHOTO')).toBeInTheDocument()
        expect(screen.getByText(/mission 42/)).toBeInTheDocument()
        expect(screen.getByText(/240 KB/)).toBeInTheDocument()
        // The caption carries the capture date, not the time alone: the
        // archive fallback can surface a photograph days old.
        expect(screen.getByText(/2025/)).toBeInTheDocument()
    })

    it('labels an archive image by its file name when no capture time is known', () => {
        render(
            <CameraViewWidget
                shot={shot({ kind: 'archive', timestamp: null, sizeBytes: null })}
                photosAvailable={true}
                isLoading={false}
            />
        )
        expect(screen.getByText('ARCHIVE')).toBeInTheDocument()
        expect(screen.getByText(/photo_20260830_120000\.jpg · mission 42/)).toBeInTheDocument()
    })

    it('says a photograph with no mission belongs to none, never to one of its own', () => {
        render(
            <CameraViewWidget
                shot={shot({ missionId: null, src: 'data:image/jpeg;base64,abc' })}
                photosAvailable={true}
                isLoading={false}
            />
        )
        expect(screen.getByText(/no mission/)).toBeInTheDocument()
    })

    it('opens the photograph full screen, and closes on Escape', () => {
        render(
            <CameraViewWidget
                shot={shot()}
                photosAvailable={true}
                isLoading={false}
            />
        )
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /full screen/i }))

        const lightbox = screen.getByRole('dialog')
        expect(lightbox).toBeInTheDocument()
        // Both the card and the lightbox show the same photograph.
        expect(screen.getAllByRole('img')).toHaveLength(2)
        // Provenance travels with it: full screen is where an operator asks
        // which mission this was.
        expect(within(lightbox).getByText(/mission 42/)).toBeInTheDocument()

        fireEvent.keyDown(document, { key: 'Escape' })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('closes the full-screen photograph on the backdrop and on its close button', () => {
        render(
            <CameraViewWidget
                shot={shot()}
                photosAvailable={true}
                isLoading={false}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /full screen/i }))
        fireEvent.click(screen.getByRole('button', { name: /Close the full-screen/i }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /full screen/i }))
        // The darkness itself, not a child of it — a click that began on the
        // image and drifted off must not close it.
        fireEvent.click(screen.getByRole('dialog'))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('takes the full-screen view down with a photograph the satellite has deleted', () => {
        render(
            <CameraViewWidget
                shot={shot()}
                photosAvailable={true}
                isLoading={false}
            />
        )
        fireEvent.click(screen.getByRole('button', { name: /full screen/i }))

        const enlarged = within(screen.getByRole('dialog')).getByRole('img')
        fireEvent.error(enlarged)

        // No black screen left over the dashboard, and the card says why.
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(screen.getByText(/retention removes/)).toBeInTheDocument()
    })

    it('falls back to the placeholder when the image is gone from the satellite', () => {
        render(
            <CameraViewWidget
                shot={shot()}
                photosAvailable={true}
                isLoading={false}
            />
        )
        fireEvent.error(screen.getByRole('img'))
        expect(screen.queryByRole('img')).not.toBeInTheDocument()
        expect(screen.getByText(/retention removes/)).toBeInTheDocument()
    })
})
