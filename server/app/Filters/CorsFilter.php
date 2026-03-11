<?php

namespace App\Filters;

use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\Filters\FilterInterface;

/**
 * CorsFilter
 *
 * Handles Cross-Origin Resource Sharing (CORS) headers for all API routes.
 * Returns 200 immediately for OPTIONS preflight requests.
 */
class CorsFilter implements FilterInterface
{
    /**
     * Add CORS headers to every response and short-circuit OPTIONS preflight.
     */
    public function before(RequestInterface $request, $arguments = null)
    {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');

        // Handle OPTIONS preflight immediately
        if ($request->getMethod() === 'options') {
            header('HTTP/1.1 200 OK');
            exit(0);
        }
    }

    /**
     * Ensure CORS headers are present on the actual response as well.
     */
    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        $response->setHeader('Access-Control-Allow-Origin', '*');
        $response->setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        $response->setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        return $response;
    }
}
