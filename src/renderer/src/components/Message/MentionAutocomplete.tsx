import React, { useEffect, useRef, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/useAppDispatch";
import { fetchMentionableUsers, clearMentionableUsers } from "../../store/slices/mentionSlice";
import type { MentionableUser, SpecialMention } from "../../types";
import clsx from "clsx";

interface MentionAutocompleteProps {
  channelUuid: string;
  searchTerm: string;
  position: { top: number; left: number };
  onSelect: (mention: MentionableUser | SpecialMention) => void;
  onClose: () => void;
  isVisible: boolean;
}

const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  channelUuid,
  searchTerm,
  position,
  onSelect,
  onClose,
  isVisible,
}) => {
  const dispatch = useAppDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const { mentionableUsers, specialMentions, isLoadingUsers } = useAppSelector(
    (state) => state.mention
  );
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Filter special mentions based on search term
  const filteredSpecialMentions = specialMentions.filter((m) =>
    m.display.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Combine special mentions and users
  const allOptions = [...filteredSpecialMentions, ...mentionableUsers];

  // Fetch users when search term changes
  useEffect(() => {
    if (isVisible && searchTerm.length >= 0) {
      const debounceTimer = setTimeout(() => {
        dispatch(
          fetchMentionableUsers({
            channelUuid,
            search: searchTerm,
          })
        );
      }, 150);

      return () => clearTimeout(debounceTimer);
    }
  }, [dispatch, channelUuid, searchTerm, isVisible]);

  // Reset selected index when options change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allOptions.length]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isVisible || allOptions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < allOptions.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : allOptions.length - 1
          );
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          if (allOptions[selectedIndex]) {
            onSelect(allOptions[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isVisible, allOptions, selectedIndex, onSelect, onClose]
  );

  // Add keyboard listener
  useEffect(() => {
    if (isVisible) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isVisible, handleKeyDown]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isVisible, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispatch(clearMentionableUsers());
    };
  }, [dispatch]);

  if (!isVisible) return null;

  const isSpecialMention = (
    option: MentionableUser | SpecialMention
  ): option is SpecialMention => {
    return "display" in option;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "away":
        return "bg-yellow-500";
      case "dnd":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div
      ref={containerRef}
      className="mention-autocomplete"
      style={{
        position: "absolute",
        bottom: position.top,
        left: position.left,
        zIndex: 1000,
      }}
    >
      <div className="mention-autocomplete-container">
        {isLoadingUsers && allOptions.length === 0 ? (
          <div className="mention-autocomplete-loading">
            <span className="text-sm text-secondary-500">Loading...</span>
          </div>
        ) : allOptions.length === 0 ? (
          <div className="mention-autocomplete-empty">
            <span className="text-sm text-secondary-500">No users found</span>
          </div>
        ) : (
          <ul className="mention-autocomplete-list">
            {allOptions.map((option, index) => (
              <li
                key={isSpecialMention(option) ? option.id : option.uuid}
                className={clsx(
                  "mention-autocomplete-item",
                  index === selectedIndex && "selected"
                )}
                onClick={() => onSelect(option)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {isSpecialMention(option) ? (
                  // Special mention (channel, here, everyone)
                  <div className="mention-special">
                    <div className="mention-special-icon">
                      <svg
                        className="w-5 h-5 text-primary-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    </div>
                    <div className="mention-special-info">
                      <span className="mention-special-name">
                        {option.display}
                      </span>
                      <span className="mention-special-description">
                        {option.description}
                      </span>
                    </div>
                  </div>
                ) : (
                  // User mention
                  <div className="mention-user">
                    <div className="mention-user-avatar">
                      <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-800 flex items-center justify-center text-sm font-medium text-primary-700 dark:text-primary-200">
                        {(option.first_name?.[0] || option.username?.[0] || "U").toUpperCase()}
                      </div>
                      <span
                        className={clsx(
                          "mention-user-status",
                          getStatusColor(option.status)
                        )}
                      />
                    </div>
                    <div className="mention-user-info">
                      <span className="mention-user-name">
                        {option.display_name || option.username || "Unknown"}
                      </span>
                      {option.username && (
                        <span className="mention-user-username">
                          @{option.username}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MentionAutocomplete;
