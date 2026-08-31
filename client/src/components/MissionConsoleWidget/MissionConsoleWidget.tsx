import React, { useEffect, useRef, useState } from 'react'
import { Container } from 'simple-react-ui-kit'

import type { Command, LiveState, Profile, TelemetryRecord, TelemetrySnapshot } from '../../features/telemetry/types'
import { getSource } from '../../features/telemetry/useSource'

import styles from './MissionConsoleWidget.module.scss'

interface Props {
    live: LiveState
    /** For uptime and the host metrics, which only DHS records. */
    latest: TelemetryRecord | null
}

/**
 * The satellite's own vocabulary, typed out.
 *
 * The previous console offered `reboot obc` and `reset adcs`, which the
 * satellite has never implemented — a console that accepts a command and does
 * nothing teaches the operator something false about the thing they are
 * operating. Everything below is a real command on `cubesat/command`, and
 * `poweroff` is absent because the vocabulary has no such thing: `CRITICAL` is
 * the only thing permitted to power the host down.
 */
const HELP_TEXT = [
    'Available commands:',
    '  status                  - what the satellite is reporting right now',
    '  profile <name>          - HOSTED | DEMO | EXPO | FLIGHT | DIAG | MAINTENANCE',
    '  science start|stop      - enter or leave SCIENCE',
    '  safe                    - request SAFE',
    '  recover                 - leave SAFE once the fault is gone',
    '  photo                   - take one photograph',
    '  timelapse start|stop    - start or stop a timelapse',
    '  telemetry               - ask COMMS to republish its whole cache',
    '  clear                   - clear the console',
    '  help                    - show this message'
]

const PROFILES: Profile[] = ['HOSTED', 'DEMO', 'EXPO', 'FLIGHT', 'DIAG', 'MAINTENANCE']

/**
 * COMMS' answer to `telemetry`, rendered. Nulls stay dashes: the bundle is
 * COMMS' cache of what it has *heard*, and a block it has heard nothing on
 * arrives empty rather than zeroed.
 */
const snapshotLines = (snapshot: TelemetrySnapshot): string[] => {
    const lines = [
        `COMMS telemetry cache${snapshot.requestId != null ? ` (request ${snapshot.requestId})` : ''}:`,
        `  State:     ${snapshot.obcState ?? '-'}, profile ${snapshot.profile ?? '-'}, mission ${snapshot.missionId ?? '-'}`,
        `  Battery:   ${snapshot.eps?.voltage?.toFixed(3) ?? '-'} V (${snapshot.eps?.batteryPercent?.toFixed(0) ?? '-'}%)`
    ]
    if (snapshot.adcs) {
        const { gnss } = snapshot.adcs
        lines.push(
            gnss.fix === true
                ? `  Position:  ${gnss.lat?.toFixed(5) ?? '-'}, ${gnss.lon?.toFixed(5) ?? '-'} (${gnss.satellites ?? '-'} sats)`
                : '  Position:  no fix - last known position withheld here'
        )
    }
    if (snapshot.science) {
        lines.push(
            `  Science:   ${snapshot.science.temperature?.toFixed(1) ?? '-'} degC, ` +
                `${snapshot.science.humidity?.toFixed(0) ?? '-'}% RH, ` +
                `${snapshot.science.pressure?.toFixed(0) ?? '-'} hPa`
        )
    }
    if (snapshot.system) {
        lines.push(
            `  System:    cpu ${snapshot.system.cpuPercent?.toFixed(0) ?? '-'}%, ` +
                `ram ${snapshot.system.ramPercent?.toFixed(0) ?? '-'}%, ` +
                `disk ${snapshot.system.diskPercent?.toFixed(0) ?? '-'}%`
        )
    }
    return lines
}

/** One typed line to one command, or null when it is not one. */
const parse = (line: string): Command | null | 'bad-profile' => {
    const [head, tail] = [line.split(/\s+/)[0], line.split(/\s+/).slice(1).join(' ')]
    switch (head) {
        case 'profile': {
            const name = tail.toUpperCase() as Profile
            return PROFILES.includes(name) ? { command: 'set_profile', params: { profile: name } } : 'bad-profile'
        }
        case 'science':
            return tail === 'stop' ? { command: 'science_stop' } : { command: 'science_start' }
        case 'safe':
            return { command: 'safe_mode' }
        case 'recover':
            return { command: 'recover' }
        case 'photo':
            return { command: 'take_photo' }
        case 'timelapse':
            return tail === 'stop'
                ? { command: 'stop_timelapse' }
                : { command: 'start_timelapse', params: { interval_sec: 30 } }
        case 'telemetry':
            return { command: 'get_telemetry' }
        default:
            return null
    }
}

const MissionConsoleWidget: React.FC<Props> = ({ live, latest }) => {
    const [lines, setLines] = useState<string[]>([
        'CubeSat Mission Console v1.0',
        'Type "help" for a list of commands.'
    ])
    const [input, setInput] = useState('')
    const source = getSource()
    const bodyRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (bodyRef.current) {
            bodyRef.current.scrollTop = bodyRef.current.scrollHeight
        }
    }, [lines])

    const print = (text: string | string[]) => {
        setLines((prev) => [...prev, ...(Array.isArray(text) ? text : [text])])
    }

    // The `telemetry` command used to be write-only: the answer lands on
    // `cubesat/comms/data`, which nothing subscribed to, so the console
    // published a question and never heard the reply. Any snapshot is printed,
    // asked for here or not — this terminal is where the channel is watched.
    useEffect(
        () => getSource().subscribeSnapshots((snapshot) => print(snapshotLines(snapshot))),

        []
    )

    const runStatus = () => {
        if (!live.obc) {
            print('Nothing has been published yet.')
            return
        }
        // No "all systems nominal" line. The satellite has a state machine and
        // it is the authority on how it is doing; a console that announced
        // health on its own would be contradicting it about itself.
        print([
            'Satellite Status:',
            `  Mission state: ${live.obc.status}`,
            `  Profile:       ${live.host?.profile ?? live.obc.profile ?? 'unknown'}`,
            `  Battery:       ${live.eps?.voltage?.toFixed(3) ?? '-'} V (${live.eps?.batteryPercent?.toFixed(0) ?? '-'}%)`,
            `  Recording:     ${live.dhs?.recording ? `mission ${live.dhs.mission?.id ?? '?'}` : 'no'}`,
            `  Radio:         ${live.comms ? (live.comms.loraEnabled ? 'transmitting' : live.comms.loraListening ? 'listening only' : 'off') : '-'}`,
            `  Uptime:        ${latest?.uptimeSeconds != null ? `${Math.floor(latest.uptimeSeconds / 3600)}h` : '-'}`
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

        const parsed = parse(cmd)
        if (parsed === 'bad-profile') {
            print(`Unknown profile. One of: ${PROFILES.join(', ')}`)
            return
        }
        if (parsed == null) {
            print(`Unknown command: "${raw}". Type "help" for a list of commands.`)
            return
        }

        try {
            await source.send(parsed)
            print(`${parsed.command} published to cubesat/command`)
        } catch (error) {
            print(error instanceof Error ? error.message : 'Command failed.')
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
