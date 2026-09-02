/**
 * The small vocabulary the widget and its lazily-loaded WebGL scene share.
 *
 * Deliberately free of `three`: `Satellite3DView` is in the main bundle and the
 * scene is a lazy chunk, so anything the two both import lands in the critical
 * path. Importing the three.js frame maths here would drag the whole renderer
 * back in and undo the lazy split. The maths lives in `worldFrame.ts`, which
 * only the scene imports. `chartColors` is safe here — it is plain strings.
 */

import { chartColors } from '../../styles/chartColors'

/**
 * One colour per axis, for everything in this widget that draws one.
 *
 * It is a single constant because "the corner gizmo's axes are the same colours
 * as the ones coming out of the cube" is a claim that has to hold, and three
 * private copies of the triad in three files is how it quietly stops holding.
 * Red / green / blue in X / Y / Z order — the convention every 3D tool the
 * viewer has ever opened uses, Blender included.
 */
export const AXIS_COLOR = {
    x: chartColors.red[0],
    y: chartColors.green[0],
    z: chartColors.blue[0]
} as const

/** The measured-acceleration arrow. Not an axis, so not one of the three. */
export const ACCEL_COLOR = chartColors.orange[0]

/**
 * Whether the scene's world frame has been checked against the one sensor that
 * physically defines "down".
 *
 * There is no fourth state for "wrong": the check cannot correct anything, only
 * report. `waiting` is not a softer `unverified` — it says the accelerometer has
 * not yet given a steady enough reading to conclude either way.
 */
export type FrameCheckStatus = 'waiting' | 'verified' | 'unverified'

export interface FrameCheck {
    status: FrameCheckStatus
    /** Degrees between the smoothed measured g and scene-world up. Null while
     *  waiting — an angle nobody can stand behind is not reported as a number. */
    angleDeg: number | null
}

export const INITIAL_FRAME_CHECK: FrameCheck = { status: 'waiting', angleDeg: null }

/**
 * How far the smoothed g may sit from scene-world up before the scene stops
 * claiming its ground plane means anything.
 *
 * 20° is chosen to separate two very different failures. A wrong sensor-world →
 * scene-world mapping is off by 90° or 180°, never by 15°; the residuals that
 * are expected — an uncalibrated accelerometer (3 % on the bench, 2026-08-28),
 * a low-byte bit-7 corruption worth 0.13 g, and the sway of a person walking
 * with the satellite in their hands — all stay well inside it once smoothed.
 */
export const FRAME_TOLERANCE_DEG = 20

/** One short sentence, in the widget's own voice, saying exactly how much of the
 *  world frame is standing on evidence right now. */
export const frameCheckLabel = (check: FrameCheck): string => {
    if (check.status === 'verified' && check.angleDeg != null) {
        return `world frame verified by measured g (${check.angleDeg.toFixed(0)}° off up)`
    }
    if (check.status === 'unverified' && check.angleDeg != null) {
        return `world frame unverified — measured g is ${check.angleDeg.toFixed(0)}° from up`
    }
    return 'world frame unverified — waiting for a steady g'
}

/**
 * The one fixed camera station, in scene-world coordinates: the oblique
 * three-quarter view the widget opens on, and the only one a button offers.
 *
 * There is exactly one because the corner orientation gizmo already covers the
 * rest. Its axis heads are clickable — that is what `makeDefault` on
 * `OrbitControls` is for — so the head labelled Z looks straight down the world
 * up-axis, and X and Y give the two side-on, on-the-horizon eyes that are the
 * cheapest way to read tilt. It does it better than a button can, too: it swings
 * the camera around the target at the distance the viewer had, where a station is
 * a hard-coded position and throws the zoom away.
 *
 * What the gizmo cannot produce is a view off-axis, so this station stays. It is
 * the only one that shows all three body axes at once, and without it a stray
 * drag has no way back.
 *
 * It is *not* named for a direction on the ground, and there is no "North"
 * button, because with the magnetometer uncalibrated the scene has no north (see
 * `worldFrame.ts`) — such a button would be the same invented compass this
 * widget exists to stop drawing.
 */
export const RESET_VIEWPOINT: readonly [number, number, number] = [1.9, 1.25, 2.4]

/** A *request* for that station, not the camera's state. `seq` increments on
 *  every press so that asking again still moves the camera back after the viewer
 *  has dragged away from it — the same value would be no state change at all. */
export interface ViewpointRequest {
    seq: number
}

export const DEFAULT_VIEWPOINT: ViewpointRequest = { seq: 0 }

// ── heading ─────────────────────────────────────────────────────────────────

/**
 * `CALIB_STAT` mag at which the BNO055's fused heading becomes a measurement.
 *
 * Below it the chip reports a *constant* — typically 0.00 — which is why
 * `hal/rpi/bno055.py` returns `yaw=None` and why the ADCS widget words the gap
 * as "withheld — magnetometer" rather than dashing it out. Anything in this
 * widget that points at north is gated on this number.
 */
export const MAG_CALIBRATED = 3

/**
 * Whether the scene knows where north is, and on what evidence.
 *
 * The four states are not degrees of confidence, they are different facts:
 * `withheld` means the satellite is not publishing a heading at all;
 * `estimating` means it is, but too briefly to have reconciled it with the
 * quaternion; `fixed` means the two agree; `inconsistent` means they do not,
 * which is a finding about the frame rather than a reason to pick one.
 *
 * Only `fixed` may put letters on the compass ring. The other three draw the
 * same plain grey circle, because "we are still working it out" and "these two
 * sources contradict each other" both amount to *not knowing where north is*,
 * and a ring lettered on either would be a compass pointing at a guess.
 */
export type HeadingStatus = 'withheld' | 'estimating' | 'fixed' | 'inconsistent'

export interface HeadingFix {
    status: HeadingStatus
    /**
     * Where magnetic north lies in the scene, as an angle in degrees about
     * scene-world up (+Y), measured from scene +X and increasing the way a
     * right-handed rotation about +Y does. Null unless `status` is `fixed` —
     * an angle nobody can stand behind is not reported as a number.
     */
    northAngleDeg: number | null
    /** Circular standard deviation of the reconciliation, in degrees: how far
     *  apart the published yaw and the quaternion's own azimuth have been over
     *  the recent past. Null until there is enough of a sample to say. */
    spreadDeg: number | null
}

export const INITIAL_HEADING_FIX: HeadingFix = { status: 'withheld', northAngleDeg: null, spreadDeg: null }

/**
 * How much scatter the reconciliation may carry and still be called a fix.
 *
 * Chosen the way `FRAME_TOLERANCE_DEG` was, to separate two different sizes of
 * failure. The residuals that are *expected* are a few degrees of magnetometer
 * noise plus whatever a sub-second skew between the attitude channel and the
 * ADCS status contributes while the satellite is turning slowly. A wrong sign
 * convention on the published heading, or a heading referenced to a different
 * body axis than the one this file projects, does not produce 15° of scatter —
 * it produces scatter of the order of however far the satellite turned.
 */
export const HEADING_SPREAD_TOLERANCE_DEG = 15

/** One short sentence, in the same voice as {@link frameCheckLabel}, saying how
 *  much of the compass is standing on evidence right now. */
export const headingLabel = (fix: HeadingFix): string => {
    if (fix.status === 'fixed' && fix.spreadDeg != null) {
        return `north from yaw and quaternion, agreeing to ${fix.spreadDeg.toFixed(0)}°`
    }
    if (fix.status === 'inconsistent' && fix.spreadDeg != null) {
        return `north withheld — yaw and quaternion disagree by ${fix.spreadDeg.toFixed(0)}°`
    }
    if (fix.status === 'estimating') {
        return 'north not yet fixed — reconciling yaw against the quaternion'
    }
    return 'heading uncalibrated — no north until the magnetometer reads 3/3'
}

// ── what the canvas is withholding, in one string ───────────────────────────

/**
 * The two verdicts composed into the canvas wrapper's `title`, or nothing.
 *
 * The scene says both of these things in pictures — an unconfirmed frame dims
 * the horizon, a heading nobody can stand behind leaves the compass ring
 * unlettered — and a picture cannot say *why*. That is the gap this fills: it
 * is the same rule as the yaw box reading "withheld" rather than "—", carried
 * over to the two verdicts the scene draws rather than prints.
 *
 * Nothing is returned when the frame is verified *and* north is fixed, because
 * then nothing is being withheld and there is nothing to explain — a tooltip
 * that followed the pointer around a canvas to report that all is well would be
 * noise, and noise is what makes the ones that matter get ignored.
 *
 * When either half *is* withholding, both sentences are given. Half an
 * explanation invites the reader to assume the other half, which is the
 * assuming this widget exists to stop.
 */
export const sceneNotes = (check: FrameCheck, fix: HeadingFix): string | undefined => {
    if (check.status === 'verified' && fix.status === 'fixed') {
        return undefined
    }
    return `${frameCheckLabel(check)}\n${headingLabel(fix)}`
}

/** The four cardinal points, as bearings. Bearings are clockwise from north
 *  seen from above, which is the convention the published `yaw` is in. */
const CARDINALS: ReadonlyArray<{ label: string; bearing: number }> = [
    { label: 'N', bearing: 0 },
    { label: 'E', bearing: 90 },
    { label: 'S', bearing: 180 },
    { label: 'W', bearing: 270 }
]

export interface CompassPoint {
    label: string
    /** Degrees clockwise from magnetic north. */
    bearing: number
    /** Where to draw it: an angle about scene-world up, in radians, in the same
     *  sense as {@link HeadingFix.northAngleDeg}. */
    angleRad: number
}

/**
 * Where the letters go — or, on any status but `fixed`, that there are none.
 *
 * A pure function, and in this file rather than in the scene, so that the rule
 * "no letters unless the magnetometer is calibrated *and* the two heading
 * sources reconcile" can be tested without a WebGL context and without three.
 *
 * A bearing runs clockwise from north seen from above; a scene angle about +Y
 * runs the other way. Hence the subtraction: bearing *b* sits at north − *b*.
 */
export const compassPoints = (fix: HeadingFix): CompassPoint[] => {
    if (fix.status !== 'fixed' || fix.northAngleDeg == null) {
        return []
    }
    const north = fix.northAngleDeg
    return CARDINALS.map(({ label, bearing }) => ({
        label,
        bearing,
        angleRad: ((north - bearing) * Math.PI) / 180
    }))
}
