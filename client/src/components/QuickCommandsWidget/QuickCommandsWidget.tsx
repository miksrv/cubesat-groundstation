import React, { useState } from 'react'
import { Container } from 'simple-react-ui-kit'

import type { Command, CommandName, Profile } from '../../features/telemetry/types'
import { getSource } from '../../features/telemetry/useSource'

import styles from './QuickCommandsWidget.module.scss'

/**
 * The satellite's own command vocabulary, and nothing else.
 *
 * These are exactly the commands the radio carries. They go onto
 * `cubesat/command` — the same topic a laptop, the `cubesat` CLI and an uplink
 * relayed off the radio all use — so nothing downstream knows or cares that
 * this one came from a browser. One vocabulary, whatever the channel.
 *
 * The previous list (`REBOOT_OBC`, `RESET_ADCS`, `REFRESH_TELEMETRY`) was the
 * PHP API's, and the satellite implements none of it. `poweroff` is deliberately
 * absent from the vocabulary altogether: `CRITICAL` is the only thing permitted
 * to power the host down, and it decides that from the battery rather than from
 * a button.
 */
const COMMANDS: Array<{ label: string; command: Command; destructive?: boolean }> = [
    { label: 'Take Photo', command: { command: 'take_photo' } },
    { label: 'Start Timelapse', command: { command: 'start_timelapse', params: { interval_sec: 30 } } },
    { label: 'Stop Timelapse', command: { command: 'stop_timelapse' } },
    { label: 'Science Start', command: { command: 'science_start' } },
    { label: 'Science Stop', command: { command: 'science_stop' } },
    { label: 'Get Telemetry', command: { command: 'get_telemetry' } },
    { label: 'Safe Mode', command: { command: 'safe_mode' }, destructive: true },
    { label: 'Recover', command: { command: 'recover' }, destructive: true }
]

const PROFILES: Profile[] = ['HOSTED', 'DEMO', 'EXPO', 'FLIGHT', 'DIAG', 'MAINTENANCE']

const QuickCommandsWidget: React.FC = () => {
    const source = getSource()
    const [pending, setPending] = useState<CommandName | null>(null)
    const [lastMessage, setLastMessage] = useState<string | null>(null)

    // A recording cannot be commanded. Asked rather than assumed, and the panel
    // is hidden rather than shown with buttons that quietly do nothing.
    if (!source.capabilities.commands) {
        return (
            <Container
                title='Quick Commands'
                className={styles.panel}
            >
                <div className={styles.feedback}>This is a recorded mission — there is no satellite to command.</div>
            </Container>
        )
    }

    const send = async (command: Command) => {
        setPending(command.command)
        try {
            await source.send(command)
            setLastMessage(`${command.command} published to cubesat/command`)
        } catch (error) {
            setLastMessage(error instanceof Error ? error.message : 'command failed')
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
                {COMMANDS.map(({ label, command, destructive }) => (
                    <button
                        key={label}
                        type='button'
                        className={`${styles.button} ${destructive ? styles.destructive : ''}`}
                        disabled={pending != null}
                        onClick={() => send(command)}
                    >
                        {pending === command.command ? '…' : label.toUpperCase()}
                    </button>
                ))}
            </div>
            <div className={styles.grid}>
                {PROFILES.map((profile) => (
                    <button
                        key={profile}
                        type='button'
                        /*
                          set_profile is the one that can end a demonstration: in
                          EXPO the satellite is its own access point, and moving to
                          HOSTED takes it down along with whoever pressed the
                          button. Marked destructive so it looks like what it is.
                        */
                        className={`${styles.button} ${styles.destructive}`}
                        disabled={pending != null}
                        onClick={() => send({ command: 'set_profile', params: { profile } })}
                    >
                        {profile}
                    </button>
                ))}
            </div>
            {lastMessage && <div className={styles.feedback}>{lastMessage}</div>}
        </Container>
    )
}

export default QuickCommandsWidget
