import React, { useState } from 'react'
import { Container } from 'simple-react-ui-kit'

import { useSendCommandMutation } from '../../features/telemetry/telemetryAPI'
import type { CommandName } from '../../features/telemetry/types'

import styles from './QuickCommandsWidget.module.scss'

const COMMANDS: Array<{ command: CommandName; label: string; destructive?: boolean }> = [
    { command: 'REFRESH_TELEMETRY', label: 'Refresh Telemetry' },
    { command: 'ENABLE_SCIENCE_MODE', label: 'Enable Science Mode' },
    { command: 'DISABLE_SCIENCE_MODE', label: 'Disable Science Mode' },
    { command: 'REBOOT_OBC', label: 'Reboot OBC', destructive: true },
    { command: 'RESET_ADCS', label: 'Reset ADCS', destructive: true },
    { command: 'SAFE_MODE', label: 'Safe Mode', destructive: true }
]

const QuickCommandsWidget: React.FC = () => {
    const [sendCommand, { isLoading }] = useSendCommandMutation()
    const [pending, setPending] = useState<CommandName | null>(null)
    const [lastMessage, setLastMessage] = useState<string | null>(null)

    const handleClick = async (command: CommandName) => {
        setPending(command)
        try {
            const result = await sendCommand(command).unwrap()
            setLastMessage(result.message)
        } catch {
            setLastMessage('Command failed — see console')
        } finally {
            setPending(null)
        }
    }

    return (
        <Container
            title='Quick Commands'
            className={styles.panel}
        >
            <div className={styles.grid}>
                {COMMANDS.map(({ command, label, destructive }) => (
                    <button
                        key={command}
                        type='button'
                        className={`${styles.button} ${destructive ? styles.destructive : ''}`}
                        disabled={isLoading && pending === command}
                        onClick={() => handleClick(command)}
                    >
                        {pending === command ? '…' : label.toUpperCase()}
                    </button>
                ))}
            </div>
            {lastMessage && <div className={styles.feedback}>{lastMessage}</div>}
        </Container>
    )
}

export default QuickCommandsWidget
