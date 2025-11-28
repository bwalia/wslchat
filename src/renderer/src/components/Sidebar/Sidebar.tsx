import React from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { setCurrentChannel, markChannelAsRead } from '../../store/slices/channelSlice';
import { openCreateChannel, openSettings, toggleSidebar } from '../../store/slices/uiSlice';
import { logout } from '../../store/slices/authSlice';
import type { Channel } from '../../types';
import clsx from 'clsx';

const Sidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { channels, currentChannel } = useAppSelector((state) => state.channel);
  const { sidebarCollapsed, isSocketConnected } = useAppSelector((state) => state.ui);

  // Separate channels by type
  const publicChannels = channels.filter((c) => c.type === 'public');
  const privateChannels = channels.filter((c) => c.type === 'private');
  const directMessages = channels.filter((c) => c.type === 'direct');

  const handleChannelClick = (channel: Channel) => {
    dispatch(setCurrentChannel(channel));
    if (channel.unread_count && channel.unread_count > 0) {
      dispatch(markChannelAsRead(channel.uuid));
    }
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  const ChannelItem: React.FC<{ channel: Channel }> = ({ channel }) => {
    const isActive = currentChannel?.uuid === channel.uuid;
    const hasUnread = (channel.unread_count || 0) > 0;

    return (
      <button
        onClick={() => handleChannelClick(channel)}
        className={clsx(
          'w-full text-left sidebar-item group',
          isActive && 'active',
          hasUnread && !isActive && 'font-semibold text-sidebar-textHover'
        )}
      >
        <span className="mr-2 text-lg">
          {channel.type === 'direct' ? (
            <span className="inline-block w-2 h-2 rounded-full bg-accent-green mr-1" />
          ) : channel.type === 'private' ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ) : (
            '#'
          )}
        </span>
        <span className="truncate flex-1">{channel.name}</span>
        {hasUnread && (
          <span className="unread-badge ml-2">
            {channel.unread_count! > 99 ? '99+' : channel.unread_count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className={clsx('sidebar flex flex-col h-full transition-all duration-200', sidebarCollapsed ? 'w-16' : 'w-64')}>
      {/* Workspace Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-hover">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-lg">Convo</span>
            <span className={clsx('w-2 h-2 rounded-full', isSocketConnected ? 'bg-accent-green' : 'bg-gray-500')} />
          </div>
        )}
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="p-1.5 rounded hover:bg-sidebar-hover text-sidebar-text hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* User Status */}
      {!sidebarCollapsed && (
        <div className="px-4 py-3 border-b border-sidebar-hover">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="avatar-md bg-primary-600 flex items-center justify-center text-white font-medium">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="presence-online" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-sidebar-text truncate">Active</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide py-2">
        {/* Channels Section */}
        {!sidebarCollapsed && (
          <>
            <div className="px-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-sidebar-text">Channels</span>
                <button
                  onClick={() => dispatch(openCreateChannel())}
                  className="p-1 rounded hover:bg-sidebar-hover text-sidebar-text hover:text-white"
                  title="Create channel"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="space-y-0.5 px-2">
              {publicChannels.map((channel) => (
                <ChannelItem key={channel.uuid} channel={channel} />
              ))}
              {privateChannels.map((channel) => (
                <ChannelItem key={channel.uuid} channel={channel} />
              ))}
            </div>

            {/* Direct Messages Section */}
            <div className="px-4 py-2 mt-4">
              <span className="text-xs font-semibold uppercase text-sidebar-text">Direct Messages</span>
            </div>
            <div className="space-y-0.5 px-2">
              {directMessages.map((channel) => (
                <ChannelItem key={channel.uuid} channel={channel} />
              ))}
            </div>
          </>
        )}

        {/* Collapsed View */}
        {sidebarCollapsed && (
          <div className="space-y-2 px-2">
            {channels.slice(0, 10).map((channel) => (
              <button
                key={channel.uuid}
                onClick={() => handleChannelClick(channel)}
                className={clsx(
                  'w-full p-2 rounded-lg flex items-center justify-center',
                  currentChannel?.uuid === channel.uuid
                    ? 'bg-sidebar-active text-white'
                    : 'text-sidebar-text hover:text-white hover:bg-sidebar-hover'
                )}
                title={channel.name}
              >
                <span className="text-lg">
                  {channel.type === 'direct' ? '💬' : '#'}
                </span>
                {(channel.unread_count || 0) > 0 && (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-accent-red" />
                )}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Footer Actions */}
      <div className="border-t border-sidebar-hover p-2">
        <button
          onClick={() => dispatch(openSettings())}
          className="sidebar-item w-full"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {!sidebarCollapsed && <span>Settings</span>}
        </button>
        <button
          onClick={handleLogout}
          className="sidebar-item w-full text-accent-red hover:text-red-400"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!sidebarCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
