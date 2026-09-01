import { act } from 'react'

import { renderHook, waitFor } from '@testing-library/react'

import { installFakeSource } from '../../test-source'

import type { Photo } from './types'
import { useCameraShot } from './useSource'

const photo = (overrides: Partial<Extract<Photo, { kind: 'photo' }>> = {}): Photo => ({
    kind: 'photo',
    timestamp: 1741863600,
    file: 'photo_20260830_120000.jpg',
    path: '/var/lib/cubesat/photos/42/photo_20260830_120000.jpg',
    sizeBytes: 245760,
    missionId: 42,
    photoBase64: 'abc123',
    overlay: null,
    ...overrides
})

describe('useCameraShot', () => {
    it('renders an on-demand photo from the pixels it carried over the bus', () => {
        const fake = installFakeSource()
        const { result } = renderHook(() => useCameraShot(42))
        act(() => {
            fake.emitPhoto(photo())
        })
        expect(result.current).toMatchObject({
            kind: 'photo',
            src: 'data:image/jpeg;base64,abc123',
            missionId: 42
        })
    })

    it('renders a timelapse frame from its URL, since the bus carried no pixels', () => {
        const fake = installFakeSource()
        const { result } = renderHook(() => useCameraShot(42))
        act(() => {
            fake.emitPhoto({
                kind: 'timelapse',
                timestamp: 1741863600,
                file: 'timelapse_20260830_120000_0007.jpg',
                path: '/var/lib/cubesat/photos/42/timelapse_20260830_120000_0007.jpg',
                sizeBytes: 204800,
                missionId: 42,
                sequence: 7,
                overlay: null
            })
        })
        expect(result.current).toMatchObject({
            kind: 'timelapse',
            src: '/api/photos/42/timelapse_20260830_120000_0007.jpg'
        })
    })

    it('asks the archive for the newest file when no live photograph has arrived', async () => {
        const fake = installFakeSource()
        fake.photos = [
            { name: 'photo_20260830_110000.jpg', url: '/api/photos/42/photo_20260830_110000.jpg' },
            { name: 'photo_20260830_120000.jpg', url: '/api/photos/42/photo_20260830_120000.jpg' }
        ]
        const { result } = renderHook(() => useCameraShot(42))
        await waitFor(() =>
            expect(result.current).toMatchObject({
                kind: 'archive',
                src: '/api/photos/42/photo_20260830_120000.jpg',
                file: 'photo_20260830_120000.jpg',
                missionId: 42,
                // Recovered from the file name, which embeds the UTC capture time.
                timestamp: Date.UTC(2026, 7, 30, 12, 0, 0) / 1000
            })
        )
    })

    it('declares no capture time for an archive name that does not embed one', async () => {
        const fake = installFakeSource()
        fake.photos = [{ name: 'snapshot.jpg', url: '/api/photos/42/snapshot.jpg' }]
        const { result } = renderHook(() => useCameraShot(42))
        await waitFor(() => expect(result.current).toMatchObject({ kind: 'archive', timestamp: null }))
    })

    it('shows nothing for an unfiled frame: the satellite serves only filed photos', () => {
        const fake = installFakeSource()
        const { result } = renderHook(() => useCameraShot(null))
        act(() => {
            fake.emitPhoto({
                kind: 'timelapse',
                timestamp: 1741863600,
                file: 'timelapse_20260830_120000_0001.jpg',
                path: '/var/lib/cubesat/photos/unfiled/timelapse_20260830_120000_0001.jpg',
                sizeBytes: 204800,
                missionId: null,
                sequence: 1,
                overlay: null
            })
        })
        expect(result.current).toBeNull()
    })

    it('never asks a source that declared photographs absent', async () => {
        const fake = installFakeSource()
        fake.capabilities = { ...fake.capabilities, photos: false }
        fake.photos = [{ name: 'photo_20260830_120000.jpg', url: '/api/photos/42/photo_20260830_120000.jpg' }]
        const { result } = renderHook(() => useCameraShot(42))
        // Give a wrongly-issued fetch every chance to land before asserting.
        await act(async () => {
            await Promise.resolve()
        })
        expect(result.current).toBeNull()
    })

    it('survives an unreachable archive: the live channel is a separate thing', async () => {
        const fake = installFakeSource()
        fake.archiveError = new Error('the archive is down')
        const { result } = renderHook(() => useCameraShot(42))
        await act(async () => {
            await Promise.resolve()
        })
        expect(result.current).toBeNull()
        act(() => {
            fake.emitPhoto(photo())
        })
        expect(result.current).toMatchObject({ kind: 'photo' })
    })
})
