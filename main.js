const { app, BrowserWindow, screen, globalShortcut, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let isVisible = true;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Calculate notch dimensions - start very small and expand
  const startWidth = 200;
  const endWidth = 320;
  const startHeight = 0;
  const endHeight = 140;
  const x = Math.round((screenWidth - startWidth) / 2);
  const y = 0; // Position at very top of screen

  mainWindow = new BrowserWindow({
    width: startWidth,
    height: startHeight,
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

function slideWindowDown(walletMode = false) {
  if (!mainWindow) return;

  console.log('Sliding window down with width and height animation...');

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;
  const startWidth = 200;
  const endWidth = walletMode ? 450 : 320;
  const startHeight = 1; // Never start with 0 height
  const endHeight = walletMode ? 250 : 140;

  // Start position (above screen)
  const startY = -140;
  const endY = 0;
  const duration = 400; // 400ms for both width and height animation
  const steps = 30; // More steps for smoother animation
  const stepDelay = duration / steps;

  let currentStep = 0;

  const animate = () => {
    if (currentStep > steps) {
      console.log('Animation complete - window at final position and size');
      return;
    }

    const progress = currentStep / steps;
    // Smooth ease-out cubic function
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    // Calculate current position and size
    const currentY = startY + (endY - startY) * easedProgress;
    const currentWidth = startWidth + (endWidth - startWidth) * easedProgress;
    const currentHeight = startHeight + (endHeight - startHeight) * easedProgress;
    const currentX = Math.round((screenWidth - currentWidth) / 2);

    // Ensure values are valid before setting
    const roundedX = Math.round(currentX);
    const roundedY = Math.round(currentY);
    const roundedWidth = Math.round(currentWidth);
    const roundedHeight = Math.round(currentHeight);

    if (typeof roundedX === 'number' && !isNaN(roundedX) && isFinite(roundedX) &&
        typeof roundedWidth === 'number' && !isNaN(roundedWidth) && isFinite(roundedWidth) &&
        typeof roundedHeight === 'number' && !isNaN(roundedHeight) && isFinite(roundedHeight) &&
        roundedWidth >= 100 && roundedHeight >= 1) {
      try {
        mainWindow.setBounds({
          x: roundedX,
          y: roundedY,
          width: roundedWidth,
          height: roundedHeight
        });
        console.log(`Step ${currentStep}/${steps}: Y=${roundedY}, Width=${roundedWidth}, Height=${roundedHeight}`);
      } catch (error) {
        console.error('Error setting bounds:', error);
        return;
      }
    } else {
      console.error('Invalid position or size values:', { roundedX, roundedY, roundedWidth, roundedHeight });
      return;
    }
    
    currentStep++;
    setTimeout(animate, stepDelay);
  };

  // Set initial off-screen position with start dimensions
  const initialX = Math.round((screenWidth - startWidth) / 2);
  if (typeof initialX === 'number' && !isNaN(initialX)) {
    mainWindow.setBounds({
      x: initialX,
      y: startY,
      width: startWidth,
      height: startHeight
    });
    console.log(`Starting animation from Y=${startY} to Y=${endY}, Width=${startWidth} to ${endWidth}, Height=${startHeight} to ${endHeight}`);
    
    // Trigger fade-in animation after a short delay
    setTimeout(() => {
      mainWindow.webContents.send('fade-in');
    }, 200);
    
    animate();
  } else {
    console.error('Invalid initial x position:', initialX);
  }
}

function slideWindowUp(walletMode = false) {
  if (!mainWindow) return;

  console.log('Sliding window up with width and height animation...');

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;
  const startWidth = walletMode ? 450 : 320;
  const endWidth = 200;
  const startHeight = walletMode ? 250 : 140;
  const endHeight = 1; // Never end with 0 height

  const startY = 0;
  const endY = -140;
  const duration = 300; // Slightly longer for smooth animation
  const steps = 20; // More steps for smoother animation
  const stepDelay = duration / steps;

  let currentStep = 0;

  const animate = () => {
    if (currentStep > steps) {
      console.log('Animation complete - hiding window');
      // Set window to completely hidden position and size
      mainWindow.setBounds({ x: 0, y: -1000, width: 1, height: 1 });
      mainWindow.hide();
      isVisible = false;
      return;
    }

    const progress = currentStep / steps;
    // Smooth ease-out cubic function
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    
    // Calculate current position and size
    const currentY = startY + (endY - startY) * easedProgress;
    const currentWidth = startWidth + (endWidth - startWidth) * easedProgress;
    const currentHeight = startHeight + (endHeight - startHeight) * easedProgress;
    const currentX = Math.round((screenWidth - currentWidth) / 2);

    // Ensure values are valid before setting
    const roundedX = Math.round(currentX);
    const roundedY = Math.round(currentY);
    const roundedWidth = Math.round(currentWidth);
    const roundedHeight = Math.round(currentHeight);

    if (typeof roundedX === 'number' && !isNaN(roundedX) && isFinite(roundedX) &&
        typeof roundedWidth === 'number' && !isNaN(roundedWidth) && isFinite(roundedWidth) &&
        typeof roundedHeight === 'number' && !isNaN(roundedHeight) && isFinite(roundedHeight) &&
        roundedWidth >= 100 && roundedHeight >= 1) {
      try {
        mainWindow.setBounds({
          x: roundedX,
          y: roundedY,
          width: roundedWidth,
          height: roundedHeight
        });
        console.log(`Step ${currentStep}/${steps}: Y=${roundedY}, Width=${roundedWidth}, Height=${roundedHeight}`);
      } catch (error) {
        console.error('Error setting bounds:', error);
        return;
      }
    } else {
      console.error('Invalid position or size values:', { roundedX, roundedY, roundedWidth, roundedHeight });
      return;
    }
    
    currentStep++;
    setTimeout(animate, stepDelay);
  };

  // Trigger fade-out animation at the start of slide up
  mainWindow.webContents.send('fade-out');

  console.log(`Starting slide up animation from Y=${startY} to Y=${endY}, Width=${startWidth} to ${endWidth}, Height=${startHeight} to ${endHeight}`);
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
      const notchWidth = 320; // Use the final width
      const x = Math.round((screenWidth - notchWidth) / 2);
      mainWindow.setPosition(x, 0);
    }
  });
}

// Wallet mode state
let isWalletMode = false;

function toggleWalletMode(enable) {
  if (!mainWindow) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  if (enable && !isWalletMode) {
    // Expand to wallet mode
    console.log('Expanding to wallet mode...');
    isWalletMode = true;

    const targetWidth = 450;
    const targetHeight = 250;
    const targetX = Math.round((screenWidth - targetWidth) / 2);

    // Animate to wallet size
    animateWindowResize(targetX, 0, targetWidth, targetHeight, 300);

  } else if (!enable && isWalletMode) {
    // Collapse to normal mode
    console.log('Collapsing to normal mode...');
    isWalletMode = false;

    const targetWidth = 320;
    const targetHeight = 140;
    const targetX = Math.round((screenWidth - targetWidth) / 2);

    // Animate to normal size
    animateWindowResize(targetX, 0, targetWidth, targetHeight, 300);
  }
}

function animateWindowResize(targetX, targetY, targetWidth, targetHeight, duration) {
  if (!mainWindow) return;

  const currentBounds = mainWindow.getBounds();
  const startX = currentBounds.x;
  const startY = currentBounds.y;
  const startWidth = currentBounds.width;
  const startHeight = currentBounds.height;

  const steps = 20;
  const stepDelay = duration / steps;
  let currentStep = 0;

  const animate = () => {
    if (currentStep > steps) return;

    const progress = currentStep / steps;
    const easedProgress = 1 - Math.pow(1 - progress, 3); // ease-out

    const currentX = startX + (targetX - startX) * easedProgress;
    const currentY = startY + (targetY - startY) * easedProgress;
    const currentWidth = startWidth + (targetWidth - startWidth) * easedProgress;
    const currentHeight = startHeight + (targetHeight - startHeight) * easedProgress;

    mainWindow.setBounds({
      x: Math.round(currentX),
      y: Math.round(currentY),
      width: Math.round(currentWidth),
      height: Math.round(currentHeight)
    });

    currentStep++;
    setTimeout(animate, stepDelay);
  };

  animate();
}

// IPC handlers for renderer process
ipcMain.on('toggle-window', () => {
  toggleVisibility();
});

ipcMain.on('wallet-mode', (event, enable) => {
  toggleWalletMode(enable);
});

ipcMain.on('quit-app', () => {
  app.quit();
});