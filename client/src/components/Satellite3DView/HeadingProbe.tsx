import React, { useEffect, useRef } from 'react'

import type { AttitudeUpdate } from '../../features/telemetry/source'
import type { AdcsStatus } from '../../features/telemetry/types'

import type { HeadingFix } from './sceneContract'
import { NorthEstimator } from './worldFrame'

interface Props {
    attitudeRef: React.MutableRefObject<AttitudeUpdate | null>
    adcs: AdcsStatus | null
    /** Called only when the fix changes — never on every tick. */
    onFix: (fix: HeadingFix) => void
}

/**
 * How often the reconciliation runs. The same reasoning as `FrameCheckProbe`:
 * ADCS publishes at 2 Hz, so an animation frame would be fifty-nine copies of
 * one sample a second. The estimator drops repeats by timestamp anyway; ticking
 * off the render loop just means it also keeps working while the scene is idle.
 */
const INTERVAL_MS = 250

/** The north angle is reported in buckets this wide. A compass ring nudged by a
 *  degree between every pair of frames would be a setState per frame for a
 *  rotation nobody can see. */
const ANGLE_BUCKET_DEG = 2

/**
 * Runs {@link NorthEstimator} against the live telemetry and reports the fix
 * upward. Renders nothing: it is arithmetic on telemetry, not a scene object.
 *
 * It lives in the lazily-loaded scene chunk because the estimator pulls in
 * three.js, and the widget that shows the caption is in the main bundle — the
 * same split, and for the same reason, as `FrameCheckProbe`.
 */
const HeadingProbe: React.FC<Props> = ({ attitudeRef, adcs, onFix }) => {
    const estimator = useRef(new NorthEstimator())
    const reported = useRef<string>('')
    // The status arrives as a prop and the interval outlives any one render, so
    // the latest value is held where the tick can reach it.
    const adcsRef = useRef(adcs)
    adcsRef.current = adcs

    useEffect(() => {
        let previous = Date.now()
        const id = setInterval(() => {
            // Measured, not assumed: a backgrounded tab throttles this timer,
            // and the forgetting factor is a function of real elapsed time.
            const now = Date.now()
            const delta = (now - previous) / 1000
            previous = now

            const fix = estimator.current.update(attitudeRef.current, adcsRef.current, delta)
            // The spread is bucketed too, not only the angle: it is the number
            // the caption prints when the two sources disagree, so a fix that
            // is drifting apart has to be able to say so without the ring
            // having moved.
            const bucket = [
                fix.status,
                fix.northAngleDeg == null ? '' : Math.round(fix.northAngleDeg / ANGLE_BUCKET_DEG),
                fix.spreadDeg == null ? '' : Math.round(fix.spreadDeg / ANGLE_BUCKET_DEG)
            ].join(':')
            if (bucket !== reported.current) {
                reported.current = bucket
                onFix(fix)
            }
        }, INTERVAL_MS)

        return () => clearInterval(id)
    }, [attitudeRef, onFix])

    return null
}

export default HeadingProbe
