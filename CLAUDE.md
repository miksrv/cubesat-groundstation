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

## GitHub Projects Workflow

**Project URL:** https://github.com/users/miksrv/projects/8/

### Team Lead Responsibilities:
1. **Detailed Task Decomposition:**
   - Break each feature into granular micro-tasks (5-20 tasks per feature)
   - Each task should be completable in 1-2 hours
   - Create clear, actionable titles (e.g., "Create MySQL migration for cubesat_data table")
   - Add brief description with acceptance criteria and technical notes
   
2. **Card Creation:**
   ```bash
   gh project item-create 8 --owner miksrv \
     --title "Task title" \
     --body "Description with acceptance criteria"
   ```
   - All new cards start in **"Todo"** status
   - Include which agent should handle the task
   - Reference related requirement files
   - Add technical context or dependencies

3. **Task Assignment:**
   - Assign each card to appropriate agent (Backend, Frontend, QA, Doc)
   - Ensure dependencies are clear in card description

### Agent Responsibilities:
Each agent MUST manage their assigned cards through the workflow:

1. **Pick a task from "Todo":**
   ```bash
   gh project item-edit --project-id 8 --id <item-id> --field-id <status-field-id> --text "In Progress"
   ```

2. **While working:**
   - Keep card in **"In Progress"** status
   - Add comments on progress if task takes multiple sessions
   
3. **After completing implementation:**
   - Move card to **"Testing"** status
   - Notify QA Agent if tests are needed
   
4. **After QA passes:**
   - Move card to **"Done"** status
   - Add final comment with PR link or completion notes

### Card Status Flow:
```
Todo → In Progress → Testing → Done
```

### Important Rules:
- **DO NOT create GitHub Issues** — use Project cards only
- Each card must have a clear title and description
- Team Lead tracks overall progress in `/ROADMAP.md`
- Agents update card status immediately when changing phases
- All cards must reach "Done" before moving to next feature

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

## Docker Compose Setup

**MySQL Database for Development and Testing**

The project uses Docker Compose to run MySQL database locally. This ensures consistent database environment for Backend and QA agents.

### Prerequisites
- Docker Desktop installed and running
- Docker Compose v2+ available

### Quick Start

**1. Start MySQL container:**
```bash
docker compose up -d
```

**2. Verify MySQL is running:**
```bash
docker compose ps
```

**3. Access MySQL (optional):**
```bash
docker compose exec cubesat mysql -uroot -prootpassword cubesat_groundstation
```

**4. Stop and remove containers:**
```bash
docker compose down
```

**5. Stop and remove with data cleanup:**
```bash
docker compose down -v
```

### Database Connection Details

When MySQL container is running, use these credentials in your `.env` files:

```env
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=cubesat_groundstation
DB_USERNAME=cubesat_user
DB_PASSWORD=cubesat_password
DB_ROOT_PASSWORD=rootpassword
```

### Agent Usage

**Backend Agent:**
- Start MySQL before running migrations: `docker compose up -d`
- Configure CodeIgniter database settings to use container
- Run migrations: `php spark migrate`
- Stop after work: `docker compose down`

**QA Agent:**
- Use same MySQL container for tests
- Tests should use test database or fixtures
- Can reset database between test runs
- Check logs: `docker compose logs cubesat`

### Container Management

**View logs:**
```bash
docker compose logs -f cubesat
```

**Restart container:**
```bash
docker compose restart cubesat
```

**Check container status:**
```bash
docker compose ps
docker compose exec cubesat mysqladmin -uroot -prootpassword ping
```

### Data Persistence

MySQL data is stored in Docker volume `cubesat`. This persists between container restarts.

To completely reset database:
```bash
docker compose down -v
docker compose up -d
cd server && php spark migrate
```

### Important Notes
- MySQL runs on port 3306 (mapped to host)
- Database `cubesat_groundstation` is created automatically
- User `cubesat_user` has full access to the database
- Root password is for admin access only
- Volume `cubesat` ensures data persists between restarts
- Container starts automatically with `restart: always`

---
