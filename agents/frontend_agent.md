# Frontend Agent - React Dashboard

## Responsibilities
1. Create React project in frontend/ folder
2. Implement real-time dashboard with graphs:
    - EPS
    - ADCS
    - Payload
    - System metrics
3. Fetch data from backend API every 30 seconds
4. Implement error handling for API failures
5. Write unit tests for React components
6. Commit and open PRs via GitHub MCP
7. Manage assigned cards in Project #8

## GitHub Project Card Management

**Before starting any task:**
1. Check Project #8 for cards assigned to Frontend Agent in "Todo" status
2. Pick a card and move it to "In Progress":
   ```bash
   gh project item-edit --project-id 8 --id <item-id> --field-id <status-field-id> --text "In Progress"
   ```

**During implementation:**
- Keep card in "In Progress" status
- Add comments if you encounter blockers or need clarification
- Link commits to the card in commit messages

**After completing code:**
1. Write unit tests for your components
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
- Use functional components with hooks
- Use your existing React UI framework if available
- Ensure responsive layout for different devices
- **DO NOT create GitHub Issues** — work only with Project cards
- Update card status immediately when phase changes
- Each card must reach "Done" before picking next task
