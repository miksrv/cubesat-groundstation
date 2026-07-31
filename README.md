# 🛰️ CubeSat Ground Station

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Project Status](https://img.shields.io/badge/status-in%20development-orange)](https://github.com/miksrv/cubesat-groundstation)

Somewhere on a workbench, a Raspberry Pi wired up like a satellite is streaming telemetry every 30 seconds — battery voltage, orientation, pressure, humidity, system health. This repo is where that data becomes mission control: a PHP/MySQL backend that ingests it and a React/ECharts dashboard that turns it into live, dark-themed charts (plus a live orbit map) you can watch from anywhere. It's the ground half of **[CubeSat Sim](https://github.com/miksrv/cubesat-sim)** — an open-source flight-software stack running on real hardware, not just a simulation on paper. If you're into satellite software, distributed systems, or just like watching real-time telemetry roll in, take a look — and a ⭐ helps others find it.

**📊 Project Board:** [GitHub Projects #8](https://github.com/users/miksrv/projects/8/) · **🛰️ Companion Project:** [CubeSat Sim](https://github.com/miksrv/cubesat-sim)

---

## 🌟 Features

- **Real-time Telemetry:** Receive and display CubeSat data every 30 seconds
- **Interactive Dashboard:** Dark-themed UI with ECharts visualizations
- **Multi-subsystem Monitoring:**
  - 🔋 **EPS:** Battery level, voltage, power status
  - 🧭 **ADCS:** Orientation (roll, pitch, yaw), IMU sensors
  - 🗺️ **GPS:** Satellite position and altitude tracking
  - 🌡️ **Payload:** Temperature, humidity, pressure sensors
  - 💻 **System:** CPU, RAM, disk usage, uptime
- **REST API:** PHP backend with CodeIgniter 4
- **State Tracking:** OBC state machine monitoring (BOOT → DEPLOY → NOMINAL → SCIENCE → LOW_POWER → SAFE)

---

## 🏗️ Architecture

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   CubeSat    │         │   Backend    │         │   Frontend   │
│              │         │              │         │              │
│  SQLite +    │  HTTP   │  PHP CI4 +   │  HTTP   │  React +     │
│  MQTT        ├────────►│  MySQL       ├────────►│  ECharts     │
│              │  30s    │              │  30s    │              │
│  Telemetry   │         │  REST API    │         │  Dashboard   │
└──────────────┘         └──────────────┘         └──────────────┘
```

### CubeSat Subsystems
- **OBC (On-Board Computer):** Central controller with state machine
- **EPS (Electrical Power System):** Battery and power monitoring
- **ADCS (Attitude Determination and Control):** Orientation sensors
- **Payload:** Science instruments and camera
- **Telemetry Aggregator:** Data collection service
- **Communication:** Subsystems talk over a local MQTT broker on the CubeSat; the Telemetry Aggregator forwards packets to this ground station over HTTP. A LoRa 433 MHz module is present on the hardware but not yet wired into any service (see [CubeSat Sim](https://github.com/miksrv/cubesat-sim#hardware))

---

## 🛠️ Tech Stack

### Backend
- PHP 8.1+ with CodeIgniter 4
- MySQL 8.0+
- PHPUnit for testing
- RESTful JSON API

### Frontend
- **Build Tool:** Rsbuild
- **Framework:** React 19+ (TypeScript)
- **State Management:** Redux Toolkit (RTK Query)
- **Charts:** Apache ECharts
- **Styling:** SASS with dark theme
- **Testing:** Jest, React Testing Library, Cypress

---

## 📁 Project Structure

```
cubesat-groundstation/
├── server/                 # Backend (CodeIgniter 4)
│   ├── app/
│   │   ├── Controllers/    # API controllers
│   │   ├── Models/         # Database models
│   │   └── Database/       # Migrations
│   └── tests/              # PHPUnit tests
│
├── client/                 # Frontend (React + Rsbuild)
│   ├── src/
│   │   ├── app/            # Redux store
│   │   ├── features/       # Redux slices
│   │   ├── components/     # React components
│   │   ├── styles/         # SASS files
│   │   └── utils/          # Utilities
│   └── cypress/            # E2E tests
│
├── docker/                 # Docker configuration
│   ├── mysql/             # MySQL init scripts
│   └── README.md          # Docker setup guide
│
├── docs/                   # Documentation
│   └── CubeSat_Groundstation.postman_collection.json  # API request collection
│
├── requirements/          # Feature specifications
├── .claude/agents/       # AI agent instructions
├── docker-compose.yml    # MySQL container config
├── ROADMAP.md           # Project roadmap
└── CLAUDE.md            # AI team lead instructions
```

---

## 🚀 Quick Start

### Prerequisites
- PHP 8.1+ with Composer
- MySQL 8.0+ **OR** Docker (recommended)
- Node.js 18+ with [Yarn 4](https://yarnpkg.com/getting-started/install) (the client is pinned to `yarn@4.9.2` via Corepack, not npm)
- Git

### 1. Clone Repository

```bash
git clone https://github.com/miksrv/cubesat-groundstation.git
cd cubesat-groundstation
```

### 2. Start MySQL (Docker - Recommended)

```bash
# Start MySQL container in background
docker compose up -d

# Verify MySQL is running
docker compose ps

# Check MySQL health
docker compose logs cubesat
```

**Database credentials:**
- Host: `localhost:3306`
- Database: `cubesat_groundstation`
- User: `cubesat_user`
- Password: `cubesat_password`

### 3. Backend Setup

```bash
# Navigate to server directory
cd server
composer install
cp env .env

# Configure database in .env (use Docker credentials above)
# Then run migrations
php spark migrate

# Start development server
php spark serve
# API available at http://localhost:8080
```

### 4. Frontend Setup

```bash
# Navigate to client directory
cd client
yarn install

# Configure API endpoint
# Edit the `server.proxy` target in rsbuild.config.ts (defaults to a remote
# demo API — point it at http://localhost:8080 for local backend development)

# Start development server
yarn dev
# Dashboard available at http://localhost:3000
```

The client has no `.env` file — the dev-server API proxy is configured directly in [`rsbuild.config.ts`](client/rsbuild.config.ts).

### Running Tests

```bash
# Backend tests
cd server
./vendor/bin/phpunit

# Frontend tests
cd client
yarn test
```

> **Note:** Cypress E2E specs exist under `client/cypress/e2e/`, but the `cypress` package isn't installed yet (`yarn add -D cypress` first) — see [ROADMAP.md](ROADMAP.md) Feature 5.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/cubesat/telemetry` | Store telemetry data |
| `GET` | `/api/cubesat/telemetry/latest` | Get latest telemetry |
| `GET` | `/api/cubesat/telemetry/history?limit=N` | Get last N records |
| `GET` | `/api/cubesat/telemetry/range?from=...&to=...` | Get time range data |

**Example Payload:**
```json
{
  "timestamp": "2026-03-11T14:30:00Z",
  "eps": { "battery": 87.5, "voltage": 12.4, "external_power": 1 },
  "adcs": { "roll": 15.3, "pitch": -2.7, "yaw": 180.5, "imu_temp": 23.4 },
  "payload": { "temperature": 22.5, "humidity": 45.2, "pressure": 1013.25 },
  "system": { "cpu_percent": 35.2, "ram_percent": 62.8 },
  "obc": { "state": "NOMINAL" },
  "gps": { "latitude": 55.7558, "longitude": 37.6173, "altitude": 400.5 }
}
```

See the [Postman collection](docs/CubeSat_Groundstation.postman_collection.json) for ready-to-run request examples.

---

## 📚 Documentation

- **[Postman Collection](docs/CubeSat_Groundstation.postman_collection.json)** - Ready-to-import API requests
- **[ROADMAP.md](ROADMAP.md)** - Feature status, progress, and technical notes per feature
- **[CubeSat Sim](https://github.com/miksrv/cubesat-sim)** - The CubeSat flight-software stack that sends telemetry to this ground station

> Dedicated architecture/API/frontend/deployment guides under `docs/` are planned (see [ROADMAP.md](ROADMAP.md) Feature 6) but not written yet — this README plus the Postman collection are the current source of truth.

---

## 🗺️ Roadmap

Current project status and upcoming features tracked in [ROADMAP.md](ROADMAP.md).

### Completed Features
- ✅ Feature 1: Backend API (10/10 tasks)
- ✅ Feature 2: Frontend Dashboard (20/20 tasks)
- ✅ Feature 3: Refactoring (10/10 tasks)
- ✅ Feature 4: Refactoring UI (8/8 tasks)

### Upcoming
- 📋 Feature 5: QA & Testing (0/24 tasks)
- 📋 Feature 6: Documentation (0/24 tasks)

---

## 🧪 Testing

This project maintains high test coverage:
- **Backend:** PHPUnit with 80% minimum coverage
- **Frontend:** Jest + React Testing Library with 75% minimum coverage
- **E2E:** Cypress for critical user paths
- **Performance:** API < 200ms, Chart rendering < 100ms

---

## 🤝 Contributing

This project uses an AI-driven development workflow with specialized agents:
- **Backend Agent:** PHP/CodeIgniter development
- **Frontend Agent:** React/TypeScript development
- **QA Agent:** Testing and quality assurance
- **Doc Agent:** Documentation management

See [CLAUDE.md](CLAUDE.md) for team workflow details.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🛰️ About CubeSat

CubeSats are miniaturized satellites used for space research and education. This ground station system is designed to receive and visualize telemetry from educational CubeSat missions.

**Related Project:** [CubeSat Sim](https://github.com/miksrv/cubesat-sim) - Educational CubeSat simulation platform

---

**Built with ❤️ for space education and exploration**
