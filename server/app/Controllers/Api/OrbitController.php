<?php

namespace App\Controllers\Api;

use App\Services\OrbitService;
use CodeIgniter\Controller;

/**
 * OrbitController
 *
 * Exposes the current mock orbital state (altitude, inclination, period,
 * RAAN, AOP, true anomaly, eclipse, beta angle, orbit number, next pass)
 * for the Orbit Info and Orbit & Ground Track widgets. Always computed —
 * there is no "real" vs "demo" branch here, since this data is inherently
 * derived rather than ingested from the CubeSat.
 *
 * Routes:
 *   GET /api/cubesat/orbit -> index()
 *
 * @package App\Controllers\Api
 */
class OrbitController extends Controller
{
    /**
     * Return the current orbital state.
     *
     * GET /api/cubesat/orbit
     *
     * @return \CodeIgniter\HTTP\ResponseInterface
     */
    public function index()
    {
        $groundStation = [
            'name' => getenv('GROUND_STATION_NAME') ?: 'ORENBURG, RUSSIA',
            'lat'  => (float) (getenv('GROUND_STATION_LAT') ?: 51.7727),
            'lon'  => (float) (getenv('GROUND_STATION_LON') ?: 55.0988),
        ];

        $now   = new \DateTime('now', new \DateTimeZone('UTC'));
        $state = (new OrbitService())->getState($now, $groundStation);

        return $this->response
            ->setStatusCode(200)
            ->setContentType('application/json')
            ->setJSON($state);
    }
}
