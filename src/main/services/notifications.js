/**
 * Notification Service for Desktop Notifications
 */

const { Notification, nativeImage } = require('electron');
const path = require('path');

class NotificationService {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.enabled = true;
    this.mutedChannels = new Set();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  muteChannel(channelUuid) {
    this.mutedChannels.add(channelUuid);
  }

  unmuteChannel(channelUuid) {
    this.mutedChannels.delete(channelUuid);
  }

  showMessageNotification(message) {
    // Don't show if notifications disabled
    if (!this.enabled) {
      return;
    }

    // Don't show if channel is muted
    if (this.mutedChannels.has(message.channel_uuid)) {
      return;
    }

    // Don't show if window is focused
    if (this.mainWindow?.isFocused()) {
      return;
    }

    // Don't show system messages
    if (message.is_system) {
      return;
    }

    const notification = new Notification({
      title: message.user?.name || 'New Message',
      body: this.truncateText(message.content, 100),
      silent: false,
      urgency: 'normal',
      timeoutType: 'default',
    });

    notification.on('click', () => {
      // Focus the window and navigate to the message
      if (this.mainWindow) {
        this.mainWindow.show();
        this.mainWindow.focus();
        this.mainWindow.webContents.send('notification:clicked', {
          channelUuid: message.channel_uuid,
          messageUuid: message.uuid,
        });
      }
    });

    notification.show();
  }

  showMentionNotification(mention) {
    if (!this.enabled) {
      return;
    }

    const notification = new Notification({
      title: `${mention.user?.name || 'Someone'} mentioned you`,
      body: this.truncateText(mention.message?.content, 100),
      silent: false,
      urgency: 'critical',
      timeoutType: 'default',
    });

    notification.on('click', () => {
      if (this.mainWindow) {
        this.mainWindow.show();
        this.mainWindow.focus();
        this.mainWindow.webContents.send('notification:clicked', {
          channelUuid: mention.channel_uuid,
          messageUuid: mention.message_uuid,
        });
      }
    });

    notification.show();
  }

  showChannelInviteNotification(invite) {
    if (!this.enabled) {
      return;
    }

    // Don't show if window is focused
    if (this.mainWindow?.isFocused()) {
      return;
    }

    // Build inviter name from available fields
    const inviterName = invite.inviter_first_name && invite.inviter_last_name
      ? `${invite.inviter_first_name} ${invite.inviter_last_name}`
      : invite.inviter?.name || 'Someone';

    // Build channel name from available fields
    const channelName = invite.channel_name || invite.channel?.name || 'a channel';

    const notification = new Notification({
      title: 'Channel Invitation',
      body: `${inviterName} invited you to join #${channelName}`,
      silent: false,
      urgency: 'normal',
      timeoutType: 'default',
    });

    notification.on('click', () => {
      if (this.mainWindow) {
        this.mainWindow.show();
        this.mainWindow.focus();
        this.mainWindow.webContents.send('notification:clicked', {
          type: 'invite',
          inviteUuid: invite.uuid,
        });
      }
    });

    notification.show();
  }

  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}

module.exports = NotificationService;
