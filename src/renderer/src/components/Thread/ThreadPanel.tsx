import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { fetchThread } from '../../store/slices/messageSlice';
import { closeThread } from '../../store/slices/uiSlice';
import MessageItem from '../Message/MessageItem';
import MessageInput from '../Message/MessageInput';

const ThreadPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const { activeThreadMessageUuid } = useAppSelector((state) => state.ui);
  const { threads, messages, isLoadingThread } = useAppSelector((state) => state.message);
  const { currentChannel } = useAppSelector((state) => state.channel);

  // Fetch thread when opened
  useEffect(() => {
    if (activeThreadMessageUuid) {
      dispatch(fetchThread({ messageUuid: activeThreadMessageUuid }));
    }
  }, [activeThreadMessageUuid, dispatch]);

  if (!activeThreadMessageUuid || !currentChannel) {
    return null;
  }

  // Get parent message
  const channelMessages = messages[currentChannel.uuid] || [];
  const parentMessage = channelMessages.find((m) => m.uuid === activeThreadMessageUuid);
  const thread = threads[activeThreadMessageUuid];

  const handleClose = () => {
    dispatch(closeThread());
  };

  return (
    <div className="thread-panel flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Thread</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            #{currentChannel.name}
          </p>
        </div>
        <button
          onClick={handleClose}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Parent Message */}
        {parentMessage && (
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <MessageItem message={parentMessage} showAvatar />
          </div>
        )}

        {/* Loading */}
        {isLoadingThread && (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-6 w-6 text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}

        {/* Replies */}
        {!isLoadingThread && thread && (
          <>
            {/* Reply count */}
            <div className="px-5 py-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {thread.replies?.length || 0} {(thread.replies?.length || 0) === 1 ? 'reply' : 'replies'}
              </p>
            </div>

            {/* Reply messages */}
            <div className="space-y-0.5">
              {thread.replies?.map((reply, index) => {
                const prevReply = thread.replies?.[index - 1];
                const showAvatar = !prevReply || prevReply.user_uuid !== reply.user_uuid;
                return (
                  <MessageItem
                    key={reply.uuid}
                    message={reply}
                    showAvatar={showAvatar}
                  />
                );
              })}
            </div>

            {/* No replies */}
            {(!thread.replies || thread.replies.length === 0) && (
              <div className="py-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">No replies yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Be the first to reply!
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reply Input */}
      <MessageInput
        channelUuid={currentChannel.uuid}
        parentMessageUuid={activeThreadMessageUuid}
        placeholder="Reply in thread..."
      />
    </div>
  );
};

export default ThreadPanel;
