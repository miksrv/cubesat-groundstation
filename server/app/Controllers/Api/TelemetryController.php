<?php

namespace App\Controllers\Api;

use App\Models\EventModel;
use App\Models\TelemetryModel;
use App\Services\DemoDataService;
use App\Services\DemoStateService;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;

/**
 * TelemetryController
 *
 * Handles ingestion and retrieval of CubeSat telemetry data transmitted by
 * the satellite every 30 seconds. The controller validates incoming JSON
 * payloads, flattens the nested structure into database columns, and exposes
 * read endpoints for the frontend dashboard.
 *
 * Routes:
 *   POST   /api/cubesat/telemetry           -> store()
 *   GET    /api/cubesat/telemetry/latest     -> latest()
 *   GET    /api/cubesat/telemetry/history    -> history()
 *   GET    /api/cubesat/telemetry/range      -> range()
 *
 * @package App\Controllers\Api
 */
class TelemetryController extends ResourceController
{
    protected $modelName = TelemetryModel::class;
    protected $format    = 'json';

    /**
     * Store a new telemetry record.
     *
     * Accepts a JSON body containing nested telemetry subsystems (eps, adcs,
     * payload, system, obc, gps). Only `timestamp` is required; all subsystem
     * fields are optional. Flattens the nested structure into a single DB row
     * and persists it via TelemetryModel.
     *
     * Requires a valid API key passed via X-API-Key header for authentication.
     *
     * POST /api/cubesat/telemetry
     * Headers: X-API-Key: your-api-key
     *
     * @return \CodeIgniter\HTTP\ResponseInterface JSON response with status 201
     *         on success, 401 on invalid/missing API key, 400 on validation
     *         failure, 422 on malformed JSON, or 500 on a database error.
     */
    public function store()
    {
        // In demo mode, acknowledge the POST without touching the database
        if ($this->isDemoMode()) {
            return $this->response
                ->setStatusCode(200)
                ->setContentType('application/json')
                ->setJSON([
                    'status'  => 'demo',
                    'message' => 'Demo mode active, data not stored',
                ]);
        }

        // Validate API key from X-API-Key header
        $providedKey = $this->request->getHeaderLine('X-API-Key');
        $validKey    = getenv('api.telemetry.key');

        if (empty($validKey) || $providedKey !== $validKey) {
            return $this->response
                ->setStatusCode(401)
                ->setContentType('application/json')
                ->setJSON([
                    'error'   => 'Unauthorized',
                    'details' => ['Invalid or missing API key'],
                ]);
        }

        $body = $this->request->getBody();

        // 422 if body is not valid JSON
        $payload = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return $this->response
                ->setStatusCode(422)
                ->setContentType('application/json')
                ->setJSON([
                    'error'   => 'Invalid JSON payload',
                    'details' => [json_last_error_msg()],
                ]);
        }

        // Only timestamp is required, all subsystem fields are optional
        if (empty($payload['timestamp'])) {
            return $this->response
                ->setStatusCode(400)
                ->setContentType('application/json')
                ->setJSON([
                    'error'   => 'Validation failed',
                    'details' => ["The field 'timestamp' is required."],
                ]);
        }

        // Flatten nested JSON structure to flat DB columns
        $eps     = $payload['eps']     ?? [];
        $adcs    = $payload['adcs']    ?? [];
        $pld     = $payload['payload'] ?? [];
        $sys     = $payload['system']  ?? [];
        $thermal = $payload['thermal'] ?? [];
        $comms   = $payload['comms']   ?? [];
        $obc     = $payload['obc']     ?? [];
        $gps     = $payload['gps']     ?? [];

        $previousState = $this->model->getLatest()['obc_state'] ?? null;
        $newState      = $payload['obc_state'] ?? null;

        $data = [
            'timestamp'      => $payload['timestamp'],
            // EPS
            'battery'        => $eps['battery']        ?? null,
            'voltage'        => $eps['voltage']         ?? null,
            'external_power' => isset($eps['external_power']) ? (int) $eps['external_power'] : null,
            'battery_current'=> $eps['current']        ?? null,
            // ADCS
            'roll'           => $adcs['roll']           ?? null,
            'pitch'          => $adcs['pitch']          ?? null,
            'yaw'            => $adcs['yaw']            ?? null,
            'imu_temp'       => $adcs['imu_temp']       ?? null,
            'accel_x'        => $adcs['accel_g']['x']   ?? null,
            'accel_y'        => $adcs['accel_g']['y']   ?? null,
            'accel_z'        => $adcs['accel_g']['z']   ?? null,
            'gyro_x'         => $adcs['gyro_dps']['x']  ?? null,
            'gyro_y'         => $adcs['gyro_dps']['y']  ?? null,
            'gyro_z'         => $adcs['gyro_dps']['z']  ?? null,
            // Payload
            'temperature'         => $pld['temperature']      ?? null,
            'humidity'            => $pld['humidity']         ?? null,
            'pressure'            => $pld['pressure']         ?? null,
            'camera_status'       => $pld['camera_status']    ?? null,
            'image_count'         => $pld['image_count']      ?? null,
            'image_resolution'    => $pld['image_resolution'] ?? null,
            'sensor_status'       => $pld['sensor_status']    ?? null,
            'science_mode'        => isset($pld['science_mode']) ? (int) $pld['science_mode'] : null,
            'payload_power_watts' => $pld['power_watts']      ?? null,
            // System
            'cpu_percent'    => $sys['cpu_percent']     ?? null,
            'ram_percent'    => $sys['ram_percent']     ?? null,
            'swap_percent'   => $sys['swap_percent']    ?? null,
            'disk_percent'   => $sys['disk_percent']    ?? null,
            'uptime_seconds' => $sys['uptime_seconds']  ?? null,
            'cpu_temperature'=> $sys['cpu_temperature'] ?? null,
            'boot_count'     => $sys['boot_count']      ?? null,
            // Thermal
            'obc_temperature'     => $thermal['obc_temperature']     ?? null,
            'eps_temperature'     => $thermal['eps_temperature']     ?? null,
            'battery_temperature' => $thermal['battery_temperature'] ?? null,
            'payload_temperature' => $thermal['payload_temperature'] ?? null,
            // Comms
            'rssi'             => $comms['rssi']             ?? null,
            'snr'              => $comms['snr']              ?? null,
            'uplink_bps'       => $comms['uplink_bps']       ?? null,
            'downlink_bps'     => $comms['downlink_bps']     ?? null,
            'latency_ms'       => $comms['latency_ms']       ?? null,
            'packet_loss_pct'  => $comms['packet_loss_pct']  ?? null,

            'obc_state'      => $newState,
            // GPS
            'latitude'       => $gps['latitude']        ?? null,
            'longitude'      => $gps['longitude']       ?? null,
            'altitude'       => $gps['altitude']        ?? null,
            'speed_kms'      => $gps['speed_kms']       ?? null,
            // Raw backup
            'raw_json'       => $body,
        ];

        $insertId = $this->model->insertTelemetry($data);

        if ($insertId === false) {
            return $this->response
                ->setStatusCode(500)
                ->setContentType('application/json')
                ->setJSON(['error' => 'Failed to save telemetry data']);
        }

        if ($newState !== null && $newState !== $previousState) {
            (new EventModel())->logStateTransition($previousState, $newState, $payload['timestamp']);
        }

        return $this->response
            ->setStatusCode(201)
            ->setContentType('application/json')
            ->setJSON([
                'status'    => 'success',
                'id'        => $insertId,
                'message'   => 'Telemetry data saved',
            ]);
    }

    /**
     * Format a telemetry record with proper types.
     *
     * Converts string values from database to proper numeric types,
     * formats timestamp to ISO 8601 format, and excludes raw_json field.
     *
     * @param array $row Raw database row
     * @return array Formatted record with proper types
     */
    private function formatRecord(array $row): array
    {
        return [
            'id'              => (int) $row['id'],
            'timestamp'       => str_replace(' ', 'T', $row['timestamp']),
            // EPS
            'battery'         => $row['battery'] !== null ? (float) $row['battery'] : null,
            'voltage'         => $row['voltage'] !== null ? (float) $row['voltage'] : null,
            'external_power'  => $row['external_power'] !== null ? (int) $row['external_power'] : null,
            'battery_current' => $row['battery_current'] !== null ? (float) $row['battery_current'] : null,
            // ADCS
            'roll'            => $row['roll'] !== null ? (float) $row['roll'] : null,
            'pitch'           => $row['pitch'] !== null ? (float) $row['pitch'] : null,
            'yaw'             => $row['yaw'] !== null ? (float) $row['yaw'] : null,
            'imu_temp'        => $row['imu_temp'] !== null ? (float) $row['imu_temp'] : null,
            'accel_x'         => $row['accel_x'] !== null ? (float) $row['accel_x'] : null,
            'accel_y'         => $row['accel_y'] !== null ? (float) $row['accel_y'] : null,
            'accel_z'         => $row['accel_z'] !== null ? (float) $row['accel_z'] : null,
            'gyro_x'          => $row['gyro_x'] !== null ? (float) $row['gyro_x'] : null,
            'gyro_y'          => $row['gyro_y'] !== null ? (float) $row['gyro_y'] : null,
            'gyro_z'          => $row['gyro_z'] !== null ? (float) $row['gyro_z'] : null,
            // Payload
            'temperature'         => $row['temperature'] !== null ? (float) $row['temperature'] : null,
            'humidity'            => $row['humidity'] !== null ? (float) $row['humidity'] : null,
            'pressure'            => $row['pressure'] !== null ? (float) $row['pressure'] : null,
            'camera_status'       => $row['camera_status'] ?? null,
            'image_count'         => $row['image_count'] !== null ? (int) $row['image_count'] : null,
            'image_resolution'    => $row['image_resolution'] ?? null,
            'sensor_status'       => $row['sensor_status'] ?? null,
            'science_mode'        => isset($row['science_mode']) ? (bool) $row['science_mode'] : null,
            'payload_power_watts' => $row['payload_power_watts'] !== null ? (float) $row['payload_power_watts'] : null,
            // System
            'cpu_percent'     => $row['cpu_percent'] !== null ? (float) $row['cpu_percent'] : null,
            'ram_percent'     => $row['ram_percent'] !== null ? (float) $row['ram_percent'] : null,
            'swap_percent'    => $row['swap_percent'] !== null ? (float) $row['swap_percent'] : null,
            'disk_percent'    => $row['disk_percent'] !== null ? (float) $row['disk_percent'] : null,
            'uptime_seconds'  => $row['uptime_seconds'] !== null ? (int) $row['uptime_seconds'] : null,
            'cpu_temperature' => $row['cpu_temperature'] !== null ? (float) $row['cpu_temperature'] : null,
            'boot_count'      => $row['boot_count'] !== null ? (int) $row['boot_count'] : null,
            // Thermal
            'obc_temperature'     => $row['obc_temperature'] !== null ? (float) $row['obc_temperature'] : null,
            'eps_temperature'     => $row['eps_temperature'] !== null ? (float) $row['eps_temperature'] : null,
            'battery_temperature' => $row['battery_temperature'] !== null ? (float) $row['battery_temperature'] : null,
            'payload_temperature' => $row['payload_temperature'] !== null ? (float) $row['payload_temperature'] : null,
            // Comms
            'rssi'            => $row['rssi'] !== null ? (int) $row['rssi'] : null,
            'snr'             => $row['snr'] !== null ? (float) $row['snr'] : null,
            'uplink_bps'      => $row['uplink_bps'] !== null ? (int) $row['uplink_bps'] : null,
            'downlink_bps'    => $row['downlink_bps'] !== null ? (int) $row['downlink_bps'] : null,
            'latency_ms'      => $row['latency_ms'] !== null ? (int) $row['latency_ms'] : null,
            'packet_loss_pct' => $row['packet_loss_pct'] !== null ? (float) $row['packet_loss_pct'] : null,
            // OBC
            'obc_state'       => $row['obc_state'],
            // GPS
            'latitude'        => $row['latitude'] !== null ? (float) $row['latitude'] : null,
            'longitude'       => $row['longitude'] !== null ? (float) $row['longitude'] : null,
            'altitude'        => $row['altitude'] !== null ? (float) $row['altitude'] : null,
            'speed_kms'       => $row['speed_kms'] !== null ? (float) $row['speed_kms'] : null,
            // Note: raw_json is intentionally excluded from API responses
        ];
    }

    /**
     * Return the most recent telemetry record.
     *
     * Queries the database for the single newest row ordered by timestamp
     * descending and returns it as a flat JSON object.
     *
     * GET /api/cubesat/telemetry/latest
     *
     * @return \CodeIgniter\HTTP\ResponseInterface JSON object of the latest
     *         record (status 200), or a 404 error if the table is empty.
     */
    public function latest()
    {
        if ($this->isDemoMode()) {
            $svc    = new DemoDataService();
            $state  = (new DemoStateService())->getState();
            $now    = new \DateTime('now', new \DateTimeZone('UTC'));
            $record = $svc->generateRecord($now, 1, $state);

            return $this->response
                ->setStatusCode(200)
                ->setContentType('application/json')
                ->setJSON($record);
        }

        $record = $this->model->getLatest();

        if ($record === null) {
            return $this->response
                ->setStatusCode(404)
                ->setContentType('application/json')
                ->setJSON(['error' => 'No telemetry records found']);
        }

        return $this->response
            ->setStatusCode(200)
            ->setContentType('application/json')
            ->setJSON($this->formatRecord($record));
    }

    /**
     * Return the last N telemetry records ordered newest first.
     *
     * The optional `limit` query parameter controls how many rows are returned.
     * Values outside the range [1, 10000] are silently clamped to 100.
     *
     * GET /api/cubesat/telemetry/history?limit=100
     *
     * @return \CodeIgniter\HTTP\ResponseInterface JSON object with `count` and
     *         `records` array (status 200).
     */
    public function history()
    {
        $limit = (int) ($this->request->getGet('limit') ?? 100);

        if ($limit < 1 || $limit > 10000) {
            $limit = 100;
        }

        if ($this->isDemoMode()) {
            $svc     = new DemoDataService();
            $state   = (new DemoStateService())->getState();
            $records = $svc->generateHistory($limit, $state);

            return $this->response
                ->setStatusCode(200)
                ->setContentType('application/json')
                ->setJSON([
                    'count'   => count($records),
                    'records' => $records,
                ]);
        }

        $records = $this->model->getHistory($limit);
        $formatted = array_map([$this, 'formatRecord'], $records);

        return $this->response
            ->setStatusCode(200)
            ->setContentType('application/json')
            ->setJSON([
                'count'   => count($formatted),
                'records' => $formatted,
            ]);
    }

    /**
     * Return telemetry records within a timestamp range (inclusive).
     *
     * Both `from` and `to` query parameters are required and must be ISO 8601
     * datetime strings (e.g. `2026-03-11T00:00:00Z`). Records are returned in
     * ascending timestamp order.
     *
     * GET /api/cubesat/telemetry/range?from=ISO8601&to=ISO8601
     *
     * @return \CodeIgniter\HTTP\ResponseInterface JSON object with `count`,
     *         `from`, `to`, and `records` array (status 200), or a 400 error
     *         when either parameter is missing.
     */
    public function range()
    {
        $from = $this->request->getGet('from');
        $to   = $this->request->getGet('to');

        if (empty($from) || empty($to)) {
            return $this->response
                ->setStatusCode(400)
                ->setContentType('application/json')
                ->setJSON([
                    'error'   => 'Validation failed',
                    'details' => ['Both "from" and "to" query parameters are required'],
                ]);
        }

        // Validate that both values are parseable as dates
        if (strtotime($from) === false || strtotime($to) === false) {
            return $this->response
                ->setStatusCode(400)
                ->setContentType('application/json')
                ->setJSON([
                    'error'   => 'Validation failed',
                    'details' => ['Parameters "from" and "to" must be valid datetime strings'],
                ]);
        }

        if ($this->isDemoMode()) {
            $svc     = new DemoDataService();
            $state   = (new DemoStateService())->getState();
            $records = $svc->generateRange($from, $to, $state);

            return $this->response
                ->setStatusCode(200)
                ->setContentType('application/json')
                ->setJSON([
                    'count'   => count($records),
                    'from'    => $from,
                    'to'      => $to,
                    'records' => $records,
                ]);
        }

        $records = $this->model->getRange($from, $to);
        $formatted = array_map([$this, 'formatRecord'], $records);

        return $this->response
            ->setStatusCode(200)
            ->setContentType('application/json')
            ->setJSON([
                'count'   => count($formatted),
                'from'    => $from,
                'to'      => $to,
                'records' => $formatted,
            ]);
    }

    /**
     * Determine whether demo mode is currently enabled.
     *
     * Reads the DEMO_MODE environment variable and treats "true" or "1"
     * (case-insensitive) as enabled; anything else (including absence) is
     * treated as disabled.
     *
     * @return bool
     */
    private function isDemoMode(): bool
    {
        $val = getenv('DEMO_MODE');
        if ($val === false) {
            return false;
        }
        return in_array(strtolower(trim($val)), ['true', '1'], true);
    }
}
