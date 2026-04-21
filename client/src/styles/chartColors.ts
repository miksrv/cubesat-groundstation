/**
 * Chart Color Palette for ECharts
 * Command Center Theme — muted operational colors
 */
export const chartColors = {
    // Operational signal colors
    signal: ['#22c55e', '#4ade80'],
    warning: ['#f59e0b', '#fbbf24'],
    critical: ['#ef4444', '#f87171'],
    inactive: ['#333333', '#444444'],

    // Telemetry data palette
    cyan: ['#00b8d9', '#00d4f5'],
    green: ['#22c55e', '#4ade80'],
    amber: ['#f59e0b', '#fbbf24'],
    red: ['#ef4444', '#f87171'],
    blue: ['#3b82f6', '#60a5fa'],
    purple: ['#8b5cf6', '#a78bfa'],
    teal: ['#14b8a6', '#2dd4bf'],
    orange: ['#f97316', '#fb923c'],
    pink: ['#ec4899', '#f472b6'],
    lime: ['#84cc16', '#a3e635'],

    // Legacy aliases
    plasma: ['#00b8d9', '#22d3ee'],
    aurora: ['#22c55e', '#4ade80'],
    stellar: ['#3b82f6', '#60a5fa'],
    cosmic: ['#8b5cf6', '#a78bfa'],
    nova: ['#ef4444', '#f87171'],
    solar: ['#f59e0b', '#fbbf24'],

    // Neutral
    slate: ['#334155', '#475569'],
    grey: ['#2a2a2a', '#3a3a3a'],
    deepSpace: ['#0a0a0a', '#111111'],
    nebula: ['#1a1a2e', '#16213e']
} as const

export type ChartColorKey = keyof typeof chartColors
