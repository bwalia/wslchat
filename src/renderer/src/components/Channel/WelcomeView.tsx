import React from 'react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { openCreateChannel } from '../../store/slices/uiSlice';

const WelcomeView: React.FC = () => {
  const dispatch = useAppDispatch();

  return (
    <div className="flex-1 flex items-center justify-center bg-channel-bg dark:bg-channel-bgDark">
      <div className="text-center max-w-md px-6">
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
          <svg className="w-12 h-12 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Welcome to Convo
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Select a channel from the sidebar to start chatting, or create a new channel to begin a conversation.
        </p>
        <button
          onClick={() => dispatch(openCreateChannel())}
          className="btn-primary"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create a Channel
        </button>
      </div>
    </div>
  );
};

export default WelcomeView;
