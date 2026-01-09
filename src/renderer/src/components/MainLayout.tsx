import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchChannels } from '../store/slices/channelSlice';
import { closeDirectMessage } from '../store/slices/uiSlice';

// Components
import Sidebar from './Sidebar/Sidebar';
import ChannelView from './Channel/ChannelView';
import ThreadPanel from './Thread/ThreadPanel';
import WelcomeView from './Channel/WelcomeView';
import CreateChannelModal from './Channel/CreateChannelModal';
import DirectMessageModal from './Channel/DirectMessageModal';
import InviteUserModal from './Channel/InviteUserModal';
import InvitationsPanel from './Invitations/InvitationsPanel';
import SettingsModal from './Settings/SettingsModal';

const MainLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const { threadPanelOpen, createChannelOpen, directMessageOpen, inviteUserOpen, settingsOpen } = useAppSelector((state) => state.ui);
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
          <div className="h-8 bg-white dark:bg-secondary-900 border-b border-secondary-200 dark:border-secondary-700 drag-region flex items-center pl-20">
            {currentChannel && (
              <span className="text-sm font-medium text-secondary-600 dark:text-secondary-400 no-drag">
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
      {directMessageOpen && (
        <DirectMessageModal
          isOpen={directMessageOpen}
          onClose={() => dispatch(closeDirectMessage())}
        />
      )}
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
