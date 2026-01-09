import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Message } from '../../types';

interface ChannelSearchPanelProps {
  channelUuid: string;
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  messages: Message[];
  total: number;
  hasMore: boolean;
}

const ChannelSearchPanel: React.FC<ChannelSearchPanelProps> = ({
  channelUuid,
  isOpen,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({ messages: [], total: 0, hasMore: false });
  const [isSearching, setIsSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Clear results when closing
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults({ messages: [], total: 0, hasMore: false });
      setSearchPerformed(false);
    }
  }, [isOpen]);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults({ messages: [], total: 0, hasMore: false });
      setSearchPerformed(false);
      return;
    }

    setIsSearching(true);
    setSearchPerformed(true);

    try {
      const result = await window.electronAPI.invoke<{
        data: Message[];
        total: number;
        page: number;
        perPage: number;
      }>('messages:search', {
        channelUuid,
        query: searchQuery,
        params: { limit: 20 },
      });

      if (result.success && result.data) {
        setResults({
          messages: result.data.data || [],
          total: result.data.total || 0,
          hasMore: (result.data.data?.length || 0) < (result.data.total || 0),
        });
      } else {
        setResults({ messages: [], total: 0, hasMore: false });
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults({ messages: [], total: 0, hasMore: false });
    } finally {
      setIsSearching(false);
    }
  }, [channelUuid]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim()) {
      debounceRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults({ messages: [], total: 0, hasMore: false });
      setSearchPerformed(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
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
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
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

  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;

    // Strip HTML for safe highlighting
    const plainText = text.replace(/<[^>]*>/g, '');
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = plainText.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="search-panel">
      {/* Header */}
      <div className="search-panel-header">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
            Search Messages
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

      {/* Search Input */}
      <div className="search-panel-input-container">
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
            placeholder="Search messages..."
            className="search-input pl-10 pr-10 w-full"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {searchPerformed && !isSearching && (
          <div className="text-xs text-secondary-500 dark:text-secondary-400 mt-2">
            {results.total} {results.total === 1 ? 'result' : 'results'} found
          </div>
        )}
      </div>

      {/* Results */}
      <div className="search-panel-content">
        {isSearching ? (
          <div className="search-panel-loading">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            <p className="text-secondary-500 dark:text-secondary-400 mt-3">Searching...</p>
          </div>
        ) : !searchPerformed ? (
          <div className="search-panel-empty">
            <svg className="w-12 h-12 text-secondary-300 dark:text-secondary-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-secondary-500 dark:text-secondary-400 text-center">
              Search for messages in this channel
            </p>
            <p className="text-sm text-secondary-400 dark:text-secondary-500 text-center mt-1">
              Type at least 2 characters to search
            </p>
          </div>
        ) : results.messages.length === 0 ? (
          <div className="search-panel-empty">
            <svg className="w-12 h-12 text-secondary-300 dark:text-secondary-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-secondary-500 dark:text-secondary-400 text-center">
              No messages found
            </p>
            <p className="text-sm text-secondary-400 dark:text-secondary-500 text-center mt-1">
              Try a different search term
            </p>
          </div>
        ) : (
          <div className="search-panel-list">
            {results.messages.map((message) => (
              <div key={message.uuid} className="search-result-item">
                <div className="search-result-header">
                  <div className="search-result-avatar avatar-gradient">
                    {getInitials(message)}
                  </div>
                  <div className="search-result-meta">
                    <span className="search-result-author">
                      {getUserName(message)}
                    </span>
                    <span className="search-result-time">
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                </div>
                <div className="search-result-content">
                  {highlightText(message.content, query)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelSearchPanel;
