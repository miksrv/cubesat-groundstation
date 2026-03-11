# CubeSat GroundStation Project Roadmap

## Overview
Cloud-based GroundStation for CubeSat telemetry visualization and monitoring. The CubeSat onboard computer (OBC) sends telemetry packets every 30 seconds via MQTT. Data is received by a PHP backend API, stored in MySQL, and visualized through a React dashboard with real-time charts.

**Project Repository:** https://github.com/miksrv/cubesat-groundstation  
**GitHub Project Board:** https://github.com/users/miksrv/projects/8/

## CubeSat System Architecture

The CubeSat runs a distributed service architecture with the following subsystems:
- **OBC (On-Board Computer):** State machine controller (BOOT → DEPLOY → NOMINAL → SCIENCE → LOW_POWER → SAFE)
- **EPS (Electrical Power System):** Battery and power monitoring
- **ADCS (Attitude Determination and Control):** Orientation via Sense HAT sensors
- **Payload:** Camera and science data collection
- **Telemetry Aggregator:** Collects data from all subsystems
- **Communication:** WiFi/MQTT and LoRa 433 MHz

### Telemetry Data Structure
The CubeSat stores telemetry in onboard SQLite and transmits the following metrics:
- **EPS:** battery, voltage, external_power
- **ADCS:** roll, pitch, yaw, imu_temp, accelerometer (x,y,z), gyroscope (x,y,z)
- **Payload:** temperature, humidity, pressure
- **System:** cpu_percent, ram_percent, swap_percent, disk_percent, uptime_seconds, cpu_temperature
- **OBC:** state (BOOT, DEPLOY, NOMINAL, SCIENCE, LOW_POWER, SAFE)
- **GPS:** latitude, longitude, altitude *(NEW)*

## Tech Stack

### Backend
- **Framework:** PHP 8.1+ with CodeIgniter 4
- **Database:** MySQL 8.0+
- **Testing:** PHPUnit
- **API:** RESTful JSON endpoints

### Frontend
- **Build Tool:** Rsbuild
- **UI Framework:** React 18+ (functional components + hooks)
- **State Management:** @reduxjs/toolkit (RTK Query)
- **Charts:** Apache ECharts
- **Styling:** SASS (SCSS)
- **Theme:** Dark theme
- **Testing:** Jest, React Testing Library, Cypress

## Project Structure
```
cubesat-groundstation/
├── server/              # Backend (CodeIgniter 4)
├── client/              # Frontend (React + Rsbuild)
├── docs/                # Documentation
├── requirements/        # Feature specifications
├── agents/              # Agent instruction files
└── ROADMAP.md          # This file
```

## Features & Progress

### Feature 1: Backend API - Data Ingestion
**Status:** 🟢 Complete
**Requirements:** `/requirements/feature_1.md`
**Agent:** Backend Agent
**Progress:** 10/10 tasks
**PR:** https://github.com/miksrv/cubesat-groundstation/pull/1

**Deliverables:**
- ✅ CodeIgniter 4 project in `/server`
- ✅ MySQL database with `cubesat_telemetry` table
- ✅ REST API endpoints:
  - POST /api/cubesat/telemetry
  - GET /api/cubesat/telemetry/latest
  - GET /api/cubesat/telemetry/history
  - GET /api/cubesat/telemetry/range
- ✅ JSON validation middleware
- ✅ CORS configuration
- ✅ PHPUnit tests

### Feature 2: Frontend Dashboard
**Status:** 🔴 Not Started  
**Requirements:** `/requirements/feature_2.md`  
**Agent:** Frontend Agent  
**Progress:** 0/20 tasks

**Deliverables:**
- ✅ React + Rsbuild + TypeScript project in `/client`
- ✅ Redux Toolkit store with RTK Query
- ✅ Dark theme SASS styling
- ✅ Dashboard with real-time charts:
  - EPS Panel (battery gauge, voltage chart)
  - ADCS Panel (orientation 3D, IMU data)
  - GPS Panel (map, coordinates, altitude)
  - Payload Chart (temperature, humidity, pressure)
  - System Metrics Chart (CPU, RAM, disk usage)
  - Telemetry Timeline (scrollable history)
- ✅ Auto-refresh every 30 seconds
- ✅ Responsive design
- ✅ Error handling and loading states

### Feature 3: QA and Testing
**Status:** 🔴 Not Started  
**Requirements:** `/requirements/feature_3.md`  
**Agent:** QA Agent  
**Progress:** 0/24 tasks

**Deliverables:**
- ✅ Backend unit tests (PHPUnit)
- ✅ Backend integration tests
- ✅ Frontend component tests (Jest)
- ✅ Frontend integration tests
- ✅ End-to-end tests (Cypress)
- ✅ Performance testing
- ✅ Data integrity validation
- ✅ Code coverage reports (Backend 80%, Frontend 75%)
- ✅ CI/CD integration

### Feature 4: Documentation
**Status:** 🔴 Not Started  
**Requirements:** `/requirements/feature_4.md`  
**Agent:** Doc Agent  
**Progress:** 0/24 tasks

**Deliverables:**
- ✅ Architecture documentation with Mermaid diagrams
- ✅ API documentation with examples
- ✅ Frontend component documentation
- ✅ Deployment guides (Backend, Frontend, Docker)
- ✅ Development setup guide
- ✅ User guide and troubleshooting
- ✅ Updated README.md

## Workflow

### Phase 1: Planning & Setup *(Current)*
1. ✅ Define project requirements
2. ✅ Update documentation structure
3. ✅ Configure GitHub Project board
4. 🔄 Team Lead creates detailed task breakdown
5. 🔄 Create Project cards for Feature 1

### Phase 2: Backend Development
1. Backend Agent picks tasks from Project board
2. Implements CodeIgniter API
3. Creates database migrations
4. Writes unit tests
5. Moves cards: Todo → In Progress → Testing → Done

### Phase 3: Frontend Development
1. Frontend Agent picks tasks from Project board
2. Sets up Rsbuild + React + Redux
3. Implements dashboard components
4. Integrates ECharts visualizations
5. Writes component tests
6. Moves cards: Todo → In Progress → Testing → Done

### Phase 4: QA & Testing
1. QA Agent reviews cards in "Testing" status
2. Runs all test suites
3. Validates data integrity
4. Performs performance testing
5. Moves approved cards to "Done"
6. Reports issues back to responsible agents

### Phase 5: Documentation
1. Doc Agent documents completed features
2. Creates architecture diagrams
3. Writes deployment guides
4. Updates README and user guides
5. Moves cards: Todo → In Progress → Testing → Done

### Phase 6: Deployment
1. Deploy backend to production server
2. Deploy frontend to CDN/static hosting
3. Configure MySQL database
4. Test with real CubeSat telemetry
5. Monitor and optimize

## GitHub Project Board Statuses

**Card Flow:**
```
Todo → In Progress → Testing → Done
```

**Rules:**
- All tasks tracked as Project cards (NO GitHub Issues)
- Team Lead creates cards with detailed descriptions
- Agents move their own cards through statuses
- QA Agent reviews cards in "Testing"
- All cards must reach "Done" before next feature

## Success Metrics

- ✅ All API endpoints functional and tested
- ✅ Dashboard displays real-time telemetry
- ✅ Charts update smoothly every 30 seconds
- ✅ Test coverage: Backend 80%, Frontend 75%
- ✅ API response time < 200ms
- ✅ Chart rendering time < 100ms
- ✅ Zero data loss from CubeSat telemetry
- ✅ Dashboard accessible on mobile devices
- ✅ Complete documentation available

## Current Status

**Last Updated:** 2026-03-11

**Active Phase:** Backend Development → Feature 2 Ready
**Next Milestone:** Feature 2 - Frontend Dashboard
**Blockers:** None

### Feature 1 Notes (2026-03-11)
- 28 PHPUnit tests pass on Docker MySQL
- Two fixes applied during QA: validation uses `array_key_exists` (not CI4 `required`) so empty subsystem objects are accepted; `range()` validates date formats before querying DB
- Migration uses `IF NOT EXISTS` for safe re-runs in test environment

---

*This roadmap is maintained by Team Lead and updated as features progress.*
