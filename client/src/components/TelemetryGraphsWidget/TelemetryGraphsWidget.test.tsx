import * as echarts from 'echarts'

import { mockTelemetryRecord } from '../../test-fixtures'
import { render, screen } from '../../test-utils'

import TelemetryGraphsWidget from './TelemetryGraphsWidget'

import '@testing-library/jest-dom'

jest.mock('echarts', () => ({
    init: jest.fn(() => ({
        setOption: jest.fn(),
        resize: jest.fn(),
        dispose: jest.fn()
    }))
}))

global.ResizeObserver = jest.fn(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
}))

describe('TelemetryGraphsWidget', () => {
    it('renders all four mini chart titles', () => {
        render(
            <TelemetryGraphsWidget
                history={[mockTelemetryRecord]}
                isLoading={false}
            />
        )
        expect(screen.getByText('Battery Voltage')).toBeInTheDocument()
        // Named for its sensor: `temperature` is the SEN0501's air reading,
        // not the SoC die and not the IMU's.
        expect(screen.getByText('Temperature (SEN0501)')).toBeInTheDocument()
        // RSSI is gone: nothing on this satellite measures signal strength as
        // telemetry. Battery charge is a real series and the one an operator
        // watches on a walk.
        expect(screen.getByText('Battery')).toBeInTheDocument()
        expect(screen.getByText('CPU Usage')).toBeInTheDocument()
    })

    it('charts the newest rows in chronological order, with nulls left as gaps', () => {
        // Two past defects in one assertion: `slice(-50)` on a newest-first
        // array once charted the *oldest* rows, and `?? 0` drew a withheld
        // reading as a dive to zero.
        ;(echarts.init as jest.Mock).mockClear()
        const history = [
            { ...mockTelemetryRecord, id: 3, timestamp: '2026-08-24T07:13:03Z', voltage: null },
            { ...mockTelemetryRecord, id: 2, timestamp: '2026-08-24T07:12:33Z', voltage: 4.1 },
            { ...mockTelemetryRecord, id: 1, timestamp: '2026-08-24T07:12:03Z', voltage: 4.2 }
        ]
        render(
            <TelemetryGraphsWidget
                history={history}
                isLoading={false}
            />
        )
        // The first chart initialised is Battery Voltage.
        const chart = (echarts.init as jest.Mock).mock.results[0].value
        const option = chart.setOption.mock.calls[0][0]
        const data = option.series[0].data as Array<[Date, number | null]>
        expect(data.map(([, value]) => value)).toEqual([4.2, 4.1, null])
        expect(data[0][0].getTime()).toBeLessThan(data[1][0].getTime())
    })

    it('thins the time axis instead of stacking a label per sample', () => {
        // Four charts share the card's width, so a label per sample smears into
        // an unreadable band. `hideOverlap` is what actually drops the
        // colliding ones; `splitNumber` only asks for few ticks.
        ;(echarts.init as jest.Mock).mockClear()
        const history = Array.from({ length: 50 }, (_, i) => ({
            ...mockTelemetryRecord,
            id: 50 - i,
            timestamp: new Date(Date.UTC(2026, 7, 24, 7, 12, 3) + (49 - i) * 30_000).toISOString()
        }))
        render(
            <TelemetryGraphsWidget
                history={history}
                isLoading={false}
            />
        )
        const chart = (echarts.init as jest.Mock).mock.results[0].value
        const xAxis = chart.setOption.mock.calls[0][0].xAxis
        expect(xAxis.axisLabel.hideOverlap).toBe(true)
        expect(xAxis.splitNumber).toBe(3)
    })

    it('drops the seconds once the window is wider than a few minutes', () => {
        ;(echarts.init as jest.Mock).mockClear()
        // 50 rows a quarter-hour apart: a window of ~12 h, where printing the
        // seconds costs width and says nothing.
        const history = Array.from({ length: 50 }, (_, i) => ({
            ...mockTelemetryRecord,
            id: 50 - i,
            timestamp: new Date(Date.UTC(2026, 7, 24, 0, 0, 0) + (49 - i) * 15 * 60_000).toISOString()
        }))
        render(
            <TelemetryGraphsWidget
                history={history}
                isLoading={false}
            />
        )
        const chart = (echarts.init as jest.Mock).mock.results[0].value
        expect(chart.setOption.mock.calls[0][0].xAxis.axisLabel.formatter).toBe('{HH}:{mm}')
    })

    it('names each series after its chart, so the tooltip is not "series0"', () => {
        ;(echarts.init as jest.Mock).mockClear()
        render(
            <TelemetryGraphsWidget
                history={[mockTelemetryRecord]}
                isLoading={false}
            />
        )
        const names = (echarts.init as jest.Mock).mock.results.map(
            (r) => r.value.setOption.mock.calls[0][0].series[0].name
        )
        expect(names).toEqual(['Battery Voltage', 'Temperature (SEN0501)', 'Battery', 'CPU Usage'])
    })

    it('shows skeleton when loading with empty history', () => {
        const { container } = render(
            <TelemetryGraphsWidget
                history={[]}
                isLoading={true}
            />
        )
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
    })
})
