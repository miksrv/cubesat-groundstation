<?php

namespace App\Services;

use Config\Services;

/**
 * DemoStateService
 *
 * Persists a small piece of mutable "satellite state" for demo mode, so that
 * commands sent from the Mission Console / Quick Commands widgets actually
 * affect the telemetry that DemoDataService generates afterwards (reboot
 * resets uptime, safe mode changes obc_state, science mode toggles, etc.).
 *
 * State is stored in CodeIgniter's file cache (never the MySQL database, to
 * keep demo mode side-effect-free for the real data store) under a single
 * global key — shared by every visitor of the demo, which is the desired
 * behavior for a public demo instance.
 *
 * @package App\Services
 */
class DemoStateService
{
    private const CACHE_KEY = 'demo_satellite_state';

    /** Seconds the OBC stays in the transient 'REBOOT' state after a reboot command. */
    public const REBOOT_WINDOW = 15;

    /** Seconds over which ADCS values decay back to nominal after a reset. */
    public const ADCS_DECAY_WINDOW = 120;

    /** Max number of manually-triggered events kept in state. */
    private const MAX_EVENTS = 20;

    /**
     * Confirmation messages, mirrored from CommandsController so state
     * transitions and event log entries use identical wording.
     */
    private const COMMAND_MESSAGES = [
        'REFRESH_TELEMETRY'    => 'Telemetry refresh requested',
        'ENABLE_SCIENCE_MODE'  => 'Science mode enabled',
        'DISABLE_SCIENCE_MODE' => 'Science mode disabled',
        'REBOOT_OBC'           => 'OBC reboot command queued',
        'RESET_ADCS'           => 'ADCS reset command queued',
        'SAFE_MODE'            => 'Safe mode command queued',
    ];

    /**
     * Read the current demo state, initializing defaults on first use.
     *
     * @return array
     */
    public function getState(): array
    {
        $cache = Services::cache();
        $state = $cache->get(self::CACHE_KEY);

        if (!is_array($state)) {
            $state = $this->defaults();
        }

        return $state + $this->defaults();
    }

    /**
     * Apply a command to the demo satellite state.
     *
     * @param string $command One of the allow-listed CommandName values
     * @return array{message: ?string} `message` is non-null only when the
     *         command was rejected (e.g. enabling science mode while in
     *         SAFE_MODE) and should be shown to the user instead of the
     *         normal canned confirmation.
     */
    public function applyCommand(string $command): array
    {
        $state = $this->getState();
        $now   = (new \DateTime('now', new \DateTimeZone('UTC')))->getTimestamp();
        $rejection = null;

        switch ($command) {
            case 'REBOOT_OBC':
                $state['last_reboot_at']        = $now;
                $state['boot_count']            = ($state['boot_count'] ?? 7) + 1;
                $state['obc_state']             = 'REBOOT';
                $state['obc_state_since']       = $now;
                $state['science_mode_override'] = null;
                $state['adcs_reset_at']          = null;
                break;

            case 'RESET_ADCS':
                $state['adcs_reset_at'] = $now;
                break;

            case 'SAFE_MODE':
                $state['obc_state']             = 'SAFE_MODE';
                $state['obc_state_since']       = $now;
                $state['science_mode_override'] = false;
                break;

            case 'ENABLE_SCIENCE_MODE':
                if ($state['obc_state'] === 'SAFE_MODE') {
                    $rejection = "Cannot enable science mode: OBC is in SAFE_MODE. Send 'reboot obc' to recover.";
                } else {
                    $state['science_mode_override'] = true;
                }
                break;

            case 'DISABLE_SCIENCE_MODE':
                $state['science_mode_override'] = false;
                break;

            case 'REFRESH_TELEMETRY':
            default:
                break;
        }

        if ($rejection === null) {
            $state['events'] = array_slice(
                array_merge($state['events'] ?? [], [[
                    'timestamp' => $now,
                    'type'      => 'command',
                    'severity'  => 'success',
                    'message'   => self::COMMAND_MESSAGES[$command] ?? $command,
                ]]),
                -self::MAX_EVENTS
            );
        }

        Services::cache()->save(self::CACHE_KEY, $state);

        return ['message' => $rejection];
    }

    /**
     * Default state: mirrors the previous hardcoded behavior of
     * DemoDataService (uptime since BASE_EPOCH, boot_count 7, always
     * NOMINAL, automatic science mode cycling).
     *
     * @return array
     */
    private function defaults(): array
    {
        return [
            'last_reboot_at'        => DemoDataService::BASE_EPOCH,
            'boot_count'            => 7,
            'obc_state'             => 'NOMINAL',
            'obc_state_since'       => DemoDataService::BASE_EPOCH,
            'science_mode_override' => null,
            'adcs_reset_at'         => null,
            'events'                => [],
        ];
    }
}
