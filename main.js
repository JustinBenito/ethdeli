const { app, BrowserWindow, screen, globalShortcut, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let isVisible = true;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Calculate notch dimensions - wider and taller than standard
  const notchWidth = 320;
  const notchHeight = 140;
  const x = Math.round((screenWidth - notchWidth) / 2);
  const y = 0; // Position at very top of screen

  mainWindow = new BrowserWindow({
    width: notchWidth,
    height: notchHeight,
    x: x,
    backgroundColor: "#000",
    y: y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: -1000, y: -1000 }, // Move traffic lights off-screen
    vibrancy: 'under-window', // Changed to under-window for better transparency
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      backgroundThrottling: false
    },
    show: false
  });

  // Load the HTML file
  mainWindow.loadFile('renderer.html');

  // Set window level to stay above menu bar
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // Show window once ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent window from being closed accidentally
  mainWindow.on('close', (event) => {
    event.preventDefault();
    toggleVisibility();
  });
}

function toggleVisibility() {
  if (mainWindow) {
    if (isVisible) {
      mainWindow.hide();
      isVisible = false;
    } else {
      mainWindow.show();
      mainWindow.focus();
      isVisible = true;
    }
  }
}

// Register global shortcut Option + L
function registerShortcuts() {
  const ret = globalShortcut.register('Alt+L', () => {
    toggleVisibility();
  });

  if (!ret) {
    console.log('Registration failed for Alt+L');
  }
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  registerShortcuts();
  setupDisplayChangeHandling();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

// Handle display changes (for Retina support) - moved to app ready
function setupDisplayChangeHandling() {
  screen.on('display-metrics-changed', () => {
    if (mainWindow) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth } = primaryDisplay.workAreaSize;
      const notchWidth = 280;
      const x = Math.round((screenWidth - notchWidth) / 2);
      mainWindow.setPosition(x, 0);
    }
  });
}

// IPC handlers for renderer process
ipcMain.on('toggle-window', () => {
  toggleVisibility();
});

ipcMain.on('quit-app', () => {
  app.quit();
});