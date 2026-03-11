# Feature 1: Backend API - Data Ingestion

## Goal
Receive CubeSat telemetry every 30 seconds and save it in MySQL.

## Endpoints
- `POST /api/cubesat/data` – save telemetry payload
- `GET /api/cubesat/data/latest` – return latest telemetry

## Micro-tasks
1. Create CodeIgniter project in `backend/`
2. Setup MySQL database
3. Create migration for table `cubesat_data`
4. Implement `CubeSatController` with methods:
    - `postData()`
    - `getLatest()`
5. Validate JSON payload types
6. Write unit tests for backend
7. Commit and open PRs