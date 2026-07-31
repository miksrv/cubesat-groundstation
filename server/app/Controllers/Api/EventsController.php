<?php

namespace App\Controllers\Api;

use App\Models\EventModel;
use App\Services\DemoDataService;
use App\Services\DemoStateService;
use CodeIgniter\RESTful\ResourceController;

/**
 * EventsController
 *
 * Read-only access to the mission event log (OBC state transitions,
 * simulated commands, deployments, alerts) that powers the Mission Events
 * and Recent Alerts widgets.
 *
 * Routes:
 *   GET /api/cubesat/events?limit=50 -> index()
 *
 * @package App\Controllers\Api
 */
class EventsController extends ResourceController
{
    protected $modelName = EventModel::class;
    protected $format     = 'json';

    /**
     * Format a raw DB row into the API shape (typed fields, decoded meta).
     *
     * @param array $row
     * @return array
     */
    private function formatEvent(array $row): array
    {
        return [
            'id'        => (int) $row['id'],
            'timestamp' => str_replace(' ', 'T', $row['timestamp']),
            'type'      => $row['type'],
            'severity'  => $row['severity'],
            'message'   => $row['message'],
            'meta'      => $row['meta_json'] !== null ? json_decode($row['meta_json'], true) : null,
        ];
    }

    /**
     * Return the most recent mission events, newest first.
     *
     * GET /api/cubesat/events?limit=50
     *
     * @return \CodeIgniter\HTTP\ResponseInterface
     */
    public function index()
    {
        $limit = (int) ($this->request->getGet('limit') ?? 50);

        if ($limit < 1 || $limit > 500) {
            $limit = 50;
        }

        if ($this->isDemoMode()) {
            $svc     = new DemoDataService();
            $state   = (new DemoStateService())->getState();
            $records = $svc->generateEvents($limit, $state['events'] ?? []);

            return $this->response
                ->setStatusCode(200)
                ->setContentType('application/json')
                ->setJSON([
                    'count'   => count($records),
                    'records' => $records,
                ]);
        }

        $records   = $this->model->getRecent($limit);
        $formatted = array_map([$this, 'formatEvent'], $records);

        return $this->response
            ->setStatusCode(200)
            ->setContentType('application/json')
            ->setJSON([
                'count'   => count($formatted),
                'records' => $formatted,
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
