# 🛰️ CubeSat Ground Station

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Project Status](https://img.shields.io/badge/status-in%20development-orange)](https://github.com/miksrv/cubesat-groundstation)

Cloud-based ground station for CubeSat telemetry visualization and real-time monitoring. This system receives telemetry data from a CubeSat every 30 seconds, stores it in MySQL, and displays interactive charts through a modern web dashboard.

**📊 Project Board:** [GitHub Projects #8](https://github.com/users/miksrv/projects/8/)

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
│  SQLite +    │  MQTT   │  PHP CI4 +   │  HTTP   │  React +     │
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
- **Communication:** MQTT (WiFi) + LoRa 433 MHz

---

## 🛠️ Tech Stack

### Backend
- PHP 8.1+ with CodeIgniter 4
- MySQL 8.0+
- PHPUnit for testing
- RESTful JSON API

### Frontend
- **Build Tool:** Rsbuild
- **Framework:** React 18+ (TypeScript)
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
├── docs/                   # Documentation
│   ├── architecture/       # System diagrams
│   ├── api/               # API documentation
│   └── deployment/        # Setup guides
│
├── requirements/          # Feature specifications
├── agents/               # AI agent instructions
├── ROADMAP.md           # Project roadmap
└── CLAUDE.md            # AI team lead instructions
```

---

## 🚀 Quick Start

### Prerequisites
- PHP 8.1+ with Composer
- MySQL 8.0+
- Node.js 18+
- Git

### Backend Setup

```bash
# Clone repository
git clone https://github.com/miksrv/cubesat-groundstation.git
cd cubesat-groundstation

# Backend setup
cd server
composer install
cp env.example .env

# Configure database in .env
# Then run migrations
php spark migrate

# Start development server
php spark serve
# API available at http://localhost:8080
```

### Frontend Setup

```bash
# Frontend setup
cd client
npm install

# Configure API endpoint
cp .env.example .env
# Edit REACT_APP_API_URL in .env

# Start development server
npm start
# Dashboard available at http://localhost:3000
```

### Running Tests

```bash
# Backend tests
cd server
./vendor/bin/phpunit

# Frontend tests
cd client
npm test

# E2E tests
cd client
npx cypress open
```

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

See [API Documentation](docs/api/endpoints.md) for details.

---

## 📚 Documentation

- **[Architecture Overview](docs/architecture/system-overview.md)** - System design and data flow
- **[API Reference](docs/api/endpoints.md)** - Complete API documentation
- **[Frontend Guide](docs/frontend/components.md)** - Component structure
- **[Deployment Guide](docs/deployment/)** - Production setup
- **[Development Guide](docs/development/getting-started.md)** - Contributing

---

## 🗺️ Roadmap

Current project status and upcoming features tracked in [ROADMAP.md](ROADMAP.md).

### Completed Features
- ✅ Project setup and requirements definition
- ✅ GitHub Project board configuration
- ✅ AI team workflow setup

### In Progress
- 🔄 Feature 1: Backend API (0/10 tasks)

### Upcoming
- 📋 Feature 2: Frontend Dashboard (0/20 tasks)
- 📋 Feature 3: QA & Testing (0/24 tasks)
- 📋 Feature 4: Documentation (0/24 tasks)

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
