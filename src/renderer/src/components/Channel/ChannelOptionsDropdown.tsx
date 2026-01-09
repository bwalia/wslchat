import React, { useState, useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { leaveChannel, updateChannel } from '../../store/slices/channelSlice';
import { openInviteUser } from '../../store/slices/uiSlice';
import type { Channel } from '../../types';
import clsx from 'clsx';

interface ChannelOptionsDropdownProps {
  channel: Channel;
  isOpen: boolean;
  onClose: () => void;
  onOpenEditChannel: () => void;
  onOpenPinnedMessages: () => void;
}

const ChannelOptionsDropdown: React.FC<ChannelOptionsDropdownProps> = ({
  channel,
  isOpen,
  onClose,
  onOpenEditChannel,
  onOpenPinnedMessages,
}) => {
  const dispatch = useAppDispatch();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useAppSelector((state) => state.auth);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const isAdmin = channel.current_user_role === 'admin';
  const isModerator = channel.current_user_role === 'moderator';
  const canEdit = isAdmin || isModerator;
  const isDirectMessage = channel.type === 'direct';

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
        setShowLeaveConfirm(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        setShowLeaveConfirm(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggleMute = async () => {
    try {
      await dispatch(updateChannel({
        channelUuid: channel.uuid,
        updates: { is_muted: !channel.is_muted },
      })).unwrap();
    } catch (error) {
      console.error('Failed to toggle mute:', error);
    }
    onClose();
  };

  const handleNotificationPreference = async (preference: 'all' | 'mentions' | 'none') => {
    try {
      await dispatch(updateChannel({
        channelUuid: channel.uuid,
        updates: { notification_preference: preference },
      })).unwrap();
    } catch (error) {
      console.error('Failed to update notification preference:', error);
    }
    onClose();
  };

  const handleLeaveChannel = async () => {
    try {
      await dispatch(leaveChannel(channel.uuid)).unwrap();
    } catch (error) {
      console.error('Failed to leave channel:', error);
    }
    onClose();
  };

  const handleInviteUser = () => {
    dispatch(openInviteUser());
    onClose();
  };

  const handleCopyChannelLink = () => {
    const link = `${window.location.origin}/channel/${channel.uuid}`;
    navigator.clipboard.writeText(link);
    onClose();
  };

  return (
    <div
      ref={dropdownRef}
      className="dropdown right-0 w-64 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* Channel Info Section */}
      <div className="px-4 py-3 border-b border-secondary-200 dark:border-secondary-700">
        <div className="flex items-center gap-2">
          {channel.type === 'private' ? (
            <svg className="w-4 h-4 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ) : (
            <span className="text-secondary-500 font-bold">#</span>
          )}
          <span className="font-medium text-secondary-900 dark:text-white truncate">
            {channel.name}
          </span>
        </div>
        {channel.description && (
          <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1 truncate">
            {channel.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="py-1">
        {/* Edit Channel - Only for admins/moderators */}
        {canEdit && !isDirectMessage && (
          <button
            onClick={() => {
              onOpenEditChannel();
              onClose();
            }}
            className="dropdown-item w-full"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Channel
          </button>
        )}

        {/* Invite People */}
        {!isDirectMessage && (
          <button onClick={handleInviteUser} className="dropdown-item w-full">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Invite People
          </button>
        )}

        {/* View Pinned Messages */}
        <button
          onClick={() => {
            onOpenPinnedMessages();
            onClose();
          }}
          className="dropdown-item w-full"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          View Pinned Messages
        </button>

        {/* Copy Channel Link */}
        <button onClick={handleCopyChannelLink} className="dropdown-item w-full">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy Channel Link
        </button>
      </div>

      {/* Notifications Section */}
      <div className="dropdown-divider" />
      <div className="py-1">
        <div className="px-4 py-1 text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase">
          Notifications
        </div>

        {/* Mute Toggle */}
        <button onClick={handleToggleMute} className="dropdown-item w-full">
          {channel.is_muted ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              Unmute Channel
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
              Mute Channel
            </>
          )}
        </button>

        {/* Notification Preferences */}
        <div className="px-4 py-2">
          <div className="text-xs text-secondary-500 dark:text-secondary-400 mb-2">
            Notify me about:
          </div>
          <div className="space-y-1">
            <button
              onClick={() => handleNotificationPreference('all')}
              className={clsx(
                'w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                channel.notification_preference === 'all'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-700 dark:text-secondary-300'
              )}
            >
              All messages
            </button>
            <button
              onClick={() => handleNotificationPreference('mentions')}
              className={clsx(
                'w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                channel.notification_preference === 'mentions'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-700 dark:text-secondary-300'
              )}
            >
              Mentions only
            </button>
            <button
              onClick={() => handleNotificationPreference('none')}
              className={clsx(
                'w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                channel.notification_preference === 'none'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-700 dark:text-secondary-300'
              )}
            >
              Nothing
            </button>
          </div>
        </div>
      </div>

      {/* Leave Channel */}
      {!isDirectMessage && (
        <>
          <div className="dropdown-divider" />
          <div className="py-1">
            {!showLeaveConfirm ? (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="dropdown-item-danger w-full"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Leave Channel
              </button>
            ) : (
              <div className="px-4 py-2">
                <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-2">
                  Are you sure you want to leave this channel?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleLeaveChannel}
                    className="btn btn-danger btn-sm flex-1"
                  >
                    Leave
                  </button>
                  <button
                    onClick={() => setShowLeaveConfirm(false)}
                    className="btn btn-ghost btn-sm flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ChannelOptionsDropdown;
