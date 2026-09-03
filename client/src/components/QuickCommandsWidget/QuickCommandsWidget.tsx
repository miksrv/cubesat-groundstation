import React, { useState } from 'react'
import { Container } from 'simple-react-ui-kit'

import { postNotice } from '../../features/console/notices'
import type { Command, CommandName, Profile } from '../../features/telemetry/types'
import { getSource } from '../../features/telemetry/useSource'

import styles from './QuickCommandsWidget.module.scss'

/**
 * The satellite's own command vocabulary, and nothing else — and since
 * 2026-09-01 this panel does not report what it sent.
 *
 * A command that goes out reappears in the `Mission Console` a moment later,
 * because the console prints what crosses `cubesat/command`. That is one
 * transcript instead of two, in the order the bus saw things, and it covers a
 * phone, the `cubesat` CLI and an uplink relayed off the radio as well as these
 * buttons. What still surfaces — via `postNotice`, into that same console — is a
 * publish that *failed*: it produces no echo, and a silent button would be a lie.
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
    // Start/Stop Timelapse were here until 2026-09-01. A mission photographs
    // itself now, and a button that publishes a verb the satellite answers
    // nothing to is worse than no button.
    // Science Start/Stop were here until 2026-09-02, when the satellite removed
    // the SCIENCE state: they changed a label and nothing a service could act on.
    { label: 'Get Telemetry', command: { command: 'get_telemetry' } },
    // The beacon starts off in DEMO and EXPO (2026-09-01): the satellite is a
    // metre away with this page open, so beaconing at its operator over a shared
    // mesh channel is noise. These two put it back inside the profile's envelope
    // — the same command the radio and `cubesat lora on` send.
    { label: 'Beacon On', command: { command: 'set_comms_config', params: { lora_enabled: true } } },
    { label: 'Beacon Off', command: { command: 'set_comms_config', params: { lora_enabled: false } } },
    { label: 'Safe Mode', command: { command: 'safe_mode' }, destructive: true },
    { label: 'Recover', command: { command: 'recover' }, destructive: true }
]

const PROFILES: Profile[] = ['HOSTED', 'DEMO', 'EXPO', 'FLIGHT', 'DIAG', 'MAINTENANCE']

interface Props {
    /** True while a recorded mission is being replayed: the buttons stay where
     *  they are — the widget set does not change with the mode — and refuse to
     *  publish, because the satellite's present is not what is on screen. */
    disabled?: boolean
}

const QuickCommandsWidget: React.FC<Props> = ({ disabled = false }) => {
    const source = getSource()
    const [pending, setPending] = useState<CommandName | null>(null)

    // A recording cannot be commanded. The vocabulary still renders — the
    // panel shows what an operator of the live satellite could do — but every
    // button is disabled. Disabled is honest where hidden was mute and enabled
    // would be a button that quietly does nothing.
    const commandable = source.capabilities.commands
    const locked = !commandable || disabled || pending != null

    const send = async (command: Command) => {
        setPending(command.command)
        try {
            await source.send(command)
            // Said nothing, deliberately (2026-09-01). The command comes back
            // off `cubesat/command` and prints itself in the Mission Console —
            // one transcript, in the order the bus saw things, covering this
            // panel, the console, a phone, the CLI and an uplink alike. A panel
            // narrating its own button is a second log to read.
        } catch (error) {
            // Except this. A publish that never reached the broker produces no
            // echo, so without a line here the button looks like it worked.
            postNotice(
                `Quick command ${command.command} failed: ${
                    error instanceof Error ? error.message : 'the broker did not accept it'
                }`
            )
        } finally {
            setPending(null)
        }
    }

    return (
        <Container
            title='Quick Commands'
            className={styles.panel}
        >
            <div className={styles.scroll}>
                <div className={styles.grid}>
                    {COMMANDS.map(({ label, command, destructive }) => (
                        <button
                            key={label}
                            type='button'
                            className={`${styles.button} ${destructive ? styles.destructive : ''}`}
                            disabled={locked}
                            onClick={() => send(command)}
                        >
                            {pending === command.command ? '…' : label.toUpperCase()}
                        </button>
                    ))}
                </div>
                <div className={`${styles.grid} ${styles.profiles}`}>
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
                            disabled={locked}
                            onClick={() => send({ command: 'set_profile', params: { profile } })}
                        >
                            {profile}
                        </button>
                    ))}
                </div>
            </div>
            {/* The only thing this panel still says, and it is about the panel
                rather than about a command. What a command did shows up in the
                Mission Console, off the bus. */}
            {disabled && <div className={styles.feedback}>Replaying a recorded mission — commands are off</div>}
            {!disabled && !commandable && (
                <div className={styles.feedback}>This source has no satellite to command</div>
            )}
        </Container>
    )
}

export default QuickCommandsWidget
