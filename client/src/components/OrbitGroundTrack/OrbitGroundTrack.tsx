import React, { lazy, Suspense } from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { OrbitState } from '../../features/orbit/simulate'
import { subsolarPoint } from '../../features/orbit/sun'
import type { TelemetryRecord } from '../../features/telemetry/types'

import styles from './OrbitGroundTrack.module.scss'

interface Props {
    latest: TelemetryRecord | null
    history: TelemetryRecord[]
    orbit: OrbitState | null
    /** Epoch seconds — the moment the globe's daylight is drawn for: now while
     *  the page is live (and in the `yarn demo` replay), the playhead while a
     *  mission is being replayed. `useSunInstant` is where that rule lives. */
    sunInstant: number
    isLoading: boolean
}

// The three.js/@react-three/fiber scene is a heavy WebGL bundle — load it lazily
// so it isn't in the critical path for the rest of the dashboard. Canvas itself
// lives inside this lazy chunk (see Orbit3DScene) so it only mounts once fully
// loaded, rather than mounting eagerly and suspending on its children.
const Orbit3DScene = lazy(() => import('./Orbit3DScene'))

const fmtDeg = (v: number | null | undefined): string => (v != null ? `${v.toFixed(4)}°` : '—')

/** A point as a navigator writes it: hemispheres rather than signs, which is
 *  what makes a subsolar readout checkable against an almanac at a glance. */
const fmtPoint = (latDeg: number, lonDeg: number): string =>
    `${Math.abs(latDeg).toFixed(1)}°${latDeg >= 0 ? 'N' : 'S'} ${Math.abs(lonDeg).toFixed(1)}°${lonDeg >= 0 ? 'E' : 'W'}`

const OrbitGroundTrack: React.FC<Props> = React.memo(({ latest, history, orbit, sunInstant, isLoading }) => {
    const showSkeleton = isLoading && !latest
    // Printed so the shading on the globe is checkable rather than decorative:
    // this is where the Sun stands at the instant on display, and it is the
    // same number the terminator is drawn from.
    const sun = subsolarPoint(sunInstant)

    return (
        <Container
            title='Orbit & Ground Track'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '280px', width: '100%' }} />}
            {!showSkeleton && (
                <>
                    <div className={styles.canvasWrapper}>
                        <Suspense fallback={<Skeleton style={{ height: '100%', width: '100%' }} />}>
                            <Orbit3DScene
                                latest={latest}
                                history={history}
                                orbit={orbit}
                                sunInstant={sunInstant}
                            />
                        </Suspense>
                    </div>
                    <div className={styles.info}>
                        <div className={styles.coords}>
                            <div className={styles.coord}>
                                <span>LAT</span>
                                <b>{fmtDeg(latest?.gnss.lat)}</b>
                            </div>
                            <div className={styles.coord}>
                                <span>LON</span>
                                <b>{fmtDeg(latest?.gnss.lon)}</b>
                            </div>
                            <div className={styles.coord}>
                                <span>ALT</span>
                                {/* Metres, as the receiver reports them — the km
                                    label once turned a 116 m bench into orbit. */}
                                <b>{latest?.gnss.alt != null ? `${latest.gnss.alt.toFixed(1)} m` : '—'}</b>
                            </div>
                            <div className={styles.coord}>
                                <span>SPEED</span>
                                {/* Metres per second, from the receiver. The register
                                     holds knots and the driver converts, so nothing here
                                     ever sees them — and this satellite walks rather than
                                     orbits, so km/s was three orders of magnitude out. */}
                                <b>{latest?.gnss.speed != null ? `${latest.gnss.speed.toFixed(2)} m/s` : '—'}</b>
                            </div>
                        </div>
                        <div className={styles.coords}>
                            <div className={styles.coord}>
                                {/* The Sun is real; the position it is tested
                                    against is the simulated one, so this says
                                    (sim) like the anomaly beside it. */}
                                <span>Eclipse (sim)</span>
                                <b className={orbit?.eclipse ? styles.eclipseOn : ''}>
                                    {orbit ? (orbit.eclipse ? 'YES' : 'NO') : '—'}
                                </b>
                            </div>
                            <div className={styles.coord}>
                                {/* Not simulated and not telemetry either:
                                    where the Sun stands over the Earth is
                                    arithmetic on the clock, so it is exact for
                                    the real planet even though the satellite
                                    drawn against it is a fiction. It is also
                                    what shades the globe — one Sun, not two. */}
                                <span>Subsolar (calc)</span>
                                <b>{fmtPoint(sun.latDeg, sun.lonDeg)}</b>
                            </div>
                            <div className={styles.coord}>
                                {/* The simulation propagates a circular orbit from the
                                    clock and nothing more; a beta angle would be
                                    precision about a fiction. True anomaly is what it
                                    actually computes. */}
                                <span>True anomaly (sim)</span>
                                <b>{orbit ? `${orbit.trueAnomalyDeg.toFixed(1)}°` : '—'}</b>
                            </div>
                        </div>
                        <div className={styles.legend}>
                            <span className={styles.legendItem}>
                                <span
                                    className={styles.legendLine}
                                    style={{ borderColor: '#22c55e' }}
                                />
                                Orbit Path
                            </span>
                            <span className={styles.legendItem}>
                                <span
                                    className={styles.legendLine}
                                    style={{ borderColor: '#3b82f6' }}
                                />
                                Ground Track
                            </span>
                            <span className={styles.legendItem}>
                                <span
                                    className={styles.legendDot}
                                    style={{ background: '#22c55e' }}
                                />
                                Satellite
                            </span>
                        </div>
                    </div>
                </>
            )}
        </Container>
    )
})

OrbitGroundTrack.displayName = 'OrbitGroundTrack'
export default OrbitGroundTrack
