const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');
const { Core } = require('@walletconnect/core');
const { getSdkError } = require('@walletconnect/utils');
const path = require('path');

// Load environment variables
try {
    require('dotenv').config({ path: path.resolve(__dirname, '.env') });
} catch (error) {
    console.warn('Could not load .env file:', error.message);
}

class WalletManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.walletAddress = null;
        this.isConnected = false;
        this.walletConnectCore = null;
        this.walletConnectSession = null;

        // Polygon Amoy Testnet Configuration
        this.networkConfig = {
            chainId: parseInt(process.env.POLYGON_AMOY_CHAIN_ID) || 80002,
            name: 'Polygon Amoy',
            rpcUrl: process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
            symbol: 'POL', // Updated to reflect the rebrand
            blockExplorer: 'https://amoy.polygonscan.com/'
        };

        // Your receiving wallet address
        this.receivingAddress = process.env.RECEIVING_WALLET_ADDRESS || '0xE5e9c170cc1459886131eE8F2B8C65fbbf70672B';

        // Supabase configuration
        const supabaseUrl = process.env.SUPABASE_URL || 'https://bippqmywmpnadwdvprod.supabase.co';
        const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpcHBxbXl3bXBuYWR3ZHZwcm9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NTQ0ODcsImV4cCI6MjA3NDUzMDQ4N30.7aJgglx2O9CIx1lPWzcGx6z9qCDcWp_oDuXdmPXNATQ';

        // Initialize Supabase
        this.supabase = createClient(supabaseUrl, supabaseKey);

        // WalletConnect Project ID
        this.projectId = process.env.WALLETCONNECT_PROJECT_ID || 'c1fd63d6b206955582f8f162d410277e';

        console.log('WalletManager initialized with:', {
            chainId: this.networkConfig.chainId,
            rpcUrl: this.networkConfig.rpcUrl,
            receivingAddress: this.receivingAddress,
            projectId: this.projectId
        });
    }

    // Initialize WalletConnect
    async initWalletConnect() {
        try {
            console.log('Initializing WalletConnect...');

            this.walletConnectCore = new Core({
                projectId: this.projectId,
            });

            await this.walletConnectCore.start();
            console.log('WalletConnect Core initialized');

            return true;
        } catch (error) {
            console.error('Failed to initialize WalletConnect:', error);
            throw new Error('WalletConnect initialization failed');
        }
    }

    // Connect with WalletConnect
    async connectWithWalletConnect() {
        try {
            console.log('Starting WalletConnect connection...');

            if (!this.walletConnectCore) {
                await this.initWalletConnect();
            }

            // For now, let's create a simple URI that users can scan
            // This is a simplified approach - in production, you'd want a full WalletConnect implementation
            const uri = `wc:example-session@2?relay-protocol=irn&symKey=examplekey&projectId=${this.projectId}`;

            console.log('WalletConnect URI generated (simplified):', uri);

            // For demo purposes, let's simulate a connection after a delay
            return new Promise((resolve) => {
                setTimeout(() => {
                    console.log('WalletConnect connection simulated - please use private key method for now');
                    resolve({
                        success: false,
                        error: 'WalletConnect connection not fully implemented yet. Please use Private Key method.',
                        uri: uri
                    });
                }, 2000);
            });

        } catch (error) {
            console.error('WalletConnect connection failed:', error);
            return {
                success: false,
                error: error.message || 'WalletConnect connection failed'
            };
        }
    }

    // Initialize provider
    async initProvider() {
        try {
            this.provider = new ethers.JsonRpcProvider(this.networkConfig.rpcUrl);

            // Test connection
            const network = await this.provider.getNetwork();
            console.log('Connected to network:', network.name, 'Chain ID:', network.chainId);

            return true;
        } catch (error) {
            console.error('Failed to initialize provider:', error);
            throw new Error('Network connection failed');
        }
    }

    // Connect with private key
    async connectWithPrivateKey(privateKey) {
        try {
            console.log('Starting wallet connection process...');

            if (!this.provider) {
                console.log('Initializing provider...');
                await this.initProvider();
            }

            // Remove 0x prefix if present and validate
            const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
            console.log('Private key length:', cleanPrivateKey.length);

            // Validate private key length
            if (cleanPrivateKey.length !== 64) {
                throw new Error(`Invalid private key length: ${cleanPrivateKey.length}. Expected 64 characters.`);
            }

            // Validate private key format (hex)
            if (!/^[0-9a-fA-F]+$/.test(cleanPrivateKey)) {
                throw new Error('Invalid private key format. Must be hexadecimal.');
            }

            console.log('Creating wallet signer...');
            this.signer = new ethers.Wallet('0x' + cleanPrivateKey, this.provider);
            this.walletAddress = this.signer.address;
            this.isConnected = true;

            console.log('===== WALLET CONNECTION SUCCESS =====');
            console.log('Wallet address:', this.walletAddress);
            console.log('Network config:', this.networkConfig);
            console.log('Provider:', this.provider);
            console.log('=====================================');

            // Test the connection by getting balance
            try {
                console.log('===== FETCHING BALANCE =====');
                const balance = await this.getBalance();
                console.log('Final balance result:', balance, 'POL');
                console.log('============================');
            } catch (balanceError) {
                console.error('===== BALANCE FETCH ERROR =====');
                console.error('Error message:', balanceError.message);
                console.error('Full error:', balanceError);
                console.error('===============================');
            }

            return {
                success: true,
                address: this.walletAddress
            };

        } catch (error) {
            console.error('Private key connection failed:', error);
            return {
                success: false,
                error: error.message || 'Invalid private key'
            };
        }
    }

    // Get wallet balance (native MATIC/POL)
    async getBalance() {
        try {
            if (!this.provider || !this.walletAddress) {
                throw new Error('Wallet not connected');
            }

            console.log('Fetching balance for address:', this.walletAddress);
            console.log('Using RPC:', this.networkConfig.rpcUrl);
            console.log('Expected chain ID:', this.networkConfig.chainId);

            // First verify network connection
            const network = await this.provider.getNetwork();
            console.log('Connected to network:', network.name, 'Chain ID:', network.chainId);
            console.log('Network details:', network);

            // Get the balance
            console.log('Calling getBalance...');
            const balance = await this.provider.getBalance(this.walletAddress);
            console.log('Raw balance received:', balance);
            console.log('Balance type:', typeof balance);
            console.log('Balance toString:', balance.toString());

            const balanceInMatic = ethers.formatEther(balance);
            console.log('Formatted balance:', balanceInMatic);
            console.log('Balance as number:', parseFloat(balanceInMatic));

            // Additional checks
            console.log('Is balance zero?', balance.toString() === '0');
            console.log('Is balance greater than zero?', balance > 0n);

            return parseFloat(balanceInMatic);

        } catch (error) {
            console.error('Failed to get balance:', error);
            console.error('Error details:', {
                code: error.code,
                reason: error.reason,
                message: error.message
            });
            throw new Error(`Failed to fetch balance: ${error.message}`);
        }
    }

    // Get credited balance from Supabase
    async getCreditedBalance() {
        try {
            if (!this.walletAddress) {
                return 0;
            }

            const { data, error } = await this.supabase
                .from('wallet_recharges')
                .select('credited_amount')
                .eq('user_address', this.walletAddress.toLowerCase());

            if (error) {
                console.error('Supabase error:', error);
                return 0;
            }

            const totalCredited = data.reduce((sum, record) => sum + parseFloat(record.credited_amount || 0), 0);
            console.log('Total credited balance:', totalCredited, 'MATIC');

            return totalCredited;

        } catch (error) {
            console.error('Failed to get credited balance:', error);
            return 0;
        }
    }

    // Send recharge transaction
    async sendRechargeTransaction(amountInMatic) {
        try {
            if (!this.signer || !this.receivingAddress) {
                throw new Error('Wallet not connected or receiving address not configured');
            }

            const amount = parseFloat(amountInMatic);
            if (amount <= 0) {
                throw new Error('Amount must be greater than 0');
            }

            // Format amount to avoid scientific notation
            const formattedAmount = amount.toFixed(18); // Use 18 decimal places to avoid scientific notation
            console.log('Original amount:', amount);
            console.log('Formatted amount:', formattedAmount);

            // Check balance
            const balance = await this.getBalance();
            if (balance < amount) {
                throw new Error('Insufficient balance');
            }

            // Estimate gas
            const gasEstimate = await this.provider.estimateGas({
                to: this.receivingAddress,
                value: ethers.parseEther(formattedAmount)
            });

            const gasPrice = await this.provider.getFeeData();
            const gasCost = gasEstimate * gasPrice.gasPrice;
            const gasCostInMatic = parseFloat(ethers.formatEther(gasCost));

            console.log('Gas estimate:', ethers.formatEther(gasEstimate), 'MATIC');
            console.log('Gas cost:', gasCostInMatic, 'MATIC');

            if (balance < (amount + gasCostInMatic)) {
                throw new Error('Insufficient balance for amount + gas fees');
            }

            // Send transaction
            const tx = await this.signer.sendTransaction({
                to: this.receivingAddress,
                value: ethers.parseEther(formattedAmount),
                gasLimit: gasEstimate,
                gasPrice: gasPrice.gasPrice
            });

            console.log('Transaction sent:', tx.hash);
            return {
                success: true,
                txHash: tx.hash,
                amount: amount
            };

        } catch (error) {
            console.error('Transaction failed:', error);

            // Handle specific error types
            if (error.message.includes('insufficient funds')) {
                throw new Error('Insufficient funds for gas fees');
            } else if (error.message.includes('network')) {
                throw new Error('Network congested, please try again');
            } else {
                throw new Error(error.message || 'Transaction failed');
            }
        }
    }

    // Wait for transaction confirmation
    async waitForTransaction(txHash) {
        try {
            if (!this.provider) {
                throw new Error('Provider not initialized');
            }

            console.log('Waiting for transaction confirmation:', txHash);

            const receipt = await this.provider.waitForTransaction(txHash, 1); // Wait for 1 confirmation
            console.log('Transaction confirmed:', receipt);

            // Get actual transaction details
            const tx = await this.provider.getTransaction(txHash);
            const amountSent = ethers.formatEther(tx.value);

            console.log('Amount confirmed:', amountSent, 'MATIC');

            return {
                success: true,
                receipt: receipt,
                amount: parseFloat(amountSent),
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString()
            };

        } catch (error) {
            console.error('Transaction confirmation failed:', error);
            throw new Error('Transaction confirmation failed');
        }
    }

    // Store transaction in Supabase
    async storeRecharge(txHash, amount) {
        try {
            if (!this.walletAddress) {
                throw new Error('Wallet not connected');
            }

            const { data, error } = await this.supabase
                .from('wallet_recharges')
                .insert([{
                    user_address: this.walletAddress.toLowerCase(),
                    credited_amount: amount,
                    tx_hash: txHash,
                    network: 'polygon-amoy',
                    created_at: new Date().toISOString()
                }])
                .select();

            if (error) {
                console.error('Supabase insert error:', error);
                throw new Error('Failed to store transaction record');
            }

            console.log('Transaction stored in Supabase:', data);
            return data[0];

        } catch (error) {
            console.error('Failed to store recharge:', error);
            throw error;
        }
    }

    // Complete recharge flow
    async completeRecharge(amountInMatic) {
        try {
            // Step 1: Send transaction
            const txResult = await this.sendRechargeTransaction(amountInMatic);

            if (!txResult.success) {
                throw new Error('Transaction failed');
            }

            // Step 2: Wait for confirmation
            const confirmation = await this.waitForTransaction(txResult.txHash);

            if (!confirmation.success) {
                throw new Error('Transaction confirmation failed');
            }

            // Step 3: Store in Supabase
            await this.storeRecharge(txResult.txHash, confirmation.amount);

            return {
                success: true,
                txHash: txResult.txHash,
                amount: confirmation.amount,
                blockNumber: confirmation.blockNumber
            };

        } catch (error) {
            console.error('Complete recharge failed:', error);
            throw error;
        }
    }

    // Disconnect wallet
    disconnect() {
        this.signer = null;
        this.walletAddress = null;
        this.isConnected = false;
        console.log('Wallet disconnected');
    }

    // Get connection status
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            address: this.walletAddress,
            network: this.networkConfig.name
        };
    }
}

module.exports = WalletManager;