import React from 'react';
import type { Channel } from '../../types';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { toggleSearch } from '../../store/slices/uiSlice';

interface ChannelHeaderProps {
  channel: Channel;
  memberCount: number;
  onToggleMembers: () => void;
}

const ChannelHeader: React.FC<ChannelHeaderProps> = ({
  channel,
  memberCount,
  onToggleMembers,
}) => {
  const dispatch = useAppDispatch();

  return (
    <div className="channel-header">
      {/* Left Section */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          {channel.type === 'direct' ? (
            <span className="text-xl">💬</span>
          ) : channel.type === 'private' ? (
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ) : (
            <span className="text-xl font-bold text-gray-500 dark:text-gray-400">#</span>
          )}
          <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">
            {channel.name}
          </h1>
        </div>
        {channel.description && (
          <>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
              {channel.description}
            </p>
          </>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Members Count */}
        <button
          onClick={onToggleMembers}
          className="btn-ghost px-3 py-1.5 text-sm gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span>{memberCount}</span>
        </button>

        {/* Search */}
        <button
          onClick={() => dispatch(toggleSearch())}
          className="btn-ghost p-2"
          title="Search in channel"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        {/* Pinned Messages */}
        <button
          className="btn-ghost p-2"
          title="Pinned messages"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>

        {/* More Options */}
        <button
          className="btn-ghost p-2"
          title="More options"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChannelHeader;
