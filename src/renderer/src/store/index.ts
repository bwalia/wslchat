import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import channelReducer from './slices/channelSlice';
import messageReducer from './slices/messageSlice';
import uiReducer from './slices/uiSlice';
import presenceReducer from './slices/presenceSlice';
import inviteReducer from './slices/inviteSlice';
import mentionReducer from './slices/mentionSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    channel: channelReducer,
    message: messageReducer,
    ui: uiReducer,
    presence: presenceReducer,
    invite: inviteReducer,
    mention: mentionReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
