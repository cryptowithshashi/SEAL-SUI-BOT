// src/wallet_manager.js
/**
 * @file Manages loading wallet keys/phrases from a file.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./bot_logger'); // Use the event-based logger
const { WALLET_FILE_PATH } = require('./config');

class WalletManager {
    constructor(walletFilePath = WALLET_FILE_PATH) {
        this.walletFilePath = path.resolve(__dirname, '..', walletFilePath); // Ensure correct path from src
        this.wallets = [];
        this.loadWallets();
    }

    /**
     * Loads wallet keys/phrases from the specified file path.
     */
    loadWallets() {
        try {
            if (fs.existsSync(this.walletFilePath)) {
                const walletData = fs.readFileSync(this.walletFilePath, 'utf8');
                this.wallets = walletData
                    .split(/[\r\n]+/) // Split by newlines (Windows/Unix)
                    .map(key => key.trim())
                    .filter(key => key && !key.startsWith('#')); // Ignore empty lines and comments

                if (this.wallets.length > 0) {
                    logger.success(`Loaded ${this.wallets.length} wallet keys/phrases from ${this.walletFilePath}`);
                } else {
                    logger.error(`No valid wallet keys/phrases found in ${this.walletFilePath}. Bot cannot operate.`);
                    // Consider throwing an error or exiting if wallets are mandatory
                }
            } else {
                logger.error(`Wallet file not found: ${this.walletFilePath}. Bot cannot operate.`);
                // Consider throwing an error or exiting
            }
        } catch (error) {
            logger.error(`Error loading wallets from ${this.walletFilePath}`, error);
            this.wallets = []; // Ensure wallets array is empty on error
        }
    }

    /**
     * Gets the loaded wallet keys/phrases.
     * @returns {string[]} An array of wallet keys/phrases.
     */
    getWallets() {
        return this.wallets;
    }

    /**
     * Checks if any wallets were loaded.
     * @returns {boolean} True if wallets are available, false otherwise.
     */
    hasWallets() {
        return this.wallets.length > 0;
    }

    /**
     * Gets the total number of loaded wallets.
     * @returns {number} The count of wallets.
     */
    getWalletCount() {
        return this.wallets.length;
    }
}

module.exports = WalletManager;
