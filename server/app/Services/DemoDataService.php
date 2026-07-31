<?php

namespace App\Services;

/**
 * DemoDataService
 *
 * Generates deterministic, realistic CubeSat telemetry records for demo mode.
 * All values are computed using trigonometric functions seeded by timestamp,
 * so the same timestamp always produces the same output (no randomness).
 *
 * Simulated subsystems:
 *   - EPS:     battery, voltage, external_power, battery_current
 *   - ADCS:    roll, pitch, yaw, imu_temp, accel_x/y/z, gyro_x/y/z
 *   - Payload: temperature, humidity, pressure
 *   - System:  cpu_percent, ram_percent, swap_percent, disk_percent,
 *              uptime_seconds, cpu_temperature
 *   - OBC:     obc_state (always "NOMINAL")
 *   - GPS:     latitude, longitude, altitude
 *
 * @package App\Services
 */
class DemoDataService
{
    /**
     * Fixed base timestamp (Unix epoch) used to compute uptime_seconds.
     * Represents 2026-07-30 00:00:00 UTC (mission start / deployment date).
     */
    public const BASE_EPOCH = 1785369600;

    /**
     * Demo record ID offset — returned IDs count down from this value so they
     * look plausible without touching any database sequence.
     */
    private const ID_BASE = 100000;

    /**
     * Round a float to N decimal places.
     */
    private function r(float $value, int $decimals = 2): float
    {
        return round($value, $decimals);
    }

    /**
     * Generate a single flattened telemetry record for the given timestamp.
     *
     * All numeric values are derived deterministically from $ts (Unix epoch
     * seconds) using sin/cos with different frequencies and phase offsets so
     * each channel varies independently and smoothly over time.
     *
     * @param \DateTime  $timestamp The moment to simulate
     * @param int        $id        Synthetic record ID
     * @param array|null $state     Demo satellite state from DemoStateService::getState(),
     *                              overlaying command effects (reboot, safe mode, science
     *                              mode override, ADCS reset) on top of the baseline signal.
     *                              Null falls back to the original stateless behavior.
     * @return array Flat telemetry array matching the real DB schema
     */
    public function generateRecord(\DateTime $timestamp, int $id = 1, ?array $state = null): array
    {
        $ts    = $timestamp->getTimestamp();
        $state = $state ?? [
            'last_reboot_at'        => self::BASE_EPOCH,
            'boot_count'            => 7,
            'obc_state'             => 'NOMINAL',
            'obc_state_since'       => self::BASE_EPOCH,
            'science_mode_override' => null,
            'adcs_reset_at'         => null,
        ];

        // ---- EPS --------------------------------------------------------
        // Battery: 45–85 %, slow sine ~2-hour period
        $batteryPeriod = 7200.0;
        $battery = 65.0 + 20.0 * sin((2 * M_PI * $ts) / $batteryPeriod);

        // Voltage: 3.6–4.2 V, tracks battery loosely (same period, slight offset)
        $voltage = 3.9 + 0.3 * sin((2 * M_PI * $ts) / $batteryPeriod + 0.5);

        // external_power: 1 for ~half the orbit, using a slower cycle (~45 min)
        $externalPower = (sin((2 * M_PI * $ts) / 2700.0) > 0) ? 1 : 0;

        // Battery current draw: 0.4–0.9 A, slightly lower while on external power
        $batteryCurrent = ($externalPower ? 0.5 : 0.7) + 0.15 * sin((2 * M_PI * $ts) / 1800.0 + 0.9);

        // ---- ADCS -------------------------------------------------------
        // Roll / pitch: ±15°, independent oscillations
        $roll  = 15.0 * sin((2 * M_PI * $ts) / 5400.0 + 1.0);
        $pitch = 15.0 * sin((2 * M_PI * $ts) / 4500.0 + 2.5);

        // Yaw: slow full rotation, period ~90 min (ISS-like orbit)
        $yaw = fmod(((($ts / 5400.0) * 360.0) + 360.0), 360.0);

        // IMU temperature: 20–35 °C
        $imuTemp = 27.5 + 7.5 * sin((2 * M_PI * $ts) / 10800.0 + 0.7);

        // Accelerometers: small values ±0.1 g
        $accelX = 0.05 * sin((2 * M_PI * $ts) / 1200.0 + 0.1);
        $accelY = 0.05 * sin((2 * M_PI * $ts) / 900.0  + 1.2);
        $accelZ = 0.05 * sin((2 * M_PI * $ts) / 1500.0 + 2.3);

        // Gyroscopes: small values ±0.5 dps
        $gyroX = 0.25 * sin((2 * M_PI * $ts) / 600.0  + 0.3);
        $gyroY = 0.25 * sin((2 * M_PI * $ts) / 750.0  + 1.5);
        $gyroZ = 0.25 * sin((2 * M_PI * $ts) / 480.0  + 2.9);

        // RESET_ADCS command: roll/pitch/gyro decay linearly toward zero over
        // DemoStateService::ADCS_DECAY_WINDOW seconds (yaw is orbital heading,
        // not attitude drift, so it is left untouched).
        $adcsResetAt = $state['adcs_reset_at'] ?? null;
        if ($adcsResetAt !== null) {
            $elapsed = $ts - $adcsResetAt;
            $decayFactor = max(0.0, 1.0 - ($elapsed / DemoStateService::ADCS_DECAY_WINDOW));
            $roll   *= $decayFactor;
            $pitch  *= $decayFactor;
            $gyroX  *= $decayFactor;
            $gyroY  *= $decayFactor;
            $gyroZ  *= $decayFactor;
        }

        // ---- Payload ----------------------------------------------------
        // Temperature: 18–28 °C
        $temperature = 23.0 + 5.0 * sin((2 * M_PI * $ts) / 6000.0 + 0.4);

        // Humidity: 40–60 %
        $humidity = 50.0 + 10.0 * sin((2 * M_PI * $ts) / 8000.0 + 1.8);

        // Pressure: 980–1020 hPa
        $pressure = 1000.0 + 20.0 * sin((2 * M_PI * $ts) / 7200.0 + 3.1);

        // ---- System -----------------------------------------------------
        // CPU: 15–45 %
        $cpuPercent = 30.0 + 15.0 * sin((2 * M_PI * $ts) / 3600.0 + 0.9);

        // RAM: 50–70 %
        $ramPercent = 60.0 + 10.0 * sin((2 * M_PI * $ts) / 4800.0 + 2.1);

        // Swap: 5–15 %
        $swapPercent = 10.0 + 5.0 * sin((2 * M_PI * $ts) / 7200.0 + 1.3);

        // Disk: 30–40 %
        $diskPercent = 35.0 + 5.0 * sin((2 * M_PI * $ts) / 86400.0 + 0.6);

        // Uptime: counts up from the last reboot (never negative). REBOOT_OBC
        // moves last_reboot_at forward, so uptime resets to ~0 immediately.
        $uptimeSeconds = max(0, $ts - $state['last_reboot_at']);

        // CPU temperature: 45–65 °C
        $cpuTemperature = 55.0 + 10.0 * sin((2 * M_PI * $ts) / 3600.0 + 1.7);

        // ---- GPS --------------------------------------------------------
        // Latitude: ±51.6° (ISS-like inclination), period ~92 min
        $orbitPeriod = 5520.0;
        $latitude = 51.6 * sin((2 * M_PI * $ts) / $orbitPeriod);

        // Longitude: advances eastward continuously (one full revolution per
        // orbit period), wrapped to [-180, 180)
        $rawLon = fmod(($ts / $orbitPeriod) * 360.0, 360.0);
        $longitude = ($rawLon > 180.0) ? $rawLon - 360.0 : $rawLon;

        // Altitude: 400–420 km
        $altitude = 410.0 + 10.0 * sin((2 * M_PI * $ts) / $orbitPeriod + M_PI / 4);

        // Ground speed: near-constant LEO orbital velocity, tiny wobble
        $speedKms = 7.61 + 0.02 * sin((2 * M_PI * $ts) / $orbitPeriod);

        // ---- Thermal ------------------------------------------------------
        $obcTemperature     = 28.0 + 6.0 * sin((2 * M_PI * $ts) / 3600.0 + 1.1);
        $epsTemperature     = 26.0 + 6.0 * sin((2 * M_PI * $ts) / 4200.0 + 0.2);
        $batteryTemperature = 21.0 + 4.0 * sin((2 * M_PI * $ts) / 5400.0 + 2.0);
        $payloadTemperature = 23.0 + 5.0 * sin((2 * M_PI * $ts) / 6600.0 + 0.9);

        // ---- Payload (extended) -------------------------------------------
        // ENABLE_SCIENCE_MODE / DISABLE_SCIENCE_MODE commands override the
        // automatic cycle; null means "no override, use the baseline signal".
        $scienceModeOverride = $state['science_mode_override'] ?? null;
        $scienceMode = $scienceModeOverride !== null
            ? (bool) $scienceModeOverride
            : (sin((2 * M_PI * $ts) / 9000.0) > 0.3);
        $imageCount  = 1200 + (int) floor(max(0, $ts - self::BASE_EPOCH) / 300); // one image every 5 min

        // ---- Comms ----------------------------------------------------------
        $rssi          = -60.0 + 10.0 * sin((2 * M_PI * $ts) / 1800.0 + 0.4);
        $snr           = 17.0 + 4.0 * sin((2 * M_PI * $ts) / 2100.0 + 1.6);
        $latencyMs     = 120.0 + 15.0 * sin((2 * M_PI * $ts) / 900.0 + 0.8);
        $packetLossPct = 0.2 + 0.15 * max(0, sin((2 * M_PI * $ts) / 2400.0 + 2.2));

        // ---- OBC state ------------------------------------------------------
        // REBOOT_OBC puts the OBC in a transient 'REBOOT' state for
        // DemoStateService::REBOOT_WINDOW seconds, after which it settles back
        // to NOMINAL/SCIENCE (unless SAFE_MODE was requested since). SAFE_MODE
        // persists until the next reboot. Absent any command override, the OBC
        // state mirrors science_mode (matches the "OBC state changed: NOMINAL
        // ↔ SCIENCE" entries already emitted by the event log cycle).
        $obcState = $state['obc_state'] ?? 'NOMINAL';
        if ($obcState === 'REBOOT' && ($ts - ($state['obc_state_since'] ?? 0)) >= DemoStateService::REBOOT_WINDOW) {
            $obcState = 'NOMINAL';
        }
        if ($obcState === 'NOMINAL' && $scienceMode) {
            $obcState = 'SCIENCE';
        }

        // ---- Assemble ---------------------------------------------------
        return [
            'id'              => $id,
            'timestamp'       => $timestamp->format('Y-m-d\TH:i:s'),
            // EPS
            'battery'         => $this->r($battery,   1),
            'voltage'         => $this->r($voltage,   2),
            'external_power'  => $externalPower,
            'battery_current' => $this->r($batteryCurrent, 2),
            // ADCS
            'roll'            => $this->r($roll,    2),
            'pitch'           => $this->r($pitch,   2),
            'yaw'             => $this->r($yaw,     1),
            'imu_temp'        => $this->r($imuTemp, 1),
            'accel_x'         => $this->r($accelX,  3),
            'accel_y'         => $this->r($accelY,  3),
            'accel_z'         => $this->r($accelZ,  3),
            'gyro_x'          => $this->r($gyroX,   3),
            'gyro_y'          => $this->r($gyroY,   3),
            'gyro_z'          => $this->r($gyroZ,   3),
            // Payload
            'temperature'         => $this->r($temperature, 1),
            'humidity'            => $this->r($humidity,    1),
            'pressure'            => $this->r($pressure,    1),
            'camera_status'       => $scienceMode ? 'READY' : 'STANDBY',
            'image_count'         => $imageCount,
            'image_resolution'    => '1280x720',
            'sensor_status'       => 'NOMINAL',
            'science_mode'        => (bool) $scienceMode,
            'payload_power_watts' => $scienceMode ? $this->r(1.23 + 0.1 * sin($ts / 60.0), 2) : 0.15,
            // System
            'cpu_percent'     => $this->r($cpuPercent,    1),
            'ram_percent'     => $this->r($ramPercent,    1),
            'swap_percent'    => $this->r($swapPercent,   1),
            'disk_percent'    => $this->r($diskPercent,   1),
            'uptime_seconds'  => (int) $uptimeSeconds,
            'cpu_temperature' => $this->r($cpuTemperature, 1),
            'boot_count'      => $state['boot_count'] ?? 7,
            // Thermal
            'obc_temperature'     => $this->r($obcTemperature, 1),
            'eps_temperature'     => $this->r($epsTemperature, 1),
            'battery_temperature' => $this->r($batteryTemperature, 1),
            'payload_temperature' => $this->r($payloadTemperature, 1),
            // Comms
            'rssi'            => (int) round($rssi),
            'snr'             => $this->r($snr, 1),
            'uplink_bps'      => 9600,
            'downlink_bps'    => 9600,
            'latency_ms'      => (int) round($latencyMs),
            'packet_loss_pct' => $this->r($packetLossPct, 2),
            // OBC
            'obc_state'       => $obcState,
            // GPS
            'latitude'        => $this->r($latitude,  4),
            'longitude'       => $this->r($longitude, 4),
            'altitude'        => $this->r($altitude,  2),
            'speed_kms'       => $this->r($speedKms, 2),
        ];
    }

    /**
     * Generate $limit records going back in 30-second steps from now.
     *
     * Records are ordered newest-first to match the real history endpoint
     * behaviour.
     *
     * @param int        $limit Number of records to generate (clamped to [1, 10000])
     * @param array|null $state Demo satellite state, see generateRecord().
     * @return array Array of formatted telemetry records
     */
    public function generateHistory(int $limit = 100, ?array $state = null): array
    {
        $limit   = max(1, min(10000, $limit));
        $records = [];
        $now     = new \DateTime('now', new \DateTimeZone('UTC'));
        // Snap to the nearest 30-second boundary so results are stable
        $base    = (int) floor($now->getTimestamp() / 30) * 30;

        for ($i = 0; $i < $limit; $i++) {
            $ts  = $base - ($i * 30);
            $dt  = new \DateTime('@' . $ts);
            $dt->setTimezone(new \DateTimeZone('UTC'));
            $id  = self::ID_BASE - $i;
            $records[] = $this->generateRecord($dt, $id, $state);
        }

        return $records;
    }

    /**
     * Generate records covering the given time range at 30-second intervals.
     *
     * Records are ordered ascending by timestamp to match the real range
     * endpoint behaviour.
     *
     * @param string     $from  ISO 8601 start datetime (inclusive)
     * @param string     $to    ISO 8601 end datetime   (inclusive)
     * @param array|null $state Demo satellite state, see generateRecord().
     * @return array Array of formatted telemetry records
     */
    public function generateRange(string $from, string $to, ?array $state = null): array
    {
        $fromTs = strtotime($from);
        $toTs   = strtotime($to);

        if ($fromTs === false || $toTs === false || $fromTs > $toTs) {
            return [];
        }

        // Snap start to the nearest 30-second boundary (ceiling)
        $startTs = (int) ceil($fromTs / 30) * 30;
        $records = [];
        $idBase  = self::ID_BASE;
        $idx     = 0;

        for ($ts = $startTs; $ts <= $toTs; $ts += 30) {
            $dt = new \DateTime('@' . $ts);
            $dt->setTimezone(new \DateTimeZone('UTC'));
            $records[] = $this->generateRecord($dt, $idBase + $idx, $state);
            $idx++;

            // Safety cap: never return more than 10 000 records
            if ($idx >= 10000) {
                break;
            }
        }

        return $records;
    }

    /**
     * Recurring event templates — one orbit's worth of mission log lines, each
     * anchored to an offset (seconds) within the orbit period. Repeating this
     * cycle backward in time produces a deterministic, ever-growing mission
     * event log with no randomness.
     */
    private const EVENT_TEMPLATES = [
        ['offset' => 60,   'type' => 'state_transition', 'severity' => 'info',    'message' => 'Entering ground station visibility window'],
        ['offset' => 240,  'type' => 'info',              'severity' => 'success', 'message' => 'Ground station link established'],
        ['offset' => 480,  'type' => 'command',           'severity' => 'success', 'message' => 'Telemetry downlink completed'],
        ['offset' => 900,  'type' => 'state_transition',  'severity' => 'info',    'message' => 'Leaving ground station visibility window'],
        ['offset' => 1500, 'type' => 'alert',             'severity' => 'warning', 'message' => 'Entering eclipse — switching to battery power'],
        ['offset' => 1620, 'type' => 'state_transition',  'severity' => 'info',    'message' => 'OBC state changed: NOMINAL → SCIENCE'],
        ['offset' => 3200, 'type' => 'info',              'severity' => 'info',    'message' => 'Exiting eclipse — solar panels charging'],
        ['offset' => 3800, 'type' => 'state_transition',  'severity' => 'info',    'message' => 'OBC state changed: SCIENCE → NOMINAL'],
        ['offset' => 4600, 'type' => 'alert',             'severity' => 'warning', 'message' => 'Battery level below 60% threshold'],
    ];

    /**
     * One-time mission bootstrap events, anchored to BASE_EPOCH.
     */
    private const BOOT_EVENTS = [
        ['offset' => 0,   'type' => 'deployment',       'severity' => 'success', 'message' => 'Deployment sequence started'],
        ['offset' => 30,  'type' => 'deployment',       'severity' => 'success', 'message' => 'Antenna deployed'],
        ['offset' => 90,  'type' => 'state_transition', 'severity' => 'info',    'message' => 'OBC state changed: DEPLOY → NOMINAL'],
        ['offset' => 120, 'type' => 'info',             'severity' => 'success', 'message' => 'Payload enabled'],
    ];

    /**
     * Generate the last $limit mission events, newest first, deterministically
     * derived from the current time. Repeats a fixed orbit-length event cycle
     * (see EVENT_TEMPLATES) backward from "now", plus a one-time boot sequence
     * anchored at BASE_EPOCH.
     *
     * @param int   $limit         Number of events to return (clamped to [1, 500])
     * @param array $manualEvents  Command-triggered events from
     *                             DemoStateService::getState()['events'], each
     *                             shaped like ['timestamp' => int, 'type' =>
     *                             string, 'severity' => string, 'message' => string].
     *                             Merged with the generated cycle so commands
     *                             show up in the mission event log.
     * @return array Array of formatted mission event records
     */
    public function generateEvents(int $limit = 50, array $manualEvents = []): array
    {
        $limit       = max(1, min(500, $limit));
        $period      = 5520; // seconds, matches the orbit period used for GPS simulation
        $now         = (new \DateTime('now', new \DateTimeZone('UTC')))->getTimestamp();
        $cycleStart  = (int) floor(($now - self::BASE_EPOCH) / $period) * $period + self::BASE_EPOCH;

        $candidates = [];

        foreach (self::BOOT_EVENTS as $tpl) {
            $ts = self::BASE_EPOCH + $tpl['offset'];
            if ($ts <= $now) {
                $candidates[] = ['ts' => $ts] + $tpl;
            }
        }

        // Walk backward one orbit at a time until we have enough candidates
        for ($cycle = $cycleStart; $cycle >= self::BASE_EPOCH && count($candidates) < $limit + count(self::EVENT_TEMPLATES); $cycle -= $period) {
            foreach (self::EVENT_TEMPLATES as $tpl) {
                $ts = $cycle + $tpl['offset'];
                if ($ts <= $now && $ts >= self::BASE_EPOCH) {
                    $candidates[] = ['ts' => $ts] + $tpl;
                }
            }
        }

        foreach ($manualEvents as $event) {
            $candidates[] = [
                'ts'       => (int) $event['timestamp'],
                'type'     => $event['type'],
                'severity' => $event['severity'],
                'message'  => $event['message'],
            ];
        }

        usort($candidates, static fn (array $a, array $b) => $b['ts'] - $a['ts']);
        $candidates = array_slice($candidates, 0, $limit);

        $records = [];
        foreach ($candidates as $idx => $c) {
            $dt = new \DateTime('@' . $c['ts']);
            $dt->setTimezone(new \DateTimeZone('UTC'));

            $records[] = [
                'id'        => self::ID_BASE - $idx,
                'timestamp' => $dt->format('Y-m-d\TH:i:s'),
                'type'      => $c['type'],
                'severity'  => $c['severity'],
                'message'   => $c['message'],
                'meta'      => null,
            ];
        }

        return $records;
    }
}
