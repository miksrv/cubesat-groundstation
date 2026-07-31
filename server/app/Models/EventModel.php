<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * EventModel
 *
 * Active-Record model for the `mission_events` table. Stores a running log
 * of OBC state transitions, simulated commands, deployments and alerts, used
 * by the Mission Events / Recent Alerts widgets on the dashboard.
 *
 * @package App\Models
 */
class EventModel extends Model
{
    protected $table      = 'mission_events';
    protected $primaryKey = 'id';

    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $useTimestamps    = false;

    protected $allowedFields = [
        'timestamp',
        'type',
        'severity',
        'message',
        'meta_json',
    ];

    /**
     * Return the last N events ordered newest first.
     *
     * @param int $limit Number of records to return (default 50)
     * @return array
     */
    public function getRecent(int $limit = 50): array
    {
        return $this->orderBy('timestamp', 'DESC')
                    ->limit($limit)
                    ->findAll();
    }

    /**
     * Insert a new mission event.
     *
     * @param string     $type      state_transition | command | deployment | alert | info
     * @param string     $severity  info | success | warning | critical
     * @param string     $message   Human-readable log line
     * @param string     $timestamp ISO8601/DATETIME string
     * @param array|null $meta      Extra structured context, JSON-encoded
     * @return int|false Insert ID, or false on failure
     */
    public function logEvent(string $type, string $severity, string $message, string $timestamp, ?array $meta = null)
    {
        return $this->insert([
            'timestamp' => str_replace('T', ' ', $timestamp),
            'type'      => $type,
            'severity'  => $severity,
            'message'   => $message,
            'meta_json' => $meta !== null ? json_encode($meta) : null,
        ], true);
    }

    /**
     * Log an OBC state transition detected during telemetry ingest.
     *
     * @param string|null $from      Previous obc_state (null if this is the first record)
     * @param string      $to        New obc_state
     * @param string      $timestamp ISO8601/DATETIME string of the transition
     * @return int|false Insert ID, or false on failure
     */
    public function logStateTransition(?string $from, string $to, string $timestamp)
    {
        $message = $from === null
            ? "OBC state initialized: {$to}"
            : "OBC state changed: {$from} \xE2\x86\x92 {$to}"; // "→"

        return $this->logEvent('state_transition', 'info', $message, $timestamp, ['from' => $from, 'to' => $to]);
    }
}
