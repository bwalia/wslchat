import React, { useState, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { sendMessage } from '../../store/slices/messageSlice';
import { useTypingIndicator } from '../../hooks/useSocketEvents';
import clsx from 'clsx';

interface MessageInputProps {
  channelUuid: string;
  parentMessageUuid?: string;
  placeholder?: string;
}

const MessageInput: React.FC<MessageInputProps> = ({
  channelUuid,
  parentMessageUuid,
  placeholder,
}) => {
  const dispatch = useAppDispatch();
  const { isSending } = useAppSelector((state) => state.message);
  const { currentChannel } = useAppSelector((state) => state.channel);

  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendTyping = useTypingIndicator(channelUuid);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    adjustTextareaHeight();
    sendTyping(true);
  };

  const handleSubmit = async () => {
    if (!content.trim() || isSending) return;

    sendTyping(false);

    await dispatch(
      sendMessage({
        channelUuid,
        content: content.trim(),
        parentMessageUuid,
      })
    );

    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const channelName = currentChannel?.name || 'channel';
  const defaultPlaceholder = parentMessageUuid
    ? 'Reply in thread...'
    : `Message #${channelName}`;

  return (
    <div className="message-input-container">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 pt-2">
        {/* Bold */}
        <button className="emoji-btn" title="Bold (Ctrl+B)">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
          </svg>
        </button>

        {/* Italic */}
        <button className="emoji-btn" title="Italic (Ctrl+I)">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h4M14 20H8M15 4L9 20" />
          </svg>
        </button>

        {/* Code */}
        <button className="emoji-btn" title="Code">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </button>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-1" />

        {/* Link */}
        <button className="emoji-btn" title="Add link">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </button>

        {/* Numbered List */}
        <button className="emoji-btn" title="Numbered list">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        </button>
      </div>

      {/* Text Area */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsExpanded(true)}
        onBlur={() => setIsExpanded(false)}
        placeholder={placeholder || defaultPlaceholder}
        className="message-input min-h-[44px]"
        rows={1}
        disabled={isSending}
      />

      {/* Bottom Toolbar */}
      <div className="flex items-center justify-between px-3 pb-2">
        <div className="flex items-center gap-1">
          {/* Attach File */}
          <button className="emoji-btn" title="Attach file">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {/* Emoji */}
          <button className="emoji-btn" title="Add emoji">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Mention */}
          <button className="emoji-btn" title="Mention someone">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
          </button>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || isSending}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            content.trim() && !isSending
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
          )}
          title="Send message"
        >
          {isSending ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>

      {/* Keyboard shortcut hint */}
      {isExpanded && (
        <div className="px-3 pb-2">
          <p className="text-2xs text-gray-400 dark:text-gray-500">
            Press <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">Enter</kbd> to send,{' '}
            <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">Shift + Enter</kbd> for new line
          </p>
        </div>
      )}
    </div>
  );
};

export default MessageInput;
