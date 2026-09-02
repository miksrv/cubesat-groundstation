import type { AdcsStatus } from '../../features/telemetry/types'
import { mockAdcs } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import AttitudeIndicator from './AttitudeIndicator'

import '@testing-library/jest-dom'

const uncalibrated: Partial<AdcsStatus> = {
    yaw: null,
    calibStatus: { sys: 2, gyro: 3, accel: 3, mag: 1 }
}

/* The instrument prints nothing — roll, pitch and the heading are spelled out in
   the panel below the canvas, and a second copy over the satellite said nothing
   new. So what is asserted here is the picture and the `aria-label`, which is
   now the only reading of it that is not pixels. */
describe('AttitudeIndicator', () => {
    it('reads roll and pitch off the satellite rather than off the camera', () => {
        const { container } = render(<AttitudeIndicator adcs={{ ...mockAdcs, roll: 12.4, pitch: -6.6 }} />)

        expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Attitude: roll 12 degrees, pitch -7 degrees')
        // The clipped group is the horizon: present exactly when there is an
        // attitude to draw one from.
        expect(container.querySelector('[clip-path]')).toBeInTheDocument()
    })

    it('draws a dial and no words', () => {
        const { container } = render(<AttitudeIndicator adcs={{ ...mockAdcs, roll: 12.4, pitch: -6.6, yaw: 178.9 }} />)

        expect(container.querySelector('svg')).toBeInTheDocument()
        // Not "R 12° P -7°", not "HDG 179°", not a caption about the
        // magnetometer: the overlay is a picture over the scene.
        expect(container.textContent).toBe('')
    })

    it('draws no horizon at all when either half of the attitude is withheld', () => {
        // Half an attitude drawn as a whole one reads as a satellite flying
        // level, which is a claim the satellite did not make. With no words
        // left, the empty dial is the whole of what the instrument says — and
        // the label is what says why.
        const { container } = render(<AttitudeIndicator adcs={{ ...mockAdcs, pitch: null }} />)

        expect(container.querySelector('[clip-path]')).not.toBeInTheDocument()
        expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Attitude withheld')
    })

    it('says nothing at all rather than something confident with no ADCS', () => {
        const { container } = render(<AttitudeIndicator adcs={null} />)

        expect(container.querySelector('[clip-path]')).not.toBeInTheDocument()
        expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Attitude withheld')
    })

    it('shows no horizon for an uncalibrated satellite either, if its attitude is withheld', () => {
        // An uncalibrated magnetometer is not an uncalibrated accelerometer:
        // roll and pitch survive it, so the dial still draws. What used to be
        // withheld in words here — the heading — is withheld in the YAW tile
        // under the canvas instead.
        const { container } = render(<AttitudeIndicator adcs={{ ...mockAdcs, ...uncalibrated }} />)

        expect(container.querySelector('[clip-path]')).toBeInTheDocument()
        expect(container.textContent).toBe('')
    })
})
