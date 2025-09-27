const { ipcRenderer } = require('electron');
const WalletManager = require('./wallet-manager');

class NotchOverlay {
    constructor() {
        this.timerDuration = 30; // 30 seconds
        this.currentTime = this.timerDuration;
        this.timerInterval = null;
        this.isTimerRunning = false;
        this.selectedChip = null;
        this.contextMessages = [
            'Dynamic Island Active',
            'Processing Request',
            'Task Completed',
            'Timer Running',
            'System Ready',
            'Monitoring Activity'
        ];

        // Wallet functionality
        this.walletManager = new WalletManager();
        this.isWalletMode = false;
        this.isWalletConnected = false;
        this.walletAddress = null;
        this.creditedBalance = 0;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeTimer();
        this.startContextRotation();
        // Fade-in animation will be triggered by main process
    }

    setupEventListeners() {
        // Chip interactions
        document.querySelectorAll('.chip').forEach((chip, index) => {
            chip.addEventListener('click', () => this.handleChipClick(chip, index + 1));
            chip.addEventListener('mouseenter', () => this.handleChipHover(chip));
            chip.addEventListener('mouseleave', () => this.handleChipLeave(chip));
        });

        // Arrow button interactions
        const upArrow = document.getElementById('up-arrow');
        const downArrow = document.getElementById('down-arrow');

        upArrow.addEventListener('click', () => this.handleUpArrow());
        downArrow.addEventListener('click', () => this.handleDownArrow());

        // Timer interactions
        const timerContainer = document.getElementById('timer-container');
        timerContainer.addEventListener('click', () => this.toggleTimer());

        // Wallet interactions
        const walletIcon = document.getElementById('wallet-icon');
        walletIcon.addEventListener('click', () => this.toggleWalletMode());

        // Removed WalletConnect button event listener since we're using direct private key method

        const connectPrivateKeyBtn = document.getElementById('connect-private-key');
        connectPrivateKeyBtn.addEventListener('click', () => this.connectWithPrivateKey());

        const rechargeBtn = document.getElementById('recharge-btn');
        rechargeBtn.addEventListener('click', () => this.handleRecharge());

        const disconnectBtn = document.getElementById('disconnect-btn');
        disconnectBtn.addEventListener('click', () => this.disconnectWallet());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Window focus/blur events
        window.addEventListener('focus', () => this.handleWindowFocus());
        window.addEventListener('blur', () => this.handleWindowBlur());

        // Listen for fade animation events from main process
        ipcRenderer.on('fade-in', () => {
            console.log('Fade-in animation triggered');
            this.triggerNotchEmergence();
        });
        ipcRenderer.on('fade-out', () => {
            console.log('Fade-out animation triggered');
            this.triggerNotchFadeOut();
        });
    }

    // Wallet Methods
    toggleWalletMode() {
        this.isWalletMode = !this.isWalletMode;
        const notchContent = document.getElementById('notch-content');
        const walletIcon = document.getElementById('wallet-icon');

        if (this.isWalletMode) {
            // Enter wallet mode
            notchContent.classList.add('wallet-mode');
            walletIcon.querySelector('#wallet-status').textContent = 'Close';

            // Trigger window resize
            ipcRenderer.send('wallet-mode', true);

            // Show appropriate wallet UI
            if (this.isWalletConnected) {
                this.showConnectedWalletUI();
            } else {
                this.showWalletConnectUI();
            }
        } else {
            // Exit wallet mode
            notchContent.classList.remove('wallet-mode');
            walletIcon.querySelector('#wallet-status').textContent = this.isWalletConnected ? 'Connected' : 'Connect';

            // Trigger window resize
            ipcRenderer.send('wallet-mode', false);

            // Hide wallet UI
            document.getElementById('wallet-ui').classList.add('hidden');
        }
    }


    showWalletConnectUI() {
        // Hide all wallet sections
        document.getElementById('wallet-connect-section').classList.remove('hidden');
        document.getElementById('connected-wallet-section').classList.add('hidden');

        // Show wallet UI and private key input directly
        document.getElementById('wallet-ui').classList.remove('hidden');
        document.getElementById('private-key-input').classList.remove('hidden');

        // Update connection text
        document.getElementById('connection-text').textContent = 'Enter your private key:';
    }

    async connectWithPrivateKey() {
        const privateKeyField = document.getElementById('private-key-field');
        const privateKey = privateKeyField.value.trim();

        if (!privateKey) {
            this.showError('Please enter a private key');
            return;
        }

        // Show loading state
        this.showTransactionStatus('Connecting wallet...', true);

        try {
            console.log('Attempting to connect wallet with private key...');
            const result = await this.walletManager.connectWithPrivateKey(privateKey);
            console.log('Connection result:', result);

            if (result.success) {
                this.isWalletConnected = true;
                this.walletAddress = result.address;

                // Update wallet icon
                const walletIcon = document.getElementById('wallet-icon');
                walletIcon.classList.add('connected');
                walletIcon.querySelector('#wallet-status').textContent = 'Connected';

                // Clear private key field for security
                privateKeyField.value = '';

                // Load credited balance
                await this.loadCreditedBalance();

                // Show connected wallet UI
                this.showConnectedWalletUI();

                this.updateContextText('Wallet Connected Successfully');

            } else {
                this.showError(result.error || 'Connection failed');
            }

        } catch (error) {
            console.error('Connection error:', error);
            this.showError(error.message || 'Connection failed');
        } finally {
            this.hideTransactionStatus();
        }
    }

    async showConnectedWalletUI() {
        // Hide connection UI, show connected UI
        document.getElementById('wallet-connect-section').classList.add('hidden');
        document.getElementById('connected-wallet-section').classList.remove('hidden');

        // Update wallet info
        if (this.walletAddress) {
            const shortAddress = `${this.walletAddress.slice(0, 6)}...${this.walletAddress.slice(-4)}`;
            document.getElementById('wallet-address').textContent = shortAddress;
        }

        // Update balance display
        this.updateBalanceDisplay();
    }

    async loadCreditedBalance() {
        try {
            console.log('===== LOADING CREDITED BALANCE =====');
            this.creditedBalance = await this.walletManager.getCreditedBalance();
            console.log('Credited balance from Supabase:', this.creditedBalance);

            // Also get the actual wallet balance for comparison
            try {
                const walletBalance = await this.walletManager.getBalance();
                console.log('Actual wallet balance:', walletBalance);
                console.log('Credited vs Wallet balance:', this.creditedBalance, 'vs', walletBalance);
            } catch (balanceError) {
                console.error('Could not get wallet balance for comparison:', balanceError);
            }

            this.updateBalanceDisplay();
            console.log('====================================');
        } catch (error) {
            console.error('Failed to load credited balance:', error);
            this.creditedBalance = 0;
        }
    }

    updateBalanceDisplay() {
        console.log('===== UPDATING BALANCE DISPLAY =====');
        console.log('Current credited balance:', this.creditedBalance);
        console.log('Balance type:', typeof this.creditedBalance);

        const balanceElement = document.getElementById('credited-balance');
        const displayText = `Balance: ${this.creditedBalance.toFixed(4)} POL`;
        balanceElement.textContent = displayText;

        console.log('Display text set to:', displayText);
        console.log('====================================');
    }

    async handleRecharge() {
        const amountInput = document.getElementById('recharge-amount');
        const amount = parseFloat(amountInput.value);

        if (!amount || amount <= 0) {
            this.showError('Please enter a valid amount');
            return;
        }

        // Check for very small amounts that might cause scientific notation
        if (amount < 0.001) {
            this.showError('Minimum amount is 0.001 POL');
            return;
        }

        // Check for amounts that might cause precision issues
        if (amount > 1000) {
            this.showError('Maximum amount is 1000 POL');
            return;
        }

        if (!this.isWalletConnected) {
            this.showError('Please connect your wallet first');
            return;
        }

        // Show transaction status
        this.showTransactionStatus('Initiating transaction...', true);

        try {
            // Complete recharge flow
            const result = await this.walletManager.completeRecharge(amount);

            if (result.success) {
                // Update credited balance
                this.creditedBalance += result.amount;
                this.updateBalanceDisplay();

                // Clear amount input
                amountInput.value = '';

                // Show success message
                this.showTransactionStatus(`Transaction successful! ${result.amount} POL credited.`, false);
                this.updateContextText(`Recharged ${result.amount} POL`);

                // Hide status after delay
                setTimeout(() => this.hideTransactionStatus(), 3000);

            } else {
                this.showError('Transaction failed');
            }

        } catch (error) {
            console.error('Recharge error:', error);

            // Handle specific error messages
            if (error.message.includes('insufficient funds')) {
                this.showError('Insufficient funds for gas fees. Please add more POL to your wallet.');
            } else if (error.message.includes('network')) {
                this.showError('Network congested. Please try again later.');
            } else {
                this.showError(error.message || 'Transaction failed');
            }
        } finally {
            // Hide loading spinner after delay if still showing
            setTimeout(() => {
                const statusElement = document.getElementById('transaction-status');
                if (!statusElement.classList.contains('hidden')) {
                    const spinner = document.getElementById('status-spinner');
                    if (spinner) {
                        spinner.style.display = 'none';
                    }
                }
            }, 1000);
        }
    }

    disconnectWallet() {
        // Reset wallet state
        this.isWalletConnected = false;
        this.walletAddress = null;
        this.creditedBalance = 0;

        // Reset wallet manager
        this.walletManager.disconnect();

        // Update UI
        const walletIcon = document.getElementById('wallet-icon');
        walletIcon.classList.remove('connected');
        walletIcon.querySelector('#wallet-status').textContent = 'Connect';

        // Clear inputs
        document.getElementById('private-key-field').value = '';
        document.getElementById('recharge-amount').value = '';

        // Show connection UI
        this.showWalletConnectUI();

        this.updateContextText('Wallet Disconnected');
    }

    showTransactionStatus(message, showSpinner = false) {
        const statusElement = document.getElementById('transaction-status');
        const statusText = document.getElementById('status-text');
        const spinner = document.getElementById('status-spinner');

        statusText.textContent = message;
        spinner.style.display = showSpinner ? 'block' : 'none';
        statusElement.classList.remove('hidden');
    }

    hideTransactionStatus() {
        const statusElement = document.getElementById('transaction-status');
        statusElement.classList.add('hidden');
    }

    showError(message) {
        this.showTransactionStatus(`Error: ${message}`, false);
        this.updateContextText('Error occurred');

        // Auto-hide error after 5 seconds
        setTimeout(() => this.hideTransactionStatus(), 5000);
    }

    handleChipClick(chip, number) {
        // Remove previous selection
        if (this.selectedChip) {
            this.selectedChip.classList.remove('selected');
        }

        // Add selection and animation
        chip.classList.add('selected', 'expanding');
        this.selectedChip = chip;

        // Update context text
        this.updateContextText(`Chip ${number} Selected`);

        // Remove expanding animation after completion
        setTimeout(() => {
            chip.classList.remove('expanding');
        }, 300);

        // Add tactile feedback
        this.addTactileFeedback(chip);
    }

    handleChipHover(chip) {
        if (!chip.classList.contains('selected')) {
            chip.style.transform = 'scale(1.05)';
        }
    }

    handleChipLeave(chip) {
        if (!chip.classList.contains('selected')) {
            chip.style.transform = '';
        }
    }

    handleUpArrow() {
        this.updateContextText('Moving Up');
        this.addButtonAnimation('up-arrow');

        // Simulate action with visual feedback
        setTimeout(() => {
            this.updateContextText('Position Updated');
        }, 1000);
    }

    handleDownArrow() {
        this.updateContextText('Moving Down');
        this.addButtonAnimation('down-arrow');

        // Simulate action with visual feedback
        setTimeout(() => {
            this.updateContextText('Position Updated');
        }, 1000);
    }

    addButtonAnimation(buttonId) {
        const button = document.getElementById(buttonId);
        button.style.transform = 'scale(0.9)';

        setTimeout(() => {
            button.style.transform = '';
        }, 150);
    }

    toggleTimer() {
        if (this.isTimerRunning) {
            this.stopTimer();
        } else {
            this.startTimer();
        }
    }

    startTimer() {
        if (this.isTimerRunning) return;

        this.isTimerRunning = true;
        this.updateContextText('Timer Started');

        this.timerInterval = setInterval(() => {
            this.currentTime--;
            this.updateTimerDisplay();
            this.updateTimerProgress();

            if (this.currentTime <= 0) {
                this.completeTimer();
            }
        }, 1000);
    }

    stopTimer() {
        if (!this.isTimerRunning) return;

        this.isTimerRunning = false;
        clearInterval(this.timerInterval);
        this.updateContextText('Timer Stopped');
    }

    resetTimer() {
        this.stopTimer();
        this.currentTime = this.timerDuration;
        this.updateTimerDisplay();
        this.updateTimerProgress();
        this.updateContextText('Timer Reset');
    }

    completeTimer() {
        this.isTimerRunning = false;
        clearInterval(this.timerInterval);

        // Add completion animation
        const timerContainer = document.getElementById('timer-container');
        timerContainer.classList.add('timer-complete');

        this.updateContextText('Timer Complete!');

        // Reset after animation
        setTimeout(() => {
            timerContainer.classList.remove('timer-complete');
            this.resetTimer();
        }, 500);
    }

    updateTimerDisplay() {
        const timerText = document.getElementById('timer-text');
        timerText.textContent = this.currentTime;
    }

    updateTimerProgress() {
        const progressCircle = document.getElementById('timer-progress');
        const circumference = 87.96; // 2 * π * 14 (radius)
        const progress = (this.timerDuration - this.currentTime) / this.timerDuration;
        const offset = circumference * (1 - progress);

        progressCircle.style.strokeDashoffset = offset;
    }

    initializeTimer() {
        this.updateTimerDisplay();
        this.updateTimerProgress();
    }

    updateContextText(text) {
        const contextText = document.getElementById('context-text');
        contextText.classList.add('updated');
        contextText.textContent = text;

        setTimeout(() => {
            contextText.classList.remove('updated');
        }, 600);
    }

    startContextRotation() {
        let messageIndex = 0;

        setInterval(() => {
            if (!this.isTimerRunning && !this.selectedChip) {
                messageIndex = (messageIndex + 1) % this.contextMessages.length;
                this.updateContextText(this.contextMessages[messageIndex]);
            }
        }, 5000);
    }

    addTactileFeedback(element) {
        // Add visual pulse effect
        element.classList.add('pulse');
        setTimeout(() => {
            element.classList.remove('pulse');
        }, 1000);
    }

    handleKeyboard(event) {
        switch(event.key) {
            case '1':
            case '2':
            case '3':
            case '4':
                const chipIndex = parseInt(event.key) - 1;
                const chip = document.querySelectorAll('.chip')[chipIndex];
                if (chip) this.handleChipClick(chip, parseInt(event.key));
                break;
            case ' ':
                event.preventDefault();
                this.toggleTimer();
                break;
            case 'r':
                this.resetTimer();
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.handleUpArrow();
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.handleDownArrow();
                break;
            case 'Escape':
                ipcRenderer.send('toggle-window');
                break;
        }
    }

    handleWindowFocus() {
        // Window focus - animations are handled by main process
    }

    handleWindowBlur() {
        // Optional: Add subtle effects when window loses focus
    }

    animateEntrance() {
        const notchContent = document.getElementById('notch-content');
        // Remove any existing classes
        notchContent.classList.remove('animate-out', 'visible');

        // Force reflow
        notchContent.offsetHeight;

        // Add entrance animation
        notchContent.classList.add('animate-in');

        setTimeout(() => {
            notchContent.classList.remove('animate-in');
            notchContent.classList.add('visible');
        }, 500);
    }

    triggerNotchEmergence() {
        const notchContent = document.getElementById('notch-content');
        
        // Reset any existing animations
        notchContent.classList.remove('fade-in', 'fade-out');
        
        // Force reflow
        notchContent.offsetHeight;
        
        // Add the fade-in class to trigger the smooth animation
        notchContent.classList.add('fade-in');
    }

    triggerNotchFadeOut() {
        const notchContent = document.getElementById('notch-content');
        
        // Reset any existing animations
        notchContent.classList.remove('fade-in', 'fade-out');
        
        // Force reflow
        notchContent.offsetHeight;
        
        // Add the fade-out class to trigger the smooth exit animation
        notchContent.classList.add('fade-out');
    }

    animateExit() {
        const notchContent = document.getElementById('notch-content');
        notchContent.classList.remove('animate-in', 'visible');
        notchContent.classList.add('animate-out');

        setTimeout(() => {
            notchContent.classList.remove('animate-out');
        }, 300);
    }
}

// Device pixel ratio optimization for Retina displays
function optimizeForDisplay() {
    const dpr = window.devicePixelRatio || 1;
    const notchContent = document.getElementById('notch-content');

    if (dpr > 1) {
        // Retina display optimizations
        notchContent.style.transform = `scale(${1 / dpr})`;
        notchContent.style.transformOrigin = 'top center';
        document.body.style.zoom = dpr;
    }
}

// Performance monitoring
function initPerformanceMonitoring() {
    let frameCount = 0;
    let lastTime = performance.now();

    function checkFrameRate() {
        frameCount++;
        const currentTime = performance.now();

        if (currentTime - lastTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));

            // Adjust animation quality based on performance
            if (fps < 30) {
                document.body.classList.add('reduced-animations');
            } else {
                document.body.classList.remove('reduced-animations');
            }

            frameCount = 0;
            lastTime = currentTime;
        }

        requestAnimationFrame(checkFrameRate);
    }

    requestAnimationFrame(checkFrameRate);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    optimizeForDisplay();
    initPerformanceMonitoring();

    // Create the main notch overlay instance
    window.notchOverlay = new NotchOverlay();

    // Handle system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
        // The notch is always dark, but we could adjust other elements here
        document.body.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    });
});

// Handle window before unload
window.addEventListener('beforeunload', () => {
    if (window.notchOverlay) {
        window.notchOverlay.stopTimer();
    }
});