# Frontend Agent - React Dashboard

## Responsibilities
1. Create React project in client/ folder
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

---

## UI Kit: simple-react-ui-kit

**IMPORTANT:** Use the custom React UI Kit for all UI components.

- **NPM Package:** `simple-react-ui-kit`
- **Library Summary:** `~/Projects/simple-react-ui-kit/LIBRARY_SUMMARY.md`
- **Storybook:** https://miksrv.github.io/simple-react-ui-kit/?path=/docs/components-badge--docs
- **GitHub:** https://github.com/miksrv/simple-react-ui-kit

### Installation
```bash
npm install simple-react-ui-kit
```

### Available Components
Use these components from the kit:
- `Badge` - Labels and tags
- `Button` - Buttons with modes (primary, secondary, outline, link)
- `Container` - Layout wrapper with title and actions
- `Checkbox` - Three-state checkbox
- `Dropdown` - Select menus
- `Input` - Text inputs
- `Spinner` - Loading indicator
- `Table` - Data tables
- `Tooltip` - Hover tooltips
- `Icon` - Icon set

Refer to Storybook for full documentation and examples.

---

## Design System

### Dark Theme CSS Variables

Apply these CSS variables in `styles/global.scss`:

```scss
:root[data-theme='dark'] {
    --letter-spacing: 0.00938em;
    --width-max: 1000px;
    --width-menu: 280px;

    --link-color: #529ef4;
    --link-color-hover: #77adec;
    --link-color-active: #60a6f5;

    /* Element Heights */
    --size-small: 24px;
    --size-medium: 28px;
    --size-large: 32px;

    /* Primary Colors */
    --color-contrast: #000;

    --color-green: #4bb34b;
    --color-green-hover: #48ac4a;
    --color-green-active: #45a64a;
    --color-green-background: #2e3e2b;

    --color-orange: #f8a01c;
    --color-orange-hover: #ee9a1d;
    --color-orange-active: #e4941f;
    --color-orange-background: #5e5443;

    --color-red: #e64646;
    --color-red-hover: #dd4446;
    --color-red-active: #d44245;
    --color-red-background: #522e2e;

    --color-main: #2688eb;
    --color-main-hover: #2483e4;
    --color-main-active: #237edd;
    --color-main-background: #3c4957;

    /* Text and Typography */
    --font-size: 14px;
    --font-size-small: 12px;
    --font-family: -apple-system, system-ui, 'Helvetica Neue', Roboto, sans-serif;
    --text-color-primary: #e1e3e6;
    --text-color-secondary: #76787a;
    --text-color-secondary-hover: #7b7d7f;

    /* Layout and Containers */
    --border-radius: 6px;
    --body-background: #1b1b1b;
    --modal-background: #0c0c0c;
    --overlay-background: rgba(0, 0, 0, 0.4);
    --container-shadow: inset 0 0 0 0.5px #363738;
    --container-background-color: #2c2d2e;

    /* Input Fields */
    --dropdown-background-color: #232324;
    --dropdown-background-color-hover: #3a3a3b;
    --input-background-color: #232324;
    --input-label-color: #969a9f;
    --input-border-color: #444546;
    --input-border: 0.5px solid var(--input-border-color);
    --input-border-focus-color: var(--color-main);

    /* Buttons */
    --button-font-weight: 300;
    --button-default-color: var(--text-color-primary);
    --button-default-background: transparent;
    --button-default-background-hover: rgba(255, 255, 255, 0.04);
    --button-default-background-active: rgba(255, 255, 255, 0.08);

    --button-primary-color: var(--body-background);
    --button-primary-background: var(--text-color-primary);
    --button-primary-background-hover: #ebedf0;
    --button-primary-background-active: #d7d8db;

    --button-secondary-background: rgba(255, 255, 255, 0.1);
    --button-secondary-background-hover: rgba(255, 255, 255, 0.12);
    --button-secondary-background-active: rgba(255, 255, 255, 0.14);
    --button-secondary-color: var(--text-color-primary);

    /* Table */
    --table-header-background: #232324;
    --table-header-background-hover: #2f2f31;
    --table-border-color: var(--input-border-color);
    --table-row-box-shadow: inset 0 -1px var(--input-border-color);

    /* Skeleton */
    --skeleton-background-animation: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
}
```

### Chart Color Palette

Use these colors for ECharts graphs. Create `src/styles/chartColors.ts`:

```typescript
export const chartColors = {
    brown: ['#795548', '#8d6e63'],
    navy: ['#283593', '#3f51b5'],
    violet: ['#8c1fc9', '#a23de3'],
    purple: ['#7d2ae8', '#9146ff'],
    magenta: ['#c2185b', '#db3c7f'],
    pink: ['#e91e63', '#ff5b85'],
    red: ['#e53935', '#f25755'],
    orange: ['#ff5722', '#ff7043'],
    yellow: ['#ffeb3b', '#fff176'],
    lime: ['#cddc39', '#d4e157'],
    olive: ['#8c9e35', '#a3b236'],
    green: ['#4caf50', '#66bb6a'],
    teal: ['#009688', '#26a69a'],
    blue: ['#2c7eec', '#468de8'],
    lightblue: ['#2196f3', '#42a5f5'],
    cyan: ['#00bcd4', '#4dd0e1'],
    air: ['#8dbdef', '#9bc4f5'],
    grey: ['#607d8b', '#78909c']
}

// Usage: chartColors.blue[0] for primary, chartColors.blue[1] for secondary/hover
```

---

## Code Quality Requirements

### ESLint & Prettier

**ALWAYS** run these commands after writing code:

```bash
# Check ESLint rules
npm run eslint:check

# Fix Prettier formatting
npm run prettier:fix
```

Both must pass without errors before committing.

---

## Test File Location

**IMPORTANT:** Place test files INSIDE each component's directory:

```
components/
├── EPSPanel/
│   ├── EPSPanel.tsx
│   ├── EPSPanel.module.scss
│   └── EPSPanel.test.tsx      ← Test here
├── ADCSPanel/
│   ├── ADCSPanel.tsx
│   └── ADCSPanel.test.tsx     ← Test here
```

**DO NOT** use a separate `__tests__` folder.

---

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
1. Write unit tests for your components (in component directory)
2. Run `npm run eslint:check` and `npm run prettier:fix`
3. Verify tests pass locally
4. Move card to "Testing" status:
   ```bash
   gh project item-edit --project-id 8 --id <item-id> --field-id <status-field-id> --text "Testing"
   ```
5. Notify Team Lead and QA Agent

**After QA approval:**
- Move card to "Done" status
- Add final comment with PR link

---

## Rules
- Use functional components with hooks
- Use `simple-react-ui-kit` components
- Apply dark theme CSS variables
- Use chart color palette for ECharts
- Ensure responsive layout for different devices
- Run ESLint and Prettier before commits
- Place tests inside component directories
- **DO NOT create GitHub Issues** — work only with Project cards
- Update card status immediately when phase changes
- Each card must reach "Done" before picking next task
