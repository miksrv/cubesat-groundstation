import React, { useEffect, useRef } from 'react'

import type { AttitudeUpdate } from '../../features/telemetry/source'
import type { Vector3 } from '../../features/telemetry/types'

import type { FrameCheck } from './sceneContract'
import { GravityFrameCheck } from './worldFrame'

interface Props {
    attitudeRef: React.MutableRefObject<AttitudeUpdate | null>
    accel: Vector3 | null
    /** Called only when the verdict changes — never on every tick. */
    onCheck: (check: FrameCheck) => void
}

/**
 * How often the audit runs. Not on the animation frame: ADCS publishes at 2 Hz
 * and the smoothing has a three-second time constant, so sixty ticks a second
 * would be fifty-nine copies of the same sample. Off the render loop the check
 * also keeps running while the scene is idle, which is when a satellite sitting
 * still on a bench is easiest to audit.
 */
const INTERVAL_MS = 250

/** The verdict's angle is reported in buckets this wide, so that a value
 *  drifting by a degree does not put a setState between every pair of frames. */
const ANGLE_BUCKET_DEG = 5

/**
 * Runs `GravityFrameCheck` against the live telemetry and reports the verdict
 * upward. Renders nothing: it is an audit, not a scene object.
 *
 * It lives in the lazily-loaded scene chunk because `GravityFrameCheck` pulls in
 * three.js, and the widget that shows the verdict is in the main bundle.
 */
const FrameCheckProbe: React.FC<Props> = ({ attitudeRef, accel, onCheck }) => {
    const check = useRef(new GravityFrameCheck())
    const reported = useRef<string>('')
    // The acceleration arrives as a prop and the interval outlives any one
    // render, so the latest value is held where the tick can reach it.
    const accelRef = useRef(accel)
    accelRef.current = accel

    useEffect(() => {
        let previous = Date.now()
        const id = setInterval(() => {
            // Measured, not assumed: a backgrounded tab throttles this timer,
            // and a smoother told 250 ms had passed when a minute had would
            // average across a hole it never saw.
            const now = Date.now()
            const delta = (now - previous) / 1000
            previous = now

            const verdict = check.current.update(attitudeRef.current, accelRef.current, delta)
            const bucket =
                verdict.angleDeg == null
                    ? verdict.status
                    : `${verdict.status}:${Math.round(verdict.angleDeg / ANGLE_BUCKET_DEG)}`
            if (bucket !== reported.current) {
                reported.current = bucket
                onCheck(verdict)
            }
        }, INTERVAL_MS)

        return () => clearInterval(id)
    }, [attitudeRef, onCheck])

    return null
}

export default FrameCheckProbe
