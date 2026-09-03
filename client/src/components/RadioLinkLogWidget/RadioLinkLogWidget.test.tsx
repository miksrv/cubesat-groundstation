import type { RadioEvent } from '../../features/telemetry/types'
import { render, screen } from '../../test-utils'

import RadioLinkLogWidget from './RadioLinkLogWidget'

import '@testing-library/jest-dom'

const rx = (overrides: Partial<RadioEvent> = {}): RadioEvent => ({
    timestamp: 1741863600,
    direction: 'rx',
    kind: null,
    text: '!pos',
    bytes: 4,
    sender: '!e2f1a4c8',
    snr: 6.25,
    rssi: -96,
    hops: 0,
    sent: null,
    ...overrides
})

describe('RadioLinkLogWidget', () => {
    it('says the log is empty rather than rendering a bare table', () => {
        render(<RadioLinkLogWidget events={[]} />)
        expect(screen.getByText(/No radio traffic yet/)).toBeInTheDocument()
    })

    it('says why it is empty when the caller knows better than the default', () => {
        // A replayed mission recorded before radio_log existed is a different
        // statement from a link that has said nothing yet.
        render(
            <RadioLinkLogWidget
                events={[]}
                emptyMessage='This mission recorded no radio traffic'
            />
        )
        expect(screen.getByText('This mission recorded no radio traffic')).toBeInTheDocument()
    })

    it('renders received messages in the order it was given them', () => {
        // Newest first is the caller's job now: the live log prepends, and a
        // replay hands over the mission's traffic up to the playhead.
        render(<RadioLinkLogWidget events={[rx({ text: '!sys', timestamp: 1741863610 }), rx()]} />)
        const cells = screen.getAllByText(/^!(pos|sys)$/)
        expect(cells[0]).toHaveTextContent('!sys')
        expect(screen.getAllByText('-96 dBm')).toHaveLength(2)
        expect(screen.getAllByText('6.3 dB')).toHaveLength(2)
        expect(screen.getAllByText('!e2f1a4c8')).toHaveLength(2)
    })

    it('renders what the node did not report as a dash, never a zero', () => {
        render(<RadioLinkLogWidget events={[rx({ rssi: null, hops: null })]} />)
        // rssi and hops: two dashes for the two withheld link fields.
        expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
        expect(screen.queryByText('0 dBm')).not.toBeInTheDocument()
    })

    it('colours the clock apart, and the two directions apart from each other', () => {
        // Only the class is checkable here — jsdom loads no stylesheet — but the
        // classes are what the .module.scss hangs the three colours on.
        render(<RadioLinkLogWidget events={[rx(), rx({ direction: 'tx', kind: 'beacon', sent: true })]} />)
        expect(screen.getByText('▼ RX')).toHaveClass('rx')
        expect(screen.getByText('▲ TX')).toHaveClass('tx')
        // The rendered clock is local-time, so match its shape, not a literal.
        expect(screen.getAllByText(/^\d{2}:\d{2}:\d{2}$/)[0]).toHaveClass('time')
    })

    it('renders an ack, and says what it is without implying a beacon', () => {
        // New in DEMO and EXPO on 2026-09-03: those profiles start the beacon
        // off, and until that day they produced no tx rows at all. A reply to
        // a command is now gated on listening instead, so an ack goes out in a
        // profile that beacons nothing — and reading it as "the beacon is on
        // after all" is the wrong conclusion to invite from a three-letter
        // label in a table of numbers.
        render(
            <RadioLinkLogWidget
                events={[rx({ direction: 'tx', kind: 'ack', text: 'CSAT t=1 re=photo ok=1 kb=182 seq=7', sent: true })]}
            />
        )
        expect(screen.getByText('ack')).toBeInTheDocument()
        expect(screen.getByTitle(/whether or not the scheduled beacon is on/)).toBeInTheDocument()
    })

    it('renders a kind this build has not heard of rather than dropping the row', () => {
        render(<RadioLinkLogWidget events={[rx({ direction: 'tx', kind: 'newkind', sent: true })]} />)
        expect(screen.getByText('newkind')).toBeInTheDocument()
    })

    it('marks a transmission that never left, and keeps it on the record', () => {
        render(
            <RadioLinkLogWidget
                events={[
                    rx({
                        direction: 'tx',
                        kind: 'beacon',
                        text: 'CS t=1 st=NOMINAL',
                        sender: null,
                        snr: null,
                        rssi: null,
                        hops: null,
                        sent: false
                    })
                ]}
            />
        )
        expect(screen.getByText('▲ TX')).toBeInTheDocument()
        expect(screen.getByText('beacon')).toBeInTheDocument()
        expect(screen.getByTitle(/transmission failed/)).toBeInTheDocument()
    })
})
