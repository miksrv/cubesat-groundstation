<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateMissionEventsTable extends Migration
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
            'type' => [
                // state_transition | command | deployment | alert | info
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => false,
            ],
            'severity' => [
                // info | success | warning | critical
                'type'       => 'VARCHAR',
                'constraint' => 10,
                'null'       => false,
                'default'    => 'info',
            ],
            'message' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => false,
            ],
            'meta_json' => [
                'type' => 'TEXT',
                'null' => true,
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addKey('timestamp');
        $this->forge->addKey('severity');

        $this->forge->createTable('mission_events', true); // IF NOT EXISTS
    }

    public function down()
    {
        $this->forge->dropTable('mission_events');
    }
}
