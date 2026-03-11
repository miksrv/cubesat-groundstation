# Feature 1: Backend API - Data Ingestion

## Goal
Receive CubeSat telemetry every 30 seconds and save it in MySQL.

## Database Schema
Table: `cubesat_telemetry`
```sql
CREATE TABLE cubesat_telemetry (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    timestamp DATETIME NOT NULL,
    
    -- EPS (Electrical Power System)
    battery DECIMAL(5,2),
    voltage DECIMAL(5,2),
    external_power TINYINT(1),
    
    -- ADCS (Attitude Determination and Control)
    roll DECIMAL(6,2),
    pitch DECIMAL(6,2),
    yaw DECIMAL(6,2),
    imu_temp DECIMAL(5,2),
    accel_x DECIMAL(8,4),
    accel_y DECIMAL(8,4),
    accel_z DECIMAL(8,4),
    gyro_x DECIMAL(8,4),
    gyro_y DECIMAL(8,4),
    gyro_z DECIMAL(8,4),
    
    -- Payload (Science Data)
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    pressure DECIMAL(7,2),
    
    -- System Metrics
    cpu_percent DECIMAL(5,2),
    ram_percent DECIMAL(5,2),
    swap_percent DECIMAL(5,2),
    disk_percent DECIMAL(5,2),
    uptime_seconds INTEGER,
    cpu_temperature DECIMAL(5,2),
    
    -- OBC State
    obc_state VARCHAR(20),
    
    -- GPS / Location (NEW)
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    altitude DECIMAL(8,2),
    
    -- Raw data backup
    raw_json TEXT,
    
    INDEX idx_timestamp (timestamp),
    INDEX idx_obc_state (obc_state)
);
```

## JSON Payload Example
```json
{
  "timestamp": "2026-03-11T14:30:00Z",
  "eps": {
    "battery": 87.5,
    "voltage": 12.4,
    "external_power": 1
  },
  "adcs": {
    "roll": 15.3,
    "pitch": -2.7,
    "yaw": 180.5,
    "imu_temp": 23.4,
    "accel": {"x": 0.012, "y": -0.003, "z": 9.81},
    "gyro": {"x": 0.001, "y": 0.002, "z": -0.001}
  },
  "payload": {
    "temperature": 22.5,
    "humidity": 45.2,
    "pressure": 1013.25
  },
  "system": {
    "cpu_percent": 35.2,
    "ram_percent": 62.8,
    "swap_percent": 12.3,
    "disk_percent": 48.7,
    "uptime_seconds": 86400,
    "cpu_temperature": 45.3
  },
  "obc": {
    "state": "NOMINAL"
  },
  "gps": {
    "latitude": 55.7558,
    "longitude": 37.6173,
    "altitude": 400.5
  }
}
```

## Endpoints
- `POST /api/cubesat/telemetry` – save telemetry payload
- `GET /api/cubesat/telemetry/latest` – return latest telemetry
- `GET /api/cubesat/telemetry/history?limit=100` – return last N records
- `GET /api/cubesat/telemetry/range?from=timestamp&to=timestamp` – time range query

## Micro-tasks
1. Create CodeIgniter 4 project in `server/` folder
2. Setup MySQL database connection (config/database.php)
3. Create migration for table `cubesat_telemetry`
4. Create `TelemetryModel` with CRUD methods
5. Implement `TelemetryController` with methods:
    - `store()` - handle POST requests
    - `latest()` - return latest record
    - `history()` - return last N records
    - `range()` - return time-filtered records
6. Add JSON payload validation middleware
7. Add CORS configuration for frontend
8. Write PHPUnit tests for all endpoints
9. Create API documentation in comments
10. Commit and open PR
