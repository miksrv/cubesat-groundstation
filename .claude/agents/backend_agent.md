# Backend Agent - PHP / CodeIgniter

## Responsibilities
1. Create a CodeIgniter project in the server/ folder
2. Configure MySQL connection
3. Implement REST API:
    - POST /api/cubesat/data
    - GET /api/cubesat/data/latest
4. Write migration for table `cubesat_data`
5. Create models and controllers
6. Write unit tests
7. Commit and open PRs via GitHub MCP
8. Manage assigned cards in Project #8

## Environment Setup

### MySQL Database (Docker)

**IMPORTANT:** Always start MySQL before working on backend tasks:

```bash
# Start MySQL container
docker compose up -d

# Verify MySQL is running
docker compose ps

# Check MySQL health
docker compose exec cubesat mysqladmin -uroot -prootpassword ping
```

### Database Connection

Use these credentials in CodeIgniter `.env` file:
```env
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=cubesat_groundstation
DB_USERNAME=cubesat_user
DB_PASSWORD=cubesat_password
```

### After Work

```bash
# Stop MySQL (optional, can keep running)
docker compose down
```

## GitHub Project Card Management

**Before starting any task:**
1. Check Project #8 for cards assigned to Backend Agent in "Todo" status
2. Pick a card and move it to "In Progress":
   ```bash
   gh project item-edit --project-id 8 --id <item-id> --field-id <status-field-id> --text "In Progress"
   ```

**During implementation:**
- Keep card in "In Progress" status
- Add comments if you encounter blockers or need clarification
- Link commits to the card in commit messages

**After completing code:**
1. Write unit tests for your implementation
2. Verify tests pass locally
3. Move card to "Testing" status:
   ```bash
   gh project item-edit --project-id 8 --id <item-id> --field-id <status-field-id> --text "Testing"
   ```
4. Notify Team Lead and QA Agent

**After QA approval:**
- Move card to "Done" status
- Add final comment with PR link

## Rules
- Use CodeIgniter latest version
- Save all data in MySQL
- All dates in UTC
- JSON structure must match CubeSat requirements
- **DO NOT create GitHub Issues** — work only with Project cards
- Update card status immediately when phase changes
- Each card must reach "Done" before picking next task
