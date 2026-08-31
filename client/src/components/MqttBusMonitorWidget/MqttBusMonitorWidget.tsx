import React from 'react'
import { Container } from 'simple-react-ui-kit'

import type { LiveState } from '../../features/telemetry/types'
import { chartColors } from '../../styles/chartColors'
import type { SubsystemKey } from '../../utils/subsystemStatus'
import { getSubsystemStatuses } from '../../utils/subsystemStatus'

import styles from './MqttBusMonitorWidget.module.scss'

interface NodeDef {
    label: string
    y: number
    color: string
    /** Whether this publisher has actually been heard from. */
    heard: (live: LiveState) => boolean
    /** The subsystem this node is, so OBC's verdict can grey out what the
     *  profile never started. HOSTD and DASHBOARD have no key: OBC does not
     *  watch them, and this page arriving proves DASHBOARD by itself. */
    key?: SubsystemKey
}

/**
 * The bus, as it really is.
 *
 * These are the services on the satellite and the topics they publish, and a
 * node is lit only when something has arrived from it — so the diagram says
 * what is on the air rather than decorating the page with a fixed picture. The
 * old right-hand column named a `CLOUD` node: there is no cloud, and the
 * ground station is this page.
 *
 * A service the profile never started is drawn grey and still, not dim: its
 * silence is the profile working, and a pulsing line out of a stopped unit
 * would be the diagram inventing traffic.
 */
const LEFT_NODES: NodeDef[] = [
    { label: 'EPS', y: 40, color: chartColors.blue[0], heard: (l) => l.eps != null, key: 'EPS' },
    { label: 'PAYLOAD', y: 84, color: chartColors.blue[0], heard: (l) => l.payload != null, key: 'PAYLOAD' },
    { label: 'ADCS', y: 128, color: chartColors.green[0], heard: (l) => l.adcs != null, key: 'ADCS' },
    { label: 'DHS', y: 172, color: chartColors.amber[0], heard: (l) => l.dhs != null, key: 'DHS' }
]

const RIGHT_NODES: NodeDef[] = [
    { label: 'OBC', y: 40, color: chartColors.green[0], heard: (l) => l.obc != null, key: 'OBC' },
    { label: 'HOSTD', y: 84, color: chartColors.blue[0], heard: (l) => l.host != null },
    { label: 'COMMS', y: 128, color: chartColors.amber[0], heard: (l) => l.comms != null, key: 'COMMS' },
    { label: 'DASHBOARD', y: 172, color: chartColors.red[0], heard: () => true }
]

const HUB_X = 220
const HUB_Y = 106
const HUB_SIZE = 76

const CHIP_WIDTH = 128
const CHIP_HEIGHT = 32
const LEFT_CHIP_X = 8
const RIGHT_CHIP_X = 304

const OFF_STROKE = 'var(--text-color-secondary)'

/** Smooth S-curve from a leaf node's dot to the hub's edge, echoing the reference design's flowing bus lines. */
const curvePath = (fromX: number, fromY: number, toX: number, toY: number): string => {
    const midX = (fromX + toX) / 2
    return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`
}

/** Spread each of the 4 lines to a different point along the hub's edge instead of one shared corner, so they fan in/out visibly rather than converging on a single spot. */
const hubEdgeY = (index: number, count: number): number => HUB_Y + (index - (count - 1) / 2) * 16

const NodeChip: React.FC<{ node: NodeDef; x: number; dotX: number; align: 'left' | 'right'; off: boolean }> = ({
    node,
    x,
    dotX,
    align,
    off
}) => (
    <g>
        <rect
            x={x}
            y={node.y - CHIP_HEIGHT / 2}
            width={CHIP_WIDTH}
            height={CHIP_HEIGHT}
            rx={6}
            className={styles.chip}
        />
        <text
            x={x + CHIP_WIDTH / 2}
            y={node.y + 4}
            textAnchor='middle'
            className={off ? styles.chipLabelOff : styles.chipLabel}
        >
            {node.label}
        </text>
        <circle
            cx={dotX}
            cy={node.y}
            r={4}
            fill={off ? OFF_STROKE : node.color}
            className={off ? styles.dotOff : align === 'left' ? styles.dotLeft : styles.dotRight}
        />
    </g>
)

/** Small isometric cube icon standing in for the satellite hub, echoing the reference design. */
const CubeIcon: React.FC = () => (
    <g transform={`translate(${HUB_X}, ${HUB_Y})`}>
        <polygon
            points='0,-22 22,-11 0,0 -22,-11'
            className={styles.cubeTop}
        />
        <polygon
            points='-22,-11 0,0 0,24 -22,13'
            className={styles.cubeLeft}
        />
        <polygon
            points='22,-11 0,0 0,24 22,13'
            className={styles.cubeRight}
        />
    </g>
)

interface Props {
    live: LiveState
}

const MqttBusMonitorWidget: React.FC<Props> = React.memo(({ live }) => {
    // OBC's verdict, the same one the Subsystem Status widget renders: OFF is
    // "the profile never started it", which is not the same picture as "not
    // heard from yet" — one is grey and still, the other dim and waiting.
    const verdicts = new Map(getSubsystemStatuses(live).map((s) => [s.key, s.status]))
    const isOff = (node: NodeDef) => node.key != null && verdicts.get(node.key) === 'OFF'

    const line = (node: NodeDef, index: number, d: string) => {
        const off = isOff(node)
        return (
            <path
                key={node.label}
                d={d}
                className={off ? styles.pulseLineOff : styles.pulseLine}
                style={{
                    stroke: off ? OFF_STROKE : node.color,
                    animationDelay: `${index * 0.3}s`,
                    opacity: off ? 0.5 : node.heard(live) ? 1 : 0.25
                }}
            />
        )
    }

    return (
        <Container
            title='MQTT Bus Monitor'
            className={styles.panel}
        >
            <svg
                viewBox='0 0 440 196'
                preserveAspectRatio='none'
                className={styles.diagram}
            >
                {LEFT_NODES.map((node, i) =>
                    line(
                        node,
                        i,
                        curvePath(
                            LEFT_CHIP_X + CHIP_WIDTH + 4,
                            node.y,
                            HUB_X - HUB_SIZE / 2,
                            hubEdgeY(i, LEFT_NODES.length)
                        )
                    )
                )}
                {RIGHT_NODES.map((node, i) =>
                    line(
                        node,
                        i,
                        curvePath(HUB_X + HUB_SIZE / 2, hubEdgeY(i, RIGHT_NODES.length), RIGHT_CHIP_X - 4, node.y)
                    )
                )}

                <rect
                    x={HUB_X - HUB_SIZE / 2}
                    y={HUB_Y - HUB_SIZE / 2}
                    width={HUB_SIZE}
                    height={HUB_SIZE}
                    rx={10}
                    className={styles.hubBox}
                />
                <CubeIcon />
                <text
                    x={HUB_X}
                    y={HUB_Y + HUB_SIZE / 2 + 16}
                    textAnchor='middle'
                    className={styles.hubLabel}
                >
                    CubeSat
                </text>

                {LEFT_NODES.map((node) => (
                    <NodeChip
                        key={node.label}
                        node={node}
                        x={LEFT_CHIP_X}
                        dotX={LEFT_CHIP_X + CHIP_WIDTH}
                        align='left'
                        off={isOff(node)}
                    />
                ))}
                {RIGHT_NODES.map((node) => (
                    <NodeChip
                        key={node.label}
                        node={node}
                        x={RIGHT_CHIP_X}
                        dotX={RIGHT_CHIP_X}
                        align='right'
                        off={isOff(node)}
                    />
                ))}
            </svg>
            <div className={styles.legend}>
                <span className={styles.legendItem}>
                    <span
                        className={styles.legendDot}
                        style={{ background: chartColors.green[0] }}
                    />
                    Telemetry
                </span>
                <span className={styles.legendItem}>
                    <span
                        className={styles.legendDot}
                        style={{ background: chartColors.blue[0] }}
                    />
                    Status
                </span>
                <span className={styles.legendItem}>
                    <span
                        className={styles.legendDot}
                        style={{ background: chartColors.amber[0] }}
                    />
                    Commands
                </span>
                <span className={styles.legendItem}>
                    <span
                        className={styles.legendDot}
                        style={{ background: chartColors.red[0] }}
                    />
                    Events
                </span>
            </div>
        </Container>
    )
})

MqttBusMonitorWidget.displayName = 'MqttBusMonitorWidget'
export default MqttBusMonitorWidget
