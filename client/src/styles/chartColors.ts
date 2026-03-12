/**
 * Chart Color Palette for ECharts
 *
 * Each color has two variants:
 * - [0]: Primary color
 * - [1]: Secondary/hover color
 *
 * Usage: chartColors.blue[0] for primary, chartColors.blue[1] for secondary
 */
export const chartColors = {
    brown: ['#795548', '#8d6e63'],
    navy: ['#283593', '#3f51b5'],
    violet: ['#8c1fc9', '#a23de3'],
    purple: ['#7d2ae8', '#9146ff'],
    magenta: ['#c2185b', '#db3c7f'],
    pink: ['#e91e63', '#ff5b85'],
    red: ['#e53935', '#f25755'],
    orange: ['#ff5722', '#ff7043'],
    yellow: ['#ffeb3b', '#fff176'],
    lime: ['#cddc39', '#d4e157'],
    olive: ['#8c9e35', '#a3b236'],
    green: ['#4caf50', '#66bb6a'],
    teal: ['#009688', '#26a69a'],
    blue: ['#2c7eec', '#468de8'],
    lightblue: ['#2196f3', '#42a5f5'],
    cyan: ['#00bcd4', '#4dd0e1'],
    air: ['#8dbdef', '#9bc4f5'],
    grey: ['#607d8b', '#78909c']
} as const

export type ChartColorKey = keyof typeof chartColors
