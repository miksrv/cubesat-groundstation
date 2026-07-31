<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * AddBatteryCurrentToTelemetry
 *
 * Additive migration for the Power System widget: adds the battery current
 * draw (Amps), used to derive the "Consumption" readouts in mA and W.
 */
class AddBatteryCurrentToTelemetry extends Migration
{
    public function up()
    {
        $this->forge->addColumn('cubesat_telemetry', [
            'battery_current' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => true,
                'after'      => 'external_power',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('cubesat_telemetry', ['battery_current']);
    }
}
