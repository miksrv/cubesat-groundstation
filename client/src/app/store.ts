import { configureStore } from '@reduxjs/toolkit';
import { telemetryApi } from '../features/telemetry/telemetryAPI';
import telemetryReducer from '../features/telemetry/telemetrySlice';

export const store = configureStore({
  reducer: {
    telemetry: telemetryReducer,
    [telemetryApi.reducerPath]: telemetryApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(telemetryApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
