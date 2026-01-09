import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { fetchPinnedMessages, unpinMessage } from '../../store/slices/messageSlice';
import type { Message } from '../../types';

interface PinnedMessagesPanelProps {
  channelUuid: string;
  isOpen: boolean;
  onClose: () => void;
}

const PinnedMessagesPanel: React.FC<PinnedMessagesPanelProps> = ({
  channelUuid,
  isOpen,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const { pinnedMessages } = useAppSelector((state) => state.message);
  const { user } = useAppSelector((state) => state.auth);
  const { currentChannel } = useAppSelector((state) => state.channel);

  const messages = pinnedMessages[channelUuid] || [];
  const isAdmin = currentChannel?.current_user_role === 'admin';
  const isModerator = currentChannel?.current_user_role === 'moderator';
  const canUnpin = isAdmin || isModerator;

  useEffect(() => {
    if (isOpen && channelUuid) {
      dispatch(fetchPinnedMessages(channelUuid));
    }
  }, [dispatch, isOpen, channelUuid]);

  if (!isOpen) return null;

  const handleUnpin = async (messageUuid: string) => {
    try {
      await dispatch(unpinMessage({ messageUuid, channelUuid })).unwrap();
    } catch (error) {
      console.error('Failed to unpin message:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getUserName = (message: Message) => {
    if (message.user) {
      if (message.user.first_name && message.user.last_name) {
        return `${message.user.first_name} ${message.user.last_name}`;
      }
      return message.user.name || message.user.email || 'Unknown User';
    }
    return 'Unknown User';
  };

  const getInitials = (message: Message) => {
    if (message.user) {
      if (message.user.first_name && message.user.last_name) {
        return `${message.user.first_name[0]}${message.user.last_name[0]}`.toUpperCase();
      }
      if (message.user.name) {
        return message.user.name.slice(0, 2).toUpperCase();
      }
    }
    return '??';
  };

  return (
    <div className="pinned-panel">
      {/* Header */}
      <div className="pinned-panel-header">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
            Pinned Messages
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="pinned-panel-content">
        {messages.length === 0 ? (
          <div className="pinned-panel-empty">
            <svg className="w-12 h-12 text-secondary-300 dark:text-secondary-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <p className="text-secondary-500 dark:text-secondary-400 text-center">
              No pinned messages yet
            </p>
            <p className="text-sm text-secondary-400 dark:text-secondary-500 text-center mt-1">
              Pin important messages so they're easy to find later
            </p>
          </div>
        ) : (
          <div className="pinned-panel-list">
            {messages.map((message) => (
              <div key={message.uuid} className="pinned-message">
                <div className="pinned-message-header">
                  <div className="pinned-message-avatar avatar-gradient">
                    {getInitials(message)}
                  </div>
                  <div className="pinned-message-meta">
                    <span className="pinned-message-author">
                      {getUserName(message)}
                    </span>
                    <span className="pinned-message-time">
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                  {canUnpin && (
                    <button
                      onClick={() => handleUnpin(message.uuid)}
                      className="pinned-message-unpin"
                      title="Unpin message"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <div
                  className="pinned-message-content"
                  dangerouslySetInnerHTML={{ __html: message.content }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PinnedMessagesPanel;
