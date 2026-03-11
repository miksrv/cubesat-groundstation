<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * TelemetryModel
 *
 * Active-Record model for the `cubesat_telemetry` table. Provides helper
 * methods for inserting new telemetry rows and querying them by recency or
 * timestamp range. All column values map directly to the flat DB schema
 * produced by TelemetryController::store().
 *
 * @package App\Models
 */
class TelemetryModel extends Model
{
    protected $table      = 'cubesat_telemetry';
    protected $primaryKey = 'id';

    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;

    protected $allowedFields = [
        'timestamp',
        // EPS
        'battery',
        'voltage',
        'external_power',
        // ADCS
        'roll',
        'pitch',
        'yaw',
        'imu_temp',
        'accel_x',
        'accel_y',
        'accel_z',
        'gyro_x',
        'gyro_y',
        'gyro_z',
        // Payload
        'temperature',
        'humidity',
        'pressure',
        // System
        'cpu_percent',
        'ram_percent',
        'swap_percent',
        'disk_percent',
        'uptime_seconds',
        'cpu_temperature',
        // OBC
        'obc_state',
        // GPS
        'latitude',
        'longitude',
        'altitude',
        // Raw
        'raw_json',
    ];

    protected $useTimestamps = false;

    /**
     * Insert a new telemetry record.
     *
     * @param array $data Flattened telemetry data matching DB columns
     * @return int|false The insert ID, or false on failure
     */
    public function insertTelemetry(array $data)
    {
        return $this->insert($data, true);
    }

    /**
     * Return the most recent telemetry record.
     *
     * @return array|null
     */
    public function getLatest(): ?array
    {
        return $this->orderBy('timestamp', 'DESC')
                    ->first();
    }

    /**
     * Return the last N telemetry records ordered newest first.
     *
     * @param int $limit Number of records to return (default 100)
     * @return array
     */
    public function getHistory(int $limit = 100): array
    {
        return $this->orderBy('timestamp', 'DESC')
                    ->limit($limit)
                    ->findAll();
    }

    /**
     * Return records within a timestamp range (inclusive).
     *
     * @param string $from ISO8601 start datetime
     * @param string $to   ISO8601 end datetime
     * @return array
     */
    public function getRange(string $from, string $to): array
    {
        return $this->where('timestamp >=', $from)
                    ->where('timestamp <=', $to)
                    ->orderBy('timestamp', 'ASC')
                    ->findAll();
    }
}
