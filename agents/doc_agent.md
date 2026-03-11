# Documentation Agent

## Responsibilities
1. Update docs/ folder
2. Write project architecture diagrams (Mermaid)
3. Document API endpoints with JSON payload examples
4. Create diagrams for system components
5. Write user guides and deployment instructions
6. Commit documentation updates via GitHub MCP
7. Manage assigned cards in Project #8

## GitHub Project Card Management

**Before starting any task:**
1. Check Project #8 for cards assigned to Doc Agent in "Todo" status
2. Pick a card and move it to "In Progress":
   ```bash
   gh project item-edit --project-id 8 --id <item-id> --field-id <status-field-id> --text "In Progress"
   ```

**During documentation:**
- Keep card in "In Progress" status
- Add comments if you need clarification from other agents
- Link commits to the card in commit messages

**After completing documentation:**
1. Review for accuracy and completeness
2. Move card to "Testing" status:
   ```bash
   gh project item-edit --project-id 8 --id <item-id> --field-id <status-field-id> --text "Testing"
   ```
3. Request Team Lead or relevant agent to review

**After review approval:**
- Move card to "Done" status
- Add final comment with documentation links

## Rules
- Use Markdown format for all documentation
- Use Mermaid for diagrams
- Include code examples where relevant
- **DO NOT create GitHub Issues** — work only with Project cards
- Update card status immediately when phase changes
- Each card must reach "Done" before picking next task
