import { NorthEstimator } from '../../../components/Satellite3DView/worldFrame'
import type { AdcsStatus } from '../types'

import raw from './placeholder.json'

/**
 * The bundled recording, checked against the one part of the dashboard that
 * reconciles two of its channels against each other.
 *
 * Everything else a recording feeds is taken on its own: a chart draws the
 * numbers it is given. `NorthEstimator` is different — it folds the published
 * `yaw` together with the quaternion and reports how much the two disagree, so a
 * recording whose heading was invented independently of its orientation is
 * *detectable*, and this one's was. `yaw` was the counter-clockwise turn angle
 * written out verbatim, where a BNO055's `EUL_HEADING` is a clockwise compass
 * bearing; folding the two gave twice the turn angle instead of a constant, 180°
 * of scatter, and the demo's compass ring correctly refused to letter itself.
 *
 * A generated fixture cannot prove anything about the hardware. It can be made
 * to stop contradicting the hardware's documented conventions, and that is what
 * is asserted here: run the estimator on the recording the way the replay feeds
 * it, and a north offset has to come out.
 */

/** The offset `scripts/make-placeholder-recording.mjs` writes in. The estimator
 *  is given no hint of it — recovering it is the test. */
const NORTH_OFFSET_DEG = 42

/** Wall seconds between two crossed rows at the replay's compression: rows are
 *  30 s of satellite time apart and the playhead runs ten times over. */
const WALL_SECONDS_BETWEEN_ROWS = 3

interface Row {
    timestamp: string
    yaw: number | null
    calib_status: string
    gyro_x: number
    gyro_y: number
    gyro_z: number
}

const rows = raw.telemetry as unknown as Row[]
const samples = raw.attitude as Array<{ t: number; quat_w: number; quat_x: number; quat_y: number; quat_z: number }>
const sampleAt = new Map(samples.map((sample) => [sample.t, sample]))

const adcsFrom = (row: Row, at: number): AdcsStatus =>
    ({
        timestamp: at,
        yaw: row.yaw,
        gyro: { x: row.gyro_x, y: row.gyro_y, z: row.gyro_z },
        calibStatus: JSON.parse(row.calib_status)
    }) as AdcsStatus

describe('the bundled placeholder recording', () => {
    it('withholds the heading until the magnetometer is calibrated', () => {
        const withheld = rows.filter((row) => row.yaw == null)
        const published = rows.filter((row) => row.yaw != null)

        expect(withheld.length).toBeGreaterThan(0)
        expect(published.length).toBeGreaterThan(0)
        // Withheld exactly when the magnetometer says so, and never a zero
        // standing in for it.
        for (const row of withheld) {
            expect(JSON.parse(row.calib_status).mag).toBeLessThan(3)
        }
        for (const row of published) {
            expect(JSON.parse(row.calib_status).mag).toBe(3)
        }
    })

    it('publishes a heading the quaternion agrees with, so the demo can find north', () => {
        const estimator = new NorthEstimator()
        let fix = estimator.update(null, null, 1)

        for (const row of rows) {
            const at = Date.parse(row.timestamp) / 1000
            const sample = sampleAt.get(at)
            if (!sample) {
                continue
            }
            // The pairing the replay actually produces: one clock, so when the
            // playhead crosses a row the attitude sample beside it is from the
            // same second.
            //
            // The delta is *wall* seconds, not satellite ones — the estimator
            // forgets on the clock the viewer is watching, and `HeadingProbe`
            // hands it real elapsed time. At the demo's tenfold compression a row
            // is crossed every 3 s of that, which is what makes the accumulated
            // weight settle above `NORTH_MIN_WEIGHT` instead of below it.
            fix = estimator.update(
                { t: sample.t, w: sample.quat_w, x: sample.quat_x, y: sample.quat_y, z: sample.quat_z },
                adcsFrom(row, at),
                WALL_SECONDS_BETWEEN_ROWS
            )
        }

        expect(fix.status).toBe('fixed')
        // Within a degree: the recording's hand-wobble moves the body's forward
        // axis a little, and the estimator is averaging over that.
        expect(fix.northAngleDeg).toBeCloseTo(NORTH_OFFSET_DEG, 0)
        expect(fix.spreadDeg).toBeLessThan(1)
    })
})
