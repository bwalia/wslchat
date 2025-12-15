/**
 * InvitationsPanel - Production-grade panel for managing channel invitations
 * Features:
 * - View all pending invitations
 * - Accept/decline invitations with loading states
 * - Real-time updates via socket events
 * - Comprehensive error handling
 * - Type-safe implementation
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import {
  fetchPendingInvites,
  acceptInvite,
  declineInvite,
  setInvitesPanelOpen,
  clearInviteError,
} from '../../store/slices/inviteSlice';
import { fetchChannels, setCurrentChannel } from '../../store/slices/channelSlice';
import type { ChannelInvite, Channel } from '../../types';
import clsx from 'clsx';

// Safe date parser with fallback
const safeParseDate = (dateString: string | undefined | null): Date => {
  if (!dateString) return new Date();

  try {
    let normalized = dateString;
    if (typeof dateString === 'string' && !dateString.includes('T')) {
      normalized = dateString.replace(' ', 'T');
      if (!normalized.includes('+') && !normalized.includes('Z')) {
        normalized += 'Z';
      }
    }
    const date = new Date(normalized);
    return isNaN(date.getTime()) ? new Date() : date;
  } catch {
    return new Date();
  }
};

// Format relative time safely
const formatRelativeTime = (dateString: string | undefined): string => {
  try {
    const date = safeParseDate(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Recently';
  }
};

// Get inviter display name safely
const getInviterName = (invite: ChannelInvite): string => {
  if (invite.inviter_first_name && invite.inviter_last_name) {
    return `${invite.inviter_first_name} ${invite.inviter_last_name}`.trim();
  }
  if (invite.inviter?.name) {
    return invite.inviter.name;
  }
  if (invite.inviter_first_name) {
    return invite.inviter_first_name;
  }
  return 'Someone';
};

// Get channel display name safely
const getChannelName = (invite: ChannelInvite): string => {
  return invite.channel_name || invite.channel?.name || 'Unknown Channel';
};

// Channel type icon component
const ChannelIcon: React.FC<{ invite: ChannelInvite }> = ({ invite }) => {
  const type = invite.channel_type || invite.channel?.type;

  if (type === 'private') {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    );
  }
  return <span className="text-lg font-medium">#</span>;
};

// Loading spinner component
const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <svg
      className={clsx('animate-spin', sizeClasses[size])}
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
  );
};

// Invitation card component
interface InvitationCardProps {
  invite: ChannelInvite;
  isProcessing: boolean;
  isAccepting: boolean;
  isDeclining: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

const InvitationCard: React.FC<InvitationCardProps> = ({
  invite,
  isProcessing,
  isAccepting,
  isDeclining,
  onAccept,
  onDecline,
}) => {
  return (
    <div
      className={clsx(
        'p-4 rounded-lg border transition-all duration-200',
        isProcessing
          ? 'border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
      )}
    >
      {/* Channel Info */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
          <ChannelIcon invite={invite} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white truncate">
            #{getChannelName(invite)}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Invited by {getInviterName(invite)} &bull; {formatRelativeTime(invite.created_at)}
          </p>
        </div>
      </div>

      {/* Invite Message */}
      {invite.message && (
        <div className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-300 italic">
            &ldquo;{invite.message}&rdquo;
          </p>
        </div>
      )}

      {/* Channel Description */}
      {invite.channel_description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
          {invite.channel_description}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onAccept}
          disabled={isProcessing}
          className={clsx(
            'flex-1 btn-primary py-2 text-sm font-medium',
            isProcessing && 'opacity-75 cursor-not-allowed'
          )}
        >
          {isProcessing && isAccepting ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" />
              Accepting...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Accept
            </span>
          )}
        </button>
        <button
          onClick={onDecline}
          disabled={isProcessing}
          className={clsx(
            'flex-1 btn-secondary py-2 text-sm font-medium',
            isProcessing && 'opacity-75 cursor-not-allowed'
          )}
        >
          {isProcessing && isDeclining ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" />
              Declining...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Decline
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

const InvitationsPanel: React.FC = () => {
  const dispatch = useAppDispatch();

  const {
    pendingInvites,
    isLoading,
    isAccepting,
    isDeclining,
    processingInviteUuid,
    error,
    lastFetched,
  } = useAppSelector((state) => state.invite);

  const { channels } = useAppSelector((state) => state.channel);

  // Memoize the check for stale data
  const isStale = useMemo(() => {
    return !lastFetched || Date.now() - lastFetched > 30000;
  }, [lastFetched]);

  // Fetch invites on mount if stale
  useEffect(() => {
    if (isStale) {
      dispatch(fetchPendingInvites());
    }
  }, [dispatch, isStale]);

  // Handle accept invitation with proper error handling
  const handleAccept = useCallback(
    async (inviteUuid: string, channelUuid: string) => {
      try {
        console.log('[Invitations] Accepting invite:', inviteUuid, 'for channel:', channelUuid);

        // Accept the invitation
        const acceptResult = await dispatch(acceptInvite(inviteUuid)).unwrap();
        console.log('[Invitations] Accept result:', acceptResult);

        // Small delay to ensure backend has processed the membership
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Join the socket room for this channel
        if (channelUuid) {
          try {
            await window.electronAPI.invoke('socket:join-channel', channelUuid);
            console.log('[Invitations] Joined socket room for channel:', channelUuid);
          } catch (socketErr) {
            console.warn('[Invitations] Socket join failed (non-critical):', socketErr);
          }
        }

        // Refresh channels to get the newly joined channel
        console.log('[Invitations] Fetching updated channel list...');
        const channelsResult = await dispatch(fetchChannels({})).unwrap();
        console.log('[Invitations] Channels result:', channelsResult);

        // Navigate to the new channel if found
        const channelsList = channelsResult?.data || [];
        if (channelUuid && Array.isArray(channelsList)) {
          const newChannel = channelsList.find((c: Channel) => c.uuid === channelUuid);
          if (newChannel) {
            console.log('[Invitations] Found new channel, navigating:', newChannel.name);
            dispatch(setCurrentChannel(newChannel));
            dispatch(setInvitesPanelOpen(false));
            return;
          }
        }

        // Fallback: check existing channels in store
        if (channelUuid && Array.isArray(channels)) {
          const existingChannel = channels.find((c) => c.uuid === channelUuid);
          if (existingChannel) {
            console.log('[Invitations] Found channel in store, navigating:', existingChannel.name);
            dispatch(setCurrentChannel(existingChannel));
            dispatch(setInvitesPanelOpen(false));
            return;
          }
        }

        // If channel not found, still close the panel (invite was accepted)
        console.log('[Invitations] Channel not found in list, closing panel anyway');
        dispatch(setInvitesPanelOpen(false));
      } catch (err) {
        // Error is already handled by Redux slice
        console.error('[Invitations] Accept failed:', err);
      }
    },
    [dispatch, channels]
  );

  // Handle decline invitation with proper error handling
  const handleDecline = useCallback(
    async (inviteUuid: string) => {
      try {
        await dispatch(declineInvite(inviteUuid)).unwrap();
      } catch (err) {
        // Error is already handled by Redux slice
        console.error('[Invitations] Decline failed:', err);
      }
    },
    [dispatch]
  );

  // Handle close panel
  const handleClose = useCallback(() => {
    dispatch(setInvitesPanelOpen(false));
    dispatch(clearInviteError());
  }, [dispatch]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [handleClose]);

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div
        className="modal-content max-w-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invitations-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <svg
                className="w-5 h-5 text-primary-600 dark:text-primary-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h2 id="invitations-title" className="text-xl font-bold text-gray-900 dark:text-white">
                Channel Invitations
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pendingInvites.length > 0
                  ? `${pendingInvites.length} pending invitation${pendingInvites.length > 1 ? 's' : ''}`
                  : 'No pending invitations'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            aria-label="Close invitations panel"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                <button
                  onClick={() => dispatch(clearInviteError())}
                  className="ml-auto p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                  aria-label="Dismiss error"
                >
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && pendingInvites.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-gray-500 dark:text-gray-400">Loading invitations...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && pendingInvites.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Pending Invitations
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-center max-w-xs">
                When someone invites you to join a channel, it will appear here.
              </p>
            </div>
          )}

          {/* Invitations List */}
          {pendingInvites.length > 0 && (
            <div className="space-y-4">
              {pendingInvites.map((invite) => {
                const isProcessing = processingInviteUuid === invite.uuid;
                return (
                  <InvitationCard
                    key={invite.uuid}
                    invite={invite}
                    isProcessing={isProcessing}
                    isAccepting={isAccepting}
                    isDeclining={isDeclining}
                    onAccept={() => handleAccept(invite.uuid, invite.channel_uuid)}
                    onDecline={() => handleDecline(invite.uuid)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={handleClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvitationsPanel;
