import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchChannels } from '../store/slices/channelSlice';

// Components
import Sidebar from './Sidebar/Sidebar';
import ChannelView from './Channel/ChannelView';
import ThreadPanel from './Thread/ThreadPanel';
import WelcomeView from './Channel/WelcomeView';
import CreateChannelModal from './Channel/CreateChannelModal';
import InviteUserModal from './Channel/InviteUserModal';
import InvitationsPanel from './Invitations/InvitationsPanel';
import SettingsModal from './Settings/SettingsModal';

const MainLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const { threadPanelOpen, createChannelOpen, inviteUserOpen, settingsOpen } = useAppSelector((state) => state.ui);
  const { invitesPanelOpen } = useAppSelector((state) => state.invite);
  const { currentChannel, channels } = useAppSelector((state) => state.channel);

  // Fetch channels on mount
  useEffect(() => {
    dispatch(fetchChannels({}));
  }, [dispatch]);

  // Join socket rooms for all channels
  useEffect(() => {
    const joinChannels = async () => {
      for (const channel of channels) {
        await window.electronAPI.invoke('socket:join-channel', channel.uuid);
      }
    };
    if (channels.length > 0) {
      joinChannels();
    }
  }, [channels]);

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Title Bar (for custom window controls on macOS) */}
        {window.electronAPI.isMac && (
          <div className="h-8 bg-channel-bg dark:bg-channel-bgDark drag-region flex items-center pl-20">
            {currentChannel && (
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 no-drag">
                # {currentChannel.name}
              </span>
            )}
          </div>
        )}

        {/* Channel Content */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            {currentChannel ? <ChannelView /> : <WelcomeView />}
          </div>

          {/* Thread Panel */}
          {threadPanelOpen && (
            <ThreadPanel />
          )}
        </div>
      </div>

      {/* Modals */}
      {createChannelOpen && <CreateChannelModal />}
      {inviteUserOpen && currentChannel && (
        <InviteUserModal
          channelUuid={currentChannel.uuid}
          channelName={currentChannel.name}
        />
      )}
      {invitesPanelOpen && <InvitationsPanel />}
      {settingsOpen && <SettingsModal />}
    </div>
  );
};

export default MainLayout;
