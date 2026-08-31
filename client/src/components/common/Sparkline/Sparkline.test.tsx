import { render, screen } from '../../../test-utils'

import Sparkline from './Sparkline'

import '@testing-library/jest-dom'

const pathOf = (): string => screen.getByTestId('sparkline-line').getAttribute('d') ?? ''

describe('Sparkline', () => {
    it('draws one line through a series', () => {
        render(
            <Sparkline
                values={[4.2, 4.15, 4.1]}
                color='#3b82f6'
            />
        )
        const d = pathOf()
        expect(d.match(/M/g)).toHaveLength(1)
        expect(d.match(/L/g)).toHaveLength(2)
    })

    it('renders a withheld reading as a gap, never a plunge', () => {
        // The same rule the full-size charts follow: a null is a value the
        // satellite refused to invent, and a line through it would invent one.
        render(
            <Sparkline
                values={[4.2, 4.15, null, 4.1, 4.05]}
                color='#3b82f6'
            />
        )
        expect(pathOf().match(/M/g)).toHaveLength(2)
    })

    it('draws nothing from fewer than two readings', () => {
        render(
            <Sparkline
                values={[4.2]}
                color='#3b82f6'
            />
        )
        expect(screen.queryByTestId('sparkline')).not.toBeInTheDocument()
    })

    it('washes the area under each segment separately, so a gap stays a gap', () => {
        render(
            <Sparkline
                values={[4.2, 4.15, null, 4.1, 4.05]}
                color='#3b82f6'
            />
        )
        const area = screen.getByTestId('sparkline').querySelector('path')?.getAttribute('d') ?? ''
        // Two closed polygons, one per run — a wash bridging the gap would
        // paint history under a reading the satellite withheld.
        expect(area.match(/Z/g)).toHaveLength(2)
    })

    it('draws a flat series as a level line rather than dividing by zero', () => {
        render(
            <Sparkline
                values={[5, 5, 5]}
                color='#3b82f6'
            />
        )
        expect(pathOf()).toContain('M0.00,14.00')
    })
})
