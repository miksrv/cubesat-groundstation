<?php

namespace App\Services;

/**
 * OrbitService
 *
 * Computes a deterministic, self-consistent set of mock orbital elements for
 * the Orbit & Ground Track / Orbit Info widgets. This is NOT a real SGP4/TLE
 * propagator — it models a simple circular LEO orbit (fixed inclination,
 * slowly precessing RAAN, Kepler-derived period from altitude) so the numbers
 * stay physically plausible and reproducible from a timestamp alone, with no
 * randomness — same philosophy as DemoDataService.
 *
 * @package App\Services
 */
class OrbitService
{
    private const EARTH_RADIUS_KM = 6371.0;
    private const MU_EARTH        = 398600.4418; // km^3/s^2, standard gravitational parameter

    /** Same mission epoch used by DemoDataService (2026-07-30 00:00:00 UTC), so orbit_number stays consistent. */
    private const BASE_EPOCH = 1785369600;

    private const INCLINATION_DEG      = 97.45; // sun-synchronous-like LEO
    private const RAAN_EPOCH_DEG       = 100.0;
    private const RAAN_DRIFT_DEG_PER_S = -0.98 / 86400.0; // ~ -0.98 deg/day precession
    private const AOP_EPOCH_DEG        = 80.0;
    private const AOP_DRIFT_DEG_PER_S  = 0.05 / 86400.0;

    /** Fraction of each orbit near "start" treated as the ground-station visibility window. */
    private const VISIBILITY_FRACTION = 0.12;

    /** Fraction of each orbit (centered on true anomaly 180°) spent in Earth's shadow. */
    private const ECLIPSE_FRACTION = 0.35;

    private function r(float $value, int $decimals = 2): float
    {
        return round($value, $decimals);
    }

    /**
     * Compute the current mock orbital state for the given moment.
     *
     * @param \DateTime $timestamp Moment to evaluate (UTC)
     * @param array     $groundStation ['name' => string, 'lat' => float, 'lon' => float]
     * @return array
     */
    public function getState(\DateTime $timestamp, array $groundStation): array
    {
        $ts      = $timestamp->getTimestamp();
        $elapsed = max(0, $ts - self::BASE_EPOCH);

        // Altitude oscillates gently around ~506 km (matches the GPS altitude simulated
        // in DemoDataService, kept as an independent but similarly-scaled mock value).
        $altitudeKm = 506.0 + 6.0 * sin((2 * M_PI * $ts) / 5520.0 + M_PI / 4);

        $semiMajorAxisKm = self::EARTH_RADIUS_KM + $altitudeKm;
        $periodSeconds   = 2 * M_PI * sqrt(($semiMajorAxisKm ** 3) / self::MU_EARTH);

        $orbitNumber    = (int) floor($elapsed / $periodSeconds) + 1;
        $elapsedInOrbit = fmod($elapsed, $periodSeconds);
        $trueAnomalyDeg = ($elapsedInOrbit / $periodSeconds) * 360.0;

        $raanDeg = fmod(self::RAAN_EPOCH_DEG + self::RAAN_DRIFT_DEG_PER_S * $elapsed, 360.0);
        if ($raanDeg < 0) {
            $raanDeg += 360.0;
        }
        $aopDeg = fmod(self::AOP_EPOCH_DEG + self::AOP_DRIFT_DEG_PER_S * $elapsed, 360.0);
        if ($aopDeg < 0) {
            $aopDeg += 360.0;
        }

        // Beta angle: slow ~60-day oscillation between roughly -60° and +60°
        $betaAngleDeg = 45.0 * sin((2 * M_PI * $ts) / (60 * 86400.0) + 0.6);

        // Eclipse: simplified — a fixed-width shadow arc centered opposite the ascending node
        $distFromAntiNode = abs(fmod($trueAnomalyDeg - 180.0 + 540.0, 360.0) - 180.0);
        $eclipse           = $distFromAntiNode < (self::ECLIPSE_FRACTION * 360.0 / 2);

        // Ground-station visibility window: first slice of each orbit
        $visibilityWindowSeconds = self::VISIBILITY_FRACTION * $periodSeconds;
        $inVisibilityWindow      = $elapsedInOrbit < $visibilityWindowSeconds;
        $nextPassSeconds         = $inVisibilityWindow
            ? 0
            : (int) round($periodSeconds - $elapsedInOrbit);

        return [
            'orbit_type'       => 'LEO',
            'altitude_km'      => $this->r($altitudeKm, 1),
            'inclination_deg'  => $this->r(self::INCLINATION_DEG, 2),
            'period_min'       => $this->r($periodSeconds / 60.0, 2),
            'raan_deg'         => $this->r($raanDeg, 2),
            'aop_deg'          => $this->r($aopDeg, 2),
            'true_anomaly_deg' => $this->r($trueAnomalyDeg, 2),
            'eclipse'          => $eclipse,
            'beta_angle_deg'   => $this->r($betaAngleDeg, 1),
            'orbit_number'     => $orbitNumber,
            'ground_station'   => $groundStation,
            'next_pass_seconds'=> $nextPassSeconds,
        ];
    }
}
