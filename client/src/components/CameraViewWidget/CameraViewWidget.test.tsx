import type { CameraShot } from '../../features/telemetry/types'
import { fireEvent, render, screen } from '../../test-utils'

import CameraViewWidget from './CameraViewWidget'

import '@testing-library/jest-dom'

const shot = (overrides: Partial<CameraShot> = {}): CameraShot => ({
    src: '/api/photos/42/photo_20260830_120000.jpg',
    kind: 'photo',
    file: 'photo_20260830_120000.jpg',
    timestamp: 1741863600,
    missionId: '42',
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

    it('says a photograph filed under no mission is unfiled, never a mission of its own', () => {
        render(
            <CameraViewWidget
                shot={shot({ missionId: null, src: 'data:image/jpeg;base64,abc' })}
                photosAvailable={true}
                isLoading={false}
            />
        )
        expect(screen.getByText(/unfiled/)).toBeInTheDocument()
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
