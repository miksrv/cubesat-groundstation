/**
 * Pins the `cubesat/payload/photo` wire shapes to the satellite's own spelling
 * (`cubesat-sim/src/cubesat/payload/service.py`). One topic, three variants,
 * split across two decoders: a capture is a Photo, a refusal is a PhotoRefusal,
 * and each decoder must return null for the other's message.
 */

import { decodeComms, decodeDeleteResult, decodeObc, decodePhoto, decodePhotoRefusal } from './decode'

const refusalWire = {
    timestamp: 1741863600.5,
    request_id: 'req-3',
    status: 'ERROR',
    reason: 'mission state LOW_POWER does not permit the camera',
    reason_code: 'state'
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
            reason: 'mission state LOW_POWER does not permit the camera',
            // Both spellings of the same no, added by the satellite on
            // 2026-09-03: the sentence for a person, the one word for a beacon
            // field that may not contain a space.
            reasonCode: 'state'
        })
    })

    it('leaves the code null on a satellite that predates it', () => {
        const { reason_code: _dropped, ...older } = refusalWire
        expect(decodePhotoRefusal(older)?.reasonCode).toBeNull()
    })

    it('returns null for a capture, which decodePhoto owns', () => {
        expect(decodePhotoRefusal(photoWire)).toBeNull()
    })
})

/**
 * Pins `cubesat/comms/status` to the satellite's own spelling, and in
 * particular to the rename of 2026-09-03: `lora_enabled` became
 * `beacon_enabled` when the flag stopped deciding whether the radio transmits
 * at all and started rationing only the scheduled beacon. The satellite
 * publishes both keys for now; the fallback is what lets this build run against
 * one that has not been updated, and the precedence is what stops it reading a
 * deprecated mirror when the real field is right there.
 */
describe('decodeComms', () => {
    const commsWire = {
        timestamp: 1741863600.0,
        radio: { present: true, node: '!698204b0', region: 'US' },
        beacon_enabled: true,
        lora_enabled: true,
        lora_listening: true,
        command_channel: 1,
        last_uplink: 1741863400.0
    }

    it('reads the beacon flag and the command channel', () => {
        expect(decodeComms(commsWire)).toStrictEqual({
            timestamp: 1741863600.0,
            radio: { present: true, node: '!698204b0', region: 'US' },
            beaconEnabled: true,
            loraListening: true,
            commandChannel: 1,
            lastUplink: 1741863400.0
        })
    })

    it('prefers the new key over the deprecated mirror beside it', () => {
        // They carry the same value on the satellite today. If they ever
        // disagree, the one that is not deprecated is the answer.
        expect(decodeComms({ ...commsWire, beacon_enabled: false }).beaconEnabled).toBe(false)
    })

    it('falls back to lora_enabled on a satellite that has not been updated', () => {
        const { beacon_enabled: _dropped, ...older } = commsWire
        expect(decodeComms(older).beaconEnabled).toBe(true)
    })

    it('withholds a command channel rather than reading its absence as channel 0', () => {
        // Channel 0 is the public primary. Naming it as the command channel
        // would be the opposite of the truth about a satellite that has no
        // uplink filter at all.
        const { command_channel: _dropped, ...older } = commsWire
        expect(decodeComms(older).commandChannel).toBeNull()
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

describe('decodeDeleteResult', () => {
    it('decodes what DHS reports in dhs_status.last_delete', () => {
        expect(
            decodeDeleteResult({
                at: 1741863612.4,
                request_id: 'req_042',
                mission_id: 41,
                ok: true,
                error: null,
                rows: 318,
                attitude: 2283,
                radio: 57,
                photos: 12,
                bytes_reclaimed: 5242880
            })
        ).toStrictEqual({
            at: 1741863612.4,
            requestId: 'req_042',
            missionId: 41,
            ok: true,
            error: null,
            rows: 318,
            attitude: 2283,
            radio: 57,
            photos: 12,
            bytesReclaimed: 5242880
        })
    })

    it('carries the refusal and its reason', () => {
        const refused = decodeDeleteResult({
            at: 1741863612.4,
            request_id: 'req_042',
            mission_id: 41,
            ok: false,
            error: 'mission 41 is being recorded; end it first'
        })
        expect(refused?.ok).toBe(false)
        expect(refused?.error).toBe('mission 41 is being recorded; end it first')
    })

    it('treats anything but an explicit success as a refusal', () => {
        // The satellite is the half that knows. Assuming otherwise would tell
        // somebody their mission is gone when it may well not be.
        expect(decodeDeleteResult({ request_id: 'req_042' })?.ok).toBe(false)
    })

    it('is null before the recorder has ever been asked to delete anything', () => {
        expect(decodeDeleteResult(null)).toBeNull()
        expect(decodeDeleteResult(undefined)).toBeNull()
    })
})
