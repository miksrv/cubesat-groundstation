# Feature 3: Refactoring

This document describes testing requirements, code quality standards, and API response formatting for the CubeSat GroundStation project.

---

## 1. Frontend Testing Requirements

### 1.1 Test File Location

All UI component tests **MUST** be placed inside the component's own directory, not in a separate `__tests__` folder.

**Correct structure:**
```
components/
├── EPSPanel/
│   ├── EPSPanel.tsx
│   ├── EPSPanel.module.scss
│   └── EPSPanel.test.tsx      ← Test file inside component folder
├── ADCSPanel/
│   ├── ADCSPanel.tsx
│   ├── ADCSPanel.module.scss
│   └── ADCSPanel.test.tsx
└── Dashboard/
    ├── Dashboard.tsx
    ├── Dashboard.module.scss
    └── Dashboard.test.tsx
```

**Incorrect structure (DO NOT use):**
```
__tests__/
├── EPSPanel.test.tsx
├── ADCSPanel.test.tsx
└── Dashboard.test.tsx
```

### 1.2 Code Quality Checks

After writing or modifying any frontend code, **ALWAYS** run:

```bash
# Check ESLint rules
npm run eslint:check

# Fix Prettier formatting
npm run prettier:fix
```

Both commands must pass without errors before committing code.

### 1.3 Test Coverage Requirements

- All React components must have unit tests
- Test user interactions and state changes
- Test error states and loading states
- Mock API calls using Jest mocks
- Use `@testing-library/react` for component testing

---

## 2. Backend API Response Formatting

### 2.1 Response Data Types

All telemetry API endpoints MUST return properly typed values:

| Field | Type | Notes |
|-------|------|-------|
| `id` | `number` | Integer, not string |
| `timestamp` | `string` | ISO 8601 format: `"2026-03-12T14:30:00"` |
| `battery` | `number` | Float, e.g., `85.5` |
| `voltage` | `number` | Float, e.g., `7.8` |
| `external_power` | `number` | Integer: `0` or `1` |
| `roll`, `pitch`, `yaw` | `number` | Float |
| `imu_temp` | `number` | Float |
| `accel_x`, `accel_y`, `accel_z` | `number` | Float |
| `gyro_x`, `gyro_y`, `gyro_z` | `number` | Float |
| `temperature` | `number` | Float |
| `humidity` | `number` | Float |
| `pressure` | `number` | Float |
| `cpu_percent`, `ram_percent`, `swap_percent`, `disk_percent` | `number` | Float |
| `uptime_seconds` | `number` | Integer |
| `cpu_temperature` | `number` | Float |
| `obc_state` | `string` | e.g., `"NOMINAL"` |
| `latitude`, `longitude` | `number` | Float |
| `altitude` | `number` | Float |

### 2.2 Excluded Fields

The following fields MUST be **excluded** from API responses:

- `raw_json` — Do NOT include in `/telemetry/latest` and `/telemetry/history` responses

### 2.3 Example Response

**GET /api/cubesat/telemetry/latest**
```json
{
    "id": 1,
    "timestamp": "2026-03-12T14:30:00",
    "battery": 85.5,
    "voltage": 7.8,
    "external_power": 1,
    "roll": 0.5,
    "pitch": -1.2,
    "yaw": 45.3,
    "imu_temp": 25.4,
    "accel_x": 0.01,
    "accel_y": -0.02,
    "accel_z": 9.81,
    "gyro_x": 0.001,
    "gyro_y": 0.002,
    "gyro_z": -0.001,
    "temperature": 22.5,
    "humidity": 45.0,
    "pressure": 1013.25,
    "cpu_percent": 15.5,
    "ram_percent": 42.3,
    "swap_percent": 5.0,
    "disk_percent": 35.8,
    "uptime_seconds": 86400,
    "cpu_temperature": 48.5,
    "obc_state": "NOMINAL",
    "latitude": 55.7558,
    "longitude": 37.6173,
    "altitude": 420.5
}
```

### 2.4 Frontend Data Handling

Since API returns properly typed values, **DO NOT** perform type conversions in frontend code:

```typescript
// ❌ WRONG - unnecessary conversion
const battery = Number(data.battery)

// ✅ CORRECT - use value directly
const battery = data.battery
```

---

## 3. Backend Testing Requirements

### 3.1 PHPUnit Tests

- All API endpoints must have unit tests
- Test validation rules for incoming data
- Test error responses (400, 401, 404, 500)
- Test database operations
- Use test database or fixtures

### 3.2 Test Commands

```bash
cd server

# Run all tests
./vendor/bin/phpunit

# Run specific test file
./vendor/bin/phpunit tests/unit/TelemetryControllerTest.php

# Run with coverage report
./vendor/bin/phpunit --coverage-html build/coverage
```

---

## 4. Integration Testing

### 4.1 End-to-End Tests (Cypress)

Test complete user workflows:
- Dashboard loads and displays telemetry data
- Charts render correctly with data
- Polling updates data every 30 seconds
- Error states display correctly when API is unavailable

### 4.2 Cypress Commands

```bash
cd client

# Open Cypress interactive mode
npx cypress open

# Run tests headlessly
npx cypress run
```

---

## 5. Testing Checklist

Before marking any card as "Testing":

### Frontend
- [ ] Component has unit test in same directory
- [ ] `npm run eslint:check` passes
- [ ] `npm run prettier:fix` applied
- [ ] `npm test` passes
- [ ] No TypeScript errors

### Backend
- [ ] Endpoint has PHPUnit test
- [ ] API returns numbers (not strings)
- [ ] `raw_json` field excluded from responses
- [ ] `./vendor/bin/phpunit` passes

### Integration
- [ ] Frontend correctly displays API data
- [ ] No console errors in browser
- [ ] Charts render with real data
