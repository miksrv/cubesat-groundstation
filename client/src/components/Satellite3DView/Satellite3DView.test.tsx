import type React from 'react'
import * as THREE from 'three'

import type { AttitudeUpdate } from '../../features/telemetry/source'
import type { AdcsStatus } from '../../features/telemetry/types'
import { mockAdcs } from '../../test-fixtures'
import { FakeSource, installFakeSource } from '../../test-source'
import { act, fireEvent, render, screen } from '../../test-utils'

import { CAMERA_FACE_ROTATION } from './CubeSatModel'
import Satellite3DView from './Satellite3DView'

import '@testing-library/jest-dom'

/** Level: the sensor's world frame is the one in which this is identity. */
const LEVEL: AttitudeUpdate = { t: 1, w: 1, x: 0, y: 0, z: 0 }

/** A quarter turn about the sensor world's up axis, counter-clockwise seen from
 *  above — the satellite carried round a corner. */
const TURNED: AttitudeUpdate = { t: 1, w: Math.SQRT1_2, x: 0, y: 0, z: Math.SQRT1_2 }

describe('Satellite3DView', () => {
    // The view subscribes to the attitude channel, so it needs a source. The
    // fake is the whole point of the interface: no broker, no server.
    let fake: FakeSource

    beforeEach(() => {
        fake = installFakeSource()
    })

    it('renders the 3D satellite view panel title', () => {
        render(
            <Satellite3DView
                adcs={mockAdcs}
                isLoading={false}
            />
        )
        expect(screen.getByText('3D Satellite View')).toBeInTheDocument()
    })

    it('shows skeleton when isLoading=true and latest is null', () => {
        const { container } = render(
            <Satellite3DView
                adcs={null}
                isLoading={true}
            />
        )
        const skeleton = container.querySelector('[data-testid="skeleton"]')
        expect(skeleton).toBeInTheDocument()
    })

    it('displays roll, pitch, and yaw values', () => {
        render(
            <Satellite3DView
                adcs={{ ...mockAdcs, roll: 15.3, pitch: -8.7, yaw: 120.5 }}
                isLoading={false}
            />
        )

        expect(screen.getByText('Roll (X)')).toBeInTheDocument()
        expect(screen.getByText('15.3°')).toBeInTheDocument()
        expect(screen.getByText('Pitch (Y)')).toBeInTheDocument()
        expect(screen.getByText('-8.7°')).toBeInTheDocument()
        expect(screen.getByText('Yaw (Z)')).toBeInTheDocument()
        expect(screen.getByText('120.5°')).toBeInTheDocument()
    })

    it('displays dash when values are null', () => {
        render(
            <Satellite3DView
                adcs={{ ...mockAdcs, roll: null, pitch: null, yaw: null }}
                isLoading={false}
            />
        )

        // Roll and pitch dash out; yaw says *why* it is missing, because below
        // magnetometer calibration 3 the BNO055 reports a constant and the
        // satellite withholds it rather than publish confident nonsense.
        expect(screen.getAllByText('—°')).toHaveLength(2)
        expect(screen.getByText('withheld')).toBeInTheDocument()
    })

    it('offers the three canvas overlays as switches, all on to begin with', async () => {
        render(
            <Satellite3DView
                adcs={mockAdcs}
                isLoading={false}
            />
        )
        await screen.findByTestId('r3f-canvas')

        // What stood here was a colour key for the body triad — three lines
        // naming axes the corner gizmo already labels, plus one for the
        // accelerometer arrow. The scene draws all four; the words were
        // furniture, and the switches are not.
        expect(screen.queryByText('X — camera looks −X')).not.toBeInTheDocument()
        expect(screen.queryByText('Measured g — up at rest')).not.toBeInTheDocument()

        expect(screen.getByRole('switch', { name: 'Artificial horizon' })).toBeChecked()
        expect(screen.getByRole('switch', { name: 'Orientation gizmo' })).toBeChecked()
        expect(screen.getByRole('switch', { name: 'Ground reference' })).toBeChecked()
    })

    it('takes the artificial horizon off the canvas without touching the numbers', async () => {
        render(
            <Satellite3DView
                adcs={{ ...mockAdcs, roll: 15.3, pitch: -8.7 }}
                isLoading={false}
            />
        )
        await screen.findByTestId('r3f-canvas')

        expect(screen.getByRole('img', { name: /attitude/i })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('switch', { name: 'Artificial horizon' }))

        expect(screen.queryByRole('img', { name: /attitude/i })).not.toBeInTheDocument()
        // The switch hides an annotation, never a measurement: roll and pitch
        // are printed under the canvas either way.
        expect(screen.getByText('15.3°')).toBeInTheDocument()
        expect(screen.getByText('-8.7°')).toBeInTheDocument()
    })

    it('displays angular rate readout from gyro data', () => {
        render(
            <Satellite3DView
                adcs={{ ...mockAdcs, gyro: { x: 0.1, y: -0.2, z: 0.05 } }}
                isLoading={false}
            />
        )

        expect(screen.getByText(/0\.10°\/s/)).toBeInTheDocument()
        expect(screen.getByText(/-0\.20°\/s/)).toBeInTheDocument()
        expect(screen.getByText(/0\.05°\/s/)).toBeInTheDocument()
    })

    it('renders the (mocked) 3D canvas once the lazy scene resolves', async () => {
        render(
            <Satellite3DView
                adcs={mockAdcs}
                isLoading={false}
            />
        )

        expect(await screen.findByTestId('r3f-canvas')).toBeInTheDocument()
    })

    it('does not show skeleton when data is available even if loading', () => {
        const { container } = render(
            <Satellite3DView
                adcs={mockAdcs}
                isLoading={true}
            />
        )

        const skeleton = container.querySelector('[data-testid="skeleton"]')
        expect(skeleton).not.toBeInTheDocument()
    })

    describe('the world frame check', () => {
        // The audit smooths over three seconds of accelerometer, so the clock is
        // driven rather than waited on. Nothing else here needs fake timers.
        beforeEach(() => {
            jest.useFakeTimers()
        })

        afterEach(() => {
            jest.useRealTimers()
        })

        const settle = (): void => {
            act(() => {
                jest.advanceTimersByTime(6000)
            })
        }

        it('claims nothing before the accelerometer has been heard from', async () => {
            render(
                <Satellite3DView
                    adcs={mockAdcs}
                    isLoading={false}
                />
            )
            await screen.findByTestId('r3f-canvas')

            // No attitude sample has arrived, so the rotation into world
            // coordinates cannot be done at all — and the panel says so instead
            // of drawing a horizon it has not earned.
            settle()
            // Not printed under the canvas any more — the horizon simply does
            // not brighten. The reason for that is on the wrapper, where it can
            // be asked for without becoming furniture.
            expect(screen.getByTitle(/world frame unverified — waiting for a steady g/)).toBeInTheDocument()
        })

        it('says the frame is verified once a level satellite reads g along its own +Z', async () => {
            render(
                <Satellite3DView
                    adcs={mockAdcs}
                    isLoading={false}
                />
            )
            await screen.findByTestId('r3f-canvas')

            act(() => {
                fake.emitAttitude(LEVEL)
            })
            settle()

            expect(screen.getByTitle(/world frame verified by measured g/)).toBeInTheDocument()
        })

        it('withdraws the horizon instead of correcting it when g disagrees', async () => {
            // The same one g, but along the body +X axis: what a level satellite
            // would look like if the sensor-world mapping were a quarter turn
            // wrong. Nothing throws, nothing is silently rotated — the panel
            // stops claiming its ground plane means anything.
            render(
                <Satellite3DView
                    adcs={{ ...mockAdcs, accel: { x: 0.99, y: 0.02, z: 0.01 } }}
                    isLoading={false}
                />
            )
            await screen.findByTestId('r3f-canvas')

            act(() => {
                fake.emitAttitude(LEVEL)
            })
            settle()

            expect(screen.getByTitle(/world frame unverified — measured g is \d+° from up/)).toBeInTheDocument()
        })

        it('withholds a verdict while the satellite is being accelerated', async () => {
            render(
                <Satellite3DView
                    adcs={{ ...mockAdcs, accel: { x: 0, y: 0, z: 2.4 } }}
                    isLoading={false}
                />
            )
            await screen.findByTestId('r3f-canvas')

            act(() => {
                fake.emitAttitude(LEVEL)
            })
            settle()

            expect(screen.getByTitle(/world frame unverified — waiting for a steady g/)).toBeInTheDocument()
        })
    })

    describe('the compass', () => {
        // The reconciliation runs on an interval and needs a run of pairs, so
        // the clock is driven rather than waited on.
        beforeEach(() => {
            jest.useFakeTimers()
        })

        afterEach(() => {
            jest.useRealTimers()
        })

        /** A calibrated magnetometer publishing a heading, a still satellite,
         *  and — as the live source does — an attitude sample stamped with the
         *  very same timestamp as the status it left with. */
        const publish = (
            rerender: (ui: React.ReactElement) => void,
            steps: Array<{ sample: AttitudeUpdate; adcs: Partial<AdcsStatus> }>,
            count = 14
        ): void => {
            for (let index = 0; index < count; index += 1) {
                const step = steps[index % steps.length]
                const t = 1000 + index * 0.5
                act(() => {
                    fake.emitAttitude({ ...step.sample, t })
                })
                rerender(
                    <Satellite3DView
                        adcs={{ ...mockAdcs, gyro: { x: 0, y: 0, z: 0 }, ...step.adcs, timestamp: t }}
                        isLoading={false}
                    />
                )
                act(() => {
                    jest.advanceTimersByTime(300)
                })
            }
        }

        it('draws no letters and prints no heading while the magnetometer is uncalibrated', async () => {
            const uncalibrated = {
                ...mockAdcs,
                yaw: null,
                calibStatus: { sys: 2, gyro: 3, accel: 3, mag: 1 }
            }
            const { rerender } = render(
                <Satellite3DView
                    adcs={uncalibrated}
                    isLoading={false}
                />
            )
            await screen.findByTestId('r3f-canvas')

            publish(rerender, [{ sample: LEVEL, adcs: uncalibrated }])

            // The ring is still drawn — it is the horizon plane through the
            // body — but it carries nothing that claims a direction.
            expect(screen.queryByText('N')).not.toBeInTheDocument()
            expect(screen.queryByText('E')).not.toBeInTheDocument()
            expect(screen.queryByText('S')).not.toBeInTheDocument()
            expect(screen.queryByText('W')).not.toBeInTheDocument()

            // And no heading number anywhere in the widget: the yaw box and the
            // canvas say why instead. The attitude indicator used to be a third
            // voice on this; it prints nothing now, so the words are the yaw
            // box's and the canvas caption's alone.
            expect(screen.queryByText(/HDG/)).not.toBeInTheDocument()
            expect(screen.queryByText(/178\.9/)).not.toBeInTheDocument()
            expect(screen.getByText('withheld')).toBeInTheDocument()
            // An unlettered ring on its own would read as a broken compass. The
            // canvas carries the reason, on the same rule that makes the yaw box
            // say "withheld" rather than dash out.
            expect(
                screen.getByTitle(/heading uncalibrated — no north until the magnetometer reads 3\/3/)
            ).toBeInTheDocument()
        })

        it('letters the ring once the published yaw and the quaternion reconcile', async () => {
            const { container, rerender } = render(
                <Satellite3DView
                    adcs={mockAdcs}
                    isLoading={false}
                />
            )
            await screen.findByTestId('r3f-canvas')

            // Level, then a quarter turn counter-clockwise seen from above,
            // whose compass bearing therefore *falls* by 90.
            publish(rerender, [
                { sample: LEVEL, adcs: { yaw: 30 } },
                { sample: TURNED, adcs: { yaw: 300 } }
            ])

            expect(screen.getByText('N')).toBeInTheDocument()
            expect(screen.getByText('E')).toBeInTheDocument()
            expect(screen.getByText('S')).toBeInTheDocument()
            expect(screen.getByText('W')).toBeInTheDocument()
            // Nothing is being withheld now — a lettered ring over an
            // undimmed horizon is the whole message — so the canvas carries no
            // tooltip at all. A widget that explained itself when there was
            // nothing to explain would train the viewer to ignore it. Asked of
            // the canvas rather than of the panel: the overlay switches below it
            // carry hints of their own, which say what a control does and not
            // what the satellite is withholding.
            expect(container.querySelector('.canvasWrapper')).not.toHaveAttribute('title')
        })

        it('takes the ground reference away on request without changing what is withheld', async () => {
            const { container, rerender } = render(
                <Satellite3DView
                    adcs={mockAdcs}
                    isLoading={false}
                />
            )
            await screen.findByTestId('r3f-canvas')

            publish(rerender, [
                { sample: LEVEL, adcs: { yaw: 30 } },
                { sample: TURNED, adcs: { yaw: 300 } }
            ])
            expect(screen.getByText('N')).toBeInTheDocument()

            fireEvent.click(screen.getByRole('switch', { name: 'Ground reference' }))

            // The disc, its grid, its horizon rim and the letters on it go
            // together — they are one reference, and half of it is a floor with
            // no edge.
            expect(screen.queryByText('N')).not.toBeInTheDocument()
            expect(screen.queryByText('W')).not.toBeInTheDocument()
            // Nothing was withheld before the switch and nothing is after it:
            // the rim is where the two verdicts are *drawn*, and the words for
            // them live on the wrapper, which still has none to say.
            expect(container.querySelector('.canvasWrapper')).not.toHaveAttribute('title')
        })

        it('takes the letters away again when the two sources stop agreeing', async () => {
            const { rerender } = render(
                <Satellite3DView
                    adcs={mockAdcs}
                    isLoading={false}
                />
            )
            await screen.findByTestId('r3f-canvas')

            // The same quarter turn with the bearing *rising*: a heading that
            // ran the other way round would look like this, and there is no
            // honest average of the two estimates it produces.
            publish(rerender, [
                { sample: LEVEL, adcs: { yaw: 30 } },
                { sample: TURNED, adcs: { yaw: 120 } }
            ])

            expect(screen.queryByText('N')).not.toBeInTheDocument()
            expect(screen.getByTitle(/north withheld — yaw and quaternion disagree by \d+°/)).toBeInTheDocument()
        })
    })

    describe('the camera controls', () => {
        it('offers no camera buttons — the gizmo already covers the stations', () => {
            render(
                <Satellite3DView
                    adcs={mockAdcs}
                    isLoading={false}
                />
            )

            // The header used to carry a Reset button; the axis-aligned
            // stations belong to the orientation gizmo, whose heads keep the
            // viewer's distance to the target where a button snapped to a
            // hard-coded position and threw the zoom away.
            expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'Level' })).not.toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'Top' })).not.toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'Side' })).not.toBeInTheDocument()
            // No compass: heading is withheld until the magnetometer is
            // calibrated, so no control may imply the scene knows where north is.
            expect(screen.queryByRole('button', { name: /north/i })).not.toBeInTheDocument()
        })
    })
})

/**
 * The one silent failure mode of a decal: it can be laid on the right face and
 * still be a quarter turn wrong about that face's normal, and nothing but the
 * lettering will say so. It did say so — "CAM" read bottom-to-top, and because
 * it is the only marking on an otherwise blank white cube, the satellite read
 * as lying on its right side while every other part of the scene agreed it was
 * level. Asserted here rather than left to the eye, because the eye is what
 * missed it.
 */
describe('the camera-face decal', () => {
    /** Where a rotation carries one of the decal's own axes, to the nearest
     *  whole component. `+ 0` folds away the −0 that `round()` leaves behind:
     *  `toStrictEqual` tells the two zeroes apart and a reader would not. */
    const image = (axis: THREE.Vector3): number[] =>
        axis
            .clone()
            .applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...CAMERA_FACE_ROTATION)))
            .round()
            .toArray()
            .map((component) => component + 0)

    it('faces out of the −X face, the one the hardware puts a lens on', () => {
        // A plane geometry's own normal is +Z.
        expect(image(new THREE.Vector3(0, 0, 1))).toStrictEqual([-1, 0, 0])
    })

    it('stands its up on +Z, the top of the frame, not on +Y, one of its edges', () => {
        expect(image(new THREE.Vector3(0, 1, 0))).toStrictEqual([0, 0, 1])
    })

    it('reads left-to-right for someone looking into the lens', () => {
        // That viewer looks along body +X with +Z up, so their right hand is
        // body −Y — and the text's own +X has to land there or the lettering
        // comes out mirrored.
        expect(image(new THREE.Vector3(1, 0, 0))).toStrictEqual([0, -1, 0])
    })
})
