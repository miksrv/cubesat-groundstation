/**
 * Pins the `cubesat/payload/photo` wire shapes to the satellite's own spelling
 * (`cubesat-sim/src/cubesat/payload/service.py`). One topic, three variants,
 * split across two decoders: a capture is a Photo, a refusal is a PhotoRefusal,
 * and each decoder must return null for the other's message.
 */

import { decodeObc, decodePhoto, decodePhotoRefusal } from './decode'

const refusalWire = {
    timestamp: 1741863600.5,
    request_id: 'req-3',
    status: 'ERROR',
    reason: 'mission state LOW_POWER does not permit the camera'
}

const photoWire = {
    timestamp: 1741863600.5,
    request_id: 'req-3',
    status: 'SUCCESS',
    kind: 'photo',
    file: 'photo_20260830_120000.jpg',
    path: '/var/lib/cubesat/photos/12/photo_20260830_120000.jpg',
    size_bytes: 214543,
    mission_id: 12,
    sequence: null,
    overlay: null,
    photo_base64: '/9j/4AAQ'
}

describe('decodePhotoRefusal', () => {
    it('decodes the refusal variant — status ERROR, no kind', () => {
        expect(decodePhotoRefusal(refusalWire)).toStrictEqual({
            timestamp: 1741863600.5,
            requestId: 'req-3',
            reason: 'mission state LOW_POWER does not permit the camera'
        })
    })

    it('returns null for a capture, which decodePhoto owns', () => {
        expect(decodePhotoRefusal(photoWire)).toBeNull()
    })
})

describe('decodeObc', () => {
    it('keeps a state name this build has not heard of, verbatim', () => {
        // The state machine lives on the satellite. An earlier build validated
        // the name and dropped the whole message — so a satellite that grew a
        // state froze the panel on the previous one, profile and subsystems
        // included.
        const obc = decodeObc({
            timestamp: 1741863600.5,
            status: 'HIBERNATE',
            profile: 'FLIGHT',
            subsystems: { watched: ['eps'], lost: [] }
        })
        expect(obc?.status).toBe('HIBERNATE')
        expect(obc?.profile).toBe('FLIGHT')
        expect(obc?.subsystems).toStrictEqual({ watched: ['eps'], lost: [] })
    })

    it('still drops a payload with no usable status at all', () => {
        expect(decodeObc({ timestamp: 1741863600.5, profile: 'DEMO' })).toBeNull()
        expect(decodeObc({ timestamp: 1741863600.5, status: '' })).toBeNull()
        expect(decodeObc({ timestamp: 1741863600.5, status: 7 })).toBeNull()
    })
})

describe('decodePhoto', () => {
    it('still drops the refusal variant rather than guessing at it', () => {
        expect(decodePhoto(refusalWire)).toBeNull()
    })

    it('decodes a capture', () => {
        expect(decodePhoto(photoWire)).toMatchObject({
            kind: 'photo',
            file: 'photo_20260830_120000.jpg',
            missionId: 12,
            photoBase64: '/9j/4AAQ'
        })
    })
})
