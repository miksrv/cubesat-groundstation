# GroundStation Project Roadmap

## Overview
This project is a cloud-based GroundStation for CubeSat telemetry. CubeSat sends telemetry every 30 seconds to a PHP backend, which stores it in MySQL. A React frontend fetches data and displays graphs for EPS, ADCS, Payload, and System metrics.

## Features
1. **Backend API**
    - Receive telemetry
    - Store in MySQL
    - Provide REST endpoints

2. **Frontend Dashboard**
    - Display real-time telemetry graphs
    - Fetch data every 30 seconds
    - Responsive design

3. **QA / Testing**
    - Unit tests for backend
    - Integration tests for frontend-backend
    - Validate data consistency

4. **Documentation**
    - API documentation
    - Architecture diagrams
    - JSON payload examples

## Workflow
- Read requirements from `/requirements/feature_*.md`
- Decompose tasks into micro-tasks
- Assign tasks to agents (backend, frontend, QA, doc)
- Create GitHub issues
- Collect results and verify tests
- Notify when a feature is complete