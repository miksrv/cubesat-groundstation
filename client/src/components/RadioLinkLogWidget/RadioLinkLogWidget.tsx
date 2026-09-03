import React from 'react'
import { Container } from 'simple-react-ui-kit'

import type { RadioEvent } from '../../features/telemetry/types'

import styles from './RadioLinkLogWidget.module.scss'

/**
 * The radio's session log, live: one row per transaction on the LoRa channel —
 * every message heard and every transmission attempted, from
 * `cubesat/comms/radio`. The same events DHS records into `radio_log`, so what
 * this table shows is what the mission archive will hold.
 *
 * A stream, not a state: there is no retained "current traffic" for a fresh
 * page to learn, so the table fills from the moment it is open and says so
 * while it is still empty. Half the columns are blank by design — link quality
 * exists only for what was heard, an outcome only for what was said — and a
 * blank is rendered as a dash, never as a zero.
 *
 * The events arrive as a prop rather than from a subscription inside the widget,
 * so the same table renders the live link and the traffic a replayed mission
 * recorded into `radio_log`. It was the last widget still reaching for a channel
 * of its own, which during a replay meant one panel reading the present while
 * everything beside it read a past afternoon.
 *
 * Two things changed on the satellite on 2026-09-03 and both are visible here.
 * An `rx` row now only ever describes the satellite's own mesh channel — COMMS
 * drops everything else before publishing, so the public mesh's chat, which did
 * turn up in this table on 2026-09-02, no longer can. And `DEMO` and `EXPO`,
 * which start the beacon off, now produce `tx` rows where they produced none at
 * all: a reply to a command is gated on listening rather than on the beacon
 * flag, so an `ack` goes out in a profile that beacons nothing.
 */

const dash = '—'

const time = (epoch: number): string =>
    epoch > 0 ? new Date(epoch * 1000).toLocaleTimeString(undefined, { hour12: false }) : dash

const number = (value: number | null, digits: number, unit = ''): string =>
    value != null ? `${value.toFixed(digits)}${unit}` : dash

/**
 * What each `tx` kind is, spelled out on hover — the words are the satellite's
 * and they are three-letter labels in a table of numbers otherwise. `ack` is
 * the one worth explaining: it is the kind that appears in `DEMO` and `EXPO`
 * without a beacon behind it, and reading it as "the beacon is on after all"
 * is the wrong conclusion to invite.
 *
 * A kind this build has not heard of gets no hint and still renders, exactly
 * as {@link RadioEvent.kind} promises.
 */
const KIND_HINT: Record<string, string> = {
    ack: 'answer to a command — sent whether or not the scheduled beacon is on',
    beacon: 'scheduled telemetry, on the beacon interval for this state',
    down: 'going-down notice, sent as COMMS shuts off'
}

/** What the tx event was for, or who the rx came from. */
const origin = (event: RadioEvent): string => {
    if (event.direction === 'rx') {
        return event.sender ?? dash
    }
    return event.kind ?? dash
}

/** The hover text for the same cell: what a kind means, or nothing for an rx,
 *  whose sender is already its own explanation. */
const originHint = (event: RadioEvent): string | undefined =>
    event.direction === 'tx' && event.kind != null ? KIND_HINT[event.kind] : undefined

interface Props {
    /** Newest first. Live from `cubesat/comms/radio`, or a replayed mission's
     *  own traffic up to the playhead. */
    events: RadioEvent[]
    /** What to say when there are none — the reason differs by mode. */
    emptyMessage?: string
}

const RadioLinkLogWidget: React.FC<Props> = ({ events, emptyMessage }) => {
    return (
        <Container
            title='Radio Link Log'
            className={styles.panel}
        >
            {events.length === 0 && (
                <div className={styles.empty}>
                    {emptyMessage ?? (
                        <>
                            No radio traffic yet — rows appear as the link talks and listens, on the satellite&apos;s
                            own mesh channel alone. The same events are recorded into the mission&apos;s{' '}
                            <code>radio_log</code>.
                        </>
                    )}
                </div>
            )}
            {events.length > 0 && (
                <div className={styles.scroll}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Dir</th>
                                <th>Kind / From</th>
                                <th>RSSI</th>
                                <th>SNR</th>
                                <th>Hops</th>
                                <th>Bytes</th>
                                <th className={styles.messageHead}>Message</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((event, index) => (
                                <tr
                                    key={`${event.timestamp}-${index}`}
                                    className={event.sent === false ? styles.failed : undefined}
                                    /* The one row worth explaining: it spent no
                                       airtime, but it says something about the link. */
                                    title={
                                        event.sent === false ? 'transmission failed — never left the radio' : undefined
                                    }
                                >
                                    <td className={`${styles.mono} ${styles.time}`}>{time(event.timestamp)}</td>
                                    <td className={event.direction === 'rx' ? styles.rx : styles.tx}>
                                        {event.direction === 'rx' ? '▼ RX' : '▲ TX'}
                                    </td>
                                    <td
                                        className={styles.mono}
                                        title={originHint(event)}
                                    >
                                        {origin(event)}
                                    </td>
                                    <td className={styles.mono}>{number(event.rssi, 0, ' dBm')}</td>
                                    <td className={styles.mono}>{number(event.snr, 1, ' dB')}</td>
                                    <td className={styles.mono}>{event.hops ?? dash}</td>
                                    <td className={styles.mono}>{event.bytes ?? dash}</td>
                                    <td
                                        className={styles.message}
                                        title={event.text ?? undefined}
                                    >
                                        {event.text ?? dash}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Container>
    )
}

export default RadioLinkLogWidget
