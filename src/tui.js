// src/tui.js
/**
 * @file Manages the Terminal User Interface (TUI) using the blessed library.
 * v3: Enhanced focus indication for scrollable panes.
 */

const blessed = require('blessed');
const logger = require('./bot_logger'); // Import the central logger/emitter
const {
    TUI_TITLE,
    TUI_MAIN_LOG_LABEL,
    TUI_SUCCESS_LOG_LABEL,
    TUI_STATUS_LABEL
} = require('./config');

class TerminalUI {
    constructor() {
        this.screen = blessed.screen({
            smartCSR: true,
            title: TUI_TITLE,
            fullUnicode: true,
            // dump: __dirname + '/logs/tui.log',
            // forceUnicode: true,
        });

        this.scrollablePanes = [];
        this.currentFocusIndex = 0;

        this.initComponents();
        this.attachHandlers();

        if (this.scrollablePanes.length > 0) {
            this.scrollablePanes[0].focus(); // Set initial focus
        }
        this.render();
    }

    /**
     * Creates and lays out the TUI components (boxes).
     */
    initComponents() {
        const bannerHeight = 3;
        const mainLogWidth = '65%';
        const sidePanelWidth = '35%';
        const sidePanelLeft = mainLogWidth;

        // Box 1: Top Banner (No changes needed here)
        this.bannerBox = blessed.box({
            parent: this.screen,
            top: 0, left: 0, width: '100%', height: bannerHeight,
            content: `{center}${TUI_TITLE}{/center}`,
            tags: true, border: { type: 'line' },
            style: { fg: 'white', bg: 'blue', border: { fg: '#ffffff' } },
        });

        // --- Define common focus style ---
        const focusStyle = {
             border: { fg: 'yellow' } // Bright yellow border when focused
        };

        // Box 2: Main Log Area (Left)
        this.mainLogBox = blessed.log({
            parent: this.screen,
            label: TUI_MAIN_LOG_LABEL,
            tags: true,
            top: bannerHeight, left: 0, width: mainLogWidth, height: `100%-${bannerHeight}`,
            border: { type: 'line' },
            style: {
                fg: 'white', bg: 'black',
                border: { fg: '#ffffff' }, // Default border
                label: { fg: 'cyan', bold: true },
                scrollbar: { bg: 'cyan', fg: 'black' },
                focus: focusStyle // Apply focus style
            },
            scrollable: true, alwaysScroll: true,
            scrollbar: { ch: ' ', track: { bg: 'cyan' }, style: { inverse: true } },
            mouse: true, keys: true, vi: true,
        });
        this.scrollablePanes.push(this.mainLogBox);

        // Box 3: Success Log Area (Top Right)
        this.successLogBox = blessed.log({
            parent: this.screen,
            label: TUI_SUCCESS_LOG_LABEL,
            tags: true,
            top: bannerHeight, left: sidePanelLeft, width: sidePanelWidth, height: '50%',
            border: { type: 'line' },
            style: {
                fg: 'white', bg: 'black',
                border: { fg: '#ffffff' }, // Default border
                label: { fg: 'green', bold: true },
                scrollbar: { bg: 'green', fg: 'black' },
                focus: focusStyle // Apply focus style
            },
            scrollable: true, alwaysScroll: true,
            scrollbar: { ch: ' ', track: { bg: 'green' }, style: { inverse: true } },
            mouse: true, keys: true, vi: true,
        });
        this.scrollablePanes.push(this.successLogBox);

        // Box 4: Status / Info Area (Bottom Right)
        this.statusBox = blessed.log({
            parent: this.screen,
            label: TUI_STATUS_LABEL,
            content: '', // Set later
            tags: true,
            top: '50%+1', left: sidePanelLeft, width: sidePanelWidth, height: `100%-${bannerHeight}-50%-1`,
            border: { type: 'line' },
            style: {
                fg: 'white', bg: 'black',
                border: { fg: '#ffffff' }, // Default border
                label: { fg: 'yellow', bold: true },
                scrollbar: { bg: 'yellow', fg: 'black' },
                focus: focusStyle // Apply focus style
            },
            scrollable: true,
            scrollbar: { ch: ' ', track: { bg: 'yellow' }, style: { inverse: true } },
            mouse: true, keys: true, vi: true,
        });
        this.scrollablePanes.push(this.statusBox);

        // --- Initial Status Setup ---
        this.currentStatus = {
             loadedWallet: 'N/A', walletIndex: 0, totalWallets: 0,
             activeBots: 0, overallStatus: 'Initializing...'
        };
        this.statusBox.setContent(this.formatStatusContent(this.currentStatus));
    }

    /**
     * Attaches event handlers for logger events and screen interactions.
     */
    attachHandlers() {
        // Listen for log events from the central logger
        logger.on('log', (logEntry) => {
            this.addLog(logEntry);
        });

        // Listen for status update events from the central logger
        logger.on('statusUpdate', (statusData) => {
             this.updateStatus(statusData);
        });

        // Handle screen resize events
        this.screen.on('resize', () => {
            this.screen.render();
        });

        // --- Input Handling ---

        // Handle Ctrl+C for clean exit
        this.screen.key(['C-c'], (ch, key) => {
            logger.warn('Ctrl+C detected. Exiting application...');
            this.destroy();
            process.exit(0);
        });

        // Handle Tab key for focus cycling forward
        this.screen.key(['tab'], (ch, key) => {
            this.currentFocusIndex = (this.currentFocusIndex + 1) % this.scrollablePanes.length;
            this.scrollablePanes[this.currentFocusIndex].focus();
            this.screen.render(); // Re-render to show focus change
        });

         // Handle Shift+Tab key for reverse focus cycling
        this.screen.key(['S-tab'], (ch, key) => {
             this.currentFocusIndex = (this.currentFocusIndex - 1 + this.scrollablePanes.length) % this.scrollablePanes.length;
             this.scrollablePanes[this.currentFocusIndex].focus();
             this.screen.render(); // Re-render to show focus change
        });

        // Enable mouse event handling
        this.screen.enableMouse();
    }

    /**
     * Formats a log entry for display in the TUI.
     * @param {object} logEntry - The log object from BotLogger.
     * @returns {string} Formatted log string with timestamp, icon, and message.
     */
    formatLogMessage(logEntry) {
        const timestamp = logEntry.timestamp.toLocaleTimeString();
        let color = 'white';

        switch (logEntry.level) {
            case 'SUCCESS': color = 'green'; break;
            case 'ERROR': color = 'red'; break;
            case 'WARN': color = 'yellow'; break;
            case 'WAIT': color = 'blue'; break;
            case 'INFO': color = 'cyan'; break;
            case 'WALLET': color = 'magenta'; break;
            case 'DEBUG': color = 'gray'; break;
        }
        const cleanMessage = blessed.helpers.escape(logEntry.message);
        return `[${timestamp}] ${logEntry.icon} {${color}-fg}${cleanMessage}{/${color}-fg}`;
    }

    /**
     * Adds a log entry to the appropriate log box.
     * @param {object} logEntry - The log object from BotLogger.
     */
    addLog(logEntry) {
        const formattedMessage = this.formatLogMessage(logEntry);

        if (logEntry.level !== 'DEBUG' || process.env.NODE_ENV !== 'production') {
             this.mainLogBox.log(formattedMessage);
        }

        if (logEntry.level === 'SUCCESS') {
            this.successLogBox.log(formattedMessage);
        }
        // screen.render() often not needed here for blessed.log
    }

    /**
     * Formats the content for the status box.
     * @param {object} statusData - The current status data.
     * @returns {string} Formatted string for the status box content.
     */
    formatStatusContent(statusData) {
         const walletInfo = statusData.totalWallets > 0
            ? `Wallet ${statusData.walletIndex || '-'}/${statusData.totalWallets || '-'}: ${statusData.loadedWallet || 'N/A'}`
            : `Wallet: ${statusData.loadedWallet || 'N/A'}`;

        // Instructions emphasize the focus border
        return ` Status: {bold}${statusData.overallStatus || 'N/A'}{/bold}
 ${walletInfo}
 Active Bots: ${statusData.activeBots ?? 'N/A'}
---------------------------------
 {bold}Controls:{/bold}
   - {yellow-fg}Ctrl+C{/yellow-fg}: Exit
   - {yellow-fg}Tab{/yellow-fg}: Cycle Focus Pane
     ({yellow-fg}Yellow Border{/yellow-fg} = Active)
   - {yellow-fg}Scroll{/yellow-fg}: Mouse Wheel / ↑↓ / PgUp/PgDn
     (in focused pane)
        `;
    }

     /**
     * Updates the status box content.
     * @param {object} statusUpdateData - New status data fields to update.
     */
    updateStatus(statusUpdateData) {
         this.currentStatus = { ...this.currentStatus, ...statusUpdateData };
         const formattedContent = this.formatStatusContent(this.currentStatus);
         this.statusBox.setContent(formattedContent);
         this.screen.render(); // Re-render screen for status updates
    }


    /**
     * Renders the TUI screen.
     */
    render() {
        if (this.screen) {
            this.screen.render();
        }
    }

    /**
     * Destroys the TUI screen (useful for cleanup).
     */
    destroy() {
        logger.info("Destroying TUI screen...");
        if (this.screen) {
            this.screen.destroy();
            this.screen = null;
        }
    }
}

module.exports = TerminalUI;
