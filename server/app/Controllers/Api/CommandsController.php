<?php

namespace App\Controllers\Api;

use App\Models\EventModel;
use App\Services\DemoStateService;
use CodeIgniter\RESTful\ResourceController;

/**
 * CommandsController
 *
 * Simulated command bus for the Mission Console / Quick Commands widgets.
 * This never talks to real hardware — it validates the command against an
 * allow-list, logs it to the mission event log, and returns a canned
 * confirmation message. In demo mode it always succeeds without requiring
 * an API key so the dashboard stays interactive for anyone exploring it.
 *
 * Routes:
 *   POST /api/cubesat/commands -> store()
 *
 * @package App\Controllers\Api
 */
class CommandsController extends ResourceController
{
    protected $format = 'json';

    /**
     * Allow-listed commands and the console/quick-commands confirmation
     * message returned for each.
     */
    private const COMMANDS = [
        'REFRESH_TELEMETRY'    => 'Telemetry refresh requested',
        'ENABLE_SCIENCE_MODE'  => 'Science mode enabled',
        'DISABLE_SCIENCE_MODE' => 'Science mode disabled',
        'REBOOT_OBC'           => 'OBC reboot command queued',
        'RESET_ADCS'           => 'ADCS reset command queued',
        'SAFE_MODE'            => 'Safe mode command queued',
    ];

    /**
     * Accept and log a simulated command.
     *
     * POST /api/cubesat/commands
     * Body: { "command": "ENABLE_SCIENCE_MODE" }
     *
     * @return \CodeIgniter\HTTP\ResponseInterface
     */
    public function store()
    {
        $body    = $this->request->getBody();
        $payload = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE || empty($payload['command'])) {
            return $this->response
                ->setStatusCode(422)
                ->setContentType('application/json')
                ->setJSON([
                    'error'   => 'Invalid JSON payload',
                    'details' => ['A "command" field is required'],
                ]);
        }

        $command = strtoupper(trim((string) $payload['command']));

        if (!array_key_exists($command, self::COMMANDS)) {
            return $this->response
                ->setStatusCode(400)
                ->setContentType('application/json')
                ->setJSON([
                    'error'   => 'Unknown command',
                    'details' => [
                        "Command '{$command}' is not recognized. Allowed: " . implode(', ', array_keys(self::COMMANDS)),
                    ],
                ]);
        }

        if (!$this->isDemoMode()) {
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
        }

        $message = self::COMMANDS[$command];

        // Demo mode never touches the real database (mirrors
        // TelemetryController::store()'s demo-mode behavior) — but it does
        // update a small simulated satellite state (file cache, see
        // DemoStateService) so the command actually affects telemetry
        // returned afterwards (uptime reset on reboot, obc_state, science
        // mode, etc.), instead of being a no-op.
        if ($this->isDemoMode()) {
            $result = (new DemoStateService())->applyCommand($command);

            return $this->response
                ->setStatusCode(200)
                ->setContentType('application/json')
                ->setJSON([
                    'status'   => 'demo',
                    'message'  => $result['message'] ?? $message,
                    'event_id' => null,
                ]);
        }

        $now     = (new \DateTime('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s');
        $eventId = (new EventModel())->logEvent('command', 'success', $message, $now, ['command' => $command]);

        return $this->response
            ->setStatusCode(200)
            ->setContentType('application/json')
            ->setJSON([
                'status'   => 'ok',
                'message'  => $message,
                'event_id' => $eventId !== false ? $eventId : null,
            ]);
    }

    /**
     * Determine whether demo mode is currently enabled.
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
