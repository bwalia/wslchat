import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/useAppDispatch";
import {
  inviteUserToChannel,
  searchUsersToInvite,
  clearInviteState,
} from "../../store/slices/channelSlice";
import { closeInviteUser } from "../../store/slices/uiSlice";
import clsx from "clsx";

interface InviteUserModalProps {
  channelUuid: string;
  channelName: string;
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({
  channelUuid,
  channelName,
}) => {
  const dispatch = useAppDispatch();
  const {
    inviteSearchResults,
    isSearchingUsers,
    isInviting,
    inviteError,
    inviteSuccess,
    members,
  } = useAppSelector((state) => state.channel);
  const { user: currentUser } = useAppSelector((state) => state.auth);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<{
    uuid: string;
    name: string;
    email: string;
  } | null>(null);
  const [inviteMessage, setInviteMessage] = useState("");
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set());
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get existing member UUIDs to filter them out from search results
  const existingMemberUuids = new Set(
    (members[channelUuid] || []).map((m) => m.user_uuid)
  );

  // Debounced search
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (query.trim().length >= 2) {
        searchTimeoutRef.current = setTimeout(() => {
          dispatch(searchUsersToInvite({ query: query.trim(), channelUuid }));
        }, 300);
      }
    },
    [dispatch, channelUuid]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      dispatch(clearInviteState());
    };
  }, [dispatch]);

  // Reset success state after showing
  useEffect(() => {
    if (inviteSuccess && selectedUser) {
      setSentInvites((prev) => new Set(prev).add(selectedUser.uuid));
      setSelectedUser(null);
      setInviteMessage("");
    }
  }, [inviteSuccess, selectedUser]);

  const handleClose = () => {
    dispatch(closeInviteUser());
    dispatch(clearInviteState());
  };

  const handleSelectUser = (user: {
    uuid: string;
    name: string;
    email: string;
  }) => {
    setSelectedUser(user);
  };

  const handleSendInvite = async () => {
    if (!selectedUser) return;

    try {
      await dispatch(
        inviteUserToChannel({
          channelUuid,
          userUuid: selectedUser.uuid,
          message: inviteMessage.trim() || undefined,
          expiresInHours: 72, // 3 days
        })
      ).unwrap();
    } catch (error) {
      console.error("[InviteUser] Failed to send invite:", error);
    }
  };

  // Filter out current user, existing members, and already invited users
  const filteredResults = inviteSearchResults.filter(
    (user) =>
      user.uuid !== currentUser?.uuid &&
      !existingMemberUuids.has(user.uuid) &&
      !sentInvites.has(user.uuid)
  );

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Invite people to #{channelName}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Search for users to invite to this channel
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Search Input */}
          <div>
            <label
              htmlFor="user-search"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Search users
            </label>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                id="user-search"
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by name or email..."
                className="input-field pl-10"
                autoFocus
              />
              {isSearchingUsers && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg
                    className="animate-spin h-5 w-5 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Search Results */}
          {searchQuery.length >= 2 && !selectedUser && (
            <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              {filteredResults.length > 0 ? (
                filteredResults.map((user) => (
                  <button
                    key={user.uuid}
                    onClick={() => handleSelectUser(user)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
                  >
                    <div className="avatar-md bg-primary-500 flex items-center justify-center text-white font-medium">
                      {user.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {user.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                      </p>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                  </button>
                ))
              ) : !isSearchingUsers ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  {inviteSearchResults.length > 0
                    ? "All matching users are already members or invited"
                    : "No users found. Try a different search term."}
                </div>
              ) : null}
            </div>
          )}

          {/* Selected User */}
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                <div className="avatar-md bg-primary-500 flex items-center justify-center text-white font-medium">
                  {selectedUser.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedUser.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedUser.email}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-1 rounded hover:bg-primary-100 dark:hover:bg-primary-800 text-gray-500"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Optional Message */}
              <div>
                <label
                  htmlFor="invite-message"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Add a message{" "}
                  <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="invite-message"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Hey! I'd like you to join our channel..."
                  className="input-field resize-none"
                  rows={3}
                  maxLength={250}
                />
              </div>
            </div>
          )}

          {/* Sent Invites */}
          {sentInvites.size > 0 && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {sentInvites.size} invite{sentInvites.size > 1 ? "s" : ""} sent
                successfully
              </p>
            </div>
          )}

          {/* Error Message */}
          {inviteError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">
                {inviteError}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            className="btn-secondary"
            disabled={isInviting}
          >
            {sentInvites.size > 0 ? "Done" : "Cancel"}
          </button>
          {selectedUser && (
            <button
              onClick={handleSendInvite}
              disabled={isInviting}
              className={clsx(
                "btn-primary",
                isInviting && "opacity-75 cursor-not-allowed"
              )}
            >
              {isInviting ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Sending...
                </span>
              ) : (
                "Send Invite"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InviteUserModal;
