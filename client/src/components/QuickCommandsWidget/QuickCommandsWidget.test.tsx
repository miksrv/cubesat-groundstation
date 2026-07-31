import { useSendCommandMutation } from '../../features/telemetry/telemetryAPI'
import { render, screen } from '../../test-utils'

import QuickCommandsWidget from './QuickCommandsWidget'

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

describe('QuickCommandsWidget', () => {
    it('renders all command buttons', () => {
        mockUseSendCommandMutation.mockReturnValue([jest.fn(), { isLoading: false }])
        render(<QuickCommandsWidget />)
        expect(screen.getByText('REFRESH TELEMETRY')).toBeInTheDocument()
        expect(screen.getByText('ENABLE SCIENCE MODE')).toBeInTheDocument()
        expect(screen.getByText('SAFE MODE')).toBeInTheDocument()
    })

    it('dispatches a command and shows the returned message', async () => {
        const unwrap = jest.fn().mockResolvedValue({ status: 'ok', message: 'Science mode enabled', event_id: 1 })
        const sendCommand = jest.fn(() => ({ unwrap }))
        mockUseSendCommandMutation.mockReturnValue([sendCommand, { isLoading: false }])

        render(<QuickCommandsWidget />)
        screen.getByText('ENABLE SCIENCE MODE').click()

        expect(sendCommand).toHaveBeenCalledWith('ENABLE_SCIENCE_MODE')
        expect(await screen.findByText('Science mode enabled')).toBeInTheDocument()
    })
})
