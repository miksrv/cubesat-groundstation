/**
 * Chart Color Palette for ECharts
 * Space/Cosmic Theme for CubeSat Ground Station
 *
 * Each color has two variants:
 * - [0]: Primary color
 * - [1]: Secondary/hover color
 *
 * Usage: chartColors.blue[0] for primary, chartColors.blue[1] for secondary
 */
export const chartColors = {
    // Deep space blues
    deepSpace: ['#0f172a', '#1e293b'],
    nebula: ['#312e81', '#4338ca'],

    // Cosmic accent colors
    plasma: ['#06b6d4', '#22d3ee'],
    aurora: ['#10b981', '#34d399'],
    stellar: ['#3b82f6', '#60a5fa'],
    cosmic: ['#8b5cf6', '#a78bfa'],
    nova: ['#f43f5e', '#fb7185'],
    solar: ['#f59e0b', '#fbbf24'],

    // Signal/Data indicators
    signal: ['#22c55e', '#4ade80'],
    warning: ['#eab308', '#facc15'],
    critical: ['#ef4444', '#f87171'],
    inactive: ['#64748b', '#94a3b8'],

    // Primary UI colors
    blue: ['#3b82f6', '#60a5fa'],
    cyan: ['#06b6d4', '#22d3ee'],
    teal: ['#14b8a6', '#2dd4bf'],
    green: ['#22c55e', '#4ade80'],
    lime: ['#84cc16', '#a3e635'],
    yellow: ['#eab308', '#facc15'],
    orange: ['#f97316', '#fb923c'],
    red: ['#ef4444', '#f87171'],
    pink: ['#ec4899', '#f472b6'],
    magenta: ['#d946ef', '#e879f9'],
    purple: ['#a855f7', '#c084fc'],
    violet: ['#8b5cf6', '#a78bfa'],

    // Neutral tones
    slate: ['#475569', '#64748b'],
    grey: ['#6b7280', '#9ca3af']
} as const

export type ChartColorKey = keyof typeof chartColors
