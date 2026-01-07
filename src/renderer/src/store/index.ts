import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import authReducer from './slices/authSlice';
import channelReducer from './slices/channelSlice';
import messageReducer from './slices/messageSlice';
import uiReducer from './slices/uiSlice';
import presenceReducer from './slices/presenceSlice';
import inviteReducer from './slices/inviteSlice';
import mentionReducer from './slices/mentionSlice';
import kanbanReducer from './slices/kanbanSlice';

// Combine all reducers
const rootReducer = combineReducers({
  auth: authReducer,
  channel: channelReducer,
  message: messageReducer,
  ui: uiReducer,
  presence: presenceReducer,
  invite: inviteReducer,
  mention: mentionReducer,
  kanban: kanbanReducer,
});

// Persist configuration - persist auth, kanban, and ui state
const persistConfig = {
  key: 'root',
  version: 1,
  storage,
  whitelist: ['auth', 'kanban', 'ui'], // Only persist these reducers
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for redux-persist
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
