# Feature 5: UI Refactoring

This document describes the UI refactoring requirements including migration to the `simple-react-ui-kit` component library and implementation of the new dark theme color scheme.

---

## 1. Install simple-react-ui-kit

### 1.1 Installation

```bash
cd client
npm install simple-react-ui-kit
```

### 1.2 Import Global Styles

Add to `src/index.tsx` or main entry point:

### 1.3 Documentation

- **Library Summary:** `~/Projects/simple-react-ui-kit/LIBRARY_SUMMARY.md`
- **Storybook:** https://miksrv.github.io/simple-react-ui-kit/?path=/docs/components-badge--docs
- **GitHub:** https://github.com/miksrv/simple-react-ui-kit

---

## 2. Component Migration

Replace existing custom components with `simple-react-ui-kit` equivalents where applicable:

| Current Component | Replace With | Notes |
|-------------------|--------------|-------|
| Custom buttons | `Button` | Use `mode` prop: primary, secondary, outline, link |
| Custom badges/tags | `Badge` | Use for status indicators (OBC state) |
| Loading spinners | `Spinner` | Replace custom loading indicators |
| Custom containers/cards | `Container` | Use `title` and `action` props |
| Custom tables | `Table` | For TelemetryTimeline component |
| Custom checkboxes | `Checkbox` | If any filter controls needed |
| Custom dropdowns | `Dropdown` | For any select menus |
| Custom inputs | `Input` | For any form fields |
| Tooltips | `Tooltip` | For chart data tooltips if needed |
| Custom skeleton loaders | `Skeleton` | Replace shimmer animations |

### 2.1 Example Migrations

**Before (custom button):**
```tsx
<button className={styles.button} onClick={handleClick}>
    Refresh
</button>
```

**After (simple-react-ui-kit):**
```tsx
import { Button } from 'simple-react-ui-kit'

<Button label="Refresh" mode="primary" onClick={handleClick} />
```

**Before (custom badge):**
```tsx
<span className={styles.badge} style={{ background: color }}>
    {obcState}
</span>
```

**After (simple-react-ui-kit):**
```tsx
import { Badge } from 'simple-react-ui-kit'

<Badge label={obcState} />
```

---

## 3. Dark Theme Color Scheme

### 3.1 CSS Variables

Update `src/styles/global.scss` with the following dark theme variables:

```scss
:root[data-theme='dark'] {
    --letter-spacing: 0.00938em;
    --width-max: 1000px;
    --width-menu: 280px;

    --link-color: #529ef4;
    --link-color-hover: #77adec;
    --link-color-active: #60a6f5;

    /* Element Heights for `size` props */
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
    --container-error-background-color: #ffe9e9;
    --container-error-color: var(--color-red);
    --container-success-background-color: #e8f9e8;
    --container-success-color: var(--color-green);

    /* Input Fields and Dropdowns */
    --dropdown-background-color: #232324;
    --dropdown-background-color-hover: #3a3a3b;
    --dropdown-badge-background-color: #ffffff;
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
    --button-secondary-color-hover: var(--text-color-primary);
    --button-secondary-color-active: var(--text-color-primary);

    /* Popout */
    --popout-shadow: 0 0 2px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.08);

    /* Table */
    --table-header-background: #232324;
    --table-header-background-hover: #2f2f31;
    --table-border-color: var(--input-border-color);
    --table-row-box-shadow: inset 0 -1px var(--input-border-color);

    /* Skeleton */
    --skeleton-background-animation: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
}
```

### 3.2 Apply Dark Theme

Add `data-theme="dark"` to the root HTML element:

```tsx
// In index.tsx or App.tsx
useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
}, [])
```

Or in `index.html`:
```html
<html data-theme="dark">
```

---

## 4. Chart Color Palette

### 4.1 Create Chart Colors File

Create `src/styles/chartColors.ts`:

```typescript
/**
 * Chart Color Palette for ECharts
 *
 * Each color has two variants:
 * - [0]: Primary color
 * - [1]: Secondary/hover color
 */
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
} as const

export type ChartColorKey = keyof typeof chartColors
```

### 4.2 Update Chart Components

Replace hardcoded colors in chart components with `chartColors`:

```typescript
import { chartColors } from '../../styles/chartColors'

// Before
lineStyle: { color: '#ef4444' }

// After
lineStyle: { color: chartColors.red[0] }
```

### 4.3 Suggested Color Assignments

| Chart/Data | Color | Variable |
|------------|-------|----------|
| Battery gauge | green → orange → red | `chartColors.green`, `chartColors.orange`, `chartColors.red` |
| Voltage line | blue | `chartColors.blue[0]` |
| Gyro X | red | `chartColors.red[0]` |
| Gyro Y | green | `chartColors.green[0]` |
| Gyro Z | blue | `chartColors.blue[0]` |
| Temperature | red | `chartColors.red[0]` |
| Humidity | lightblue | `chartColors.lightblue[0]` |
| Pressure | orange | `chartColors.orange[0]` |
| CPU% | red | `chartColors.red[0]` |
| RAM% | blue | `chartColors.blue[0]` |
| Swap% | orange | `chartColors.orange[0]` |
| Disk% | green | `chartColors.green[0]` |
| Altitude | teal | `chartColors.teal[0]` |

---

## 5. Testing Requirements

After completing the refactoring:

### 5.1 Run All Tests

```bash
cd client

# Run unit tests
npm run test

# Check for TypeScript errors
npx tsc --noEmit

# Run ESLint
npm run eslint:check

# Run Prettier
npm run prettier:fix
```

### 5.2 Visual Testing

- [ ] All charts render correctly with new colors
- [ ] Dark theme applies consistently across all components
- [ ] `simple-react-ui-kit` components display correctly
- [ ] No visual regressions in dashboard layout
- [ ] Responsive design still works on mobile/tablet

### 5.3 Functional Testing

- [ ] API data fetching still works
- [ ] Charts update with new telemetry data
- [ ] Loading states display correctly (Spinner/Skeleton)
- [ ] Error states display correctly
- [ ] Polling continues every 30 seconds

---

## 6. Acceptance Criteria

- [ ] `simple-react-ui-kit` installed and imported
- [ ] All applicable components migrated to library components
- [ ] Dark theme CSS variables applied
- [ ] Chart colors updated to use `chartColors` palette
- [ ] All unit tests pass
- [ ] No ESLint errors
- [ ] No TypeScript errors
- [ ] Visual appearance matches design specifications
