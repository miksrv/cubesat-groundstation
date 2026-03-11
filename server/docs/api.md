# CubeSat Telemetry API

## Base URL

```
http://localhost:8080
```

All responses are `Content-Type: application/json`.

---

## Endpoints

### POST /api/cubesat/telemetry

Ingest a telemetry snapshot transmitted by the CubeSat. The request body must be a valid JSON object containing all required subsystem keys. The server validates the payload, flattens the nested structure, and persists a single row to the database.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | string (ISO 8601) | Yes | UTC datetime of the measurement |
| `eps` | object | Yes | Electrical Power System data |
| `eps.battery` | number | No | Battery charge level (%) |
| `eps.voltage` | number | No | Bus voltage (V) |
| `eps.external_power` | integer (0/1) | No | External power connected flag |
| `adcs` | object | Yes | Attitude Determination and Control System data |
| `adcs.roll` | number | No | Roll angle (degrees) |
| `adcs.pitch` | number | No | Pitch angle (degrees) |
| `adcs.yaw` | number | No | Yaw angle (degrees) |
| `adcs.imu_temp` | number | No | IMU temperature (°C) |
| `adcs.accel` | object | No | Accelerometer readings (g) |
| `adcs.accel.x` | number | No | X-axis acceleration |
| `adcs.accel.y` | number | No | Y-axis acceleration |
| `adcs.accel.z` | number | No | Z-axis acceleration |
| `adcs.gyro` | object | No | Gyroscope readings (rad/s) |
| `adcs.gyro.x` | number | No | X-axis angular rate |
| `adcs.gyro.y` | number | No | Y-axis angular rate |
| `adcs.gyro.z` | number | No | Z-axis angular rate |
| `payload` | object | Yes | Science/sensor payload data |
| `payload.temperature` | number | No | Ambient temperature (°C) |
| `payload.humidity` | number | No | Relative humidity (%) |
| `payload.pressure` | number | No | Atmospheric pressure (hPa) |
| `system` | object | Yes | On-board computer system metrics |
| `system.cpu_percent` | number | No | CPU utilisation (%) |
| `system.ram_percent` | number | No | RAM utilisation (%) |
| `system.swap_percent` | number | No | Swap utilisation (%) |
| `system.disk_percent` | number | No | Disk utilisation (%) |
| `system.uptime_seconds` | integer | No | System uptime (seconds) |
| `system.cpu_temperature` | number | No | CPU temperature (°C) |
| `obc` | object | Yes | On-Board Computer state |
| `obc.state` | string | No | OBC state string (e.g. `"NOMINAL"`) |
| `gps` | object | Yes | GPS / location data |
| `gps.latitude` | number | No | Latitude (decimal degrees) |
| `gps.longitude` | number | No | Longitude (decimal degrees) |
| `gps.altitude` | number | No | Altitude above sea level (km) |

**Example request body:**

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

#### Success Response — `201 Created`

```json
{
  "status": "success",
  "id": 42,
  "message": "Telemetry data saved"
}
```

#### Error Responses

| Status | Condition | Example body |
|--------|-----------|--------------|
| `400 Bad Request` | One or more required top-level keys (`timestamp`, `eps`, `adcs`, `payload`, `system`, `obc`, `gps`) are missing | `{"error":"Validation failed","details":["The eps field is required."]}` |
| `422 Unprocessable Entity` | Request body is not valid JSON | `{"error":"Invalid JSON payload","details":["Syntax error"]}` |
| `500 Internal Server Error` | Database write failed | `{"error":"Failed to save telemetry data"}` |

#### curl Example

```bash
curl -X POST http://localhost:8080/api/cubesat/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2026-03-11T14:30:00Z",
    "eps":     {"battery": 87.5, "voltage": 12.4, "external_power": 1},
    "adcs":    {"roll": 15.3, "pitch": -2.7, "yaw": 180.5, "imu_temp": 23.4,
                "accel": {"x": 0.012, "y": -0.003, "z": 9.81},
                "gyro":  {"x": 0.001, "y": 0.002,  "z": -0.001}},
    "payload": {"temperature": 22.5, "humidity": 45.2, "pressure": 1013.25},
    "system":  {"cpu_percent": 35.2, "ram_percent": 62.8, "swap_percent": 12.3,
                "disk_percent": 48.7, "uptime_seconds": 86400, "cpu_temperature": 45.3},
    "obc":     {"state": "NOMINAL"},
    "gps":     {"latitude": 55.7558, "longitude": 37.6173, "altitude": 400.5}
  }'
```

---

### GET /api/cubesat/telemetry/latest

Return the single most recent telemetry record stored in the database.

#### Query Parameters

None.

#### Success Response — `200 OK`

Returns the flat database row as a JSON object.

```json
{
  "id": 42,
  "timestamp": "2026-03-11T14:30:00Z",
  "battery": "87.50",
  "voltage": "12.40",
  "external_power": "1",
  "roll": "15.30",
  "pitch": "-2.70",
  "yaw": "180.50",
  "imu_temp": "23.40",
  "accel_x": "0.0120",
  "accel_y": "-0.0030",
  "accel_z": "9.8100",
  "gyro_x": "0.0010",
  "gyro_y": "0.0020",
  "gyro_z": "-0.0010",
  "temperature": "22.50",
  "humidity": "45.20",
  "pressure": "1013.25",
  "cpu_percent": "35.20",
  "ram_percent": "62.80",
  "swap_percent": "12.30",
  "disk_percent": "48.70",
  "uptime_seconds": "86400",
  "cpu_temperature": "45.30",
  "obc_state": "NOMINAL",
  "latitude": "55.7558000",
  "longitude": "37.6173000",
  "altitude": "400.50",
  "raw_json": "{...}"
}
```

#### Error Responses

| Status | Condition | Example body |
|--------|-----------|--------------|
| `404 Not Found` | No records exist in the database | `{"error":"No telemetry records found"}` |

#### curl Example

```bash
curl http://localhost:8080/api/cubesat/telemetry/latest
```

---

### GET /api/cubesat/telemetry/history

Return the last N telemetry records, ordered from newest to oldest. Useful for populating time-series graphs with a fixed rolling window.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | No | `100` | Number of records to return. Clamped to [1, 10000]; any value outside that range defaults to 100. |

#### Success Response — `200 OK`

```json
{
  "count": 2,
  "records": [
    {
      "id": 43,
      "timestamp": "2026-03-11T14:30:30Z",
      "battery": "88.00",
      "..."
    },
    {
      "id": 42,
      "timestamp": "2026-03-11T14:30:00Z",
      "battery": "87.50",
      "..."
    }
  ]
}
```

#### Error Responses

This endpoint always returns `200`. An empty `records` array is returned when there is no data.

#### curl Examples

```bash
# Default – last 100 records
curl http://localhost:8080/api/cubesat/telemetry/history

# Custom limit – last 500 records
curl "http://localhost:8080/api/cubesat/telemetry/history?limit=500"
```

---

### GET /api/cubesat/telemetry/range

Return all telemetry records whose `timestamp` falls within the specified inclusive range. Records are ordered from oldest to newest (ascending), making them suitable for direct charting.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string (ISO 8601) | Yes | Start of the range (inclusive), e.g. `2026-03-11T00:00:00Z` |
| `to` | string (ISO 8601) | Yes | End of the range (inclusive), e.g. `2026-03-11T23:59:59Z` |

#### Success Response — `200 OK`

```json
{
  "count": 2,
  "from": "2026-03-11T00:00:00Z",
  "to": "2026-03-11T23:59:59Z",
  "records": [
    {
      "id": 1,
      "timestamp": "2026-03-11T00:00:00Z",
      "battery": "80.00",
      "..."
    },
    {
      "id": 42,
      "timestamp": "2026-03-11T14:30:00Z",
      "battery": "87.50",
      "..."
    }
  ]
}
```

#### Error Responses

| Status | Condition | Example body |
|--------|-----------|--------------|
| `400 Bad Request` | Either `from` or `to` (or both) are missing | `{"error":"Validation failed","details":["Both \"from\" and \"to\" query parameters are required"]}` |

#### curl Example

```bash
curl "http://localhost:8080/api/cubesat/telemetry/range?from=2026-03-11T00:00:00Z&to=2026-03-11T23:59:59Z"
```

---

## Database Schema

The API persists telemetry to the `cubesat_telemetry` table. The nested JSON payload is flattened into individual columns:

```sql
CREATE TABLE cubesat_telemetry (
    id               INTEGER PRIMARY KEY AUTO_INCREMENT,
    timestamp        DATETIME NOT NULL,

    -- EPS (Electrical Power System)
    battery          DECIMAL(5,2),
    voltage          DECIMAL(5,2),
    external_power   TINYINT(1),

    -- ADCS (Attitude Determination and Control)
    roll             DECIMAL(6,2),
    pitch            DECIMAL(6,2),
    yaw              DECIMAL(6,2),
    imu_temp         DECIMAL(5,2),
    accel_x          DECIMAL(8,4),
    accel_y          DECIMAL(8,4),
    accel_z          DECIMAL(8,4),
    gyro_x           DECIMAL(8,4),
    gyro_y           DECIMAL(8,4),
    gyro_z           DECIMAL(8,4),

    -- Payload (Science Data)
    temperature      DECIMAL(5,2),
    humidity         DECIMAL(5,2),
    pressure         DECIMAL(7,2),

    -- System Metrics
    cpu_percent      DECIMAL(5,2),
    ram_percent      DECIMAL(5,2),
    swap_percent     DECIMAL(5,2),
    disk_percent     DECIMAL(5,2),
    uptime_seconds   INTEGER,
    cpu_temperature  DECIMAL(5,2),

    -- OBC State
    obc_state        VARCHAR(20),

    -- GPS / Location
    latitude         DECIMAL(10,7),
    longitude        DECIMAL(10,7),
    altitude         DECIMAL(8,2),

    -- Raw data backup
    raw_json         TEXT,

    INDEX idx_timestamp (timestamp),
    INDEX idx_obc_state (obc_state)
);
```

---

## Error Format

All error responses share a consistent shape:

```json
{
  "error": "Human-readable error message",
  "details": ["Optional array of specific validation messages"]
}
```

The `details` field is omitted when there are no per-field messages (e.g. `500` errors).
