const { ipcRenderer } = require('electron');
const WalletManager = require('./wallet-manager');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

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
        this.storedPrivateKey = null;

        // Betting functionality
        this.supabase = null;
        this.isQuestionMode = false;
        this.currentMarket = null;
        this.lastMarketId = null;
        this.questionTimer = null;
        this.yesShares = 0;
        this.noShares = 0;
        this.marketMonitorInterval = null;
        this.currentUserPosition = null; // Track user's current position

        this.init();
    }

    // SIMPLE BETTING DISPLAY - NO COMPLEX CSS
    showSimpleBetting(questionText) {
        console.log('=== SHOWING SIMPLE BETTING ===');
        console.log('Question:', questionText);

        // Reset share counts
        this.simpleYes = 0;
        this.simpleNo = 0;

        // Hide judge section and show betting UI
        document.getElementById('judge-section').style.display = 'none';

        // Also hide the old betting section if it exists
        const oldBettingSection = document.getElementById('betting-question-section');
        if (oldBettingSection) {
            oldBettingSection.style.display = 'none';
        }

        // Keep wallet section visible
        const walletSection = document.getElementById('wallet-section');
        if (walletSection) {
            walletSection.style.display = 'block';
            walletSection.style.position = 'absolute';
            walletSection.style.top = '8px';
            walletSection.style.left = '8px';
            walletSection.style.zIndex = '100';
        }

        // Show simple betting UI
        const bettingUI = document.getElementById('simple-betting-ui');
        const questionEl = document.getElementById('simple-question');
        const timerEl = document.getElementById('simple-timer');
        const votesEl = document.getElementById('simple-votes');

        // Set the question text from database
        questionEl.textContent = questionText || 'New betting question available';
        timerEl.textContent = '30';
        // Update display with current share counts
        votesEl.textContent = `Yes: ${this.yesShares} | No: ${this.noShares}`;

        // Force the betting UI to be visible with absolute positioning
        bettingUI.style.display = 'block';
        bettingUI.style.visibility = 'visible';
        bettingUI.style.opacity = '1';
        bettingUI.style.position = 'relative';
        bettingUI.style.zIndex = '1000';

        // Force remove any hidden classes
        bettingUI.classList.remove('hidden');
        bettingUI.className = bettingUI.className.replace(/hidden/g, '');

        console.log('Question text set to:', questionEl.textContent);
        console.log('Betting UI styles set:', {
            display: bettingUI.style.display,
            visibility: bettingUI.style.visibility,
            opacity: bettingUI.style.opacity,
            classList: Array.from(bettingUI.classList)
        });

        // Expand notch
        ipcRenderer.send('expand-for-question');

        // Clear any existing timer
        if (this.simpleBettingTimer) {
            clearInterval(this.simpleBettingTimer);
        }

        // Start simple timer
        let timeLeft = 30;
        this.simpleBettingTimer = setInterval(() => {
            timeLeft--;
            timerEl.textContent = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(this.simpleBettingTimer);
                this.hideSimpleBetting();
            }
        }, 1000);

        // Remove any existing event listeners to prevent duplicates
        const upBtn = document.getElementById('simple-up');
        const downBtn = document.getElementById('simple-down');

        // Clone and replace to remove old listeners
        const newUpBtn = upBtn.cloneNode(true);
        const newDownBtn = downBtn.cloneNode(true);
        upBtn.parentNode.replaceChild(newUpBtn, upBtn);
        downBtn.parentNode.replaceChild(newDownBtn, downBtn);

        // Add fresh event listeners
        newUpBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('=== YES BUTTON CLICKED ===');

            // Update vote count immediately for UI feedback
            this.simpleYes++;
            votesEl.textContent = `Yes: ${this.simpleYes} | No: ${this.simpleNo}`;
            console.log('Updated counts:', { yes: this.simpleYes, no: this.simpleNo });

            // Cast YES vote to database
            await this.castVote('yes');

            // Visual feedback
            newUpBtn.style.transform = 'scale(0.9)';
            setTimeout(() => {
                newUpBtn.style.transform = 'scale(1)';
            }, 150);
        });

        newDownBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('=== NO BUTTON CLICKED ===');

            // Update vote count immediately for UI feedback
            this.simpleNo++;
            votesEl.textContent = `Yes: ${this.simpleYes} | No: ${this.simpleNo}`;
            console.log('Updated counts:', { yes: this.simpleYes, no: this.simpleNo });

            // Cast NO vote to database
            await this.castVote('no');

            // Visual feedback
            newDownBtn.style.transform = 'scale(0.9)';
            setTimeout(() => {
                newDownBtn.style.transform = 'scale(1)';
            }, 150);
        });

        console.log('Simple betting UI activated with clickable buttons');
    }

    // Judge UI Initialization
    initializeJudgeUI() {
        console.log('=== INITIALIZING JUDGE UI ===');

        // Update wallet connection status
        this.updateWalletStatus();

        // Setup event listeners for new UI elements
        const connectBtn = document.getElementById('connect-wallet-btn');
        const rechargeBtnMain = document.getElementById('recharge-btn-main');
        const disconnectBtnMain = document.getElementById('disconnect-btn-main');

        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.showPrivateKeyModal());
        }

        if (rechargeBtnMain) {
            rechargeBtnMain.addEventListener('click', () => this.handleMainRecharge());
        }

        if (disconnectBtnMain) {
            disconnectBtnMain.addEventListener('click', () => this.disconnectWallet());
        }

        console.log('Judge UI initialized');
    }

    updateWalletStatus() {
        const statusEl = document.getElementById('wallet-connection-status');
        const connectBtn = document.getElementById('connect-wallet-btn');
        const rechargeSection = document.getElementById('recharge-section-main');

        if (this.isWalletConnected && this.walletAddress) {
            statusEl.innerHTML = `
                <div style="
                    padding: 12px;
                    background: rgba(52, 199, 89, 0.2);
                    border: 2px solid #34C759;
                    border-radius: 12px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                " onclick="window.notchOverlay.handleWalletStatusClick(event)"
                   title="Triple-click to disconnect wallet">
                    <div style="color: #34C759; font-weight: 600; font-size: 14px;">✅ WALLET CONNECTED</div>
                    <div style="color: #ffffff; font-size: 11px; margin-top: 4px; font-family: monospace;">
                        ${this.walletAddress.slice(0, 10)}...${this.walletAddress.slice(-8)}
                    </div>
                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 9px; margin-top: 4px;">
                        Triple-click to disconnect
                    </div>
                </div>
            `;
            connectBtn.style.display = 'none';
            rechargeSection.style.display = 'flex';

            // Update wallet info
            const addressEl = document.getElementById('wallet-address-main');
            const balanceEl = document.getElementById('balance-main');

            if (addressEl) {
                const shortAddress = `${this.walletAddress.slice(0, 6)}...${this.walletAddress.slice(-4)}`;
                addressEl.textContent = shortAddress;
            }

            if (balanceEl) {
                balanceEl.textContent = `Balance: ${this.creditedBalance.toFixed(4)} POL`;
            }
        } else {
            statusEl.textContent = 'Connect your wallet to start voting';
            connectBtn.style.display = 'block';
            rechargeSection.style.display = 'none';
        }
    }

    async handleMainRecharge() {
        const amountInput = document.getElementById('recharge-amount-main');
        const amount = parseFloat(amountInput.value);

        if (!amount || amount <= 0) {
            this.showMainTransactionStatus('Please enter a valid amount', false);
            return;
        }

        if (amount < 0.001) {
            this.showMainTransactionStatus('Minimum amount is 0.001 POL', false);
            return;
        }

        if (!this.isWalletConnected) {
            this.showMainTransactionStatus('Please connect your wallet first', false);
            return;
        }

        // Show transaction status
        this.showMainTransactionStatus('Initiating transaction...', true);

        try {
            // Complete recharge flow
            const result = await this.walletManager.completeRecharge(amount);

            if (result.success) {
                // Update credited balance
                this.creditedBalance += result.amount;
                this.updateWalletStatus();

                // Clear amount input
                amountInput.value = '';

                // Show success message
                this.showMainTransactionStatus(`Success! ${result.amount} POL credited.`, false);

                // Hide status after delay
                setTimeout(() => this.hideMainTransactionStatus(), 3000);

            } else {
                this.showMainTransactionStatus('Transaction failed', false);
            }

        } catch (error) {
            console.error('Recharge error:', error);

            if (error.message.includes('insufficient funds')) {
                this.showMainTransactionStatus('Insufficient funds for gas fees', false);
            } else if (error.message.includes('network')) {
                this.showMainTransactionStatus('Network congested, try again', false);
            } else {
                this.showMainTransactionStatus(error.message || 'Transaction failed', false);
            }
        }
    }

    showMainTransactionStatus(message, showSpinner = false) {
        const statusElement = document.getElementById('transaction-status-main');
        const statusText = document.getElementById('status-text-main');
        const spinner = document.getElementById('status-spinner-main');

        if (statusElement && statusText) {
            statusText.textContent = message;
            if (spinner) {
                spinner.style.display = showSpinner ? 'block' : 'none';
            }
            statusElement.classList.remove('hidden');
            statusElement.style.display = 'flex';
        }
    }

    hideMainTransactionStatus() {
        const statusElement = document.getElementById('transaction-status-main');
        if (statusElement) {
            statusElement.classList.add('hidden');
            statusElement.style.display = 'none';
        }
    }

    showPrivateKeyModal() {
        console.log('=== SHOWING PRIVATE KEY MODAL ===');

        // Create a simple inline private key input in the Judge UI
        const statusEl = document.getElementById('wallet-connection-status');
        const connectBtn = document.getElementById('connect-wallet-btn');

        // Hide the connect button and show input
        connectBtn.style.display = 'none';
        statusEl.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                gap: 8px;
                width: 100%;
                padding: 8px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            ">
                <input
                    type="password"
                    id="private-key-input-main"
                    placeholder="Enter your Polygon Amoy private key"
                    style="
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        border-radius: 8px;
                        padding: 8px 12px;
                        color: white;
                        font-size: 11px;
                        width: 100%;
                        font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
                        -webkit-app-region: no-drag;
                        pointer-events: auto;
                    "
                />
                <div style="display: flex; gap: 8px; justify-content: center;">
                    <button
                        id="connect-with-key-btn"
                        onclick="window.notchOverlay.handleConnectClick()"
                        style="
                            background: linear-gradient(135deg, #34C759, #30D158);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            padding: 6px 12px;
                            font-size: 11px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            -webkit-app-region: no-drag;
                            pointer-events: auto;
                            font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
                        "
                    >Connect</button>
                    <button
                        id="cancel-connect-btn"
                        onclick="window.notchOverlay.hidePrivateKeyModal()"
                        style="
                            background: rgba(128, 128, 128, 0.2);
                            color: #ffffff;
                            border: 1px solid rgba(128, 128, 128, 0.3);
                            border-radius: 8px;
                            padding: 6px 12px;
                            font-size: 11px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            -webkit-app-region: no-drag;
                            pointer-events: auto;
                            font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
                        "
                    >← Back</button>
                </div>
                <p style="
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 10px;
                    text-align: center;
                    margin: 0;
                    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
                ">Enter your private key for Polygon Amoy testnet</p>
                <div id="connection-status-display" style="
                    color: rgba(255, 255, 255, 0.8);
                    font-size: 11px;
                    text-align: center;
                    margin: 4px 0 0 0;
                    padding: 8px 12px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 6px;
                    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
                    display: none;
                    min-height: 20px;
                "></div>
            </div>
        `;

        // Add event listeners for the new buttons
        const connectWithKeyBtn = document.getElementById('connect-with-key-btn');
        const cancelBtn = document.getElementById('cancel-connect-btn');
        const privateKeyInput = document.getElementById('private-key-input-main');

        if (connectWithKeyBtn) {
            connectWithKeyBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                console.log('=== CONNECT BUTTON CLICKED ===');

                const privateKey = privateKeyInput.value.trim();
                console.log('Private key length:', privateKey.length);

                if (privateKey) {
                    console.log('Starting connection process...');
                    this.showConnectionStatus('Connecting...', 'info');

                    try {
                        await this.connectWithPrivateKeyMain(privateKey);
                        console.log('Connection process completed');
                    } catch (error) {
                        console.error('Connection process failed:', error);
                        this.showConnectionStatus(`Connection failed: ${error.message}`, 'error');
                    }
                } else {
                    console.log('No private key entered');
                    this.showConnectionStatus('Please enter a private key', 'error');
                }
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hidePrivateKeyModal();
            });
        }

        // Allow Enter key to connect
        if (privateKeyInput) {
            privateKeyInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    const privateKey = privateKeyInput.value.trim();
                    if (privateKey) {
                        this.showConnectionStatus('Connecting...', 'info');
                        await this.connectWithPrivateKeyMain(privateKey);
                    } else {
                        this.showConnectionStatus('Please enter a private key', 'error');
                    }
                }
            });
        }

        console.log('Private key modal shown');
    }

    // Simple click handler that's directly accessible
    async handleConnectClick() {
        console.log('=== CONNECT BUTTON CLICKED ===');

        const connectBtn = document.getElementById('connect-with-key-btn');
        const privateKeyInput = document.getElementById('private-key-input-main');
        const statusDiv = document.getElementById('connection-status-display');

        if (!privateKeyInput) {
            alert('Private key input not found');
            return;
        }

        const privateKey = privateKeyInput.value.trim();

        if (!privateKey) {
            if (statusDiv) {
                statusDiv.style.display = 'block';
                statusDiv.textContent = 'Please enter a private key';
                statusDiv.style.background = 'rgba(255, 59, 48, 0.2)';
                statusDiv.style.color = '#FF453A';
            }
            return;
        }

        // Show connecting status
        if (connectBtn) {
            connectBtn.textContent = 'Connecting...';
            connectBtn.disabled = true;
        }
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.textContent = 'Connecting to wallet...';
            statusDiv.style.background = 'rgba(0, 122, 255, 0.2)';
            statusDiv.style.color = '#007AFF';
        }

        try {
            // Create wallet directly - simple approach
            const ethers = require('ethers');
            const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;

            // Create provider
            const provider = new ethers.JsonRpcProvider('https://rpc-amoy.polygon.technology');

            // Create wallet
            const wallet = new ethers.Wallet(cleanPrivateKey, provider);
            const address = wallet.address;

            console.log('WALLET CREATED:', address);

            // Success!
            this.isWalletConnected = true;
            this.walletAddress = address;

            // Clear input
            privateKeyInput.value = '';

            // Save to storage
            this.saveWalletToStorage(privateKey);

            // Update UI
            this.updateWalletStatus();

            // Show success
            if (statusDiv) {
                statusDiv.style.display = 'block';
                statusDiv.textContent = `Connected! Address: ${address.slice(0, 6)}...${address.slice(-4)}`;
                statusDiv.style.background = 'rgba(52, 199, 89, 0.2)';
                statusDiv.style.color = '#34C759';
            }

            // Auto-hide status after showing success
            setTimeout(() => {
                this.hidePrivateKeyModal();
            }, 2000);

        } catch (error) {
            console.error('Connection failed:', error);

            if (statusDiv) {
                statusDiv.style.display = 'block';
                statusDiv.textContent = 'Connection failed: ' + error.message;
                statusDiv.style.background = 'rgba(255, 59, 48, 0.2)';
                statusDiv.style.color = '#FF453A';
            }

            // Reset button
            if (connectBtn) {
                connectBtn.textContent = 'Connect';
                connectBtn.disabled = false;
            }
        }
    }

    // Handle wallet status clicks for logout
    handleWalletStatusClick(event) {
        if (!this.clickCount) {
            this.clickCount = 0;
            this.clickTimer = null;
        }

        this.clickCount++;

        if (this.clickCount === 1) {
            // Start timer for triple-click detection
            this.clickTimer = setTimeout(() => {
                this.clickCount = 0;
            }, 600); // 600ms window for triple-click

        } else if (this.clickCount === 3) {
            // Triple-click detected - logout
            clearTimeout(this.clickTimer);
            this.clickCount = 0;

            console.log('Triple-click detected - logging out wallet');

            // Show confirmation
            const statusEl = event.target.closest('div');
            if (statusEl) {
                statusEl.style.background = 'rgba(255, 59, 48, 0.2)';
                statusEl.style.borderColor = '#FF3B30';
                statusEl.innerHTML = `
                    <div style="color: #FF453A; font-weight: 600; font-size: 14px;">🔄 DISCONNECTING...</div>
                `;
            }

            // Logout after brief delay
            setTimeout(() => {
                this.disconnectWallet();
            }, 500);
        }
    }

    hidePrivateKeyModal() {
        const statusEl = document.getElementById('wallet-connection-status');
        const connectBtn = document.getElementById('connect-wallet-btn');

        // Reset to original state
        statusEl.textContent = 'Connect your wallet to start voting';
        connectBtn.style.display = 'block';
    }

    showConnectionStatus(message, type = 'info') {
        const statusEl = document.getElementById('connection-status-display');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.display = 'block';

            // Color coding based on type
            if (type === 'error') {
                statusEl.style.background = 'rgba(255, 59, 48, 0.1)';
                statusEl.style.color = '#FF453A';
                statusEl.style.border = '1px solid rgba(255, 59, 48, 0.3)';
            } else if (type === 'success') {
                statusEl.style.background = 'rgba(52, 199, 89, 0.1)';
                statusEl.style.color = '#34C759';
                statusEl.style.border = '1px solid rgba(52, 199, 89, 0.3)';
            } else {
                statusEl.style.background = 'rgba(255, 255, 255, 0.05)';
                statusEl.style.color = 'rgba(255, 255, 255, 0.8)';
                statusEl.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            }
        }
    }

    hideConnectionStatus() {
        const statusEl = document.getElementById('connection-status-display');
        if (statusEl) {
            statusEl.style.display = 'none';
        }
    }

    async connectWithPrivateKeyMain(privateKey) {
        console.log('=== CONNECTING WITH PRIVATE KEY (MAIN) ===');

        try {
            // Show loading state
            this.showMainTransactionStatus('Connecting wallet...', true);
            this.showConnectionStatus('Connecting to Polygon Amoy...', 'info');

            console.log('Calling WalletManager.connectWithPrivateKey...');
            const result = await this.walletManager.connectWithPrivateKey(privateKey);
            console.log('WalletManager result:', result);

            if (result.success) {
                this.isWalletConnected = true;
                this.walletAddress = result.address;

                console.log('Connection successful, wallet address:', this.walletAddress);
                this.showConnectionStatus('Connected! Loading balance...', 'success');

                // Save private key to storage for auto-connect
                this.saveWalletToStorage(privateKey);

                // Load credited balance from database
                console.log('Loading credited balance...');
                await this.loadCreditedBalance();

                // Try to get actual wallet balance for display (non-blocking)
                this.showConnectionStatus('Wallet connected! Checking balance...', 'success');
                setTimeout(async () => {
                    try {
                        const actualBalance = await this.walletManager.getBalance();
                        console.log('Actual wallet balance:', actualBalance, 'POL');
                        this.showConnectionStatus(`Balance: ${actualBalance.toFixed(4)} POL`, 'success');
                        setTimeout(() => this.hideConnectionStatus(), 3000);
                    } catch (balanceError) {
                        console.warn('Could not get wallet balance:', balanceError.message);
                        this.showConnectionStatus('Connected (Balance unavailable)', 'success');
                        setTimeout(() => this.hideConnectionStatus(), 3000);
                    }
                }, 1000);

                // Update Judge UI
                this.updateWalletStatus();

                // Hide the modal
                this.hidePrivateKeyModal();
                this.hideMainTransactionStatus();

                console.log('Wallet connected successfully:', this.walletAddress);

            } else {
                console.error('Wallet connection failed:', result.error);
                this.showMainTransactionStatus(result.error || 'Connection failed', false);
                this.showConnectionStatus(result.error || 'Connection failed', 'error');
                setTimeout(() => this.hideMainTransactionStatus(), 5000);
            }

        } catch (error) {
            console.error('Connection error:', error);
            const errorMessage = error.message || 'Connection failed';
            this.showMainTransactionStatus(errorMessage, false);
            this.showConnectionStatus(errorMessage, 'error');
            setTimeout(() => this.hideMainTransactionStatus(), 5000);
        }
    }

    // Wallet Storage Functions
    async loadStoredWallet() {
        try {
            console.log('=== LOADING STORED WALLET ===');

            // Check localStorage for stored private key
            const storedKey = localStorage.getItem('wallet_private_key');

            if (storedKey) {
                console.log('Found stored private key, attempting auto-connect...');

                // Auto-connect with stored key
                const result = await this.walletManager.connectWithPrivateKey(storedKey);

                if (result.success) {
                    this.isWalletConnected = true;
                    this.walletAddress = result.address;
                    this.storedPrivateKey = storedKey;

                    // Update wallet icon
                    const walletIcon = document.getElementById('wallet-icon');
                    if (walletIcon) {
                        walletIcon.classList.add('connected');
                        // Update wallet status text if it exists
                        const statusEl = walletIcon.querySelector('#wallet-status');
                        if (statusEl) {
                            statusEl.textContent = 'Connected';
                        }
                    }

                    // Load credited balance
                    await this.loadCreditedBalance();

                    // Update Judge UI
                    this.updateWalletStatus();

                    console.log('Auto-connected to wallet:', this.walletAddress);
                } else {
                    console.error('Auto-connect failed:', result.error);
                    // Remove invalid stored key
                    localStorage.removeItem('wallet_private_key');
                }
            } else {
                console.log('No stored wallet found');
            }
        } catch (error) {
            console.error('Error loading stored wallet:', error);
            // Remove invalid stored key if there's an error
            localStorage.removeItem('wallet_private_key');
        }
    }

    saveWalletToStorage(privateKey) {
        try {
            console.log('=== SAVING WALLET TO STORAGE ===');

            // Store the private key in localStorage
            localStorage.setItem('wallet_private_key', privateKey);
            this.storedPrivateKey = privateKey;

            console.log('Wallet saved to storage successfully');
        } catch (error) {
            console.error('Error saving wallet to storage:', error);
        }
    }

    removeStoredWallet() {
        try {
            console.log('=== REMOVING STORED WALLET ===');

            // Remove from localStorage
            localStorage.removeItem('wallet_private_key');
            this.storedPrivateKey = null;

            console.log('Stored wallet removed successfully');
        } catch (error) {
            console.error('Error removing stored wallet:', error);
        }
    }

    hideSimpleBetting() {
        console.log('Hiding simple betting');

        // Hide betting UI
        document.getElementById('simple-betting-ui').style.display = 'none';

        // Show judge section
        document.getElementById('judge-section').style.display = 'flex';

        // Collapse notch
        ipcRenderer.send('collapse-after-question');

        // Reset market data
        this.currentMarket = null;
        this.currentUserPosition = null;
        this.simpleYes = 0;
        this.simpleNo = 0;
    }

    init() {
        this.setupEventListeners();
        this.initializeTimer();
        this.initializeSupabase();
        this.initializeJudgeUI();
        this.loadStoredWallet();
        // Fade-in animation will be triggered by main process
    }

    initializeSupabase() {
        try {
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_ANON_KEY;

            console.log('=== INITIALIZING SUPABASE ===');
            console.log('Supabase URL:', supabaseUrl);
            console.log('Supabase Key exists:', !!supabaseKey);

            if (!supabaseUrl || !supabaseKey) {
                console.error('Supabase credentials not found in environment');
                return;
            }

            this.supabase = createClient(supabaseUrl, supabaseKey);
            console.log('Supabase client initialized successfully');

            // SIMPLE TEST FUNCTION
            window.testBetting = () => {
                console.log('Test betting called manually');
                this.showSimpleBetting('Will Bitcoin reach $100k by end of 2024?');
            };

            // SIMPLE SHOW BETTING FUNCTION
            window.showBetting = (question) => {
                this.showSimpleBetting(question);
            };

            // Auto-show removed - only show new questions from polling

            // Function to test with real database data
            window.testWithDatabase = async () => {
                console.log('Testing with real database data...');
                try {
                    // First try the bets table for questions
                    const { data: betsData, error: betsError } = await this.supabase
                        .from('bets')
                        .select('*')
                        .order('id', { ascending: false })
                        .limit(1);

                    console.log('Bets table data:', betsData);

                    // Also try markets table if it exists
                    const { data: marketsData, error: marketsError } = await this.supabase
                        .from('markets')
                        .select('*')
                        .order('id', { ascending: false })
                        .limit(1);

                    console.log('Markets table data:', marketsData);

                    // Use whichever has question_text
                    let questionData = null;
                    if (betsData && betsData[0] && betsData[0].question_text) {
                        questionData = betsData[0];
                        console.log('Using bets table data');
                    } else if (marketsData && marketsData[0] && marketsData[0].question_text) {
                        questionData = marketsData[0];
                        console.log('Using markets table data');
                    } else if (betsData && betsData[0]) {
                        questionData = betsData[0];
                        console.log('Using bets table data (no question_text field)');
                    }

                    if (questionData) {
                        console.log('Question data:', questionData);
                        console.log('Available fields:', Object.keys(questionData));
                        const question = questionData.question_text || questionData.question || questionData.text || questionData.title || 'Test question from database';
                        this.showSimpleBetting(question);
                    }
                } catch (err) {
                    console.error('Database test error:', err);
                }
            };

            // Function to test with specific table
            window.testTable = async (tableName = 'bets') => {
                console.log(`Testing with ${tableName} table...`);
                try {
                    const { data, error } = await this.supabase
                        .from(tableName)
                        .select('*')
                        .order('id', { ascending: false })
                        .limit(3);

                    console.log(`${tableName} table data:`, data);
                    if (data && data.length > 0) {
                        console.log('First record fields:', Object.keys(data[0]));
                        data.forEach((record, index) => {
                            console.log(`Record ${index + 1}:`, record);
                        });
                    }
                } catch (err) {
                    console.error(`${tableName} table error:`, err);
                }
            };

            // Start monitoring for new markets
            this.startMarketMonitoring();
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
        }
    }

    async startMarketMonitoring() {
        if (!this.supabase) {
            console.error('Cannot start market monitoring - no Supabase client');
            return;
        }

        console.log('=== STARTING MARKET MONITORING ===');

        // Get the latest market to establish baseline and show immediately
        try {
            console.log('Fetching latest market for baseline...');

            const { data: marketsData, error: marketsError } = await this.supabase
                .from('markets')
                .select('*')
                .order('id', { ascending: false })
                .limit(1);

            console.log('Baseline markets query result:', { data: marketsData, error: marketsError });

            if (!marketsError && marketsData && marketsData.length > 0) {
                const latestMarket = marketsData[0];
                console.log('Found latest market:', latestMarket);
                console.log('Available fields:', Object.keys(latestMarket));

                // Store current market data for baseline (don't show it)
                this.currentMarket = latestMarket;
                this.lastMarketId = latestMarket.id;

                console.log('Baseline established with market ID:', latestMarket.id);
                console.log('Will only show NEW markets from now on');

            } else {
                console.log('No markets found in database');
            }
        } catch (error) {
            console.error('Error getting latest market:', error);
        }

        // Poll for new markets every 3 seconds
        console.log('Setting up polling interval (every 3 seconds)');
        this.marketMonitorInterval = setInterval(() => {
            console.log('--- Polling for new markets ---');
            this.checkForNewMarkets();
        }, 3000);

        // Also run an initial check
        setTimeout(() => {
            console.log('Running initial market check...');
            this.checkForNewMarkets();
        }, 1000);
    }

    async checkForNewMarkets() {
        if (!this.supabase || this.isQuestionMode) return;

        console.log('=== CHECKING FOR NEW MARKETS ===');
        console.log('Current lastMarketId:', this.lastMarketId);

        try {
            const { data: marketsData, error: marketsError } = await this.supabase
                .from('markets')
                .select('*')
                .order('id', { ascending: false })
                .limit(1);

            console.log('Latest markets query result:', { data: marketsData, error: marketsError });

            if (!marketsError && marketsData && marketsData.length > 0) {
                const latestMarket = marketsData[0];
                console.log('Latest market ID:', latestMarket.id, 'Last known ID:', this.lastMarketId);

                // Check if this is a NEW market (higher ID than we've seen)
                if (!this.lastMarketId || latestMarket.id > this.lastMarketId) {
                    console.log('=== NEW MARKET DETECTED ===');
                    console.log('Full market object:', JSON.stringify(latestMarket, null, 2));

                    // Extract question from markets table
                    const questionText = latestMarket.question_text || latestMarket.question || latestMarket.text || latestMarket.title || 'New betting question available';
                    console.log('Question text extracted from markets:', questionText);

                    // Update our current market data
                    this.currentMarket = latestMarket;
                    this.lastMarketId = latestMarket.id;

                    // Load current share counts for this market
                    await this.loadMarketShares(latestMarket.id);

                    // Show the betting UI
                    this.showSimpleBetting(questionText);
                } else {
                    console.log('No new markets (latest ID:', latestMarket.id, 'not greater than last known:', this.lastMarketId, ')');
                }
            } else {
                console.log('No markets found in database');
            }
        } catch (error) {
            console.error('Error checking for new markets:', error);
        }
    }

    // Load current share counts for a market from user_positions
    async loadMarketShares(marketId) {
        try {
            console.log('Loading share counts for market:', marketId);

            const { data: positions, error } = await this.supabase
                .from('user_positions')
                .select('yes_shares, no_shares')
                .eq('market_id', marketId);

            if (!error && positions) {
                // Sum up all yes and no shares for this market
                this.yesShares = positions.reduce((sum, pos) => sum + (pos.yes_shares || 0), 0);
                this.noShares = positions.reduce((sum, pos) => sum + (pos.no_shares || 0), 0);

                console.log('Market', marketId, 'shares loaded:', {
                    yesShares: this.yesShares,
                    noShares: this.noShares
                });
            } else {
                console.error('Error loading market shares:', error);
                this.yesShares = 0;
                this.noShares = 0;
            }
        } catch (error) {
            console.error('Error loading market shares:', error);
            this.yesShares = 0;
            this.noShares = 0;
        }
    }

    displayNewBet(bet) {
        console.log('=== DISPLAY NEW BET CALLED ===');
        console.log('Current state check:');
        console.log('- isQuestionMode:', this.isQuestionMode);
        console.log('- isWalletMode:', this.isWalletMode);

        if (this.isQuestionMode || this.isWalletMode) {
            console.log('BLOCKED: Already in question or wallet mode');
            return;
        }

        console.log('=== PROCESSING NEW BET ===');
        console.log('Bet data received:', JSON.stringify(bet, null, 2));

        this.currentBet = bet;
        this.isQuestionMode = true;
        this.yesVotes = 0;
        this.noVotes = 0;
        this.currentUserVote = null; // Reset user vote

        console.log('State updated - isQuestionMode now:', this.isQuestionMode);

        // Show question
        const questionText = document.getElementById('betting-question-text');
        const questionSection = document.getElementById('betting-question-section');
        const yesCount = document.getElementById('yes-count');
        const noCount = document.getElementById('no-count');

        console.log('DOM elements found:', {
            questionText: !!questionText,
            questionSection: !!questionSection,
            yesCount: !!yesCount,
            noCount: !!noCount
        });

        const questionContent = bet.question || bet.text || 'New betting question available';
        console.log('Setting question content to:', questionContent);

        questionText.textContent = questionContent;
        yesCount.textContent = `Yes: ${this.yesVotes}`;
        noCount.textContent = `No: ${this.noVotes}`;

        console.log('Text content set. Elements now contain:', {
            questionText: questionText.textContent,
            yesCount: yesCount.textContent,
            noCount: noCount.textContent
        });

        // Show the question section and force it to be visible
        questionSection.classList.remove('hidden');
        questionSection.style.display = 'block';
        questionSection.style.visibility = 'visible';
        questionSection.style.opacity = '1';

        console.log('=== QUESTION SECTION VISIBILITY ===');
        console.log('Question section state:', {
            display: questionSection.style.display,
            visibility: questionSection.style.visibility,
            opacity: questionSection.style.opacity,
            classList: Array.from(questionSection.classList),
            hasHiddenClass: questionSection.classList.contains('hidden'),
            computedStyle: window.getComputedStyle(questionSection).display
        });

        // Trigger notch expansion
        console.log('=== TRIGGERING NOTCH EXPANSION ===');
        this.expandNotchForQuestion();

        // Start 30-second timer
        console.log('=== STARTING QUESTION TIMER ===');
        this.startQuestionTimer();

        // Show appropriate context based on wallet connection
        if (this.isWalletConnected) {
            this.updateContextText('New Bet: Vote Yes/No');
        } else {
            this.updateContextText('Connect wallet to vote');
        }

        console.log('=== DISPLAY NEW BET COMPLETE ===');
    }

    expandNotchForQuestion() {
        console.log('=== EXPANDING NOTCH FOR QUESTION ===');

        // Send expansion request to main process
        ipcRenderer.send('expand-for-question');

        // Add visual indication
        const notchContent = document.getElementById('notch-content');
        notchContent.classList.add('question-mode');

        console.log('Question mode class added, notch should expand');
    }

    startQuestionTimer() {
        // Take over the main timer for betting
        this.stopTimer(); // Stop any existing timer
        this.timerDuration = 30;
        this.currentTime = 30;
        this.isTimerRunning = true;
        this.updateTimerDisplay();
        this.updateTimerProgress();

        this.questionTimer = setInterval(() => {
            this.currentTime--;
            this.updateTimerDisplay();
            this.updateTimerProgress();
            this.updateContextText(`Vote Now! ${this.currentTime}s remaining`);

            if (this.currentTime <= 0) {
                this.completeQuestionTimer();
            }
        }, 1000);
    }

    completeQuestionTimer() {
        this.isTimerRunning = false;
        if (this.questionTimer) {
            clearInterval(this.questionTimer);
            this.questionTimer = null;
        }

        // Add completion animation to timer
        const timerContainer = document.getElementById('timer-container');
        timerContainer.classList.add('timer-complete');

        // Hide question and distribute rewards
        setTimeout(() => {
            timerContainer.classList.remove('timer-complete');
            this.hideQuestion();
        }, 500);
    }

    async hideQuestion() {
        if (!this.isQuestionMode) return;

        this.isQuestionMode = false;

        // Clear timer
        if (this.questionTimer) {
            clearInterval(this.questionTimer);
            this.questionTimer = null;
        }

        // Calculate and distribute rewards before hiding
        await this.calculateAndDistributeRewards();

        // Hide question section
        const questionSection = document.getElementById('betting-question-section');
        questionSection.classList.add('hidden');

        // Remove question mode styling
        const notchContent = document.getElementById('notch-content');
        notchContent.classList.remove('question-mode');

        // Reset timer to normal state
        this.resetTimer();

        // Send collapse request to main process
        ipcRenderer.send('collapse-after-question');

        // Reset bet data
        const currentBetId = this.currentBet ? this.currentBet.id : null;
        const finalYesVotes = this.yesVotes;
        const finalNoVotes = this.noVotes;

        this.currentBet = null;
        this.yesVotes = 0;
        this.noVotes = 0;
        this.currentUserVote = null;

        this.updateContextText('Rewards distributed!');

        // Update the bet status in database
        if (currentBetId) {
            try {
                await this.supabase
                    .from('bets')
                    .update({
                        status: 'completed',
                        yes_votes: finalYesVotes,
                        no_votes: finalNoVotes,
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', currentBetId);
            } catch (error) {
                console.error('Error updating bet status:', error);
            }
        }
    }

    async calculateAndDistributeRewards() {
        if (!this.currentBet || !this.supabase) return;

        try {
            // Get all votes for this bet
            const { data: votes, error } = await this.supabase
                .from('votes')
                .select('*')
                .eq('bet_id', this.currentBet.id);

            if (error) {
                console.error('Error fetching votes:', error);
                return;
            }

            const totalVotes = votes.length;
            const yesVotes = votes.filter(v => v.vote_type === 'yes').length;
            const noVotes = votes.filter(v => v.vote_type === 'no').length;

            if (totalVotes === 0) {
                console.log('No votes to process');
                return;
            }

            // Determine winning side (majority wins)
            const winningSide = yesVotes > noVotes ? 'yes' : 'no';
            const winningVotes = winningSide === 'yes' ? yesVotes : noVotes;
            const losingVotes = winningSide === 'yes' ? noVotes : yesVotes;

            // Calculate rewards
            const baseReward = 0.001; // 0.001 POL base reward
            const bonusPool = losingVotes * 0.0005; // Bonus from losing side
            const rewardPerWinner = winningVotes > 0 ? baseReward + (bonusPool / winningVotes) : baseReward;

            console.log(`Bet ${this.currentBet.id}: ${winningSide} wins! Reward per winner: ${rewardPerWinner} POL`);

            // Distribute rewards to winners
            const winnerVotes = votes.filter(v => v.vote_type === winningSide);
            const rewardPromises = winnerVotes.map(vote => this.distributeReward(vote.wallet_address, rewardPerWinner));

            await Promise.all(rewardPromises);

            // Update user's balance if they won
            if (this.currentUserVote === winningSide && this.isWalletConnected) {
                this.creditedBalance += rewardPerWinner;
                this.updateBalanceDisplay();
                this.updateContextText(`You won ${rewardPerWinner.toFixed(4)} POL!`);
            } else if (this.currentUserVote && this.currentUserVote !== winningSide) {
                this.updateContextText('Better luck next time!');
            }

        } catch (error) {
            console.error('Error calculating rewards:', error);
        }
    }

    async distributeReward(walletAddress, amount) {
        try {
            // Check if user already has a balance record
            const { data: existingBalance, error: fetchError } = await this.supabase
                .from('wallet_balances')
                .select('credited_balance')
                .eq('wallet_address', walletAddress)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error('Error fetching existing balance:', fetchError);
                return;
            }

            const currentBalance = existingBalance ? existingBalance.credited_balance : 0;
            const newBalance = currentBalance + amount;

            // Update or insert balance
            const { error: upsertError } = await this.supabase
                .from('wallet_balances')
                .upsert({
                    wallet_address: walletAddress,
                    credited_balance: newBalance,
                    updated_at: new Date().toISOString()
                });

            if (upsertError) {
                console.error('Error updating balance:', upsertError);
            } else {
                console.log(`Distributed ${amount} POL to ${walletAddress}`);
            }

            // Record the transaction
            await this.supabase
                .from('reward_transactions')
                .insert({
                    wallet_address: walletAddress,
                    bet_id: this.currentBet.id,
                    amount: amount,
                    transaction_type: 'reward',
                    created_at: new Date().toISOString()
                });

        } catch (error) {
            console.error('Error distributing reward:', error);
        }
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

                // Save private key to storage for auto-connect
                this.saveWalletToStorage(privateKey);

                // Update wallet icon
                const walletIcon = document.getElementById('wallet-icon');
                walletIcon.classList.add('connected');
                const statusEl = walletIcon.querySelector('#wallet-status');
                if (statusEl) {
                    statusEl.textContent = 'Connected';
                }

                // Clear private key field for security
                privateKeyField.value = '';

                // Load credited balance
                await this.loadCreditedBalance();

                // Update Judge UI
                this.updateWalletStatus();

                // Show connected wallet UI
                this.showConnectedWalletUI();

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

        // Remove stored wallet
        this.removeStoredWallet();

        // Reset wallet manager
        this.walletManager.disconnect();

        // Update UI
        const walletIcon = document.getElementById('wallet-icon');
        walletIcon.classList.remove('connected');
        const statusEl = walletIcon.querySelector('#wallet-status');
        if (statusEl) {
            statusEl.textContent = 'Connect';
        }

        // Clear inputs
        document.getElementById('private-key-field').value = '';
        document.getElementById('recharge-amount').value = '';

        // Update Judge UI
        this.updateWalletStatus();

        // Show connection UI
        this.showWalletConnectUI();
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
        // If in question mode, this is a "Yes" vote
        if (this.isQuestionMode && this.currentBet) {
            this.castVote('yes');
            this.addButtonAnimation('up-arrow');
            return;
        }

        this.updateContextText('Moving Up');
        this.addButtonAnimation('up-arrow');

        // Simulate action with visual feedback
        setTimeout(() => {
            this.updateContextText('Position Updated');
        }, 1000);
    }

    handleDownArrow() {
        // If in question mode, this is a "No" vote
        if (this.isQuestionMode && this.currentBet) {
            this.castVote('no');
            this.addButtonAnimation('down-arrow');
            return;
        }

        this.updateContextText('Moving Down');
        this.addButtonAnimation('down-arrow');

        // Simulate action with visual feedback
        setTimeout(() => {
            this.updateContextText('Position Updated');
        }, 1000);
    }

    async castVote(voteType) {
        console.log('=== CASTING VOTE ===');
        console.log('Vote type:', voteType);
        console.log('Current market:', this.currentMarket);
        console.log('Wallet address:', this.walletAddress);

        // For UI testing, always allow vote counting
        this.updateContextText(`${voteType.toUpperCase()} Vote Cast!`);

        // Only try database insert if we have a market and wallet
        if (!this.currentMarket) {
            console.log('No current market - vote counted locally only');
            return;
        }

        if (!this.walletAddress) {
            console.log('No wallet connected - vote counted locally only');
            this.updateContextText('Connect wallet to save vote');
            return;
        }

        // Check if user already has a position in this market
        if (this.currentUserPosition) {
            console.log('User already has position in market:', this.currentUserPosition);
            this.updateContextText(`Already voted in this market`);
            return;
        }

        // Update global share counts
        if (voteType === 'yes') {
            this.yesShares++;
        } else {
            this.noShares++;
        }

        this.updateShareDisplay();

        // Store position in user_positions table
        try {
            const positionData = {
                market_id: this.currentMarket.id,
                user_id: this.walletAddress, // Using wallet address as user_id
                yes_shares: voteType === 'yes' ? 1 : 0,
                no_shares: voteType === 'no' ? 1 : 0,
                created_at: new Date().toISOString()
            };

            console.log('Inserting position data:', positionData);

            const { data, error } = await this.supabase
                .from('user_positions')
                .insert([positionData])
                .select();

            if (error) {
                console.error('Error storing position:', error);
                this.updateContextText('Vote saved locally - DB error');
            } else {
                console.log('Position stored successfully:', data);
                this.currentUserPosition = data[0];
                this.updateContextText(`${voteType.toUpperCase()} vote saved!`);
            }
        } catch (error) {
            console.error('Error storing position:', error);
            this.updateContextText('Vote saved locally - DB error');
        }
    }

    updateShareDisplay() {
        const votesEl = document.getElementById('simple-votes');
        if (votesEl) {
            votesEl.textContent = `Yes: ${this.yesShares} | No: ${this.noShares}`;
        }

        // Also update old vote display if it exists
        const yesCount = document.getElementById('yes-count');
        const noCount = document.getElementById('no-count');
        if (yesCount) yesCount.textContent = `Yes: ${this.yesShares}`;
        if (noCount) noCount.textContent = `No: ${this.noShares}`;
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
        // Cleanup market monitoring
        if (window.notchOverlay.marketMonitorInterval) {
            clearInterval(window.notchOverlay.marketMonitorInterval);
        }
        if (window.notchOverlay.questionTimer) {
            clearInterval(window.notchOverlay.questionTimer);
        }
    }
});