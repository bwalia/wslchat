import React, { useState, useEffect } from 'react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { updateChannel } from '../../store/slices/channelSlice';
import type { Channel } from '../../types';
import clsx from 'clsx';

interface EditChannelModalProps {
  channel: Channel;
  isOpen: boolean;
  onClose: () => void;
}

const EditChannelModal: React.FC<EditChannelModalProps> = ({
  channel,
  isOpen,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && channel) {
      setName(channel.name || '');
      setDescription(channel.description || '');
      setIsPrivate(channel.type === 'private');
      setError(null);
    }
  }, [isOpen, channel]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Channel name is required');
      return;
    }

    if (name.length < 2) {
      setError('Channel name must be at least 2 characters');
      return;
    }

    if (name.length > 80) {
      setError('Channel name must be less than 80 characters');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await dispatch(updateChannel({
        channelUuid: channel.uuid,
        updates: {
          name: name.trim(),
          description: description.trim() || undefined,
          type: isPrivate ? 'private' : 'public',
        },
      })).unwrap();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update channel');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Format channel name (remove special characters, lowercase)
  const formatChannelName = (value: string) => {
    return value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
      .replace(/-+/g, '-');
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-content max-w-md">
        {/* Header */}
        <div className="modal-header">
          <h2 className="text-xl font-semibold text-secondary-900 dark:text-white">
            Edit Channel
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
                <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
              </div>
            )}

            {/* Channel Name */}
            <div>
              <label htmlFor="channel-name" className="input-label">
                Channel Name
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400 font-bold">
                  #
                </span>
                <input
                  id="channel-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(formatChannelName(e.target.value))}
                  placeholder="e.g. marketing"
                  className="input-field pl-8"
                  maxLength={80}
                />
              </div>
              <p className="input-helper">
                Names must be lowercase, without spaces or special characters.
              </p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="channel-description" className="input-label">
                Description <span className="text-secondary-400">(optional)</span>
              </label>
              <textarea
                id="channel-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this channel about?"
                className="input-field min-h-[80px] resize-none"
                maxLength={250}
              />
              <p className="input-helper">
                {description.length}/250 characters
              </p>
            </div>

            {/* Privacy Toggle */}
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-secondary-900 dark:text-white">
                    Make Private
                  </h3>
                  <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-0.5">
                    Only invited members can see and join this channel
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrivate(!isPrivate)}
                  className={clsx(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    isPrivate ? 'bg-primary-500' : 'bg-secondary-300 dark:bg-secondary-600'
                  )}
                >
                  <span
                    className={clsx(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      isPrivate ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-md"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-md"
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditChannelModal;
