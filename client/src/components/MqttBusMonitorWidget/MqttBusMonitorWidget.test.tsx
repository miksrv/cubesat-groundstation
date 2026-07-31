import { render, screen } from '../../test-utils'

import MqttBusMonitorWidget from './MqttBusMonitorWidget'

import '@testing-library/jest-dom'

describe('MqttBusMonitorWidget', () => {
    it('renders the OBC hub and all leaf node labels', () => {
        render(<MqttBusMonitorWidget />)
        expect(screen.getByText('OBC')).toBeInTheDocument()
        expect(screen.getByText('EPS')).toBeInTheDocument()
        expect(screen.getByText('PAYLOAD')).toBeInTheDocument()
        expect(screen.getByText('TELEMETRY')).toBeInTheDocument()
        expect(screen.getByText('COMMANDS')).toBeInTheDocument()
    })
})
