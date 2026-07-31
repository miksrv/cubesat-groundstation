<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * AddSubsystemDetailColumnsToTelemetry
 *
 * Additive migration for Feature 7 (Mission Control widget redesign). Adds
 * nullable columns needed by the new Thermal, Payload, OBC and Comms widgets.
 * No existing columns are modified, renamed, or dropped.
 */
class AddSubsystemDetailColumnsToTelemetry extends Migration
{
    public function up()
    {
        $this->forge->addColumn('cubesat_telemetry', [
            // Thermal System widget
            'obc_temperature' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
                'after'      => 'cpu_temperature',
            ],
            'eps_temperature' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
                'after'      => 'obc_temperature',
            ],
            'battery_temperature' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
                'after'      => 'eps_temperature',
            ],
            'payload_temperature' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
                'after'      => 'battery_temperature',
            ],

            // Payload widget
            'camera_status' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
            ],
            'image_count' => [
                'type' => 'INTEGER',
                'null' => true,
            ],
            'image_resolution' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
            ],
            'sensor_status' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
            ],
            'science_mode' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => true,
            ],
            'payload_power_watts' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
            ],

            // OBC System widget
            'boot_count' => [
                'type' => 'INTEGER',
                'null' => true,
            ],

            // Comms / Ground Station Link widget
            'rssi' => [
                'type' => 'INTEGER',
                'null' => true,
            ],
            'snr' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
            ],
            'uplink_bps' => [
                'type' => 'INTEGER',
                'null' => true,
            ],
            'downlink_bps' => [
                'type' => 'INTEGER',
                'null' => true,
            ],
            'latency_ms' => [
                'type' => 'INTEGER',
                'null' => true,
            ],
            'packet_loss_pct' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
            ],

            // GPS
            'speed_kms' => [
                'type'       => 'DECIMAL',
                'constraint' => '6,3',
                'null'       => true,
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('cubesat_telemetry', [
            'obc_temperature',
            'eps_temperature',
            'battery_temperature',
            'payload_temperature',
            'camera_status',
            'image_count',
            'image_resolution',
            'sensor_status',
            'science_mode',
            'payload_power_watts',
            'boot_count',
            'rssi',
            'snr',
            'uplink_bps',
            'downlink_bps',
            'latency_ms',
            'packet_loss_pct',
            'speed_kms',
        ]);
    }
}
