# Feature 2: Frontend Dashboard

## Goal
Create a real-time telemetry visualization dashboard using React with dark theme, displaying CubeSat data through interactive charts.

## Tech Stack
- **Build Tool:** Rsbuild
- **UI Library:** React (functional components + hooks)
- **State Management:** @reduxjs/toolkit
- **Charts:** ECharts (Apache ECharts)
- **Styling:** SASS (SCSS syntax)
- **Theme:** Dark theme throughout the application

## Dashboard Layout
```
┌─────────────────────────────────────────────────┐
│ Header: CubeSat Ground Station | Status: NOMINAL│
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  EPS     │  │  ADCS    │  │  GPS     │      │
│  │  Panel   │  │  Panel   │  │  Panel   │      │
│  └──────────┘  └──────────┘  └──────────┘      │
├─────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐     │
│  │  Payload        │  │  System Metrics  │     │
│  │  Chart          │  │  Chart           │     │
│  └─────────────────┘  └──────────────────┘     │
├─────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐      │
│  │  Telemetry Timeline (scrollable)     │      │
│  └──────────────────────────────────────┘      │
└─────────────────────────────────────────────────┘
```

## Components Structure
```
client/
├── src/
│   ├── app/
│   │   ├── store.ts              # Redux store configuration
│   │   └── hooks.ts              # Typed Redux hooks
│   ├── features/
│   │   ├── telemetry/
│   │   │   ├── telemetrySlice.ts # Redux slice for telemetry
│   │   │   ├── telemetryAPI.ts   # API calls
│   │   │   └── types.ts          # TypeScript interfaces
│   │   └── theme/
│   │       └── themeSlice.ts     # Theme configuration
│   ├── components/
│   │   ├── Dashboard/
│   │   │   ├── Dashboard.tsx
│   │   │   └── Dashboard.module.scss
│   │   ├── Header/
│   │   │   ├── Header.tsx
│   │   │   └── Header.module.scss
│   │   ├── EPSPanel/
│   │   │   ├── EPSPanel.tsx
│   │   │   └── EPSPanel.module.scss
│   │   ├── ADCSPanel/
│   │   │   ├── ADCSPanel.tsx
│   │   │   └── ADCSPanel.module.scss
│   │   ├── GPSPanel/
│   │   │   ├── GPSPanel.tsx
│   │   │   └── GPSPanel.module.scss
│   │   ├── PayloadChart/
│   │   │   ├── PayloadChart.tsx
│   │   │   └── PayloadChart.module.scss
│   │   ├── SystemChart/
│   │   │   ├── SystemChart.tsx
│   │   │   └── SystemChart.module.scss
│   │   └── TelemetryTimeline/
│   │       ├── TelemetryTimeline.tsx
│   │       └── TelemetryTimeline.module.scss
│   ├── styles/
│   │   ├── _variables.scss       # SASS variables (colors, spacing)
│   │   ├── _mixins.scss          # SASS mixins
│   │   └── global.scss           # Global styles
│   ├── utils/
│   │   ├── chartConfig.ts        # ECharts default configs
│   │   └── formatters.ts         # Data formatters
│   ├── App.tsx
│   └── index.tsx
├── rsbuild.config.ts             # Rsbuild configuration
├── package.json
└── tsconfig.json
```

## ECharts Visualizations

### 1. EPS Panel
- **Gauge Chart:** Battery level (0-100%)
- **Line Chart:** Voltage over time
- **Status Indicator:** External power (on/off)

### 2. ADCS Panel
- **3D Scatter/Surface:** Roll, Pitch, Yaw visualization
- **Line Chart:** IMU temperature
- **Vector Chart:** Accelerometer (x, y, z)
- **Line Chart:** Gyroscope (x, y, z)

### 3. GPS Panel
- **Map Visualization:** Satellite position (lat, lon)
- **Line Chart:** Altitude over time
- **Info Display:** Current coordinates

### 4. Payload Chart
- **Multi-axis Line Chart:** Temperature, Humidity, Pressure over time

### 5. System Metrics Chart
- **Stacked Area Chart:** CPU, RAM, Swap, Disk usage
- **Gauge Charts:** Real-time usage indicators
- **Line Chart:** CPU temperature
- **Info Display:** Uptime

## Data Flow
1. **Redux Toolkit Query (RTK Query)** for API calls with auto-refetch every 30s
2. **Redux Store** maintains telemetry history (last 100 records)
3. **Components** subscribe to store changes via `useSelector`
4. **ECharts** instances update reactively on data changes

## Dark Theme Colors (SASS Variables)
```scss
$bg-primary: #0a0e27;
$bg-secondary: #151932;
$bg-panel: #1a1f3a;
$text-primary: #e2e8f0;
$text-secondary: #94a3b8;
$accent-primary: #3b82f6;
$accent-success: #10b981;
$accent-warning: #f59e0b;
$accent-danger: #ef4444;
$border-color: #2d3548;
```

## Micro-tasks
1. Initialize Rsbuild + React + TypeScript project in `client/`
2. Configure Rsbuild with SASS support
3. Setup Redux Toolkit store structure
4. Create telemetry slice and RTK Query API
5. Implement dark theme SASS variables and global styles
6. Create Dashboard layout component
7. Implement Header component with connection status
8. Create EPS Panel with battery gauge and voltage chart
9. Create ADCS Panel with orientation visualization
10. Create GPS Panel with map and altitude chart
11. Create Payload Chart component (temperature, humidity, pressure)
12. Create System Metrics Chart component
13. Create Telemetry Timeline component
14. Implement auto-refresh logic (30s polling)
15. Add error handling and loading states
16. Add responsive design for mobile/tablet
17. Write Jest unit tests for components
18. Write integration tests
19. Optimize chart performance (debouncing, memoization)
20. Commit and open PR
