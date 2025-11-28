import React from 'react';
import type { TypingUser } from '../../types';

interface TypingIndicatorProps {
  users: TypingUser[];
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ users }) => {
  if (users.length === 0) return null;

  const getTypingText = () => {
    if (users.length === 1) {
      return `${users[0].userName} is typing`;
    } else if (users.length === 2) {
      return `${users[0].userName} and ${users[1].userName} are typing`;
    } else if (users.length === 3) {
      return `${users[0].userName}, ${users[1].userName}, and ${users[2].userName} are typing`;
    } else {
      return `${users[0].userName} and ${users.length - 1} others are typing`;
    }
  };

  return (
    <div className="typing-indicator">
      <div className="flex items-center gap-1">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
      <span>{getTypingText()}...</span>
    </div>
  );
};

export default TypingIndicator;
