/**
 * Socket.io Service for Real-time Communication
 */

const { io } = require('socket.io-client');
const EventEmitter = require('events');
const config = require('../config');

const SOCKET_URL = config.socketUrl;

// Check if socket server is available
const SOCKET_ENABLED = process.env.SOCKET_ENABLED !== 'false';

class SocketService extends EventEmitter {
  constructor(store) {
    super();
    this.store = store;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3; // Reduced attempts since socket may not be available
    this.joinedChannels = new Set();
    this.connectionFailed = false;
  }

  connect(token, userId) {
    // Skip connection if socket is disabled or already failed
    if (!SOCKET_ENABLED) {
      console.log('Socket connection disabled via SOCKET_ENABLED=false');
      return;
    }

    if (this.connectionFailed) {
      console.log('Socket connection previously failed, skipping reconnection');
      return;
    }

    if (this.socket?.connected) {
      return;
    }

    console.log('Attempting socket connection to:', SOCKET_URL);

    this.socket = io(SOCKET_URL, {
      auth: {
        token,
        userId,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
      // Don't block app if socket unavailable
      forceNew: true,
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.reconnectAttempts = 0;
      this.emit('connected');

      // Rejoin channels after reconnection
      this.joinedChannels.forEach((channelUuid) => {
        this.socket.emit('channel:join', { channelUuid });
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.emit('disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;

      // Only log first few errors to avoid spamming console
      if (this.reconnectAttempts <= 3) {
        console.warn(`Socket connection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} failed:`, error.message);
      }

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn('Socket server unavailable. Real-time features disabled. App will continue to work with REST API.');
        this.connectionFailed = true;
        this.socket.disconnect();
        this.emit('connection_failed', error);
      }
    });

    // Message events
    this.socket.on('message:new', (message) => {
      this.emit('message:new', message);
    });

    this.socket.on('message:updated', (message) => {
      this.emit('message:updated', message);
    });

    this.socket.on('message:deleted', (data) => {
      this.emit('message:deleted', data);
    });

    // Typing events
    this.socket.on('typing:start', (data) => {
      this.emit('typing:start', data);
    });

    this.socket.on('typing:stop', (data) => {
      this.emit('typing:stop', data);
    });

    // Reaction events
    this.socket.on('reaction:added', (data) => {
      this.emit('reaction:added', data);
    });

    this.socket.on('reaction:removed', (data) => {
      this.emit('reaction:removed', data);
    });

    // Presence events
    this.socket.on('presence:updated', (data) => {
      this.emit('presence:updated', data);
    });

    this.socket.on('user:online', (data) => {
      this.emit('presence:updated', { ...data, status: 'online' });
    });

    this.socket.on('user:offline', (data) => {
      this.emit('presence:updated', { ...data, status: 'offline' });
    });

    // Channel events
    this.socket.on('channel:updated', (data) => {
      this.emit('channel:updated', data);
    });

    this.socket.on('channel:member_joined', (data) => {
      this.emit('member:joined', data);
    });

    this.socket.on('channel:member_left', (data) => {
      this.emit('member:left', data);
    });

    // Invitation events
    this.socket.on('invite:received', (data) => {
      this.emit('invite:received', data);
    });

    this.socket.on('invite:accepted', (data) => {
      this.emit('invite:accepted', data);
    });

    this.socket.on('invite:declined', (data) => {
      this.emit('invite:declined', data);
    });

    this.socket.on('invite:expired', (data) => {
      this.emit('invite:expired', data);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.emit('error', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.joinedChannels.clear();
    }
  }

  joinChannel(channelUuid) {
    if (this.socket?.connected && channelUuid) {
      this.socket.emit('channel:join', { channelUuid });
      this.joinedChannels.add(channelUuid);
    }
  }

  leaveChannel(channelUuid) {
    if (this.socket?.connected && channelUuid) {
      this.socket.emit('channel:leave', { channelUuid });
      this.joinedChannels.delete(channelUuid);
    }
  }

  emit(event, data) {
    if (event === 'typing') {
      // Handle typing indicator
      if (this.socket?.connected) {
        this.socket.emit(data.isTyping ? 'typing:start' : 'typing:stop', {
          channelUuid: data.channelUuid,
        });
      }
      return;
    }

    if (event === 'presence:update') {
      if (this.socket?.connected) {
        this.socket.emit('presence:update', data);
      }
      return;
    }

    // For all other events, use EventEmitter's emit
    super.emit(event, data);
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

module.exports = SocketService;
