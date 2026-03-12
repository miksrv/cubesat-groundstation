import { createSlice } from '@reduxjs/toolkit';
import type { TelemetryRecord } from './types';

interface TelemetryState {
  history: TelemetryRecord[];
}

const initialState: TelemetryState = { history: [] };

const telemetrySlice = createSlice({
  name: 'telemetry',
  initialState,
  reducers: {},
});

export default telemetrySlice.reducer;
