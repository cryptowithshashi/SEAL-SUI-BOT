// src/bot_logger.js
/**
 * @file Logger module that uses EventEmitter to decouple logging from TUI updates.
 */

const { EventEmitter } = require('events');

// Log levels and their corresponding icons/prefixes
const LOG_LEVELS = {
    INFO: 'INFO',
    SUCCESS: 'SUCCESS',
    WARN: 'WARN',
    ERROR: 'ERROR',
    WAIT: 'WAIT', // Added for waiting states
    DEBUG: 'DEBUG', // Added for detailed debugging
    STATUS: 'STATUS', // For status updates
    WALLET: 'WALLET', // For wallet-specific info
};

const LOG_ICONS = {
    INFO: 'ℹ️',
    SUCCESS: '✅',
    WARN: '⚠️',
    ERROR: '🚨', // Changed icon for error
    WAIT: '⌛️',
    DEBUG: '🐞',
    WALLET: '💼', // Changed icon for wallet
};

class BotLogger extends EventEmitter {
    constructor() {
        super();
        this.logHistory = []; // Optional: Keep a history if needed
        this.maxHistory = 1000; // Limit history size
    }

    /**
     * Emits a log event.
     * @param {string} level - The log level (e.g., INFO, ERROR).
     * @param {string} message - The log message.
     * @param {object} [metadata={}] - Optional additional data.
     */
    log(level, message, metadata = {}) {
        const timestamp = new Date();
        const logEntry = {
            level: level.toUpperCase(),
            message,
            timestamp,
            icon: LOG_ICONS[level.toUpperCase()] || '➡️', // Default icon
            metadata,
        };

        // Store in history (optional)
        this.logHistory.push(logEntry);
        if (this.logHistory.length > this.maxHistory) {
            this.logHistory.shift(); // Remove oldest entry
        }

        // Emit the event for listeners (like the TUI)
        this.emit('log', logEntry);
    }

    // --- Convenience methods for different log levels ---

    info(message, metadata) {
        this.log(LOG_LEVELS.INFO, message, metadata);
    }

    success(message, metadata) {
        this.log(LOG_LEVELS.SUCCESS, message, metadata);
    }

    warn(message, metadata) {
        this.log(LOG_LEVELS.WARN, message, metadata);
    }

    error(message, error, metadata = {}) {
        // Include error details if provided
        let logMessage = message;
        if (error instanceof Error) {
            logMessage += ` | Error: ${error.message}`;
            // Optionally add stack trace for debug level
            // metadata.stack = error.stack;
        } else if (typeof error === 'string') {
            logMessage += ` | Details: ${error}`;
        }
        this.log(LOG_LEVELS.ERROR, logMessage, metadata);
    }

    wait(message, metadata) {
        this.log(LOG_LEVELS.WAIT, message, metadata);
    }

    debug(message, metadata) {
        // Debug logs might be filtered out in production
        if (process.env.NODE_ENV !== 'production') {
            this.log(LOG_LEVELS.DEBUG, message, metadata);
        }
    }

    // --- Specific event emitters for status updates ---

    /**
     * Emits an event specifically for updating the status panel.
     * @param {object} statusData - Data to display in the status panel.
     * Example: { loadedWallet: 'MzE4...aBc9', activeBots: 5, overallStatus: 'Running' }
     */
    updateStatus(statusData) {
        this.emit('statusUpdate', statusData);
        // Optionally log the status update as INFO as well
        // this.info(`Status Updated: ${JSON.stringify(statusData)}`);
    }

     /**
     * Emits an event when a wallet is loaded.
     * @param {string} address - The Sui address of the loaded wallet.
     * @param {string} maskedAddress - A masked version of the address for display.
     * @param {number} walletIndex - The index of the wallet (e.g., 1, 2, ...).
     * @param {number} totalWallets - The total number of wallets loaded.
     */
    walletLoaded(address, maskedAddress, walletIndex, totalWallets) {
        const message = `Wallet ${walletIndex}/${totalWallets} loaded: ${maskedAddress}`;
        this.log(LOG_LEVELS.WALLET, message, { address, maskedAddress, walletIndex, totalWallets });
        // Also trigger a status update
        this.updateStatus({ loadedWallet: maskedAddress, walletIndex, totalWallets });
    }

    /**
     * Emits an event to update the count of active bots/channels.
     * @param {number} count - The number of active bots/channels.
     */
    updateActiveBots(count) {
         this.updateStatus({ activeBots: count });
         this.info(`Active bots/channels updated: ${count}`);
    }

     /**
     * Emits an event to update the overall status message.
     * @param {string} statusMessage - The overall status (e.g., "Running", "Idle", "Error").
     */
    updateOverallStatus(statusMessage) {
        this.updateStatus({ overallStatus: statusMessage });
        this.info(`Overall status changed: ${statusMessage}`);
    }
}

// Export a single instance to be used throughout the application
module.exports = new BotLogger();
