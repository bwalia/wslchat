import React, { useRef, useEffect, useCallback } from 'react';
import type { Message } from '../../types';
import MessageItem from './MessageItem';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  canLoadMore: boolean;
  onLoadMore: () => void;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  canLoadMore,
  onLoadMore,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const container = containerRef.current;
    const loading = loadingRef.current;

    if (!container || !loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && canLoadMore && !isLoading) {
          onLoadMore();
        }
      },
      {
        root: container,
        threshold: 0,
        rootMargin: '100px',
      }
    );

    observer.observe(loading);

    return () => {
      observer.disconnect();
    };
  }, [canLoadMore, isLoading, onLoadMore]);

  // Ensure messages is an array (defensive coding)
  const safeMessages = Array.isArray(messages) ? messages : [];

  // Group messages by date
  const groupedMessages = safeMessages.reduce<{ date: string; messages: Message[] }[]>(
    (groups, message) => {
      const date = new Date(message.created_at).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.date === date) {
        lastGroup.messages.push(message);
      } else {
        groups.push({ date, messages: [message] });
      }

      return groups;
    },
    []
  );

  if (isLoading && safeMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-primary-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (safeMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">No messages yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Be the first to send a message!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto flex flex-col"
    >
      {/* Load more indicator */}
      <div ref={loadingRef} className="py-4 text-center">
        {isLoading && (
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading more...
          </div>
        )}
        {!isLoading && !canLoadMore && safeMessages.length > 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Beginning of conversation
          </p>
        )}
      </div>

      {/* Messages grouped by date */}
      {groupedMessages.map((group) => (
        <div key={group.date}>
          {/* Date Separator */}
          <div className="flex items-center gap-4 px-5 py-2">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
              {group.date}
            </span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>

          {/* Messages */}
          {group.messages.map((message, index) => {
            const prevMessage = group.messages[index - 1];
            const showAvatar = !prevMessage || prevMessage.user_uuid !== message.user_uuid;

            return (
              <MessageItem
                key={message.uuid}
                message={message}
                showAvatar={showAvatar}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default MessageList;
