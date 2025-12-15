import React, { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { fetchMessages } from '../../store/slices/messageSlice';
import { fetchChannelMembers, markChannelAsRead } from '../../store/slices/channelSlice';
import { toggleMembersDrawer } from '../../store/slices/uiSlice';

// Components
import MessageList from '../Message/MessageList';
import MessageInput from '../Message/MessageInput';
import ChannelHeader from './ChannelHeader';
import MembersDrawer from './MembersDrawer';
import TypingIndicator from '../Message/TypingIndicator';

const ChannelView: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentChannel, members } = useAppSelector((state) => state.channel);
  const { messages, isLoading, hasMore } = useAppSelector((state) => state.message);
  const { membersDrawerOpen } = useAppSelector((state) => state.ui);
  const { typingUsers } = useAppSelector((state) => state.presence);
  const { user } = useAppSelector((state) => state.auth);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages when channel changes
  useEffect(() => {
    if (currentChannel) {
      dispatch(fetchMessages({ channelUuid: currentChannel.uuid }));
      dispatch(fetchChannelMembers({ channelUuid: currentChannel.uuid }));
      dispatch(markChannelAsRead(currentChannel.uuid));
    }
  }, [currentChannel, dispatch]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages[currentChannel?.uuid || '']?.length]);

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

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Messages */}
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
