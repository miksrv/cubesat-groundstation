import React from 'react'
import { Container } from 'simple-react-ui-kit'

import { chartColors } from '../../styles/chartColors'

import styles from './MqttBusMonitorWidget.module.scss'

interface NodeDef {
    label: string
    y: number
    color: string
}

const LEFT_NODES: NodeDef[] = [
    { label: 'EPS', y: 40, color: chartColors.blue[0] },
    { label: 'PAYLOAD', y: 84, color: chartColors.blue[0] },
    { label: 'ADCS', y: 128, color: chartColors.green[0] },
    { label: 'SENSORS', y: 172, color: chartColors.amber[0] }
]

const RIGHT_NODES: NodeDef[] = [
    { label: 'TELEMETRY', y: 40, color: chartColors.green[0] },
    { label: 'GROUND STATION', y: 84, color: chartColors.blue[0] },
    { label: 'CLOUD', y: 128, color: chartColors.amber[0] },
    { label: 'COMMANDS', y: 172, color: chartColors.red[0] }
]

const HUB_X = 220
const HUB_Y = 106
const HUB_SIZE = 76

const CHIP_WIDTH = 128
const CHIP_HEIGHT = 32
const LEFT_CHIP_X = 8
const RIGHT_CHIP_X = 304

/** Smooth S-curve from a leaf node's dot to the hub's edge, echoing the reference design's flowing bus lines. */
const curvePath = (fromX: number, fromY: number, toX: number, toY: number): string => {
    const midX = (fromX + toX) / 2
    return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`
}

/** Spread each of the 4 lines to a different point along the hub's edge instead of one shared corner, so they fan in/out visibly rather than converging on a single spot. */
const hubEdgeY = (index: number, count: number): number => HUB_Y + (index - (count - 1) / 2) * 16

const NodeChip: React.FC<{ node: NodeDef; x: number; dotX: number; align: 'left' | 'right' }> = ({
    node,
    x,
    dotX,
    align
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
            className={styles.chipLabel}
        >
            {node.label}
        </text>
        <circle
            cx={dotX}
            cy={node.y}
            r={4}
            fill={node.color}
            className={align === 'left' ? styles.dotLeft : styles.dotRight}
        />
    </g>
)

/** Small isometric cube icon standing in for the OBC hub, echoing the reference design. */
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

const MqttBusMonitorWidget: React.FC = React.memo(() => (
    <Container
        title='MQTT Bus Monitor'
        className={styles.panel}
    >
        <svg
            viewBox='0 0 440 196'
            preserveAspectRatio='none'
            className={styles.diagram}
        >
            {LEFT_NODES.map((node, i) => (
                <path
                    key={`l-${node.label}`}
                    d={curvePath(
                        LEFT_CHIP_X + CHIP_WIDTH + 4,
                        node.y,
                        HUB_X - HUB_SIZE / 2,
                        hubEdgeY(i, LEFT_NODES.length)
                    )}
                    className={styles.pulseLine}
                    style={{ stroke: node.color, animationDelay: `${i * 0.3}s` }}
                />
            ))}
            {RIGHT_NODES.map((node, i) => (
                <path
                    key={`r-${node.label}`}
                    d={curvePath(HUB_X + HUB_SIZE / 2, hubEdgeY(i, RIGHT_NODES.length), RIGHT_CHIP_X - 4, node.y)}
                    className={styles.pulseLine}
                    style={{ stroke: node.color, animationDelay: `${i * 0.3 + 0.15}s` }}
                />
            ))}

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
                OBC
            </text>

            {LEFT_NODES.map((node) => (
                <NodeChip
                    key={node.label}
                    node={node}
                    x={LEFT_CHIP_X}
                    dotX={LEFT_CHIP_X + CHIP_WIDTH}
                    align='left'
                />
            ))}
            {RIGHT_NODES.map((node) => (
                <NodeChip
                    key={node.label}
                    node={node}
                    x={RIGHT_CHIP_X}
                    dotX={RIGHT_CHIP_X}
                    align='right'
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
))

MqttBusMonitorWidget.displayName = 'MqttBusMonitorWidget'
export default MqttBusMonitorWidget
