import React, { useEffect, useRef, useState } from 'react'
import { Container } from 'simple-react-ui-kit'

import { useSendCommandMutation } from '../../features/telemetry/telemetryAPI'
import type { CommandName, TelemetryRecord } from '../../features/telemetry/types'

import styles from './MissionConsoleWidget.module.scss'

interface Props {
    latest: TelemetryRecord | null
}

const HELP_TEXT = [
    'Available commands:',
    '  status                 — show current satellite status',
    '  enable science          — enable science mode',
    '  disable science         — disable science mode',
    '  reboot obc              — reboot the on-board computer',
    '  reset adcs               — reset attitude control',
    '  safe mode               — enter safe mode',
    '  clear                   — clear the console',
    '  help                    — show this message'
]

const COMMAND_MAP: Record<string, CommandName> = {
    'enable science': 'ENABLE_SCIENCE_MODE',
    'enable science mode': 'ENABLE_SCIENCE_MODE',
    'disable science': 'DISABLE_SCIENCE_MODE',
    'disable science mode': 'DISABLE_SCIENCE_MODE',
    'reboot obc': 'REBOOT_OBC',
    'reset adcs': 'RESET_ADCS',
    'safe mode': 'SAFE_MODE'
}

const MissionConsoleWidget: React.FC<Props> = ({ latest }) => {
    const [lines, setLines] = useState<string[]>([
        'CubeSat Mission Console v1.0',
        'Type "help" for a list of commands.'
    ])
    const [input, setInput] = useState('')
    const [sendCommand] = useSendCommandMutation()
    const bodyRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (bodyRef.current) {
            bodyRef.current.scrollTop = bodyRef.current.scrollHeight
        }
    }, [lines])

    const print = (text: string | string[]) => {
        setLines((prev) => [...prev, ...(Array.isArray(text) ? text : [text])])
    }

    const runStatus = () => {
        if (!latest) {
            print('No telemetry data available.')
            return
        }
        print([
            'Satellite Status:',
            `  Battery: ${latest.voltage?.toFixed(2) ?? '—'} V (${latest.battery?.toFixed(0) ?? '—'}%)`,
            `  Mode: ${latest.obc_state ?? 'UNKNOWN'}`,
            `  Uptime: ${latest.uptime_seconds != null ? Math.floor(latest.uptime_seconds / 86400) : '—'}d`,
            'All systems nominal'
        ])
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const raw = input.trim()
        if (!raw) {
            return
        }
        print(`> ${raw}`)
        setInput('')

        const cmd = raw.toLowerCase()

        if (cmd === 'clear') {
            setLines([])
            return
        }
        if (cmd === 'help') {
            print(HELP_TEXT)
            return
        }
        if (cmd === 'status') {
            runStatus()
            return
        }

        const mapped = COMMAND_MAP[cmd]
        if (!mapped) {
            print(`Unknown command: "${raw}". Type "help" for a list of commands.`)
            return
        }

        try {
            const result = await sendCommand(mapped).unwrap()
            print(result.message)
        } catch {
            print('Command failed.')
        }
    }

    return (
        <Container
            title='Mission Console'
            className={styles.panel}
        >
            <div
                ref={bodyRef}
                className={styles.body}
            >
                {lines.map((line, idx) => (
                    <div
                        key={idx}
                        className={styles.line}
                    >
                        {line}
                    </div>
                ))}
            </div>
            <form
                className={styles.form}
                onSubmit={handleSubmit}
            >
                <span className={styles.prompt}>{'>'}</span>
                <input
                    className={styles.input}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder='Type a command…'
                    autoComplete='off'
                />
            </form>
        </Container>
    )
}

export default MissionConsoleWidget
