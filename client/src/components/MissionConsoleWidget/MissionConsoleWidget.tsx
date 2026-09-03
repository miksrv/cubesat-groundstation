import React, { useEffect, useRef, useState } from 'react'
import { Container } from 'simple-react-ui-kit'

import { subscribeNotices } from '../../features/console/notices'
import type {
    Command,
    CommandEcho,
    LiveState,
    Profile,
    TelemetryRecord,
    TelemetrySnapshot
} from '../../features/telemetry/types'
import { getSource } from '../../features/telemetry/useSource'

import styles from './MissionConsoleWidget.module.scss'

interface Props {
    live: LiveState
    /** For uptime and the host metrics, which only DHS records. */
    latest: TelemetryRecord | null
    /** True while a recorded mission is being replayed. The console stays on the
     *  page — the widget set does not change with the mode — but nothing can be
     *  typed into it: there is no present to command, and a queued command that
     *  reached the satellite anyway would act on *now* while the operator is
     *  looking at a past afternoon. */
    disabled?: boolean
}

/**
 * The satellite's own vocabulary, typed out — and it is the *radio's*
 * vocabulary, verbatim.
 *
 * These are exactly the lines `comms/compact.py` accepts over the Meshtastic
 * uplink, so an operator learns one command language: what works here works
 * from a phone in a field, and vice versa (the radio also tolerates a `!`
 * prefix, and so does this parser). The queries — ping, pos, sys, env,
 * mission — are answered by COMMS from its caches over the radio; here they
 * are answered from the same data the page already holds, printed in the
 * radio reply's own `re=... key=value` syntax so the answer reads the same on
 * both channels.
 *
 * The previous console offered `reboot obc` and `reset adcs`, which the
 * satellite has never implemented — a console that accepts a command and does
 * nothing teaches the operator something false about the thing they are
 * operating. `poweroff` is absent because the vocabulary has no such thing
 * (`CRITICAL` is the only thing permitted to power the host down), and
 * `science start|stop` went on 2026-09-02 with the state it named. This console
 * must not know more commands than the satellite does.
 */
const HELP_TEXT = [
    'Satellite commands - the same lines work over the Meshtastic uplink:',
    '  ping                    - proof of life',
    '  pos                     - position, with the age of the fix',
    '  sys                     - cpu, ram, disk, uptime',
    '  env                     - temperature, humidity, pressure, light',
    '  mission                 - the mission being recorded',
    '  photo                   - take one photograph',
    '  restart <service>       - restart adcs, payload, dhs or comms through HOSTD',
    '  profile <name>          - HOSTED | DEMO | EXPO | FLIGHT | DIAG | MAINTENANCE',
    '  safe                    - request SAFE',
    '  recover                 - leave SAFE once the fault is gone',
    '  beacon on|off           - start or stop transmitting (listening is unaffected)',
    'Console commands:',
    '  status                  - what the satellite is reporting right now',
    '  telemetry               - ask COMMS to republish its whole cache',
    '  clear                   - clear the console',
    '  help                    - show this message'
]

const PROFILES: Profile[] = ['HOSTED', 'DEMO', 'EXPO', 'FLIGHT', 'DIAG', 'MAINTENANCE']

/** The queries COMMS answers itself over the radio; the console answers them
 *  locally, from the same telemetry the rest of the page renders. */
type QueryName = 'ping' | 'pos' | 'sys' | 'env' | 'mission'

type Parsed = { command: Command } | { query: QueryName } | { usage: string } | null

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

/**
 * One typed line to one command, mirroring `comms/compact.py` case for case —
 * the same verbs, the same argument shapes, the optional `!`. Where the radio
 * answers a mistyped `!` line with a terse `err=unknown`, a console has room
 * to say what the arguments should have been, so bad arguments come back as a
 * usage line rather than a shrug.
 */
const parse = (line: string): Parsed => {
    const words = line.replace(/^!/, '').split(/\s+/).filter(Boolean)
    if (words.length === 0) {
        return null
    }
    const [verb, ...args] = words
    const bare = (result: Parsed): Parsed => (args.length === 0 ? result : { usage: `${verb} takes no arguments` })
    switch (verb) {
        case 'ping':
        case 'pos':
        case 'sys':
        case 'env':
        case 'mission':
            return bare({ query: verb })
        case 'photo':
            return bare({ command: { command: 'take_photo' } })
        case 'safe':
            return bare({ command: { command: 'safe_mode' } })
        case 'recover':
            return bare({ command: { command: 'recover' } })
        case 'telemetry':
            return bare({ command: { command: 'get_telemetry' } })
        case 'profile': {
            const name = args.join(' ').toUpperCase() as Profile
            // Profiles are data on the satellite, but a typo should fail here
            // rather than reach OBC and be refused there — one round trip
            // later, with the operator watching nothing happen.
            return PROFILES.includes(name)
                ? { command: { command: 'set_profile', params: { profile: name } } }
                : { usage: `Unknown profile. One of: ${PROFILES.join(', ')}` }
        }
        case 'restart':
            // The satellite gained the handler on 2026-09-01: OBC relays it,
            // HOSTD executes it against the allowlist. Which services exist is
            // the satellite's answer, so this only checks the shape.
            if (args.length === 1) {
                return { command: { command: 'restart_service', params: { service: args[0] } } }
            }
            return { usage: 'usage: restart <adcs|payload|dhs|comms>' }
        // `lora` is what this verb was called until 2026-09-01, kept accepted
        // because it may be in somebody's fingers. Renamed because it said the
        // wrong thing: turning it off never turned the radio off, and quiet-but-
        // listening is the way back into a satellite in SAFE.
        case 'beacon':
        case 'lora':
            if (args.length === 1 && (args[0] === 'on' || args[0] === 'off')) {
                return { command: { command: 'set_comms_config', params: { lora_enabled: args[0] === 'on' } } }
            }
            return { usage: 'usage: beacon on|off' }
        default:
            return null
    }
}

/** Whole seconds since an epoch-seconds timestamp, as the radio spells it. */
const ageOf = (timestamp: number | null | undefined): string =>
    timestamp != null ? String(Math.max(0, Math.round(Date.now() / 1000 - timestamp))) : '?'

/** `key=value` pairs with the absent ones omitted, never zeroed — the same
 *  withhold-rather-than-fabricate rule the radio reply follows. */
const replyLine = (re: QueryName, fields: Array<[string, string | null]>): string =>
    [`re=${re}`, ...fields.filter(([, value]) => value != null).map(([key, value]) => `${key}=${value}`)].join(' ')

const NO_DATA = (re: QueryName): string => `re=${re} ok=0 err=nodata`

/**
 * One command as it crossed the bus, in the field syntax the rest of this
 * console uses. `→` rather than the `>` of a typed line: this one is traffic,
 * and it may not have come from this page at all.
 */
const busLine = (echo: CommandEcho): string => {
    const params = Object.entries(echo.params ?? {})
        .filter(([, value]) => value != null)
        .map(([key, value]) => `${key}=${String(value)}`)
    return [`→ ${echo.command}`, ...params].join(' ')
}

/**
 * The console's answers to the query verbs, printed in the radio reply's own
 * field syntax — over LoRa these come back as a beacon, and an operator who
 * has read one should recognise the other.
 */
const answerQuery = (query: QueryName, live: LiveState, latest: TelemetryRecord | null): string => {
    switch (query) {
        case 'ping': {
            if (!live.obc) {
                return NO_DATA('ping')
            }
            return replyLine('ping', [
                ['st', live.obc.status],
                ['pr', live.obc.profile],
                ['b', live.eps?.batteryPercent != null ? live.eps.batteryPercent.toFixed(1) : null],
                ['v', live.eps?.voltage != null ? live.eps.voltage.toFixed(2) : null],
                ['age', ageOf(live.obc.timestamp)]
            ])
        }
        case 'pos': {
            const gnss = live.adcs?.gnss
            if (gnss?.lat == null || gnss.lon == null) {
                return NO_DATA('pos')
            }
            return replyLine('pos', [
                ['lat', gnss.lat.toFixed(4)],
                ['lon', gnss.lon.toFixed(4)],
                ['fix', gnss.fix ? '1' : '0'],
                ['age', ageOf(live.adcs?.timestamp)],
                ['alt', gnss.alt != null ? gnss.alt.toFixed(0) : null],
                ['sat', gnss.satellites != null ? String(gnss.satellites) : null]
            ])
        }
        case 'sys': {
            if (latest?.cpuPercent == null) {
                return NO_DATA('sys')
            }
            return replyLine('sys', [
                ['cpu', latest.cpuPercent.toFixed(0)],
                ['ram', latest.ramPercent != null ? latest.ramPercent.toFixed(0) : null],
                ['disk', latest.diskPercent != null ? latest.diskPercent.toFixed(0) : null],
                ['up', latest.uptimeSeconds != null ? `${(latest.uptimeSeconds / 3600).toFixed(1)}h` : null],
                ['tc', latest.cpuTemperature != null ? latest.cpuTemperature.toFixed(1) : null]
            ])
        }
        case 'env': {
            const science = live.science
            if (science?.temperature == null) {
                return NO_DATA('env')
            }
            return replyLine('env', [
                ['age', ageOf(science.timestamp)],
                ['tc', science.temperature.toFixed(1)],
                ['rh', science.humidity != null ? science.humidity.toFixed(0) : null],
                ['hpa', science.pressure != null ? science.pressure.toFixed(0) : null],
                ['lux', science.light != null ? science.light.toFixed(0) : null]
            ])
        }
        case 'mission': {
            if (live.dhs?.mission == null) {
                return NO_DATA('mission')
            }
            return replyLine('mission', [
                ['m', String(live.dhs.mission.id)],
                ['rows', String(live.dhs.mission.rows)]
            ])
        }
    }
}

/** Enough to scroll back through a session, bounded so an all-day stand cannot
 *  grow it without end. */
const MAX_LINES = 400

const MissionConsoleWidget: React.FC<Props> = ({ live, latest, disabled = false }) => {
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
        // Trimmed from the head: the transcript now carries the bus traffic as
        // well as what was typed, and an EXPO stand left open all day would
        // otherwise grow one array without limit. Oldest lines are the ones to
        // lose — this is a terminal, and the prompt is at the bottom.
        setLines((prev) => [...prev, ...(Array.isArray(text) ? text : [text])].slice(-MAX_LINES))
    }

    // The `telemetry` command used to be write-only: the answer lands on
    // `cubesat/comms/data`, which nothing subscribed to, so the console
    // published a question and never heard the reply. Any snapshot is printed,
    // asked for here or not — this terminal is where the channel is watched.
    useEffect(
        () => getSource().subscribeSnapshots((snapshot) => print(snapshotLines(snapshot))),

        []
    )

    // A refused capture answers on `cubesat/payload/photo`, not on any status
    // topic. Without this line a command goes out and nothing follows, which
    // reads as success.
    useEffect(
        () =>
            getSource().subscribePhotoRefusals((refusal) =>
                print(`Camera refused: ${refusal.reason ?? 'no reason given'}`)
            ),
        []
    )

    // Every command that crosses `cubesat/command`, whoever put it there: this
    // console, the Quick Commands panel beside it, a phone, the `cubesat` CLI,
    // or an uplink COMMS relayed off the radio. Printing the *traffic* rather
    // than each widget's own narration is what makes this a log of the satellite
    // instead of a log of this tab's intentions — and it is the visible form of
    // "every command works identically over MQTT and over LoRa".
    useEffect(() => getSource().subscribeCommands((echo) => print(busLine(echo))), [])

    // What a widget could not say for itself: a publish that never reached the
    // broker has no echo above, and it is the failure most worth not missing.
    useEffect(() => subscribeNotices(print), [])

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
        if (parsed == null) {
            print(`Unknown command: "${raw}". Type "help" for a list of commands.`)
            return
        }
        if ('usage' in parsed) {
            print(parsed.usage)
            return
        }
        if ('query' in parsed) {
            // Answered locally, like COMMS answers them from its own caches
            // over the radio: the data being asked about is already here.
            print(answerQuery(parsed.query, live, latest))
            return
        }

        try {
            await source.send(parsed.command)
            // Nothing printed on success: the command comes back off
            // `cubesat/command` a moment later and prints itself, once, however
            // it was sent. Printing here as well would double every line.
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
                    placeholder={disabled ? 'Replaying a recorded mission — commands are off' : 'Type a command…'}
                    autoComplete='off'
                    disabled={disabled}
                />
            </form>
        </Container>
    )
}

export default MissionConsoleWidget
