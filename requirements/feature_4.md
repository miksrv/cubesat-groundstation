# Feature 3: QA and Testing

## Goal
Ensure backend and frontend work correctly with comprehensive test coverage for all components, API endpoints, and data integrity.

## Testing Strategy

### Backend Testing (PHPUnit)
**Location:** `/server/tests/`

1. **Unit Tests:**
   - TelemetryModel CRUD operations
   - Data validation rules
   - Timestamp conversion (UTC)
   - JSON payload parsing

2. **Integration Tests:**
   - POST /api/cubesat/telemetry endpoint
   - GET /api/cubesat/telemetry/latest endpoint
   - GET /api/cubesat/telemetry/history endpoint
   - GET /api/cubesat/telemetry/range endpoint
   - Database migrations
   - CORS configuration

3. **Data Validation Tests:**
   - Valid JSON payload acceptance
   - Invalid payload rejection
   - Missing fields handling
   - Type validation (numbers, strings, booleans)
   - Edge cases (null, empty, extremely large values)

### Frontend Testing (Jest + React Testing Library)
**Location:** `/client/src/tests/`

1. **Unit Tests:**
   - Redux store and slices
   - Telemetry API calls
   - Data formatters and utilities
   - Chart configuration functions

2. **Component Tests:**
   - Dashboard renders correctly
   - Header displays connection status
   - EPS Panel shows battery and voltage
   - ADCS Panel displays orientation data
   - GPS Panel renders map and coordinates
   - Payload Chart displays sensor data
   - System Metrics Chart shows resource usage
   - Telemetry Timeline scrolls and updates

3. **Integration Tests:**
   - Redux store updates on API response
   - Components react to store changes
   - Auto-refresh triggers every 30s
   - Error states display correctly
   - Loading states work properly

### End-to-End Testing (Cypress)
**Location:** `/client/cypress/e2e/`

1. **E2E Scenarios:**
   - User opens dashboard and sees telemetry
   - Charts update when new data arrives
   - Error message appears when backend is down
   - Dashboard is responsive on mobile/tablet
   - All charts render without errors
   - Timeline scrolls and displays history

### Performance Testing

1. **Frontend Performance:**
   - Chart rendering time < 100ms
   - Redux store updates < 50ms
   - Memory leaks check (long-running dashboard)
   - Bundle size optimization

2. **Backend Performance:**
   - API response time < 200ms
   - Database query optimization
   - Concurrent request handling
   - Memory usage under load

### Data Integrity Tests

1. **Database Tests:**
   - Telemetry stored with correct types
   - Timestamps in UTC
   - All fields preserved from JSON
   - raw_json backup is valid JSON
   - Indexes work correctly

2. **API Contract Tests:**
   - Response matches expected schema
   - All required fields present
   - Data types are correct
   - Nested objects structure preserved

## Test Coverage Goals
- **Backend:** Minimum 80% code coverage
- **Frontend:** Minimum 75% code coverage
- **Integration:** All critical user paths covered

## CI/CD Integration
- Run tests automatically on every PR
- Block merge if tests fail
- Generate coverage reports
- Run E2E tests on staging environment

## Micro-tasks

### Backend Testing (8 tasks)
1. Setup PHPUnit in `/server` with configuration
2. Write TelemetryModel unit tests
3. Write POST endpoint integration tests
4. Write GET endpoints integration tests
5. Write JSON validation tests
6. Write database migration tests
7. Write CORS configuration tests
8. Generate backend coverage report

### Frontend Testing (10 tasks)
9. Setup Jest + React Testing Library in `/client`
10. Write Redux store and slice tests
11. Write API utility function tests
12. Write Dashboard component tests
13. Write EPS, ADCS, GPS Panel tests
14. Write Chart component tests
15. Write integration tests for data flow
16. Setup Cypress for E2E testing
17. Write E2E scenarios for dashboard
18. Generate frontend coverage report

### Integration & Performance (4 tasks)
19. Write end-to-end API-to-UI tests
20. Test real CubeSat telemetry payload
21. Perform load testing on backend
22. Test dashboard performance with 1000+ data points

### Documentation (2 tasks)
23. Document test setup and execution
24. Create test data fixtures and examples

## Testing Commands

### Backend
```bash
cd server
./vendor/bin/phpunit                              # Run all tests
./vendor/bin/phpunit --coverage-html coverage/    # With coverage
./vendor/bin/phpunit tests/TelemetryModelTest.php # Single test
```

### Frontend
```bash
cd client
npm test                                   # Run Jest tests
npm test -- --coverage                     # With coverage
npm test -- --watch                        # Watch mode
npx cypress open                           # Open Cypress
npx cypress run                            # Run E2E headless
```

## Success Criteria
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ All E2E tests pass
- ✅ Code coverage meets minimum thresholds
- ✅ No memory leaks in long-running dashboard
- ✅ API response time < 200ms
- ✅ Chart rendering time < 100ms
- ✅ Real CubeSat data processes correctly
