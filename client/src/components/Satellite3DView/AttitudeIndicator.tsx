import React, { useId } from 'react'

import type { AdcsStatus } from '../../features/telemetry/types'

import styles from './AttitudeIndicator.module.scss'

/**
 * A small artificial horizon over the WebGL surface — plain SVG, not a scene
 * object.
 *
 * It exists so that roll and pitch can be read without orbiting the camera. The
 * 3D view answers "which way is the satellite facing"; this answers "how far
 * over is it", which is the question a viewer who has not touched the mouse
 * actually has. Being DOM, it also survives a lost WebGL context.
 *
 * **It is a picture and nothing else.** It used to print roll, pitch and the
 * heading under the dial as well. Those three are already spelled out in the
 * panel immediately below the canvas — withheld states included, in the same
 * words — so the second copy said nothing new while covering more of the
 * satellite than it was worth. What is left is the dial.
 *
 * **Nothing here rests at zero.** Roll and pitch are `number | null` on the
 * wire and a null is withheld, never level. The horizon is drawn only when both
 * are present, because the two are one picture: a horizon line rotated by a
 * real roll and offset by an assumed pitch reads as a satellite flying level,
 * which is a claim the satellite did not make. With either missing the dial goes
 * empty — which is the whole of what an instrument with no words can say — and
 * the `aria-label` says why for anyone not reading the picture.
 */

/** The instrument's own coordinate system. Small on purpose — this widget is
 *  the narrowest column of the top row, about 290 px of canvas, and an overlay
 *  that took a third of it would be covering the thing it annotates. */
const SIZE = 84
const CENTRE = SIZE / 2
const RADIUS = 34

/**
 * Pixels of horizon travel per degree of pitch.
 *
 * At 0.6 the whole ±34 px of the dial covers about 57° of pitch, so the ladder
 * moves visibly for the few degrees of tilt a hand-carried satellite spends
 * most of its time in, and saturates rather than misleading beyond that. The
 * horizon is clipped to the dial, so saturation looks like all-sky or
 * all-ground, which is what it is.
 */
const PIXELS_PER_DEGREE = 0.6

/** Whole degrees for the `aria-label`, and never "-0": `toFixed(0)` keeps the
 *  sign of a value a hair below zero, and a satellite reported as at "-0°"
 *  reads as a rounding bug rather than as level. */
const whole = (value: number): string => `${Math.round(value)}`

const SKY = '#2b4a63'
const GROUND = '#5a4326'
const HORIZON = '#dfe6ec'
const MARK = '#f2b134'

interface Props {
    adcs: AdcsStatus | null
}

const AttitudeIndicator: React.FC<Props> = ({ adcs }) => {
    // One instrument per page today, but an SVG clip path is addressed by a
    // document-wide id, so a second one would quietly clip against the first.
    // React's own ids carry punctuation that has no business in a URL fragment.
    const clipId = `attitude-dial${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
    const roll = adcs?.roll ?? null
    const pitch = adcs?.pitch ?? null

    // Both, or neither. See the docstring: half of an attitude drawn as a whole
    // one is the confident wrong number this project keeps refusing to draw.
    const attitude = roll != null && pitch != null ? { roll, pitch } : null

    return (
        <div
            className={styles.indicator}
            // Not aria-hidden: it is the only graphical read of roll and pitch,
            // and the numbers under the canvas are rounded differently.
            role='img'
            aria-label={
                attitude
                    ? `Attitude: roll ${whole(attitude.roll)} degrees, pitch ${whole(attitude.pitch)} degrees`
                    : 'Attitude withheld'
            }
        >
            <svg
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
            >
                <defs>
                    <clipPath id={clipId}>
                        <circle
                            cx={CENTRE}
                            cy={CENTRE}
                            r={RADIUS}
                        />
                    </clipPath>
                </defs>

                {attitude ? (
                    <g clipPath={`url(#${clipId})`}>
                        {/*
                            Rotate by −roll: a satellite rolled right-side-down
                            positive (the driver's convention, bench-verified
                            2026-08-28) tips the *world* the other way, which is
                            what an artificial horizon shows. Translate by
                            +pitch: nose up drops the horizon.
                        */}
                        <g
                            transform={`rotate(${-attitude.roll} ${CENTRE} ${CENTRE}) translate(0 ${
                                attitude.pitch * PIXELS_PER_DEGREE
                            })`}
                        >
                            <rect
                                x={-SIZE}
                                y={-SIZE}
                                width={SIZE * 3}
                                height={SIZE + CENTRE}
                                fill={SKY}
                            />
                            <rect
                                x={-SIZE}
                                y={CENTRE}
                                width={SIZE * 3}
                                height={SIZE * 2}
                                fill={GROUND}
                            />
                            <line
                                x1={-SIZE}
                                y1={CENTRE}
                                x2={SIZE * 2}
                                y2={CENTRE}
                                stroke={HORIZON}
                                strokeWidth={1}
                            />
                            {/* A short ladder, so pitch reads as a quantity and
                                not only as a direction. ±10° and ±20°. */}
                            {[-20, -10, 10, 20].map((step) => (
                                <line
                                    key={step}
                                    x1={CENTRE - (Math.abs(step) === 10 ? 8 : 5)}
                                    y1={CENTRE - step * PIXELS_PER_DEGREE}
                                    x2={CENTRE + (Math.abs(step) === 10 ? 8 : 5)}
                                    y2={CENTRE - step * PIXELS_PER_DEGREE}
                                    stroke={HORIZON}
                                    strokeOpacity={0.55}
                                    strokeWidth={0.8}
                                />
                            ))}
                        </g>
                    </g>
                ) : (
                    <circle
                        cx={CENTRE}
                        cy={CENTRE}
                        r={RADIUS}
                        fill='rgba(255, 255, 255, 0.03)'
                    />
                )}

                <circle
                    cx={CENTRE}
                    cy={CENTRE}
                    r={RADIUS}
                    fill='none'
                    stroke='rgba(255, 255, 255, 0.35)'
                    strokeWidth={1}
                />

                {/* The fixed reference: the satellite itself, which does not
                    move in this instrument. Drawn whether or not there is an
                    attitude — it is the frame of reference, not a reading. */}
                <g
                    stroke={MARK}
                    strokeWidth={1.6}
                    strokeLinecap='round'
                >
                    <line
                        x1={CENTRE - 15}
                        y1={CENTRE}
                        x2={CENTRE - 5}
                        y2={CENTRE}
                    />
                    <line
                        x1={CENTRE + 5}
                        y1={CENTRE}
                        x2={CENTRE + 15}
                        y2={CENTRE}
                    />
                    <line
                        x1={CENTRE}
                        y1={CENTRE - 2}
                        x2={CENTRE}
                        y2={CENTRE + 2}
                    />
                </g>
            </svg>
        </div>
    )
}

export default AttitudeIndicator
