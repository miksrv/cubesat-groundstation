import { useEffect, useState } from 'react'

import type { OrbitState } from './simulate'
import { simulateOrbit } from './simulate'

/** The simulated orbit, stepped once a second. Nothing here was measured. */
export const useOrbit = (): OrbitState => {
    const [orbit, setOrbit] = useState<OrbitState>(() => simulateOrbit())
    useEffect(() => {
        const timer = setInterval(() => setOrbit(simulateOrbit()), 1000)
        return () => clearInterval(timer)
    }, [])
    return orbit
}
