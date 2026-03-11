<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateCubesatTelemetryTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'           => 'INTEGER',
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'timestamp' => [
                'type' => 'DATETIME',
                'null' => false,
            ],

            // EPS (Electrical Power System)
            'battery' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
            ],
            'voltage' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
            ],
            'external_power' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => true,
            ],

            // ADCS (Attitude Determination and Control)
            'roll' => [
                'type'       => 'DECIMAL',
                'constraint' => '6,2',
                'null'       => true,
            ],
            'pitch' => [
                'type'       => 'DECIMAL',
                'constraint' => '6,2',
                'null'       => true,
            ],
            'yaw' => [
                'type'       => 'DECIMAL',
                'constraint' => '6,2',
                'null'       => true,
            ],
            'imu_temp' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
            ],
            'accel_x' => [
                'type'       => 'DECIMAL',
                'constraint' => '8,4',
                'null'       => true,
            ],
            'accel_y' => [
                'type'       => 'DECIMAL',
                'constraint' => '8,4',
                'null'       => true,
            ],
            'accel_z' => [
                'type'       => 'DECIMAL',
                'constraint' => '8,4',
                'null'       => true,
            ],
            'gyro_x' => [
                'type'       => 'DECIMAL',
                'constraint' => '8,4',
                'null'       => true,
            ],
            'gyro_y' => [
                'type'       => 'DECIMAL',
                'constraint' => '8,4',
                'null'       => true,
            ],
            'gyro_z' => [
                'type'       => 'DECIMAL',
                'constraint' => '8,4',
                'null'       => true,
            ],

            // Payload (Science Data)
            'temperature' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
            ],
            'humidity' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
            ],
            'pressure' => [
                'type'       => 'DECIMAL',
                'constraint' => '7,2',
                'null'       => true,
            ],

            // System Metrics
            'cpu_percent' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
            ],
            'ram_percent' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
            ],
            'swap_percent' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
            ],
            'disk_percent' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
            ],
            'uptime_seconds' => [
                'type' => 'INTEGER',
                'null' => true,
            ],
            'cpu_temperature' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
            ],

            // OBC State
            'obc_state' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
            ],

            // GPS / Location
            'latitude' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,7',
                'null'       => true,
            ],
            'longitude' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,7',
                'null'       => true,
            ],
            'altitude' => [
                'type'       => 'DECIMAL',
                'constraint' => '8,2',
                'null'       => true,
            ],

            // Raw data backup
            'raw_json' => [
                'type' => 'TEXT',
                'null' => true,
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addKey('timestamp');
        $this->forge->addKey('obc_state');

        $this->forge->createTable('cubesat_telemetry', true); // IF NOT EXISTS
    }

    public function down()
    {
        $this->forge->dropTable('cubesat_telemetry');
    }
}
