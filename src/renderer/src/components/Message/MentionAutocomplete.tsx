import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
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

// Debounce delay for API calls (ms)
const DEBOUNCE_DELAY = 300;

// Minimum characters before triggering API search (for performance)
const MIN_SEARCH_LENGTH = 2;

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
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Track if we've fetched the initial list for this channel
  const hasFetchedRef = useRef(false);
  const lastChannelRef = useRef<string>("");
  const lastSearchRef = useRef<string>("");

  // Filter special mentions based on search term (always local filtering)
  const filteredSpecialMentions = useMemo(() => {
    if (!searchTerm) return specialMentions;
    const lowerSearch = searchTerm.toLowerCase();
    return specialMentions.filter(
      (m) =>
        m.display.toLowerCase().includes(lowerSearch) ||
        m.id.toLowerCase().includes(lowerSearch)
    );
  }, [specialMentions, searchTerm]);

  // Filter users locally when we have cached data
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return mentionableUsers;
    const lowerSearch = searchTerm.toLowerCase();
    return mentionableUsers.filter(
      (u) =>
        u.username?.toLowerCase().includes(lowerSearch) ||
        u.first_name?.toLowerCase().includes(lowerSearch) ||
        u.last_name?.toLowerCase().includes(lowerSearch) ||
        u.display_name?.toLowerCase().includes(lowerSearch) ||
        u.email?.toLowerCase().includes(lowerSearch)
    );
  }, [mentionableUsers, searchTerm]);

  // Combine special mentions and users
  const allOptions: (MentionableUser | SpecialMention)[] = useMemo(
    () => [...filteredSpecialMentions, ...filteredUsers],
    [filteredSpecialMentions, filteredUsers]
  );

  // Fetch users with smart caching and debouncing
  useEffect(() => {
    if (!isVisible) {
      return;
    }

    // Reset fetch state when channel changes
    if (lastChannelRef.current !== channelUuid) {
      hasFetchedRef.current = false;
      lastChannelRef.current = channelUuid;
    }

    // Determine if we need to make an API call
    const shouldFetch = !hasFetchedRef.current ||
      (searchTerm.length >= MIN_SEARCH_LENGTH && lastSearchRef.current !== searchTerm);

    if (!shouldFetch) {
      return;
    }

    // Debounce the API call
    const debounceTimer = setTimeout(() => {
      // Only fetch if search term meets minimum length or we're doing initial load
      if (!hasFetchedRef.current || searchTerm.length >= MIN_SEARCH_LENGTH) {
        dispatch(
          fetchMentionableUsers({
            channelUuid,
            search: searchTerm.length >= MIN_SEARCH_LENGTH ? searchTerm : undefined,
          })
        );
        hasFetchedRef.current = true;
        lastSearchRef.current = searchTerm;
      }
    }, hasFetchedRef.current ? DEBOUNCE_DELAY : 50); // Faster initial load

    return () => clearTimeout(debounceTimer);
  }, [dispatch, channelUuid, searchTerm, isVisible]);

  // Reset selected index when options change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allOptions.length]);

  // Handle selection
  const handleSelect = useCallback(
    (option: MentionableUser | SpecialMention) => {
      onSelect(option);
    },
    [onSelect]
  );

  // Handle keyboard navigation - using capture phase to intercept before editor
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if we have options
      if (allOptions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) =>
            prev < allOptions.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : allOptions.length - 1
          );
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          if (allOptions[selectedIndex]) {
            handleSelect(allOptions[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
      }
    };

    // Use capture phase to intercept events before they reach the editor
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isVisible, allOptions, selectedIndex, handleSelect, onClose]);

  // Handle click outside
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    // Use slight delay to avoid immediate close on click that opened the menu
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isVisible, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispatch(clearMentionableUsers());
    };
  }, [dispatch]);

  // Scroll selected item into view
  useEffect(() => {
    if (!isVisible) return;
    const selectedElement = containerRef.current?.querySelector(
      `[data-index="${selectedIndex}"]`
    );
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, isVisible]);

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

  const handleItemClick = (
    e: React.MouseEvent,
    option: MentionableUser | SpecialMention
  ) => {
    e.preventDefault();
    e.stopPropagation();
    handleSelect(option);
  };

  return (
    <div
      ref={containerRef}
      className="mention-autocomplete"
      style={{
        position: "absolute",
        bottom: position.top,
        left: Math.max(0, position.left),
        zIndex: 9999,
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
    >
      <div className="mention-autocomplete-container">
        {isLoadingUsers && allOptions.length === 0 ? (
          <div className="mention-autocomplete-loading">
            <span className="text-sm text-secondary-500">Loading...</span>
          </div>
        ) : allOptions.length === 0 ? (
          <div className="mention-autocomplete-empty">
            <span className="text-sm text-secondary-500">
              {searchTerm ? `No users found for "${searchTerm}"` : "No users available"}
            </span>
          </div>
        ) : (
          <ul className="mention-autocomplete-list" role="listbox">
            {allOptions.map((option, index) => (
              <li
                key={isSpecialMention(option) ? option.id : option.uuid}
                data-index={index}
                role="option"
                aria-selected={index === selectedIndex}
                className={clsx(
                  "mention-autocomplete-item",
                  index === selectedIndex && "selected"
                )}
                onMouseDown={(e) => handleItemClick(e, option)}
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
                        {option.display_name?.trim() || option.username || "Unknown"}
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
