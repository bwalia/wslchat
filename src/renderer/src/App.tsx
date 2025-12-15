import React, { useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './hooks/useAppDispatch';
import { checkStoredAuth } from './store/slices/authSlice';
import { loadSettings } from './store/slices/uiSlice';
import { fetchPendingInvites } from './store/slices/inviteSlice';
import { useSocketEvents } from './hooks/useSocketEvents';

// Components
import Login from './components/Auth/Login';
import MainLayout from './components/MainLayout';
import LoadingScreen from './components/Common/LoadingScreen';

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isInitialized } = useAppSelector((state) => state.auth);
  const { theme } = useAppSelector((state) => state.ui);

  // Setup socket event handlers
  useSocketEvents();

  // Check for stored auth on mount
  useEffect(() => {
    dispatch(checkStoredAuth());
    dispatch(loadSettings());
  }, [dispatch]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System theme
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme]);

  // Fetch pending invites when authenticated and poll periodically
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (isAuthenticated) {
      // Fetch immediately on auth
      dispatch(fetchPendingInvites());

      // Poll every 30 seconds for new invitations (until socket is available)
      pollIntervalRef.current = setInterval(() => {
        dispatch(fetchPendingInvites());
      }, 30000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, dispatch]);

  // Show loading screen while checking auth
  if (!isInitialized) {
    return <LoadingScreen />;
  }

  return (
    <div className="h-full">
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/*"
          element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </div>
  );
};

export default App;
