import React, { useCallback, useEffect, useRef } from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { TelemetryRecord } from '../../features/telemetry/types'

import styles from './AttitudeIndicator.module.scss'

interface Props {
    latest: TelemetryRecord | null
    isLoading: boolean
}

interface Point3D {
    x: number
    y: number
    z: number
}

interface Point2D {
    x: number
    y: number
}

// CubeSat face colors
const FACE_COLORS = {
    top: '#22c55e', // Green - +Z (zenith)
    bottom: '#14532d', // Dark green - -Z (nadir)
    front: '#3b82f6', // Blue - +X (velocity)
    back: '#1e3a8a', // Dark blue - -X
    right: '#eab308', // Yellow - +Y
    left: '#854d0e' // Dark yellow - -Y
}

const AttitudeIndicator: React.FC<Props> = React.memo(({ latest, isLoading }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animationRef = useRef<number>(0)

    const showSkeleton = isLoading && !latest

    // Convert degrees to radians
    const deg2rad = (deg: number): number => (deg * Math.PI) / 180

    // Rotation matrices
    const rotateX = useCallback((point: Point3D, angle: number): Point3D => {
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        return {
            x: point.x,
            y: point.y * cos - point.z * sin,
            z: point.y * sin + point.z * cos
        }
    }, [])

    const rotateY = useCallback((point: Point3D, angle: number): Point3D => {
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        return {
            x: point.x * cos + point.z * sin,
            y: point.y,
            z: -point.x * sin + point.z * cos
        }
    }, [])

    const rotateZ = useCallback((point: Point3D, angle: number): Point3D => {
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        return {
            x: point.x * cos - point.y * sin,
            y: point.x * sin + point.y * cos,
            z: point.z
        }
    }, [])

    // Project 3D point to 2D with perspective
    const project = useCallback((point: Point3D, width: number, height: number): Point2D => {
        const fov = 300
        const distance = 4
        const scale = fov / (distance + point.z)
        return {
            x: point.x * scale + width / 2,
            y: -point.y * scale + height / 2
        }
    }, [])

    // Apply all rotations (roll, pitch, yaw) to a point
    const applyRotations = useCallback(
        (point: Point3D, roll: number, pitch: number, yaw: number): Point3D => {
            // Apply rotations in order: yaw (Z), pitch (Y), roll (X)
            let p = rotateZ(point, yaw)
            p = rotateY(p, pitch)
            p = rotateX(p, roll)
            return p
        },
        [rotateX, rotateY, rotateZ]
    )

    // Draw the CubeSat
    const draw = useCallback(
        (ctx: CanvasRenderingContext2D, width: number, height: number, roll: number, pitch: number, yaw: number) => {
            ctx.clearRect(0, 0, width, height)

            const centerX = width / 2
            const centerY = height / 2
            const radius = Math.min(width, height) / 2 - 15

            // Gradient background
            const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
            bgGradient.addColorStop(0, 'rgba(30, 41, 59, 0.8)')
            bgGradient.addColorStop(1, 'rgba(15, 23, 42, 0.9)')
            ctx.fillStyle = bgGradient
            ctx.beginPath()
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
            ctx.fill()

            // Reference circle
            ctx.strokeStyle = '#334155'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
            ctx.stroke()

            // Convert degrees to radians and add base view rotation
            const baseViewX = deg2rad(25) // Tilt down slightly
            const baseViewY = deg2rad(-25) // Rotate to show 3 faces
            const rollRad = deg2rad(roll)
            const pitchRad = deg2rad(pitch)
            const yawRad = deg2rad(yaw)

            // Combined rotation: first apply attitude, then view rotation
            const applyAllRotations = (point: Point3D): Point3D => {
                // Apply spacecraft attitude (roll, pitch, yaw)
                let p = applyRotations(point, rollRad, pitchRad, yawRad)
                // Apply view rotation so we can see the cube in 3D
                p = rotateX(p, baseViewX)
                p = rotateY(p, baseViewY)
                return p
            }

            // Define cube vertices
            const size = 0.3
            const vertices: Point3D[] = [
                { x: -size, y: -size, z: -size }, // 0
                { x: size, y: -size, z: -size }, // 1
                { x: size, y: size, z: -size }, // 2
                { x: -size, y: size, z: -size }, // 3
                { x: -size, y: -size, z: size }, // 4
                { x: size, y: -size, z: size }, // 5
                { x: size, y: size, z: size }, // 6
                { x: -size, y: size, z: size } // 7
            ]

            // Apply rotations to all vertices
            const rotatedVertices = vertices.map(applyAllRotations)

            // Project to 2D
            const projectedVertices = rotatedVertices.map((v) => project(v, width, height))

            // Define faces - each face defined by 4 vertex indices
            // Using right-hand rule for face normals
            const faces = [
                { indices: [0, 1, 2, 3], color: FACE_COLORS.back, label: '-Z' }, // Back (z = -size)
                { indices: [7, 6, 5, 4], color: FACE_COLORS.front, label: '+Z' }, // Front (z = +size)
                { indices: [4, 5, 1, 0], color: FACE_COLORS.bottom, label: '-Y' }, // Bottom (y = -size)
                { indices: [3, 2, 6, 7], color: FACE_COLORS.top, label: '+Y' }, // Top (y = +size)
                { indices: [0, 3, 7, 4], color: FACE_COLORS.left, label: '-X' }, // Left (x = -size)
                { indices: [5, 6, 2, 1], color: FACE_COLORS.right, label: '+X' } // Right (x = +size)
            ]

            // Calculate average Z depth for each face for sorting
            const facesWithDepth = faces.map((face) => {
                const avgZ = face.indices.reduce((sum, i) => sum + rotatedVertices[i].z, 0) / face.indices.length
                return { ...face, depth: avgZ }
            })

            // Sort by depth (furthest first - painter's algorithm)
            facesWithDepth.sort((a, b) => a.depth - b.depth)

            // Draw faces
            facesWithDepth.forEach((face) => {
                const points = face.indices.map((i) => projectedVertices[i])

                ctx.beginPath()
                ctx.moveTo(points[0].x, points[0].y)
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y)
                }
                ctx.closePath()

                ctx.fillStyle = face.color
                ctx.fill()

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
                ctx.lineWidth = 2
                ctx.stroke()

                // Draw face label in center
                const labelX = points.reduce((sum, p) => sum + p.x, 0) / 4
                const labelY = points.reduce((sum, p) => sum + p.y, 0) / 4
                ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
                ctx.font = 'bold 12px monospace'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillText(face.label, labelX, labelY)
            })

            // Draw coordinate axes from center
            const axisLen = 0.6
            const axes = [
                { dir: { x: axisLen, y: 0, z: 0 }, color: '#ef4444', label: 'X' },
                { dir: { x: 0, y: axisLen, z: 0 }, color: '#22c55e', label: 'Y' },
                { dir: { x: 0, y: 0, z: axisLen }, color: '#3b82f6', label: 'Z' }
            ]

            const origin = applyAllRotations({ x: 0, y: 0, z: 0 })
            const projOrigin = project(origin, width, height)

            axes.forEach((axis) => {
                const end = applyAllRotations(axis.dir)
                const projEnd = project(end, width, height)

                ctx.strokeStyle = axis.color
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.moveTo(projOrigin.x, projOrigin.y)
                ctx.lineTo(projEnd.x, projEnd.y)
                ctx.stroke()

                // Arrow head
                const angle = Math.atan2(projEnd.y - projOrigin.y, projEnd.x - projOrigin.x)
                const headLen = 8
                ctx.beginPath()
                ctx.moveTo(projEnd.x, projEnd.y)
                ctx.lineTo(
                    projEnd.x - headLen * Math.cos(angle - Math.PI / 6),
                    projEnd.y - headLen * Math.sin(angle - Math.PI / 6)
                )
                ctx.moveTo(projEnd.x, projEnd.y)
                ctx.lineTo(
                    projEnd.x - headLen * Math.cos(angle + Math.PI / 6),
                    projEnd.y - headLen * Math.sin(angle + Math.PI / 6)
                )
                ctx.stroke()

                // Axis label
                ctx.fillStyle = axis.color
                ctx.font = 'bold 10px monospace'
                ctx.fillText(axis.label, projEnd.x + 8, projEnd.y + 3)
            })
        },
        [applyRotations, rotateX, rotateY, project]
    )

    useEffect(() => {
        if (showSkeleton || !canvasRef.current) {
            return
        }

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) {
            return
        }

        const resize = () => {
            const rect = canvas.getBoundingClientRect()
            const dpr = window.devicePixelRatio || 1
            canvas.width = rect.width * dpr
            canvas.height = rect.height * dpr
            ctx.scale(dpr, dpr)
            draw(ctx, rect.width, rect.height, latest?.roll ?? 0, latest?.pitch ?? 0, latest?.yaw ?? 0)
        }

        resize()

        const observer = new ResizeObserver(resize)
        observer.observe(canvas)

        return () => {
            observer.disconnect()
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
            }
        }
    }, [showSkeleton, draw, latest?.roll, latest?.pitch, latest?.yaw])

    return (
        <Container
            title='Attitude — 3D View'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '280px', width: '100%' }} />}
            <div
                className={styles.content}
                style={{ display: showSkeleton ? 'none' : 'flex' }}
            >
                <canvas
                    ref={canvasRef}
                    className={styles.canvas}
                />
                <div className={styles.values}>
                    <div className={styles.axis}>
                        <span className={styles.axisLabel}>Roll (X)</span>
                        <span className={styles.axisValue}>{latest?.roll?.toFixed(1) ?? '—'}°</span>
                    </div>
                    <div className={styles.axis}>
                        <span className={styles.axisLabel}>Pitch (Y)</span>
                        <span className={styles.axisValue}>{latest?.pitch?.toFixed(1) ?? '—'}°</span>
                    </div>
                    <div className={styles.axis}>
                        <span className={styles.axisLabel}>Yaw (Z)</span>
                        <span className={styles.axisValue}>{latest?.yaw?.toFixed(1) ?? '—'}°</span>
                    </div>
                </div>
                <div className={styles.legend}>
                    <div className={styles.legendItem}>
                        <span
                            className={styles.legendColor}
                            style={{ background: '#ef4444' }}
                        />
                        <span>X axis</span>
                    </div>
                    <div className={styles.legendItem}>
                        <span
                            className={styles.legendColor}
                            style={{ background: '#22c55e' }}
                        />
                        <span>Y axis</span>
                    </div>
                    <div className={styles.legendItem}>
                        <span
                            className={styles.legendColor}
                            style={{ background: '#3b82f6' }}
                        />
                        <span>Z axis</span>
                    </div>
                </div>
            </div>
        </Container>
    )
})

AttitudeIndicator.displayName = 'AttitudeIndicator'
export default AttitudeIndicator
