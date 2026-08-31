import React, { lazy, Suspense } from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { OrbitState } from '../../features/orbit/simulate'
import type { TelemetryRecord } from '../../features/telemetry/types'

import styles from './OrbitGroundTrack.module.scss'

interface Props {
    latest: TelemetryRecord | null
    history: TelemetryRecord[]
    orbit: OrbitState | null
    isLoading: boolean
}

// The three.js/@react-three/fiber scene is a heavy WebGL bundle — load it lazily
// so it isn't in the critical path for the rest of the dashboard. Canvas itself
// lives inside this lazy chunk (see Orbit3DScene) so it only mounts once fully
// loaded, rather than mounting eagerly and suspending on its children.
const Orbit3DScene = lazy(() => import('./Orbit3DScene'))

const fmtDeg = (v: number | null | undefined): string => (v != null ? `${v.toFixed(4)}°` : '—')

const OrbitGroundTrack: React.FC<Props> = React.memo(({ latest, history, orbit, isLoading }) => {
    const showSkeleton = isLoading && !latest

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
                                <span>Eclipse</span>
                                <b className={orbit?.eclipse ? styles.eclipseOn : ''}>
                                    {orbit?.eclipse ? 'YES' : 'NO'}
                                </b>
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
