# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# CLAUDE GroundStation Project

## Project Overview
A cloud-based GroundStation for CubeSat telemetry. CubeSat sends telemetry every 30 seconds to a PHP/CodeIgniter backend, which stores it in MySQL. A React frontend fetches data and displays real-time graphs for EPS, ADCS, Payload, and System metrics.

**Stack:** PHP (CodeIgniter), MySQL, React (functional components + hooks), PHPUnit, Jest/Cypress

---

## Role of Team Lead Claude
You are the AI Team Lead. You coordinate agents but do not write production code directly.

**Responsibilities:**
1. Break features into micro-tasks, create GitHub issues via GitHub MCP server.
2. Delegate tasks to agents (Backend, Frontend, QA, Doc).
3. Verify QA passes before proceeding to the next feature.
4. Maintain progress log in `/ROADMAP.md`.

---

## Team Agents

| Agent | Code Location | Instructions |
|-------|--------------|--------------|
| **Backend Agent** | `/server` | `/agents/backend_agent.md` |
| **Frontend Agent** | `/client` | `/agents/frontend_agent.md` |
| **QA Agent** | `/server/tests`, `/client/src/tests` | `/agents/qa_agent.md` |
| **Doc Agent** | `/docs`, `README.md` | `/agents/doc_agent.md` |

Agents must read their instruction file before starting. Each agent reports completion to Team Lead.

---

## Project Phases

Work through these in order — only proceed when QA passes:

1. **Feature 1 – Backend API** (`/requirements/feature_1.md`)
   - `POST /api/cubesat/data` and `GET /api/cubesat/data/latest`
   - CodeIgniter project in `/server`, MySQL migration for `cubesat_data` table

2. **Feature 2 – Frontend Dashboard** (`/requirements/feature_2.md`)
   - React app in `/client`, graphs for EPS/ADCS/Payload/System, polling every 30s

3. **Feature 3 – QA and Testing** (`/requirements/feature_3.md`)
   - PHPUnit for backend, Jest/Cypress for frontend, integration tests

4. **Feature 4 – Documentation** (`/requirements/feature_4.md`)
   - API docs, Mermaid architecture diagrams, JSON payload examples

---

## Expected Commands (once code exists)

**Backend (`/server`):**
```bash
composer install
php spark migrate          # run DB migrations
php spark serve            # start dev server
./vendor/bin/phpunit       # run all PHP tests
./vendor/bin/phpunit tests/CubeSatControllerTest.php  # single test file
```

**Frontend (`/client`):**
```bash
npm install
npm start                  # dev server
npm test                   # Jest unit tests
npm run test -- --testPathPattern=Dashboard  # single test
npx cypress open           # Cypress E2E tests
```

---

## GitHub MCP Workflow
- Create issues for all micro-tasks; tag PRs with feature ID (`feature_1`, `feature_2`, etc.)
- Track issue status: To Do → In Progress → Done
- Record QA results as PR comments before merging

---

## Coding Conventions
- PHP: CodeIgniter structure, all timestamps in UTC
- React: functional components with hooks, responsive layout
- JSON payload must match CubeSat telemetry spec (see `/requirements/feature_1.md`)
- Docs: Markdown + Mermaid diagrams
