<?php

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 */
$routes->get('/', 'Home::index');

// CubeSat Telemetry API routes
$routes->post('api/cubesat/telemetry', 'Api\TelemetryController::store');
$routes->get('api/cubesat/telemetry/latest', 'Api\TelemetryController::latest');
$routes->get('api/cubesat/telemetry/history', 'Api\TelemetryController::history');
$routes->get('api/cubesat/telemetry/range', 'Api\TelemetryController::range');

// Handle OPTIONS preflight for CORS
$routes->options('api/(:any)', static function () {
    return response()->setStatusCode(200);
});
