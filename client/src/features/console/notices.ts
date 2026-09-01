/**
 * Lines a widget needs printed in the Mission Console.
 *
 * There is exactly one use, and it is worth stating why the channel exists at
 * all. Since 2026-09-01 the console prints the command traffic from
 * `cubesat/command` rather than each widget narrating its own button press — so
 * `Quick Commands` says nothing when a command goes out, because the echo off
 * the bus says it better and covers a phone, the CLI and an uplink relayed off
 * the radio as well.
 *
 * A command that **never reached the broker** has no echo, and that is precisely
 * the case somebody must not miss: the button appeared to work and nothing
 * happened. So a failure travels here instead, and lands in the same transcript
 * as everything else.
 *
 * Deliberately not React state and deliberately not a context: the console
 * subscribes exactly as it subscribes to the source's own channels, and a widget
 * that wants to say something imports one function. A context would mean a
 * provider around the whole page for a single line of text.
 */

type Listener = (text: string) => void

const listeners = new Set<Listener>()

/** Print a line in the console — for a failure a widget cannot show itself. */
export const postNotice = (text: string): void => {
    listeners.forEach((listener) => listener(text))
}

export const subscribeNotices = (listener: Listener): (() => void) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}
