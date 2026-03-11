<?php

namespace App\Controllers\Api;

use App\Models\TelemetryModel;
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
     * payload, system, obc, gps). Validates that all required top-level keys
     * are present, flattens the nested structure into a single DB row, and
     * persists it via TelemetryModel.
     *
     * POST /api/cubesat/telemetry
     *
     * @return \CodeIgniter\HTTP\ResponseInterface JSON response with status 201
     *         on success, 400 on validation failure, 422 on malformed JSON, or
     *         500 on a database error.
     */
    public function store()
    {
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

        // Validate required top-level keys (array_key_exists used so empty sub-arrays are accepted)
        $requiredKeys = ['timestamp', 'eps', 'adcs', 'payload', 'system', 'obc', 'gps'];
        $missing      = array_values(array_diff($requiredKeys, array_keys($payload ?? [])));

        if (! empty($missing)) {
            return $this->response
                ->setStatusCode(400)
                ->setContentType('application/json')
                ->setJSON([
                    'error'   => 'Validation failed',
                    'details' => array_map(fn($k) => "The field '{$k}' is required.", $missing),
                ]);
        }

        // Flatten nested JSON structure to flat DB columns
        $eps     = $payload['eps']     ?? [];
        $adcs    = $payload['adcs']    ?? [];
        $pld     = $payload['payload'] ?? [];
        $sys     = $payload['system']  ?? [];
        $obc     = $payload['obc']     ?? [];
        $gps     = $payload['gps']     ?? [];

        $data = [
            'timestamp'      => $payload['timestamp'],
            // EPS
            'battery'        => $eps['battery']        ?? null,
            'voltage'        => $eps['voltage']         ?? null,
            'external_power' => $eps['external_power']  ?? null,
            // ADCS
            'roll'           => $adcs['roll']           ?? null,
            'pitch'          => $adcs['pitch']          ?? null,
            'yaw'            => $adcs['yaw']            ?? null,
            'imu_temp'       => $adcs['imu_temp']       ?? null,
            'accel_x'        => $adcs['accel']['x']     ?? null,
            'accel_y'        => $adcs['accel']['y']     ?? null,
            'accel_z'        => $adcs['accel']['z']     ?? null,
            'gyro_x'         => $adcs['gyro']['x']      ?? null,
            'gyro_y'         => $adcs['gyro']['y']      ?? null,
            'gyro_z'         => $adcs['gyro']['z']      ?? null,
            // Payload
            'temperature'    => $pld['temperature']     ?? null,
            'humidity'       => $pld['humidity']        ?? null,
            'pressure'       => $pld['pressure']        ?? null,
            // System
            'cpu_percent'    => $sys['cpu_percent']     ?? null,
            'ram_percent'    => $sys['ram_percent']     ?? null,
            'swap_percent'   => $sys['swap_percent']    ?? null,
            'disk_percent'   => $sys['disk_percent']    ?? null,
            'uptime_seconds' => $sys['uptime_seconds']  ?? null,
            'cpu_temperature'=> $sys['cpu_temperature'] ?? null,
            // OBC
            'obc_state'      => $obc['state']           ?? null,
            // GPS
            'latitude'       => $gps['latitude']        ?? null,
            'longitude'      => $gps['longitude']       ?? null,
            'altitude'       => $gps['altitude']        ?? null,
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
            ->setJSON($record);
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

        $records = $this->model->getHistory($limit);

        return $this->response
            ->setStatusCode(200)
            ->setContentType('application/json')
            ->setJSON([
                'count'   => count($records),
                'records' => $records,
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

        $records = $this->model->getRange($from, $to);

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
}
