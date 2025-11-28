import { useEffect, useCallback } from 'react';
import { useAppDispatch } from './useAppDispatch';
import { setSocketConnected } from '../store/slices/uiSlice';
import { addMessage, messageUpdated, messageDeleted, reactionAdded, reactionRemoved } from '../store/slices/messageSlice';
import { channelUpdated, memberJoined, memberLeft, incrementUnread } from '../store/slices/channelSlice';
import { userPresenceUpdated, typingStarted, typingStopped } from '../store/slices/presenceSlice';

/**
 * Hook to handle socket events and update Redux state
 */
export const useSocketEvents = () => {
  const dispatch = useAppDispatch();

  // Setup socket event listeners
  useEffect(() => {
    const cleanupFunctions: (() => void)[] = [];

    // Connection events
    cleanupFunctions.push(
      window.electronAPI.on('socket:connected', () => {
        dispatch(setSocketConnected(true));
        console.log('Socket connected');
      })
    );

    cleanupFunctions.push(
      window.electronAPI.on('socket:disconnected', () => {
        dispatch(setSocketConnected(false));
        console.log('Socket disconnected');
      })
    );

    // Message events
    cleanupFunctions.push(
      window.electronAPI.on('message:new', (message: any) => {
        dispatch(addMessage({ channelUuid: message.channel_uuid, message }));
        // Increment unread count if not the current channel
        // (This would need to check against current channel from state)
        dispatch(incrementUnread(message.channel_uuid));
      })
    );

    cleanupFunctions.push(
      window.electronAPI.on('message:updated', (message: any) => {
        dispatch(messageUpdated(message));
      })
    );

    cleanupFunctions.push(
      window.electronAPI.on('message:deleted', (data: { messageUuid: string; channelUuid: string }) => {
        dispatch(messageDeleted(data));
      })
    );

    // Typing events
    cleanupFunctions.push(
      window.electronAPI.on('typing:start', (data: any) => {
        dispatch(
          typingStarted({
            userUuid: data.userUuid,
            userName: data.userName || 'Someone',
            channelUuid: data.channelUuid,
            timestamp: Date.now(),
          })
        );
      })
    );

    cleanupFunctions.push(
      window.electronAPI.on('typing:stop', (data: any) => {
        dispatch(typingStopped({ channelUuid: data.channelUuid, userUuid: data.userUuid }));
      })
    );

    // Reaction events
    cleanupFunctions.push(
      window.electronAPI.on('reaction:added', (data: any) => {
        dispatch(reactionAdded(data));
      })
    );

    cleanupFunctions.push(
      window.electronAPI.on('reaction:removed', (data: any) => {
        dispatch(reactionRemoved(data));
      })
    );

    // Presence events
    cleanupFunctions.push(
      window.electronAPI.on('presence:updated', (data: any) => {
        dispatch(userPresenceUpdated(data));
      })
    );

    // Channel events
    cleanupFunctions.push(
      window.electronAPI.on('channel:updated', (data: any) => {
        dispatch(channelUpdated(data));
      })
    );

    cleanupFunctions.push(
      window.electronAPI.on('member:joined', (data: any) => {
        dispatch(memberJoined(data));
      })
    );

    cleanupFunctions.push(
      window.electronAPI.on('member:left', (data: any) => {
        dispatch(memberLeft(data));
      })
    );

    // Cleanup all listeners on unmount
    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [dispatch]);
};

/**
 * Hook to send typing indicators
 */
export const useTypingIndicator = (channelUuid: string | null) => {
  const typingTimeoutRef = { current: null as NodeJS.Timeout | null };

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelUuid) return;

      if (isTyping) {
        // Send typing start
        window.electronAPI.invoke('presence:set-typing', { channelUuid, isTyping: true });

        // Clear any existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Set timeout to stop typing after 3 seconds of no input
        typingTimeoutRef.current = setTimeout(() => {
          window.electronAPI.invoke('presence:set-typing', { channelUuid, isTyping: false });
        }, 3000);
      } else {
        // Send typing stop immediately
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        window.electronAPI.invoke('presence:set-typing', { channelUuid, isTyping: false });
      }
    },
    [channelUuid]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return sendTyping;
};

export default useSocketEvents;
