import type { TelemetryRecord } from '../features/telemetry/types'

export type StatusLevel = 'OK' | 'WARN' | 'CRITICAL' | 'UNKNOWN'

export type SubsystemKey = 'OBC' | 'EPS' | 'ADCS' | 'PAYLOAD' | 'COMMS'

export interface SubsystemStatus {
    key: SubsystemKey
    label: string
    status: StatusLevel
}

const isNil = (v: number | null | undefined): boolean => v == null

/** Worse-of comparator: CRITICAL > WARN > OK > UNKNOWN. */
const worse = (a: StatusLevel, b: StatusLevel): StatusLevel => {
    const rank: Record<StatusLevel, number> = { UNKNOWN: 0, OK: 1, WARN: 2, CRITICAL: 3 }
    return rank[a] >= rank[b] ? a : b
}

export const getEpsStatus = (r: TelemetryRecord | null): StatusLevel => {
    if (!r || isNil(r.battery)) {
        return 'UNKNOWN'
    }
    if (r.battery! < 15) {
        return 'CRITICAL'
    }
    if (r.battery! < 30) {
        return 'WARN'
    }
    return 'OK'
}

export const getAdcsStatus = (r: TelemetryRecord | null): StatusLevel => {
    if (!r || isNil(r.gyro_x) || isNil(r.gyro_y) || isNil(r.gyro_z)) {
        return 'UNKNOWN'
    }
    const maxRate = Math.max(Math.abs(r.gyro_x!), Math.abs(r.gyro_y!), Math.abs(r.gyro_z!))
    if (maxRate > 5) {
        return 'CRITICAL'
    }
    if (maxRate > 1) {
        return 'WARN'
    }
    return 'OK'
}

export const getObcStatus = (r: TelemetryRecord | null): StatusLevel => {
    if (!r || isNil(r.cpu_percent) || isNil(r.ram_percent)) {
        return 'UNKNOWN'
    }
    const cpu = r.cpu_percent!
    const ram = r.ram_percent!
    if (cpu > 95 || ram > 95) {
        return 'CRITICAL'
    }
    if (cpu > 85 || ram > 85) {
        return 'WARN'
    }
    return 'OK'
}

const HEALTHY_STATUS_STRINGS = new Set(['NOMINAL', 'READY', 'OK'])

export const getPayloadStatus = (r: TelemetryRecord | null): StatusLevel => {
    if (!r || (r.sensor_status == null && r.camera_status == null)) {
        return 'UNKNOWN'
    }
    const sensorOk = r.sensor_status == null || HEALTHY_STATUS_STRINGS.has(r.sensor_status)
    const cameraOk = r.camera_status == null || HEALTHY_STATUS_STRINGS.has(r.camera_status)
    return sensorOk && cameraOk ? 'OK' : 'WARN'
}

export const getCommsStatus = (r: TelemetryRecord | null): StatusLevel => {
    if (!r || isNil(r.packet_loss_pct)) {
        return 'UNKNOWN'
    }
    if (r.packet_loss_pct! > 5) {
        return 'CRITICAL'
    }
    if (r.packet_loss_pct! > 2) {
        return 'WARN'
    }
    return 'OK'
}

export const getSubsystemStatuses = (r: TelemetryRecord | null): SubsystemStatus[] => [
    { key: 'OBC', label: 'OBC', status: getObcStatus(r) },
    { key: 'EPS', label: 'EPS', status: getEpsStatus(r) },
    { key: 'ADCS', label: 'ADCS', status: getAdcsStatus(r) },
    { key: 'PAYLOAD', label: 'PAYLOAD', status: getPayloadStatus(r) },
    { key: 'COMMS', label: 'COMMS', status: getCommsStatus(r) }
]

/** Overall mission status = the worst of all subsystem statuses, mapped to a display label. */
export const getMissionStatus = (r: TelemetryRecord | null): 'NOMINAL' | 'WARNING' | 'CRITICAL' | 'UNKNOWN' => {
    const overall = getSubsystemStatuses(r).reduce<StatusLevel>((acc, s) => worse(acc, s.status), 'UNKNOWN')
    switch (overall) {
        case 'CRITICAL':
            return 'CRITICAL'
        case 'WARN':
            return 'WARNING'
        case 'OK':
            return 'NOMINAL'
        case 'UNKNOWN':
            return 'UNKNOWN'
    }
}
