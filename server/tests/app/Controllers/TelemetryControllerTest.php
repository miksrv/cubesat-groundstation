<?php

namespace Tests\app\Controllers;

use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;

/**
 * TelemetryControllerTest
 *
 * Feature tests for all four CubeSat telemetry API endpoints:
 *   POST   /api/cubesat/telemetry
 *   GET    /api/cubesat/telemetry/latest
 *   GET    /api/cubesat/telemetry/history
 *   GET    /api/cubesat/telemetry/range
 *
 * Requires the database to be migrated before running:
 *   php spark migrate
 *
 * @internal
 */
final class TelemetryControllerTest extends CIUnitTestCase
{
    use FeatureTestTrait;
    use DatabaseTestTrait;

    // Migrate App namespace only; do not refresh (rollback) between tests.
    protected $namespace = 'App';
    protected $migrate   = true;
    protected $refresh   = false;

    protected function setUp(): void
    {
        parent::setUp();
        \Config\Database::connect()->table('cubesat_telemetry')->truncate();
    }

    // -------------------------------------------------------------------------
    // Helper
    // -------------------------------------------------------------------------

    /**
     * Return a complete, valid telemetry payload array.
     */
    private function validPayload(): array
    {
        return [
            'timestamp' => '2026-03-11T14:30:00Z',
            'eps'       => [
                'battery'        => 87.5,
                'voltage'        => 12.4,
                'external_power' => 1,
            ],
            'adcs' => [
                'roll'     => 15.3,
                'pitch'    => -2.7,
                'yaw'      => 180.5,
                'imu_temp' => 23.4,
                'accel'    => ['x' => 0.012, 'y' => -0.003, 'z' => 9.81],
                'gyro'     => ['x' => 0.001, 'y' => 0.002,  'z' => -0.001],
            ],
            'payload' => [
                'temperature' => 22.5,
                'humidity'    => 45.2,
                'pressure'    => 1013.25,
            ],
            'system' => [
                'cpu_percent'    => 35.2,
                'ram_percent'    => 62.8,
                'swap_percent'   => 12.3,
                'disk_percent'   => 48.7,
                'uptime_seconds' => 86400,
                'cpu_temperature'=> 45.3,
            ],
            'obc' => ['state' => 'NOMINAL'],
            'gps' => [
                'latitude'  => 55.7558,
                'longitude' => 37.6173,
                'altitude'  => 400.5,
            ],
        ];
    }

    /**
     * POST a JSON payload to /api/cubesat/telemetry and return the response.
     */
    private function postTelemetry(string $body): \CodeIgniter\Test\TestResponse
    {
        return $this->withBodyFormat('json')
                    ->withBody($body)
                    ->post('api/cubesat/telemetry');
    }

    /**
     * Insert one telemetry record via the API and return the assigned ID.
     */
    private function insertOneRecord(array $overrides = []): int
    {
        $payload  = array_merge($this->validPayload(), $overrides);
        $response = $this->postTelemetry(json_encode($payload));
        $response->assertStatus(201);
        $data = json_decode($response->getJSON(), true);

        return (int) $data['id'];
    }

    // -------------------------------------------------------------------------
    // POST /api/cubesat/telemetry
    // -------------------------------------------------------------------------

    /**
     * A fully valid payload must be accepted with HTTP 201 and return status/id.
     */
    public function testStoreValidPayloadReturns201(): void
    {
        $response = $this->postTelemetry(json_encode($this->validPayload()));

        $response->assertStatus(201);

        $data = json_decode($response->getJSON(), true);
        $this->assertArrayHasKey('status', $data);
        $this->assertSame('success', $data['status']);
        $this->assertArrayHasKey('id', $data);
        $this->assertGreaterThan(0, (int) $data['id']);
    }

    /**
     * Non-JSON body with Content-Type application/json must return HTTP 422.
     */
    public function testStoreInvalidJsonReturns422(): void
    {
        $response = $this->withHeaders(['Content-Type' => 'application/json'])
                         ->withBody('not-valid-json{{{')
                         ->post('api/cubesat/telemetry');

        $response->assertStatus(422);

        $data = json_decode($response->getJSON(), true);
        $this->assertArrayHasKey('error', $data);
    }

    /**
     * Missing a required top-level key must return HTTP 400.
     */
    public function testStoreMissingEpsReturns400(): void
    {
        $payload = $this->validPayload();
        unset($payload['eps']);

        $response = $this->postTelemetry(json_encode($payload));

        $response->assertStatus(400);

        $data = json_decode($response->getJSON(), true);
        $this->assertArrayHasKey('error', $data);
        $this->assertSame('Validation failed', $data['error']);
    }

    /**
     * Missing the timestamp key must return HTTP 400.
     */
    public function testStoreMissingTimestampReturns400(): void
    {
        $payload = $this->validPayload();
        unset($payload['timestamp']);

        $response = $this->postTelemetry(json_encode($payload));

        $response->assertStatus(400);
    }

    /**
     * Missing several top-level keys must return HTTP 400 with details array.
     */
    public function testStoreMissingMultipleFieldsReturns400WithDetails(): void
    {
        $payload = $this->validPayload();
        unset($payload['adcs'], $payload['system']);

        $response = $this->postTelemetry(json_encode($payload));

        $response->assertStatus(400);

        $data = json_decode($response->getJSON(), true);
        $this->assertIsArray($data['details']);
        $this->assertNotEmpty($data['details']);
    }

    /**
     * Missing nested fields inside eps is still accepted (nullable columns),
     * the record is inserted with null values for missing nested fields.
     */
    public function testStoreMissingNestedEpsFieldsStillInserts(): void
    {
        $payload = $this->validPayload();
        // Remove nested eps fields – top-level key "eps" is present but empty
        $payload['eps'] = [];

        $response = $this->postTelemetry(json_encode($payload));

        // Controller only validates top-level keys; nested fields are nullable
        $response->assertStatus(201);
    }

    /**
     * An empty JSON object {} is missing all required fields → HTTP 400.
     */
    public function testStoreEmptyJsonObjectReturns400(): void
    {
        $response = $this->postTelemetry('{}');

        $response->assertStatus(400);
    }

    /**
     * Completely empty body (no body set) results in no JSON to decode.
     * The controller will either see null body (JSON_ERROR_NONE on null → 400)
     * or an empty string (JSON_ERROR_SYNTAX → 422). Either is an error response.
     */
    public function testStoreEmptyBodyReturnsError(): void
    {
        $response = $this->post('api/cubesat/telemetry');

        $statusCode = $response->response()->getStatusCode();
        $this->assertContains($statusCode, [400, 422]);
    }

    // -------------------------------------------------------------------------
    // GET /api/cubesat/telemetry/latest
    // -------------------------------------------------------------------------

    /**
     * When the table is empty, latest() should return HTTP 404.
     */
    public function testLatestEmptyDatabaseReturns404(): void
    {
        $response = $this->get('api/cubesat/telemetry/latest');

        $response->assertStatus(404);
    }

    /**
     * After inserting a record, latest() returns HTTP 200 with the record.
     */
    public function testLatestAfterInsertReturns200WithRecord(): void
    {
        $this->insertOneRecord();

        $response = $this->get('api/cubesat/telemetry/latest');

        $response->assertStatus(200);

        $data = json_decode($response->getJSON(), true);
        $this->assertArrayHasKey('id', $data);
        $this->assertArrayHasKey('timestamp', $data);
        $this->assertArrayHasKey('battery', $data);
        $this->assertArrayHasKey('obc_state', $data);
    }

    /**
     * latest() returns the most recent record when multiple records exist.
     */
    public function testLatestReturnsMostRecentRecord(): void
    {
        // Insert older record
        $payloadOld = $this->validPayload();
        $payloadOld['timestamp'] = '2026-01-01T00:00:00Z';
        $this->postTelemetry(json_encode($payloadOld));

        // Insert newer record
        $payloadNew = $this->validPayload();
        $payloadNew['timestamp'] = '2026-06-15T12:00:00Z';
        $newerResponse = $this->postTelemetry(json_encode($payloadNew));
        $newData = json_decode($newerResponse->getJSON(), true);
        $newerId = (int) $newData['id'];

        $response = $this->get('api/cubesat/telemetry/latest');
        $response->assertStatus(200);

        $latest = json_decode($response->getJSON(), true);
        $this->assertSame($newerId, (int) $latest['id']);
    }

    // -------------------------------------------------------------------------
    // GET /api/cubesat/telemetry/history
    // -------------------------------------------------------------------------

    /**
     * history() with no parameters returns HTTP 200 with count/records keys.
     */
    public function testHistoryDefaultReturns200(): void
    {
        $response = $this->get('api/cubesat/telemetry/history');

        $response->assertStatus(200);

        $data = json_decode($response->getJSON(), true);
        $this->assertArrayHasKey('count', $data);
        $this->assertArrayHasKey('records', $data);
        $this->assertIsArray($data['records']);
    }

    /**
     * history() on empty DB returns count 0 and empty records array.
     */
    public function testHistoryEmptyDatabaseReturnsEmptyArray(): void
    {
        $response = $this->get('api/cubesat/telemetry/history');

        $response->assertStatus(200);

        $data = json_decode($response->getJSON(), true);
        $this->assertSame(0, (int) $data['count']);
        $this->assertCount(0, $data['records']);
    }

    /**
     * ?limit=5 returns at most 5 records when more exist.
     */
    public function testHistoryLimitParamReturnsUpToNRecords(): void
    {
        // Insert 8 records
        for ($i = 1; $i <= 8; $i++) {
            $payload = $this->validPayload();
            $payload['timestamp'] = sprintf('2026-03-%02dT12:00:00Z', $i);
            $this->postTelemetry(json_encode($payload));
        }

        $response = $this->get('api/cubesat/telemetry/history?limit=5');

        $response->assertStatus(200);

        $data = json_decode($response->getJSON(), true);
        $this->assertLessThanOrEqual(5, (int) $data['count']);
        $this->assertCount((int) $data['count'], $data['records']);
    }

    /**
     * After inserting exactly 3 records, history() returns exactly 3.
     */
    public function testHistoryReturnsExactCountOfInsertedRecords(): void
    {
        for ($i = 1; $i <= 3; $i++) {
            $payload = $this->validPayload();
            $payload['timestamp'] = sprintf('2026-03-%02dT10:00:00Z', $i);
            $this->postTelemetry(json_encode($payload));
        }

        $response = $this->get('api/cubesat/telemetry/history');

        $response->assertStatus(200);

        $data = json_decode($response->getJSON(), true);
        $this->assertSame(3, (int) $data['count']);
        $this->assertCount(3, $data['records']);
    }

    /**
     * Out-of-range limit (0 or > 10000) falls back to 100 — no error.
     */
    public function testHistoryInvalidLimitFallsBackToDefault(): void
    {
        $response = $this->get('api/cubesat/telemetry/history?limit=0');
        $response->assertStatus(200);

        $response2 = $this->get('api/cubesat/telemetry/history?limit=99999');
        $response2->assertStatus(200);
    }

    // -------------------------------------------------------------------------
    // GET /api/cubesat/telemetry/range
    // -------------------------------------------------------------------------

    /**
     * Missing both from/to → HTTP 400.
     */
    public function testRangeMissingParamsReturns400(): void
    {
        $response = $this->get('api/cubesat/telemetry/range');

        $response->assertStatus(400);

        $data = json_decode($response->getJSON(), true);
        $this->assertArrayHasKey('error', $data);
    }

    /**
     * Missing only "to" → HTTP 400.
     */
    public function testRangeMissingToParamReturns400(): void
    {
        $response = $this->get('api/cubesat/telemetry/range?from=2026-01-01T00:00:00Z');

        $response->assertStatus(400);
    }

    /**
     * Missing only "from" → HTTP 400.
     */
    public function testRangeMissingFromParamReturns400(): void
    {
        $response = $this->get('api/cubesat/telemetry/range?to=2026-12-31T23:59:59Z');

        $response->assertStatus(400);
    }

    /**
     * Valid from/to range with no records in that window → HTTP 200, empty array.
     */
    public function testRangeNoRecordsInRangeReturns200EmptyArray(): void
    {
        $response = $this->get(
            'api/cubesat/telemetry/range?from=2020-01-01T00:00:00Z&to=2020-12-31T23:59:59Z'
        );

        $response->assertStatus(200);

        $data = json_decode($response->getJSON(), true);
        $this->assertArrayHasKey('count', $data);
        $this->assertArrayHasKey('records', $data);
        $this->assertSame(0, (int) $data['count']);
        $this->assertCount(0, $data['records']);
    }

    /**
     * Records within the requested range are returned; records outside are excluded.
     */
    public function testRangeReturnsOnlyRecordsWithinWindow(): void
    {
        // Insert three records at different timestamps
        $timestamps = [
            '2026-03-01T00:00:00Z',  // before range
            '2026-03-10T12:00:00Z',  // inside range
            '2026-03-15T08:00:00Z',  // inside range
            '2026-03-20T00:00:00Z',  // after range
        ];

        foreach ($timestamps as $ts) {
            $payload = $this->validPayload();
            $payload['timestamp'] = $ts;
            $this->postTelemetry(json_encode($payload));
        }

        $response = $this->get(
            'api/cubesat/telemetry/range?from=2026-03-05T00:00:00Z&to=2026-03-18T23:59:59Z'
        );

        $response->assertStatus(200);

        $data = json_decode($response->getJSON(), true);
        $this->assertSame(2, (int) $data['count']);
        $this->assertCount(2, $data['records']);
    }

    /**
     * range() response includes from/to echo-back keys.
     */
    public function testRangeResponseIncludesFromAndToKeys(): void
    {
        $from = '2026-03-01T00:00:00Z';
        $to   = '2026-03-31T23:59:59Z';

        $response = $this->get("api/cubesat/telemetry/range?from={$from}&to={$to}");

        $response->assertStatus(200);

        $data = json_decode($response->getJSON(), true);
        $this->assertArrayHasKey('from', $data);
        $this->assertArrayHasKey('to', $data);
        $this->assertSame($from, $data['from']);
        $this->assertSame($to, $data['to']);
    }

    /**
     * Invalid / garbled date strings are passed through gracefully — the
     * controller does not validate date format, so we expect HTTP 200 with
     * an empty result set (MySQL / SQLite3 will not match any rows).
     */
    public function testRangeInvalidDateFormatReturns200OrGracefulError(): void
    {
        $response = $this->get('api/cubesat/telemetry/range?from=not-a-date&to=also-not-a-date');

        // Controller does not reject invalid dates; graceful empty result
        $statusCode = $response->response()->getStatusCode();
        $this->assertContains($statusCode, [200, 400]);
    }
}
