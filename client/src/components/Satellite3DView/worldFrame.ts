import * as THREE from 'three'

import type { AttitudeUpdate } from '../../features/telemetry/source'
import type { AdcsStatus, Vector3 } from '../../features/telemetry/types'

import type { FrameCheck, HeadingFix } from './sceneContract'
import {
    FRAME_TOLERANCE_DEG,
    HEADING_SPREAD_TOLERANCE_DEG,
    INITIAL_FRAME_CHECK,
    INITIAL_HEADING_FIX,
    MAG_CALIBRATED
} from './sceneContract'

/**
 * The one place the sensor's world frame is turned into the scene's world frame.
 *
 * **What is assumed.** The BNO055 runs in NDOF, so its quaternion is *absolute*:
 * it maps body axes into a world frame fixed by gravity and by magnetic north,
 * not into wherever the chip happened to be switched on. That world frame's up
 * axis is +Z. three.js draws with up = +Y. `SENSOR_WORLD_TO_SCENE` is the
 * rotation that carries the first onto the second — a quarter turn about the
 * shared X axis — and it is applied on the *left* of every attitude sample:
 *
 *     scene_object.quaternion = SENSOR_WORLD_TO_SCENE * q_sensor
 *
 * It is a proper rotation (a quarter turn, not a reflection), so the drawn body
 * stays right-handed: sensor +X → scene +X, sensor +Y → scene −Z, sensor +Z →
 * scene +Y.
 *
 * **What it is derived from.** `cubesat-sim/docs/hardware-bno055-bmp280-imu.md`,
 * bench session 2026-08-23, board resting on a bench: the fused quaternion read
 * `w 0.970`, i.e. a total rotation of 2·acos(0.970) = 28.1° away from identity,
 * while the Euler angles read roll 27.19° and pitch 7.06° — the same 28° of tilt
 * off level. A quaternion that goes to identity as the board goes level is a
 * quaternion whose world frame has the board's +Z as its up axis, and
 * `hal/rpi/bno055.py` records (bench-verified 2026-08-28) that the frame's +Z
 * *is* up. That fixes the up axis, and only the up axis.
 *
 * **What it does not claim.** Which way the scene's +X points on the ground is
 * arbitrary. Heading comes from the magnetometer, and below `CALIB_STAT` mag = 3
 * the BNO055 reports a constant heading rather than a bad one — which is exactly
 * why the satellite withholds `yaw`. Nothing in *this* rotation says which way
 * is north; the horizon it produces says only which way is up.
 *
 * That gap is measured rather than assumed: {@link NorthEstimator} below
 * reconciles the published `yaw` against the azimuth this rotation gives the
 * body's own forward axis, and the difference between the two *is* the heading
 * of scene +X. Until the magnetometer reaches 3/3 there is no `yaw` to
 * reconcile, so the compass ring stays a plain unlettered circle.
 *
 * **What would disprove it.** Stand the satellite level on a bench with the
 * camera facing you. The drawn cube must sit level with its top face up, and
 * `GravityFrameCheck` below must settle at a few degrees. A cube that lies on
 * its side, or a check that settles near 90°, means this rotation is wrong —
 * and the scene says so on screen instead of quietly turning the floor.
 */
export const SENSOR_WORLD_TO_SCENE: THREE.Quaternion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    -Math.PI / 2
)

/** Scene-world up. three.js convention, and what the ground plane is drawn flat
 *  against — the horizon is a consequence of this vector, not of a measurement. */
export const SCENE_UP: THREE.Vector3 = new THREE.Vector3(0, 1, 0)

/**
 * Seconds of exponential smoothing applied to the measured acceleration before
 * anything is concluded from it. The satellite is carried on a walk, so a single
 * sample is one g plus a footfall; a few seconds of averaging leaves the g and
 * cancels the stride.
 */
export const GRAVITY_TIME_CONSTANT_S = 3

/** How much smoothed history must exist before a verdict is offered at all. */
export const GRAVITY_SETTLE_S = 3

/**
 * The band of smoothed |a| within which the accelerometer can be read as
 * measuring gravity and little else. Outside it — a lift, a fall, a shake — the
 * reading is dominated by linear acceleration and says nothing about which way
 * the world is, so the check reports `waiting` rather than a verdict it cannot
 * support.
 */
export const GRAVITY_MIN_G = 0.7
export const GRAVITY_MAX_G = 1.3

/**
 * A standing audit of `SENSOR_WORLD_TO_SCENE` against the sensor that physically
 * defines down.
 *
 * The accelerometer is not used to *orient* anything. The ground plane stays
 * fixed to scene-world −Y on purpose: the whole point of a world reference is
 * that the satellite turns inside a world that does not, and a floor that
 * followed the smoothed g would absorb part of every tilt — the viewer could no
 * longer read attitude off the picture, which is the one thing the picture is
 * for. So the accelerometer audits the floor instead of moving it, and when the
 * audit fails the scene withdraws the claim rather than silently correcting it.
 *
 * **Sign.** At rest an accelerometer reads specific force, so it points *up*,
 * not down: the bench dump above has `gravity 4.48 −1.07 8.65 m/s²` on a board
 * whose +Z is up, and both `src/test-fixtures.ts` and the placeholder recording
 * carry `accel z ≈ +0.99 g` for a level satellite. The expected direction is
 * therefore scene-world **+Y**.
 *
 * This has to run live and keep running. The bundled recording is synthetic —
 * `scripts/make-placeholder-recording.mjs` writes the accelerations it was told
 * to write — so it can neither confirm nor refute anything about the real chip.
 * The check exists so that the first real mission off the Raspberry Pi speaks up
 * on screen if any of the above is wrong.
 */
export class GravityFrameCheck {
    private readonly smoothed = new THREE.Vector3()
    private readonly measured = new THREE.Vector3()
    private readonly rotation = new THREE.Quaternion()
    private elapsed = 0
    private last: FrameCheck = INITIAL_FRAME_CHECK

    public reset(): void {
        this.smoothed.set(0, 0, 0)
        this.elapsed = 0
        this.last = INITIAL_FRAME_CHECK
    }

    /**
     * @param attitude the raw sample, not the scene's interpolated orientation —
     *   the sample and the acceleration are the two halves of one ADCS payload,
     *   and pairing a measurement with a smoothing artefact would test the
     *   interpolator rather than the frame.
     * @param accel body-frame acceleration in g.
     * @param delta seconds since the previous frame.
     */
    public update(attitude: AttitudeUpdate | null, accel: Vector3 | null, delta: number): FrameCheck {
        if (!attitude || accel?.x == null || accel?.y == null || accel?.z == null) {
            return this.last
        }
        if (!Number.isFinite(delta) || delta <= 0) {
            return this.last
        }

        // three.js orders a quaternion (x, y, z, w); the BNO055 publishes
        // (w, x, y, z). Written out rather than spread, because the two
        // conventions differ by exactly one silent rotation.
        this.rotation.set(attitude.x, attitude.y, attitude.z, attitude.w).normalize()
        this.rotation.premultiply(SENSOR_WORLD_TO_SCENE)
        this.measured.set(accel.x, accel.y, accel.z).applyQuaternion(this.rotation)

        // A long gap — a backgrounded tab — should restart the average on the
        // newest sample rather than blend across the hole, which is what
        // 1 − e^(−dt/τ) does on its own as dt grows.
        const alpha = this.elapsed === 0 ? 1 : 1 - Math.exp(-delta / GRAVITY_TIME_CONSTANT_S)
        this.smoothed.lerp(this.measured, alpha)
        this.elapsed += delta

        const magnitude = this.smoothed.length()
        if (this.elapsed < GRAVITY_SETTLE_S || magnitude < GRAVITY_MIN_G || magnitude > GRAVITY_MAX_G) {
            this.last = INITIAL_FRAME_CHECK
            return this.last
        }

        const angleDeg = THREE.MathUtils.radToDeg(this.smoothed.angleTo(SCENE_UP))
        this.last = { status: angleDeg <= FRAME_TOLERANCE_DEG ? 'verified' : 'unverified', angleDeg }
        return this.last
    }
}

/** How much of a unit vector must survive projection onto the ground plane
 *  before its azimuth is used. 0.2 is about 78° of elevation: past that the
 *  azimuth is mostly the numerical noise in the two small components. */
const MIN_HORIZONTAL = 0.2

/**
 * The scene azimuth of a direction: its angle about scene-world up (+Y),
 * measured from scene +X, right-handed, in radians.
 *
 * A right-handed rotation by θ about +Y carries +X onto `(cos θ, 0, −sin θ)`,
 * which is where the negated Z comes from. Returns null for a direction with
 * nothing left once it is projected onto the ground plane — a satellite pointed
 * straight up has no azimuth, and interpolating one out of numerical noise is
 * how a compass ends up spinning.
 */
export const sceneAzimuth = (direction: THREE.Vector3): number | null => {
    const horizontal = Math.hypot(direction.x, direction.z)
    return horizontal < MIN_HORIZONTAL ? null : Math.atan2(-direction.z, direction.x)
}

/** The body axis whose azimuth is reconciled against the published heading.
 *  See {@link NorthEstimator} for why the choice barely matters and what would
 *  show that it does. */
const BODY_FORWARD = new THREE.Vector3(1, 0, 0)

/**
 * Seconds of exponential forgetting on the accumulated reconciliation.
 *
 * The offset being estimated is not a constant of nature: the BNO055's fusion
 * engine re-references its yaw when the magnetometer calibrates, so evidence
 * from before that moment is evidence about a frame that no longer exists. A
 * minute is long enough to cover a walk's worth of turns — which is what makes
 * the consistency check able to fail — and short enough that a re-reference
 * works its way out rather than poisoning the estimate for the session.
 */
export const NORTH_TIME_CONSTANT_S = 60

/** How much accumulated evidence is needed before an angle is offered at all.
 *  ADCS publishes at 2 Hz, so this is a few seconds of agreement. */
export const NORTH_MIN_WEIGHT = 8

/**
 * The largest gap between the attitude sample and the ADCS status it is
 * reconciled against, whatever the satellite was doing.
 *
 * Live the two are exits from one payload and the gap is exactly zero — the
 * attitude channel carries `t: adcs.timestamp`. A mission replay is different:
 * the orientation is interpolated at the playhead while the status comes from
 * the nearest telemetry row, and DHS ticks a good deal slower than ADCS
 * publishes. Six seconds is about one such row. Past it the pair says nothing
 * even about a satellite standing still, because nothing observed the seconds
 * in between.
 */
export const NORTH_MAX_SKEW_S = 6

/**
 * How much heading error the pairing may carry, in degrees.
 *
 * The quantity that actually matters is not the skew and not the turn rate but
 * their product: a heading read *s* seconds away from an orientation, while the
 * satellite turned at ω, describes a direction ωs degrees from the one it is
 * being matched against. So that is what is bounded. It falls out the right way
 * at both ends — a live pair has zero skew and is admitted however fast the
 * satellite is spinning, and a replay's six-second pair is admitted only while
 * the gyro says the satellite was very nearly still.
 *
 * Four degrees is under `HEADING_SPREAD_TOLERANCE_DEG`, so a run of admitted
 * pairs cannot on its own manufacture the scatter that withdraws the compass.
 */
export const NORTH_MAX_PAIRING_ERROR_DEG = 4

/**
 * Where north is in the scene, derived rather than assumed.
 *
 * **What is assumed.** Exactly one thing: that the published `yaw` is a compass
 * bearing — degrees clockwise from magnetic north, seen from above — of some
 * body direction fixed relative to the body's own +X. That is what a BNO055
 * running NDOF means by `EUL_HEADING`, and `hal/rpi/bno055.py` publishes the
 * register verbatim (`yaw=round(heading, 4)`) with a 0..360 plausibility check
 * around it. Note what is *not* assumed: which way the sensor's world +X
 * points. `SENSOR_WORLD_TO_SCENE` above fixes the up axis and says outright
 * that the heading of scene +X is arbitrary, so this class measures it.
 *
 * **How.** Two independent things describe the same physical direction. The
 * attitude quaternion gives the scene azimuth ψ of the body's forward axis; the
 * published heading gives the magnetic bearing *h* of (near enough) the same
 * axis. Bearings run clockwise and scene azimuths run counter-clockwise, so
 * `h = −ψ + c` for some constant *c*, and *c* is then the magnetic bearing of
 * scene +X — equivalently, the scene azimuth of magnetic north. Every usable
 * pair contributes one estimate `c = h + ψ`, accumulated as a unit vector so
 * that the average wraps properly at 360°.
 *
 * **Why the choice of body axis barely matters.** The BNO055's heading is
 * measured about the chip's Z; whichever direction in the body's XY plane it
 * references, it differs from +X by a fixed rotation about that same Z, and a
 * fixed rotation is absorbed into *c* without changing anything. What would
 * *not* be absorbed is a reference direction that is not in that plane — and
 * that is one of the things the scatter below detects, because such an offset
 * would move with roll and pitch instead of holding still.
 *
 * **What would disprove it.** The scatter. Carry the satellite through a turn
 * and back: every heading it passes through contributes an estimate of the same
 * *c*, so a wrong sign convention (bearings running counter-clockwise after
 * all) puts the estimates at twice the turn angle apart, and a mispaired
 * heading puts them wherever the skew landed. The circular standard deviation
 * of the accumulator is reported alongside the angle, and past
 * `HEADING_SPREAD_TOLERANCE_DEG` the ring loses its letters and the caption
 * says by how much the two sources disagree. It is the same bargain as
 * `GravityFrameCheck`: the scene cannot correct itself, so it withdraws the
 * claim instead of quietly turning the compass.
 *
 * **A thing worth watching for.** If *c* settles near zero, the sensor's world
 * +X really is magnetic north and wave 1's "arbitrary" was conservative. That
 * would be a fact learned from the first real mission — it is still not
 * something to assume, because it only becomes true at the moment the
 * magnetometer calibrates, and it is exactly what this class measures.
 */
export class NorthEstimator {
    private sin = 0
    private cos = 0
    private weight = 0
    /** The last pair actually folded in, so that a probe ticking faster than
     *  the satellite publishes does not count one sample four times. */
    private pair = ''
    private last: HeadingFix = INITIAL_HEADING_FIX
    private readonly rotation = new THREE.Quaternion()
    private readonly forward = new THREE.Vector3()

    public reset(): void {
        this.sin = 0
        this.cos = 0
        this.weight = 0
        this.pair = ''
        this.last = INITIAL_HEADING_FIX
    }

    /**
     * @param attitude the latest attitude sample.
     * @param adcs the status it is reconciled against — the heading, the
     *   calibration that says whether the heading is a measurement at all, the
     *   turn rate, and the timestamp that says whether the two belong together.
     * @param delta seconds since the previous call, for the forgetting factor.
     */
    public update(attitude: AttitudeUpdate | null, adcs: AdcsStatus | null, delta: number): HeadingFix {
        // Withheld is not a weaker fix, it is a different situation: the
        // satellite is not publishing a heading, so there is nothing to
        // reconcile. Everything accumulated is dropped, because the fusion
        // engine re-references its yaw when the magnetometer next calibrates
        // and the old offset would then be an offset into a frame that is gone.
        if (adcs?.yaw == null || adcs.calibStatus?.mag !== MAG_CALIBRATED) {
            this.reset()
            return this.last
        }
        if (!Number.isFinite(delta) || delta <= 0) {
            return this.last
        }

        // Forget on the clock rather than per sample: the probe's tick and the
        // satellite's publish rate are different things, and only one of them
        // is time.
        const decay = Math.exp(-delta / NORTH_TIME_CONSTANT_S)
        this.sin *= decay
        this.cos *= decay
        this.weight *= decay

        this.fold(attitude, adcs)
        return this.verdict()
    }

    /** One pair of observations, if this one is usable. Silent about the ones
     *  it drops — a rejected sample is not a finding, it is a sample taken at a
     *  moment when the arithmetic would not have meant anything. */
    private fold(attitude: AttitudeUpdate | null, adcs: AdcsStatus): void {
        if (!attitude || adcs.yaw == null) {
            return
        }
        const key = `${attitude.t}:${adcs.timestamp}`
        if (key === this.pair) {
            return
        }
        const skew = Math.abs(attitude.t - adcs.timestamp)
        if (skew > NORTH_MAX_SKEW_S) {
            return
        }
        const { x, y, z } = adcs.gyro
        if (x == null || y == null || z == null) {
            return
        }
        // How far the satellite could have turned between the two halves of
        // this pair. A withheld axis is not treated as a still one — a null is
        // never a zero — which is why the three are checked above first.
        if (skew * Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) > NORTH_MAX_PAIRING_ERROR_DEG) {
            return
        }

        // three.js orders a quaternion (x, y, z, w); the BNO055 publishes
        // (w, x, y, z). Written out rather than spread, because the two
        // conventions differ by exactly one silent rotation.
        this.rotation.set(attitude.x, attitude.y, attitude.z, attitude.w).normalize()
        this.rotation.premultiply(SENSOR_WORLD_TO_SCENE)
        this.forward.copy(BODY_FORWARD).applyQuaternion(this.rotation)

        const azimuth = sceneAzimuth(this.forward)
        if (azimuth == null) {
            return
        }

        this.pair = key
        const offset = THREE.MathUtils.degToRad(adcs.yaw) + azimuth
        this.sin += Math.sin(offset)
        this.cos += Math.cos(offset)
        this.weight += 1
    }

    private verdict(): HeadingFix {
        if (this.weight < NORTH_MIN_WEIGHT) {
            this.last = { status: 'estimating', northAngleDeg: null, spreadDeg: null }
            return this.last
        }

        // The resultant length of the accumulated unit vectors: 1 when every
        // estimate agreed, 0 when they cancelled. Its circular standard
        // deviation, √(−2·ln R), is the number reported — for a tight cluster
        // it is very nearly the ordinary standard deviation in degrees, and it
        // stays meaningful when the estimates straddle 360°.
        const resultant = Math.min(1, Math.hypot(this.sin, this.cos) / this.weight)
        const spreadDeg =
            resultant <= 1e-6 ? 180 : Math.min(180, THREE.MathUtils.radToDeg(Math.sqrt(-2 * Math.log(resultant))))

        if (spreadDeg > HEADING_SPREAD_TOLERANCE_DEG) {
            this.last = { status: 'inconsistent', northAngleDeg: null, spreadDeg }
            return this.last
        }

        const north = THREE.MathUtils.radToDeg(Math.atan2(this.sin, this.cos))
        this.last = { status: 'fixed', northAngleDeg: ((north % 360) + 360) % 360, spreadDeg }
        return this.last
    }
}
