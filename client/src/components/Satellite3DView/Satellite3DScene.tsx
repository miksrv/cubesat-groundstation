import React, { Suspense } from 'react'

import { OrbitControls, Stars } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'

import type { TelemetryRecord } from '../../features/telemetry/types'

import CubeSatModel from './CubeSatModel'

interface Props {
    latest: TelemetryRecord | null
}

// Canvas lives inside this component (not the other way around) so the whole
// chunk mounts as one unit once loaded — see the OrbitGroundTrack widget for
// why mounting Canvas eagerly with a lazy child behind Suspense causes WebGL
// context loss under React.StrictMode in development.
const Satellite3DScene: React.FC<Props> = ({ latest }) => (
    <Canvas
        camera={{ position: [1.6, 1.1, 2.4], fov: 40 }}
        gl={{ powerPreference: 'default' }}
    >
        <Suspense fallback={null}>
            <ambientLight intensity={0.4} />
            <directionalLight
                position={[3, 2, 2]}
                intensity={1.4}
            />
            <Stars
                radius={20}
                depth={20}
                count={1500}
                factor={1.5}
                fade
            />
            <CubeSatModel latest={latest} />
            <OrbitControls
                enableZoom
                enablePan={false}
                minDistance={1.6}
                maxDistance={5}
            />
        </Suspense>
    </Canvas>
)

export default Satellite3DScene
