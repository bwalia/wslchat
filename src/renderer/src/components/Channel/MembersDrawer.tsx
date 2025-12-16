import React from 'react';
import type { ChannelMember } from '../../types';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { setMembersDrawerOpen, openInviteUser } from '../../store/slices/uiSlice';
import clsx from 'clsx';

interface MembersDrawerProps {
  members: ChannelMember[];
  channelName: string;
}

/**
 * Get display name for a channel member
 * Handles both direct API format (first_name, last_name) and nested user object
 */
const getMemberDisplayName = (member: ChannelMember): string => {
  // First try direct fields from API (joined from users table)
  if (member.first_name || member.last_name) {
    const name = `${member.first_name || ''} ${member.last_name || ''}`.trim();
    if (name) return name;
  }

  // Try username
  if (member.username) {
    return member.username;
  }

  // Try email (use part before @)
  if (member.email) {
    return member.email.split('@')[0];
  }

  // Try nested user object (legacy/alternative format)
  if (member.user) {
    if (member.user.name) return member.user.name;
    if (member.user.first_name || member.user.last_name) {
      const name = `${member.user.first_name || ''} ${member.user.last_name || ''}`.trim();
      if (name) return name;
    }
    if (member.user.username) return member.user.username;
    if (member.user.email) return member.user.email.split('@')[0];
  }

  return 'Unknown User';
};

/**
 * Get initials for avatar
 */
const getMemberInitials = (member: ChannelMember): string => {
  const name = getMemberDisplayName(member);
  if (name === 'Unknown User') return 'U';

  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.charAt(0).toUpperCase();
};

const MembersDrawer: React.FC<MembersDrawerProps> = ({ members, channelName }) => {
  const dispatch = useAppDispatch();
  const { usersPresence } = useAppSelector((state) => state.presence);
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const { currentChannel } = useAppSelector((state) => state.channel);

  // Check if current user is admin or moderator of this channel
  const currentUserMember = members.find((m) => m.user_uuid === currentUser?.uuid);
  const canInvite = currentUserMember?.role === 'admin' || currentUserMember?.role === 'moderator';
  const isDirectChannel = currentChannel?.type === 'direct';

  const getPresenceStatus = (userUuid: string) => {
    return usersPresence[userUuid]?.status || 'offline';
  };

  const handleInviteClick = () => {
    dispatch(openInviteUser());
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

      {/* Invite Button - Only visible to admins/moderators, not for direct channels */}
      {canInvite && !isDirectChannel && (
        <div className="px-4 py-3 border-b border-channel-border dark:border-channel-borderDark">
          <button
            onClick={handleInviteClick}
            className="w-full btn-primary btn-md flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Invite People
          </button>
        </div>
      )}

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
          const displayName = getMemberDisplayName(member);
          const initials = getMemberInitials(member);

          return (
            <div
              key={member.uuid || member.user_uuid}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-channel-hover dark:hover:bg-channel-hoverDark cursor-pointer"
            >
              <div className="relative">
                <div className="avatar-md bg-primary-500 flex items-center justify-center text-white font-medium">
                  {initials}
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
                  {displayName}
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
