import React, { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { fetchMessages } from '../../store/slices/messageSlice';
import { fetchChannelMembers, markChannelAsRead } from '../../store/slices/channelSlice';
import { toggleMembersDrawer, setActiveChannelTab } from '../../store/slices/uiSlice';
import { fetchProjectByChannel } from '../../store/slices/kanbanSlice';
import clsx from 'clsx';

// Components
import MessageList from '../Message/MessageList';
import MessageInput from '../Message/MessageInput';
import ChannelHeader from './ChannelHeader';
import MembersDrawer from './MembersDrawer';
import TypingIndicator from '../Message/TypingIndicator';
import TasksTab from './TasksTab';

const ChannelView: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentChannel, members } = useAppSelector((state) => state.channel);
  const { messages, isLoading, hasMore } = useAppSelector((state) => state.message);
  const { membersDrawerOpen, activeChannelTab } = useAppSelector((state) => state.ui);
  const { typingUsers } = useAppSelector((state) => state.presence);
  const { user } = useAppSelector((state) => state.auth);
  const { projectByChannel } = useAppSelector((state) => state.kanban);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get project for current channel (to determine if tabs should show)
  // project can be: undefined (not fetched yet), null (no project linked), or object (has project)
  const project = currentChannel ? projectByChannel[currentChannel.uuid] : undefined;
  // Show tabs if project exists. Only hide tabs if we explicitly know there's no project (project === null)
  // When project is undefined (not yet loaded), we don't show tabs yet
  const hasLinkedProject = project !== null && project !== undefined;

  // Fetch messages and project when channel changes
  useEffect(() => {
    if (currentChannel) {
      dispatch(fetchMessages({ channelUuid: currentChannel.uuid }));
      dispatch(fetchChannelMembers({ channelUuid: currentChannel.uuid }));
      dispatch(markChannelAsRead(currentChannel.uuid));
      // Fetch project to check if this channel has tasks
      dispatch(fetchProjectByChannel(currentChannel.uuid));
      // Reset to messages tab when channel changes
      dispatch(setActiveChannelTab('messages'));
    }
  }, [currentChannel, dispatch]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current && activeChannelTab === 'messages') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages[currentChannel?.uuid || '']?.length, activeChannelTab]);

  if (!currentChannel) {
    return null;
  }

  const channelMessages = messages[currentChannel.uuid] || [];
  const channelMembers = members[currentChannel.uuid] || [];
  const channelTypingUsers = typingUsers[currentChannel.uuid]?.filter(
    (t) => t.userUuid !== user?.uuid
  ) || [];
  const canLoadMore = hasMore[currentChannel.uuid];

  const handleLoadMore = () => {
    if (channelMessages.length > 0 && canLoadMore) {
      const oldestMessage = channelMessages[0];
      dispatch(
        fetchMessages({
          channelUuid: currentChannel.uuid,
          params: { before: oldestMessage.uuid, limit: 50 },
        })
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Channel Header */}
      <ChannelHeader
        channel={currentChannel}
        memberCount={channelMembers.length}
        onToggleMembers={() => dispatch(toggleMembersDrawer())}
      />

      {/* Tab Navigation - Only show if channel has linked project */}
      {hasLinkedProject && (
        <div className="channel-tabs">
          <button
            onClick={() => dispatch(setActiveChannelTab('messages'))}
            className={clsx(
              'channel-tab',
              activeChannelTab === 'messages' && 'channel-tab-active'
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Messages
          </button>
          <button
            onClick={() => dispatch(setActiveChannelTab('tasks'))}
            className={clsx(
              'channel-tab',
              activeChannelTab === 'tasks' && 'channel-tab-active'
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Tasks
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Messages Tab */}
        {activeChannelTab === 'messages' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <MessageList
              messages={channelMessages}
              isLoading={isLoading}
              canLoadMore={canLoadMore}
              onLoadMore={handleLoadMore}
            />

            {/* Typing Indicator */}
            {channelTypingUsers.length > 0 && (
              <TypingIndicator users={channelTypingUsers} />
            )}

            {/* Message Input */}
            <MessageInput channelUuid={currentChannel.uuid} />
          </div>
        )}

        {/* Tasks Tab */}
        {activeChannelTab === 'tasks' && hasLinkedProject && (
          <TasksTab channelUuid={currentChannel.uuid} />
        )}

        {/* Members Drawer */}
        {membersDrawerOpen && (
          <MembersDrawer
            members={channelMembers}
            channelName={currentChannel.name}
          />
        )}
      </div>
    </div>
  );
};

export default ChannelView;
