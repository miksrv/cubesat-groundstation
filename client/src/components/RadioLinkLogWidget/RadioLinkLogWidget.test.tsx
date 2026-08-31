import { act } from 'react'

import type { RadioEvent } from '../../features/telemetry/types'
import { installFakeSource } from '../../test-source'
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
        installFakeSource()
        render(<RadioLinkLogWidget />)
        expect(screen.getByText(/No radio traffic yet/)).toBeInTheDocument()
    })

    it('renders a received message with its link quality, newest first', () => {
        const fake = installFakeSource()
        render(<RadioLinkLogWidget />)
        act(() => {
            fake.emitRadio(rx())
            fake.emitRadio(rx({ text: '!sys', timestamp: 1741863610 }))
        })
        const cells = screen.getAllByText(/^!(pos|sys)$/)
        expect(cells[0]).toHaveTextContent('!sys')
        expect(screen.getAllByText('-96 dBm')).toHaveLength(2)
        expect(screen.getAllByText('6.3 dB')).toHaveLength(2)
        expect(screen.getAllByText('!e2f1a4c8')).toHaveLength(2)
    })

    it('renders what the node did not report as a dash, never a zero', () => {
        const fake = installFakeSource()
        render(<RadioLinkLogWidget />)
        act(() => {
            fake.emitRadio(rx({ rssi: null, hops: null }))
        })
        // rssi and hops: two dashes for the two withheld link fields.
        expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
        expect(screen.queryByText('0 dBm')).not.toBeInTheDocument()
    })

    it('marks a transmission that never left, and keeps it on the record', () => {
        const fake = installFakeSource()
        render(<RadioLinkLogWidget />)
        act(() => {
            fake.emitRadio(
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
            )
        })
        expect(screen.getByText('▲ TX')).toBeInTheDocument()
        expect(screen.getByText('beacon')).toBeInTheDocument()
        expect(screen.getByTitle(/transmission failed/)).toBeInTheDocument()
    })
})
