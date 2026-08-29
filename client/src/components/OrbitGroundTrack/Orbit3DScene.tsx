import React, { Suspense } from 'react'

import { Canvas } from '@react-three/fiber'

import type { OrbitState } from '../../features/orbit/simulate'
import type { TelemetryRecord } from '../../features/telemetry/types'

import EarthScene from './EarthScene'

interface Props {
    latest: TelemetryRecord | null
    history: TelemetryRecord[]
    orbit: OrbitState | null
}

// Canvas is created only once this whole chunk (Canvas + EarthScene + three.js)
// has finished loading, instead of mounting Canvas eagerly and suspending on
// EarthScene inside it — the latter is what triggered WebGL context loss under
// React.StrictMode's mount/cleanup/remount cycle in development.
const Orbit3DScene: React.FC<Props> = ({ latest, history, orbit }) => (
    <Canvas
        camera={{ position: [0, 1.5, 5.5], fov: 45 }}
        gl={{ powerPreference: 'default' }}
    >
        <Suspense fallback={null}>
            <EarthScene
                latest={latest}
                history={history}
                orbit={orbit}
            />
        </Suspense>
    </Canvas>
)

export default Orbit3DScene
