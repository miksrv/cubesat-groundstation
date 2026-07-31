import { useSendCommandMutation } from '../../features/telemetry/telemetryAPI'
import { mockTelemetryRecord } from '../../test-fixtures'
import { fireEvent, render, screen } from '../../test-utils'

import MissionConsoleWidget from './MissionConsoleWidget'

import '@testing-library/jest-dom'

jest.mock('../../features/telemetry/telemetryAPI', () => ({
    useSendCommandMutation: jest.fn(),
    telemetryApi: {
        reducerPath: 'telemetryApi',
        reducer: (state = {}) => state,
        middleware: () => (next: (action: unknown) => unknown) => (action: unknown) => next(action)
    }
}))

const mockUseSendCommandMutation = useSendCommandMutation as jest.Mock

const runCommand = (command: string) => {
    const input = screen.getByPlaceholderText('Type a command…')
    fireEvent.change(input, { target: { value: command } })
    const form = input.closest('form')
    if (form) {
        fireEvent.submit(form)
    }
}

describe('MissionConsoleWidget', () => {
    beforeEach(() => {
        mockUseSendCommandMutation.mockReturnValue([jest.fn(), { isLoading: false }])
    })

    it('shows the welcome banner', () => {
        render(<MissionConsoleWidget latest={mockTelemetryRecord} />)
        expect(screen.getByText('CubeSat Mission Console v1.0')).toBeInTheDocument()
    })

    it('prints satellite status on the "status" command', async () => {
        render(<MissionConsoleWidget latest={mockTelemetryRecord} />)
        runCommand('status')
        expect(await screen.findByText('Satellite Status:')).toBeInTheDocument()
    })

    it('clears the console on the "clear" command', () => {
        render(<MissionConsoleWidget latest={mockTelemetryRecord} />)
        runCommand('clear')
        expect(screen.queryByText('CubeSat Mission Console v1.0')).not.toBeInTheDocument()
    })

    it('prints an unknown-command message for unrecognized input', async () => {
        render(<MissionConsoleWidget latest={mockTelemetryRecord} />)
        runCommand('launch missiles')
        expect(await screen.findByText(/Unknown command: "launch missiles"/)).toBeInTheDocument()
    })
})
