import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { createDirectChannel, setCurrentChannel } from '../../store/slices/channelSlice';
import clsx from 'clsx';

interface User {
  uuid: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  display_name?: string;
  status?: string;
  is_chat_active?: boolean;
}

interface DirectMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DirectMessageModal: React.FC<DirectMessageModalProps> = ({
  isOpen,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const { user: currentUser } = useAppSelector((state) => state.auth);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Check if current user is an owner (for invite functionality)
  const isOwner = currentUser?.role === 'owner' || currentUser?.is_owner === true;

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setError(null);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const searchUsers = useCallback(async (searchQuery: string) => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery || trimmedQuery.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const result = await window.electronAPI.invoke<{
        users: User[];
        total: number;
      }>('chat:search-users', {
        query: trimmedQuery,
        params: { limit: 15 },
      });

      if (result.success && result.data) {
        // Filter out current user from results
        const filteredUsers = (result.data.users || []).filter(
          (u: User) => u.uuid !== currentUser?.uuid
        );
        setResults(filteredUsers);
        setSelectedIndex(0);
      } else {
        setResults([]);
        if (result.error) {
          if (!result.error.toLowerCase().includes('not found')) {
            setError(result.error);
          }
        }
      }
    } catch (err: unknown) {
      console.error('User search failed:', err);
      setResults([]);
      const errorMessage = err instanceof Error ? err.message : 'Failed to search users';
      setError(errorMessage);
    } finally {
      setIsSearching(false);
    }
  }, [currentUser?.uuid]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        searchUsers(query);
      }, 300);
    } else {
      setResults([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, searchUsers]);

  const handleStartConversation = async (user: User) => {
    if (!user?.uuid) {
      setError('Invalid user selected');
      return;
    }

    // If user is not on chat and current user is not owner, show message
    if (!user.is_chat_active && !isOwner) {
      setError('This user is not on chat yet. Only workspace owners can invite new users.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const result = await dispatch(createDirectChannel(user.uuid)).unwrap();

      if (result?.channel) {
        dispatch(setCurrentChannel(result.channel));
        onClose();
      } else {
        setError('Failed to create conversation - no channel returned');
      }
    } catch (err: unknown) {
      console.error('Failed to start conversation:', err);
      const errorMessage = err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : 'Failed to start conversation. Please try again.';
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleStartConversation(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const getUserDisplayName = (user: User) => {
    if (user.display_name && user.display_name.trim()) {
      return user.display_name.trim();
    }
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user.first_name) {
      return user.first_name;
    }
    return user.name || user.username || user.email;
  };

  const getInitials = (user: User) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user.first_name) {
      return user.first_name.slice(0, 2).toUpperCase();
    }
    if (user.name) {
      return user.name.slice(0, 2).toUpperCase();
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  const getPresenceColor = (status?: string) => {
    switch (status) {
      case 'online':
        return 'bg-success-500';
      case 'away':
        return 'bg-warning-500';
      case 'dnd':
        return 'bg-error-500';
      default:
        return 'bg-secondary-400';
    }
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-content max-w-md">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-secondary-900 dark:text-white">
                New Message
              </h2>
              <p className="text-sm text-secondary-500 dark:text-secondary-400">
                Start a conversation with someone
              </p>
            </div>
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

        {/* Body */}
        <div className="modal-body">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
              <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
            </div>
          )}

          {/* Search Input */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by name or email..."
              className="input-field pl-10"
              disabled={isCreating}
            />
          </div>

          {/* Results */}
          <div className="mt-4 max-h-72 overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
              </div>
            ) : query.length < 2 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-secondary-300 dark:text-secondary-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-secondary-500 dark:text-secondary-400">
                  Search for users to message
                </p>
                <p className="text-sm text-secondary-400 dark:text-secondary-500 mt-1">
                  Type at least 2 characters
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-secondary-300 dark:text-secondary-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-secondary-500 dark:text-secondary-400">
                  No users found
                </p>
                <p className="text-sm text-secondary-400 dark:text-secondary-500 mt-1">
                  Try a different search term
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((user, index) => {
                  const isChatActive = user.is_chat_active === true;
                  const canMessage = isChatActive || isOwner;

                  return (
                    <button
                      key={user.uuid}
                      onClick={() => handleStartConversation(user)}
                      disabled={isCreating || !canMessage}
                      className={clsx(
                        'w-full flex items-center gap-3 p-3 rounded-lg transition-colors',
                        index === selectedIndex
                          ? 'bg-primary-50 dark:bg-primary-900/30'
                          : 'hover:bg-secondary-100 dark:hover:bg-secondary-800',
                        (isCreating || !canMessage) && 'opacity-60 cursor-not-allowed'
                      )}
                    >
                      {/* Avatar with presence indicator */}
                      <div className="relative flex-shrink-0">
                        <div className={clsx(
                          'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium',
                          isChatActive ? 'avatar-gradient' : 'bg-secondary-400'
                        )}>
                          {getInitials(user)}
                        </div>
                        {isChatActive && (
                          <span className={clsx(
                            'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-secondary-800',
                            getPresenceColor(user.status)
                          )} />
                        )}
                      </div>

                      {/* User info */}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2">
                          <p className={clsx(
                            'font-medium truncate',
                            isChatActive
                              ? 'text-secondary-900 dark:text-white'
                              : 'text-secondary-500 dark:text-secondary-400'
                          )}>
                            {getUserDisplayName(user)}
                          </p>
                          {!isChatActive && (
                            <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-secondary-200 dark:bg-secondary-700 text-secondary-500 dark:text-secondary-400">
                              Not on chat
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-secondary-500 dark:text-secondary-400 truncate">
                          {user.email}
                        </p>
                      </div>

                      {/* Action indicator */}
                      <div className="flex-shrink-0">
                        {isChatActive ? (
                          <svg className="w-5 h-5 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        ) : isOwner ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                            Invite & Message
                          </span>
                        ) : (
                          <svg className="w-5 h-5 text-secondary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-secondary-500 dark:text-secondary-400">
              <kbd className="px-1.5 py-0.5 rounded bg-secondary-200 dark:bg-secondary-700 font-mono">↑↓</kbd>
              <span>navigate</span>
              <kbd className="px-1.5 py-0.5 rounded bg-secondary-200 dark:bg-secondary-700 font-mono ml-2">Enter</kbd>
              <span>select</span>
              <kbd className="px-1.5 py-0.5 rounded bg-secondary-200 dark:bg-secondary-700 font-mono ml-2">Esc</kbd>
              <span>close</span>
            </div>
            {isOwner && (
              <span className="text-xs text-primary-500">
                Owner: can invite users
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DirectMessageModal;
