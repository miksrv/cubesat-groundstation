/**
 * Chart Tooltip Configuration for ECharts
 * Provides consistent styled tooltips across all charts
 */

import type { TooltipComponentOption } from 'echarts'

/**
 * Format date for tooltip display
 * @param date - Date object or timestamp
 * @param format - 'full' | 'time' | 'date'
 */
export const formatTooltipDate = (date: Date | number, format: 'full' | 'time' | 'date' = 'full'): string => {
    const d = date instanceof Date ? date : new Date(date)

    const pad = (n: number) => n.toString().padStart(2, '0')

    const day = pad(d.getDate())
    const month = pad(d.getMonth() + 1)
    const year = d.getFullYear()
    const hours = pad(d.getHours())
    const minutes = pad(d.getMinutes())
    const seconds = pad(d.getSeconds())

    switch (format) {
        case 'time':
            return `${hours}:${minutes}:${seconds}`
        case 'date':
            return `${day}.${month}.${year}`
        case 'full':
        default:
            return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`
    }
}

/**
 * CSS styles for tooltip (injected inline)
 */
const tooltipStyles = {
    container: `
        font-family: 'Inter', -apple-system, system-ui, sans-serif;
        padding: 4px 2px;
        min-width: 140px;
    `,
    title: `
        font-size: 11px;
        font-weight: 600;
        color: #e2e8f0;
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid #334155;
    `,
    item: `
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 4px 0;
        font-size: 11px;
    `,
    icon: `
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 2px;
        margin-right: 6px;
        flex-shrink: 0;
    `,
    label: `
        color: #94a3b8;
        display: flex;
        align-items: center;
        flex: 1;
    `,
    value: `
        color: #e2e8f0;
        font-weight: 500;
        margin-left: 12px;
        font-variant-numeric: tabular-nums;
    `
}

interface TooltipParam {
    axisValue?: string | number
    axisValueLabel?: string
    seriesName?: string
    value?: [unknown, number | null]
    color?: string
    marker?: string
}

/**
 * Creates a formatted tooltip configuration for ECharts
 * @param options - Optional configuration
 */
export const createChartTooltip = (options?: {
    dateFormat?: 'full' | 'time' | 'date'
    valueFormatter?: (value: number | null, seriesName: string) => string
}): TooltipComponentOption => {
    const { dateFormat = 'full', valueFormatter } = options || {}

    return {
        trigger: 'axis',
        backgroundColor: '#1e293b',
        borderColor: '#334155',
        borderWidth: 1,
        padding: [8, 12],
        textStyle: {
            color: '#e2e8f0',
            fontSize: 11
        },
        axisPointer: {
            type: 'cross',
            label: {
                backgroundColor: '#334155',
                color: '#e2e8f0',
                fontSize: 10,
                formatter: (params: { axisDimension?: string; value?: number }) => {
                    if (params?.axisDimension === 'x' && params?.value) {
                        return formatTooltipDate(params.value, dateFormat)
                    }
                    return params?.value != null ? params.value.toFixed(2) : ''
                }
            },
            lineStyle: {
                color: '#475569',
                type: 'dashed'
            },
            crossStyle: {
                color: '#475569'
            }
        },
        formatter: (params: TooltipParam | TooltipParam[]) => {
            const items = Array.isArray(params) ? params : [params]
            if (items.length === 0) return ''

            const content: string[] = []

            // Header with formatted date
            const firstParam = items[0]
            let headerDate = ''
            if (firstParam.axisValue) {
                headerDate = formatTooltipDate(
                    typeof firstParam.axisValue === 'number' 
                        ? firstParam.axisValue 
                        : new Date(firstParam.axisValue),
                    dateFormat
                )
            } else if (firstParam.axisValueLabel) {
                headerDate = firstParam.axisValueLabel
            }

            content.push(`<div style="${tooltipStyles.container}">`)
            content.push(`<div style="${tooltipStyles.title}">${headerDate}</div>`)

            // Data rows
            items.forEach((item) => {
                const color = item.color || '#64748b'
                const value = item.value?.[1]
                const formattedValue = valueFormatter 
                    ? valueFormatter(value ?? null, item.seriesName || '')
                    : (value != null ? value.toFixed(2) : '—')

                content.push(`
                    <div style="${tooltipStyles.item}">
                        <span style="${tooltipStyles.label}">
                            <span style="${tooltipStyles.icon} background-color: ${color};"></span>
                            ${item.seriesName || ''}
                        </span>
                        <span style="${tooltipStyles.value}">${formattedValue}</span>
                    </div>
                `)
            })

            content.push('</div>')
            return content.join('')
        }
    }
}

/**
 * Value formatters for common units
 */
export const valueFormatters = {
    percent: (v: number | null) => (v != null ? `${v.toFixed(1)}%` : '—'),
    temperature: (v: number | null) => (v != null ? `${v.toFixed(1)}°C` : '—'),
    voltage: (v: number | null) => (v != null ? `${v.toFixed(2)}V` : '—'),
    pressure: (v: number | null) => (v != null ? `${v.toFixed(1)} hPa` : '—'),
    degrees: (v: number | null) => (v != null ? `${v.toFixed(1)}°` : '—'),
    generic: (v: number | null) => (v != null ? v.toFixed(2) : '—')
}

