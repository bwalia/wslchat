/**
 * Convo - Main Process Entry Point
 * Professional Slack-like desktop chat application
 */

// Load configuration first (loads dotenv)
const config = require('./config');

const { app, BrowserWindow, ipcMain, shell, nativeTheme, Tray, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Import handlers
const authHandlers = require('./handlers/auth');
const channelHandlers = require('./handlers/channels');
const messageHandlers = require('./handlers/messages');
const userHandlers = require('./handlers/users');
const presenceHandlers = require('./handlers/presence');

// Import services
const SocketService = require('./services/socket');
const NotificationService = require('./services/notifications');

// Initialize store for persisting user data
const store = new Store({
  name: 'convo-config',
  defaults: {
    windowBounds: { width: 1200, height: 800 },
    theme: 'system',
    notifications: true,
    startMinimized: false,
    minimizeToTray: true,
  },
});

// Application state
let mainWindow = null;
let tray = null;
let socketService = null;
let notificationService = null;
let isQuitting = false;

/**
 * Create the main application window
 */
const createWindow = () => {
  const { width, height, x, y } = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 800,
    minHeight: 600,
    title: 'Convo',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1d21' : '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false, // Show after ready-to-show event
  });

  // Load the app
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/build/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (!store.get('startMinimized')) {
      mainWindow.show();
    }
  });

  // Save window bounds on resize/move
  mainWindow.on('resize', saveWindowBounds);
  mainWindow.on('move', saveWindowBounds);

  // Handle window close
  mainWindow.on('close', (event) => {
    if (!isQuitting && store.get('minimizeToTray')) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }
    saveWindowBounds();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
};

/**
 * Save window position and size
 */
const saveWindowBounds = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    store.set('windowBounds', mainWindow.getBounds());
  }
};

/**
 * Create system tray
 */
const createTray = () => {
  // Create tray icon (you would need actual icon files)
  const iconPath = path.join(__dirname, '../../build/tray-icon.png');

  try {
    tray = new Tray(iconPath);
  } catch {
    // If no icon, skip tray creation in dev
    console.log('Tray icon not found, skipping tray creation');
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Convo',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Convo');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
};

/**
 * Initialize IPC handlers
 */
const initializeIPC = () => {
  // Auth handlers
  authHandlers.register(ipcMain, store);

  // Channel handlers
  channelHandlers.register(ipcMain, store, () => socketService);

  // Message handlers
  messageHandlers.register(ipcMain, store, () => socketService);

  // User handlers
  userHandlers.register(ipcMain, store);

  // Presence handlers
  presenceHandlers.register(ipcMain, store, () => socketService);

  // App handlers
  ipcMain.handle('app:get-theme', () => store.get('theme'));
  ipcMain.handle('app:set-theme', (_, theme) => {
    store.set('theme', theme);
    if (theme === 'dark') {
      nativeTheme.themeSource = 'dark';
    } else if (theme === 'light') {
      nativeTheme.themeSource = 'light';
    } else {
      nativeTheme.themeSource = 'system';
    }
    return theme;
  });

  ipcMain.handle('app:get-settings', () => ({
    notifications: store.get('notifications'),
    startMinimized: store.get('startMinimized'),
    minimizeToTray: store.get('minimizeToTray'),
    theme: store.get('theme'),
  }));

  ipcMain.handle('app:set-settings', (_, settings) => {
    Object.entries(settings).forEach(([key, value]) => {
      store.set(key, value);
    });
    return settings;
  });

  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow?.close());
};

/**
 * Initialize services
 */
const initializeServices = () => {
  // Initialize socket service
  socketService = new SocketService(store);

  // Initialize notification service
  notificationService = new NotificationService(mainWindow);

  // Connect socket events to renderer
  socketService.on('connected', () => {
    mainWindow?.webContents.send('socket:connected');
  });

  socketService.on('disconnected', () => {
    mainWindow?.webContents.send('socket:disconnected');
  });

  socketService.on('message:new', (message) => {
    mainWindow?.webContents.send('message:new', message);
    notificationService.showMessageNotification(message);
  });

  socketService.on('message:updated', (message) => {
    mainWindow?.webContents.send('message:updated', message);
  });

  socketService.on('message:deleted', (data) => {
    mainWindow?.webContents.send('message:deleted', data);
  });

  socketService.on('typing:start', (data) => {
    mainWindow?.webContents.send('typing:start', data);
  });

  socketService.on('typing:stop', (data) => {
    mainWindow?.webContents.send('typing:stop', data);
  });

  socketService.on('reaction:added', (data) => {
    mainWindow?.webContents.send('reaction:added', data);
  });

  socketService.on('reaction:removed', (data) => {
    mainWindow?.webContents.send('reaction:removed', data);
  });

  socketService.on('presence:updated', (data) => {
    mainWindow?.webContents.send('presence:updated', data);
  });

  socketService.on('channel:updated', (data) => {
    mainWindow?.webContents.send('channel:updated', data);
  });

  socketService.on('member:joined', (data) => {
    mainWindow?.webContents.send('member:joined', data);
  });

  socketService.on('member:left', (data) => {
    mainWindow?.webContents.send('member:left', data);
  });
};

/**
 * App lifecycle events
 */
app.whenReady().then(() => {
  console.log('Convo starting...');

  // Initialize IPC before creating window
  initializeIPC();

  // Create main window
  createWindow();

  // Create tray
  createTray();

  // Initialize services
  initializeServices();

  // macOS: Re-create window when clicking dock icon
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });

  console.log('Convo started successfully');
});

app.on('before-quit', () => {
  isQuitting = true;
  if (socketService) {
    socketService.disconnect();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle certificate errors in development
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (!app.isPackaged) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
