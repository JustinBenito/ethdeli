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
    console.log('Window ready to show - starting animation sequence');
    
    // Position window off-screen initially
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.workAreaSize;
    const notchWidth = 320;
    const x = Math.round((screenWidth - notchWidth) / 2);
    mainWindow.setPosition(x, -140);
    
    mainWindow.show();
    mainWindow.focus();
    // Trigger window slide down on initial load with a small delay
    // to ensure the window is fully painted before animation starts
    setTimeout(() => {
      slideWindowDown();
    }, 100);
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

function slideWindowDown() {
  if (!mainWindow) return;

  console.log('Sliding window down...');

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;
  const notchWidth = 320;
  const x = Math.round((screenWidth - notchWidth) / 2);

  // Start position (above screen)
  const startY = -140;
  const endY = 0;
  const duration = 200; // Faster animation
  const steps = 20; // Fewer steps for smoother performance
  const stepDelay = duration / steps;

  let currentStep = 0;

  const animate = () => {
    if (currentStep > steps) {
      console.log('Animation complete - window at final position');
      return;
    }

    const progress = currentStep / steps;
    // Smooth ease-out cubic function
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    const currentY = startY + (endY - startY) * easedProgress;

    // Ensure x is valid before setting position
    if (typeof x === 'number' && !isNaN(x) && isFinite(x)) {
      try {
        mainWindow.setPosition(x, Math.round(currentY));
        console.log(`Step ${currentStep}/${steps}: Y=${Math.round(currentY)}`);
      } catch (error) {
        console.error('Error setting position:', error);
        return;
      }
    } else {
      console.error('Invalid x position:', x);
      return;
    }
    
    currentStep++;
    setTimeout(animate, stepDelay);
  };

  // Set initial off-screen position
  if (typeof x === 'number' && !isNaN(x)) {
    mainWindow.setPosition(x, startY);
    console.log(`Starting animation from Y=${startY} to Y=${endY}`);
    
    // Trigger fade-in animation after a short delay
    setTimeout(() => {
      mainWindow.webContents.send('fade-in');
    }, 200);
    
    animate();
  } else {
    console.error('Invalid x position for initial setup:', x);
  }
}

function slideWindowUp() {
  if (!mainWindow) return;

  console.log('Sliding window up...');

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;
  const notchWidth = 320;
  const x = Math.round((screenWidth - notchWidth) / 2);

  const startY = 0;
  const endY = -140;
  const duration = 150; // Faster animation
  const steps = 15; // Fewer steps for smoother performance
  const stepDelay = duration / steps;

  let currentStep = 0;

  const animate = () => {
    if (currentStep > steps) {
      console.log('Animation complete - hiding window');
      mainWindow.hide();
      isVisible = false;
      return;
    }

    const progress = currentStep / steps;
    // Smooth ease-out cubic function
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const currentY = startY + (endY - startY) * easedProgress;

    // Ensure x is valid before setting position
    if (typeof x === 'number' && !isNaN(x) && isFinite(x)) {
      try {
        mainWindow.setPosition(x, Math.round(currentY));
        console.log(`Step ${currentStep}/${steps}: Y=${Math.round(currentY)}`);
      } catch (error) {
        console.error('Error setting position:', error);
        return;
      }
    } else {
      console.error('Invalid x position:', x);
      return;
    }
    
    currentStep++;
    setTimeout(animate, stepDelay);
  };

  // Trigger fade-out animation at the start of slide up
  mainWindow.webContents.send('fade-out');

  console.log(`Starting slide up animation from Y=${startY} to Y=${endY}`);
  animate();
}

function toggleVisibility() {
  if (mainWindow) {
    if (isVisible) {
      slideWindowUp();
    } else {
      mainWindow.show();
      mainWindow.focus();
      setTimeout(() => {
        slideWindowDown();
      }, 100);
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