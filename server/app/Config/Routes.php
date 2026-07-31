<?php

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 */
// CubeSat Telemetry API routes
$routes->post('api/cubesat/telemetry', 'Api\TelemetryController::store');
$routes->get('api/cubesat/telemetry/latest', 'Api\TelemetryController::latest');
$routes->get('api/cubesat/telemetry/history', 'Api\TelemetryController::history');
$routes->get('api/cubesat/telemetry/range', 'Api\TelemetryController::range');

// Mission events, simulated commands, orbit mechanics (Feature 7)
$routes->get('api/cubesat/events', 'Api\EventsController::index');
$routes->post('api/cubesat/commands', 'Api\CommandsController::store');
$routes->get('api/cubesat/orbit', 'Api\OrbitController::index');

// Handle OPTIONS preflight for CORS
$routes->options('api/(:any)', static function () {
    return response()->setStatusCode(200);
});
