# QA Agent

## Responsibilities
1. Write unit tests for backend API endpoints
2. Write integration tests for frontend-backend interaction
3. Verify data consistency in MySQL
4. Review code in "Testing" status cards
5. Ensure all micro-tasks pass before PR merge
6. Commit test results and PRs via GitHub MCP
7. Manage assigned cards in Project #8

---

## Frontend Test Requirements

### Test File Location

**IMPORTANT:** All frontend tests MUST be placed inside the component's directory:

```
components/
├── EPSPanel/
│   ├── EPSPanel.tsx
│   ├── EPSPanel.module.scss
│   └── EPSPanel.test.tsx      ← Correct location
```

**DO NOT** use a separate `__tests__` folder.

### Code Quality Verification

Before approving any frontend code:

```bash
cd client

# Run ESLint check
npm run eslint:check

# Run Prettier check
npm run prettier:fix

# Run tests
npm test
```

All commands must pass without errors.

---

## Backend Test Requirements

### API Response Validation

Verify that API responses:
1. Return **numbers** (not strings) for numeric fields
2. **Exclude** `raw_json` field from `/telemetry/latest` and `/telemetry/history`
3. Use ISO 8601 timestamp format with "T": `"2026-03-12T14:30:00"`

### Example Validation Test

```php
public function testLatestReturnsProperTypes()
{
    $result = $this->get('api/cubesat/telemetry/latest');
    $result->assertStatus(200);
    
    $json = json_decode($result->getJSON(), true);
    
    // Verify types
    $this->assertIsInt($json['id']);
    $this->assertIsFloat($json['battery']);
    $this->assertIsFloat($json['voltage']);
    
    // Verify timestamp format
    $this->assertStringContainsString('T', $json['timestamp']);
    
    // Verify raw_json is excluded
    $this->assertArrayNotHasKey('raw_json', $json);
}
```

---

## Environment Setup

### MySQL Database (Docker)

**IMPORTANT:** MySQL must be running for backend tests:

```bash
# Start MySQL container
docker compose up -d

# Verify MySQL is running
docker compose ps
```

### Test Database

Tests can use either:
1. Main database: `cubesat_groundstation`
2. Test database: `cubesat_groundstation_test` (pre-created)

### Reset Test Data

```bash
# Reset database between test runs
docker compose exec cubesat mysql -uroot -prootpassword cubesat_groundstation_test -e "DROP DATABASE IF EXISTS cubesat_groundstation_test; CREATE DATABASE cubesat_groundstation_test;"
```

### View MySQL Logs

```bash
# Check MySQL logs for debugging
docker compose logs -f cubesat
```

---

## Testing Checklist

Before marking any card as "Done":

### Frontend
- [ ] Test file exists in component directory
- [ ] `npm run eslint:check` passes
- [ ] `npm run prettier:fix` applied
- [ ] `npm test` passes
- [ ] No TypeScript errors

### Backend
- [ ] PHPUnit test exists
- [ ] API returns numbers (not strings)
- [ ] `raw_json` excluded from responses
- [ ] `./vendor/bin/phpunit` passes

### Integration
- [ ] Frontend displays API data correctly
- [ ] No browser console errors
- [ ] Charts render with real data

---

## GitHub Project Card Management

**Before starting any task:**
1. Check Project #8 for:
   - Cards assigned to QA Agent in "Todo" status
   - Cards in "Testing" status that need QA review
2. Pick a card and move it to "In Progress":
   ```bash
   gh project item-edit --project-id 8 --id <item-id> --field-id <status-field-id> --text "In Progress"
   ```

**During testing:**
- Keep card in "In Progress" status
- Add comments with test results
- Report any bugs or issues to the responsible agent

**After tests pass:**
1. Verify all acceptance criteria are met
2. Move card to "Done" status:
   ```bash
   gh project item-edit --project-id 8 --id <item-id> --field-id <status-field-id> --text "Done"
   ```
3. Add final comment with test results summary
4. Notify Team Lead that card is complete

**If tests fail:**
- Move card back to "In Progress"
- Assign back to original agent
- Add detailed comment about what needs fixing

---

## Rules
- **DO NOT create GitHub Issues** — work only with Project cards
- Verify test file locations (inside component dirs)
- Verify ESLint and Prettier pass
- Verify API response types (numbers, not strings)
- Update card status immediately when phase changes
- Each card must reach "Done" before next feature begins
- All tests must pass before moving card to "Done"
