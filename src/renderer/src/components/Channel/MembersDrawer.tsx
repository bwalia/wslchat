import React from 'react';
import type { ChannelMember } from '../../types';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { setMembersDrawerOpen } from '../../store/slices/uiSlice';
import clsx from 'clsx';

interface MembersDrawerProps {
  members: ChannelMember[];
  channelName: string;
}

const MembersDrawer: React.FC<MembersDrawerProps> = ({ members, channelName }) => {
  const dispatch = useAppDispatch();
  const { usersPresence } = useAppSelector((state) => state.presence);

  const getPresenceStatus = (userUuid: string) => {
    return usersPresence[userUuid]?.status || 'offline';
  };

  return (
    <div className="w-64 border-l border-channel-border dark:border-channel-borderDark bg-channel-bg dark:bg-channel-bgDark flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-channel-border dark:border-channel-borderDark">
        <h3 className="font-semibold text-gray-900 dark:text-white">Members</h3>
        <button
          onClick={() => dispatch(setMembersDrawerOpen(false))}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Member Count */}
      <div className="px-4 py-2 border-b border-channel-border dark:border-channel-borderDark">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {members.length} member{members.length !== 1 ? 's' : ''} in #{channelName}
        </p>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto p-2">
        {members.map((member) => {
          const status = getPresenceStatus(member.user_uuid);
          return (
            <div
              key={member.uuid}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-channel-hover dark:hover:bg-channel-hoverDark cursor-pointer"
            >
              <div className="relative">
                <div className="avatar-md bg-primary-500 flex items-center justify-center text-white font-medium">
                  {member.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span
                  className={clsx(
                    'presence-indicator',
                    status === 'online' && 'bg-accent-green',
                    status === 'away' && 'bg-accent-yellow',
                    status === 'dnd' && 'bg-accent-red',
                    status === 'offline' && 'bg-gray-400'
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {member.user?.name || 'Unknown User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {member.role === 'admin' ? 'Admin' : member.role === 'moderator' ? 'Moderator' : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MembersDrawer;
