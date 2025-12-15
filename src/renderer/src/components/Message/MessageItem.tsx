import React, { useState, useMemo } from 'react';
import type { Message } from '../../types';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { toggleReaction, deleteMessage, pinMessage, unpinMessage } from '../../store/slices/messageSlice';
import { openThread } from '../../store/slices/uiSlice';
import { format } from 'date-fns';
import clsx from 'clsx';
import { parseApiDate } from '../../utils/date';

interface MessageItemProps {
  message: Message;
  showAvatar: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, showAvatar }) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const isOwnMessage = message.user_uuid === user?.uuid;

  const formattedTime = useMemo(() => {
    const date = parseApiDate(message.created_at);
    return format(date, 'h:mm a');
  }, [message.created_at]);

  const handleReaction = (emoji: string) => {
    dispatch(toggleReaction({ messageUuid: message.uuid, emoji }));
    setShowEmojiPicker(false);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      dispatch(deleteMessage({ messageUuid: message.uuid, channelUuid: message.channel_uuid }));
    }
  };

  const handlePin = () => {
    if (message.is_pinned) {
      dispatch(unpinMessage({ messageUuid: message.uuid, channelUuid: message.channel_uuid }));
    } else {
      dispatch(pinMessage({ messageUuid: message.uuid, channelUuid: message.channel_uuid }));
    }
  };

  const handleOpenThread = () => {
    dispatch(openThread(message.uuid));
  };

  // Quick emoji options
  const quickEmojis = ['👍', '❤️', '😂', '🎉', '🤔', '👀'];

  if (message.is_deleted) {
    return (
      <div className={clsx('message', !showAvatar && 'pl-16')}>
        <p className="text-gray-400 dark:text-gray-500 italic text-sm">
          This message was deleted
        </p>
      </div>
    );
  }

  return (
    <div
      className={clsx('message group relative', !showAvatar && 'pt-0.5')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowEmojiPicker(false);
      }}
    >
      {/* Avatar */}
      {showAvatar ? (
        <div className="avatar-md bg-primary-500 flex items-center justify-center text-white font-medium flex-shrink-0">
          {message.user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
      ) : (
        <div className="w-9 flex-shrink-0 flex items-center justify-center">
          <span className="text-2xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
            {formattedTime}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        {showAvatar && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-bold text-gray-900 dark:text-white">
              {message.user?.name || 'Unknown User'}
            </span>
            <span className="message-time">{formattedTime}</span>
            {message.is_edited && (
              <span className="text-xs text-gray-400 dark:text-gray-500">(edited)</span>
            )}
            {message.is_pinned && (
              <span className="badge-primary text-2xs">Pinned</span>
            )}
          </div>
        )}

        {/* Message Content */}
        <div className="message-content">
          {message.content_type === 'code' ? (
            <pre className="code-block">{message.content}</pre>
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <div
                key={attachment.uuid}
                className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {attachment.file_type.startsWith('image/') ? (
                  <img
                    src={attachment.file_url}
                    alt={attachment.file_name}
                    className="max-w-xs max-h-64 object-cover"
                  />
                ) : (
                  <div className="px-3 py-2 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-sm text-gray-600 dark:text-gray-300">{attachment.file_name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={() => handleReaction(reaction.emoji)}
                className={clsx(
                  'reaction',
                  reaction.hasReacted && 'active'
                )}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            ))}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="reaction opacity-0 group-hover:opacity-100"
            >
              <span>+</span>
            </button>
          </div>
        )}

        {/* Thread indicator */}
        {message.reply_count > 0 && (
          <button
            onClick={handleOpenThread}
            className="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>

      {/* Hover Actions */}
      {showActions && (
        <div className="absolute -top-3 right-4 flex items-center gap-0.5 bg-white dark:bg-gray-800 rounded-lg shadow-dropdown border border-gray-200 dark:border-gray-700 p-0.5">
          {/* Quick Reactions */}
          {quickEmojis.slice(0, 3).map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className="emoji-btn"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}

          {/* More Reactions */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="emoji-btn"
            title="Add reaction"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

          {/* Reply in Thread */}
          <button
            onClick={handleOpenThread}
            className="emoji-btn"
            title="Reply in thread"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>

          {/* Pin */}
          <button
            onClick={handlePin}
            className="emoji-btn"
            title={message.is_pinned ? 'Unpin message' : 'Pin message'}
          >
            <svg className={clsx('w-4 h-4', message.is_pinned && 'text-primary-500')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>

          {/* Delete (own messages only) */}
          {isOwnMessage && (
            <button
              onClick={handleDelete}
              className="emoji-btn text-red-500 hover:text-red-600"
              title="Delete message"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="absolute top-8 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-dropdown border border-gray-200 dark:border-gray-700 p-2 z-10">
          <div className="grid grid-cols-6 gap-1">
            {['👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🎉', '🤔', '👀', '🔥', '💯'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageItem;
