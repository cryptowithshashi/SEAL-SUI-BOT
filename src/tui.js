// src/tui.js
/**
 * @file Manages the Terminal User Interface (TUI) using the blessed library.
 * v6: Removed explicit padding from bannerBox, relying on {center} tag.
 * v7: Replaced nullish coalescing operator '??' for wider Node.js compatibility.
 */

const blessed = require('blessed');
const logger = require('./bot_logger'); // Import the central logger/emitter
const {
    TUI_TITLE,
    TUI_MAIN_LOG_LABEL,
    TUI_SUCCESS_LOG_LABEL,
    TUI_STATUS_LABEL
} = require('./config'); // Assuming config.js exports these constants

class TerminalUI {
    constructor() {
        this.screen = blessed.screen({
            smartCSR: true,
            title: TUI_TITLE,
            fullUnicode: true,
            autoPadding: true, // Keep autoPadding for overall layout consistency
            // dump: __dirname + '/logs/tui.log', // Uncomment for debugging layout
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
     * Uses a container for the right panel to simplify positioning.
     */
    initComponents() {
        const bannerHeight = 3; // Height of the top title banner
        const mainLogWidth = '65%'; // Width percentage for the main log panel
        const rightPanelLeft = mainLogWidth; // Starting position for the right panel
        const rightPanelWidth = `100%-${mainLogWidth}`; // Calculate remaining width

        // --- Define common styles ---
        const boxStyle = {
            fg: 'white',
            bg: 'black',
            border: { type: 'line', fg: '#ffffff' }, // Consistent border type and color
            label: { bold: true }
        };
        // Define the focus style directly in the element options using the 'focus' property
        const focusStyle = {
            border: { fg: 'yellow' } // Focus border color (yellow)
        };

        // Box 1: Top Banner
        this.bannerBox = blessed.box({
            parent: this.screen,
            top: 0,
            left: 0,
            width: '100%',
            height: bannerHeight,
            content: `{center}${TUI_TITLE}{/center}`, // Centered title text
            tags: true,
            border: { type: 'line' }, // Consistent border type
            style: {
                ...boxStyle, // Base style
                bg: 'blue', // Banner background
                border: { fg: '#ffffff' } // Banner border
            },
        });

        // Box 2: Main Log Area (Left)
        this.mainLogBox = blessed.log({
            parent: this.screen,
            label: ` ${TUI_MAIN_LOG_LABEL} `, // Add spaces for padding around label
            tags: true,
            top: bannerHeight, // Position below banner
            left: 0,
            width: mainLogWidth,
            height: `100%-${bannerHeight}`, // Fill remaining height
            border: { type: 'line' }, // Consistent border type
            style: {
                ...boxStyle, // Base style
                label: { ...boxStyle.label, fg: 'cyan' }, // Label color
                scrollbar: { bg: 'cyan', fg: 'black' }, // Scrollbar style
            },
            focus: focusStyle, // Style applied by blessed on focus
            scrollable: true,
            alwaysScroll: true,
            scrollbar: { ch: ' ', track: { bg: 'cyan' }, style: { inverse: true } },
            mouse: true,
            keys: true,
            vi: true, // Enable vi-like keys for scrolling (j, k)
        });
        this.scrollablePanes.push(this.mainLogBox);

        // Container for the Right Panel (Success Log + Status)
        this.rightPanelContainer = blessed.box({
            parent: this.screen,
            top: bannerHeight,
            left: rightPanelLeft,
            width: rightPanelWidth,
            height: `100%-${bannerHeight}`,
            style: { bg: 'black' } // Match background, avoids visual glitches
        });

        // Box 3: Success Log Area (Top Right, inside container)
        const successLogHeight = '60%'; // Percentage height within the right container
        this.successLogBox = blessed.log({
            parent: this.rightPanelContainer, // Attach to the container
            label: ` ${TUI_SUCCESS_LOG_LABEL} `, // Add spaces for padding
            tags: true,
            top: 0, // Position at the top of the container
            left: 0, // Position at the left of the container
            width: '100%', // Fill container width
            height: successLogHeight,
            border: { type: 'line' }, // Consistent border type
            style: {
                ...boxStyle,
                label: { ...boxStyle.label, fg: 'green' }, // Label color
                scrollbar: { bg: 'green', fg: 'black' }, // Scrollbar style
            },
            focus: focusStyle,
            scrollable: true,
            alwaysScroll: true,
            scrollbar: { ch: ' ', track: { bg: 'green' }, style: { inverse: true } },
            mouse: true,
            keys: true,
            vi: true,
        });
        this.scrollablePanes.push(this.successLogBox);

        // Box 4: Status / Info Area (Bottom Right, inside container)
        this.statusBox = blessed.log({ // Using log for consistency and potential scrollability
            parent: this.rightPanelContainer, // Attach to the container
            label: ` ${TUI_STATUS_LABEL} `, // Add spaces for padding
            content: '', // Initial content set below
            tags: true,
            top: successLogHeight, // Position below the success log
            left: 0, // Position at the left of the container
            width: '100%', // Fill container width
            height: `100%-${successLogHeight}`, // Fill remaining container height
            border: { type: 'line' }, // Consistent border type
            style: {
                ...boxStyle,
                label: { ...boxStyle.label, fg: 'yellow' }, // Label color
                scrollbar: { bg: 'yellow', fg: 'black' }, // Scrollbar style
            },
            focus: focusStyle,
            scrollable: true, // Keep scrollable in case content overflows
            scrollbar: { ch: ' ', track: { bg: 'yellow' }, style: { inverse: true } },
            mouse: true,
            keys: true,
            vi: true,
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
            // Re-render the screen when the terminal size changes
            this.screen.render();
        });

        // --- Input Handling ---

        // Handle Ctrl+C for clean exit
        this.screen.key(['C-c'], (ch, key) => {
            logger.warn('Ctrl+C detected. Exiting application...');
            this.destroy(); // Clean up the blessed screen
            process.exit(0); // Exit the Node.js process
        });

        // Handle Tab key for focus cycling forward
        this.screen.key(['tab'], (ch, key) => {
            this.screen.focusNext(); // Move focus to the next focusable element
            this.screen.render(); // Re-render to show focus change
        });

         // Handle Shift+Tab key for reverse focus cycling
        this.screen.key(['S-tab'], (ch, key) => {
            this.screen.focusPrevious(); // Move focus to the previous focusable element
            this.screen.render(); // Re-render to show focus change
        });

        // Enable mouse event handling (e.g., clicking to focus, scrolling)
        this.screen.enableMouse();

        // Update currentFocusIndex when focus changes (optional, for internal tracking)
        this.screen.on('element focus', (el) => {
            const newIndex = this.scrollablePanes.indexOf(el);
            if (newIndex !== -1) {
                this.currentFocusIndex = newIndex;
            }
        });
    }

    /**
     * Formats a log entry for display in the TUI.
     * @param {object} logEntry - The log object from BotLogger.
     * @returns {string} Formatted log string with timestamp, icon, and message.
     */
    formatLogMessage(logEntry) {
        // Ensure timestamp is valid Date object before formatting
        const timestamp = (logEntry.timestamp instanceof Date)
            ? logEntry.timestamp.toLocaleTimeString()
            : new Date().toLocaleTimeString(); // Fallback to current time if timestamp is missing/invalid

        // Determine color based on log level
        let color = 'white'; // Default color
        switch (logEntry.level) {
            case 'SUCCESS': color = 'green'; break;
            case 'ERROR': color = 'red'; break;
            case 'WARN': color = 'yellow'; break;
            case 'WAIT': color = 'blue'; break;
            case 'INFO': color = 'cyan'; break;
            case 'WALLET': color = 'magenta'; break;
            case 'DEBUG': color = 'gray'; break;
        }

        // *** FIX: Replaced '??' with '||' for broader Node.js compatibility ***
        // Use logical OR (||) as a fallback for empty/null/undefined messages.
        // blessed.helpers.escape handles blessed tags within the message.
        const cleanMessage = blessed.helpers.escape(logEntry.message || '');

        // Get icon or use a default '?'
        const icon = logEntry.icon || '?';

        // Construct the final formatted string with blessed tags for color
        return `[${timestamp}] ${icon} {${color}-fg}${cleanMessage}{/${color}-fg}`;
    }

    /**
     * Adds a log entry to the appropriate log box.
     * @param {object} logEntry - The log object from BotLogger.
     */
    addLog(logEntry) {
        // Basic validation to prevent errors if logEntry is malformed
        if (!logEntry || typeof logEntry !== 'object') {
             // Log to console as TUI might be compromised if receiving bad data
             console.error("TUI received invalid log entry:", logEntry);
             return;
        }
        const formattedMessage = this.formatLogMessage(logEntry);

        // Add to main log (unless it's DEBUG and we're in production)
        if (logEntry.level !== 'DEBUG' || process.env.NODE_ENV !== 'production') {
             if (this.mainLogBox) {
                this.mainLogBox.log(formattedMessage);
             }
        }

        // Add SUCCESS messages specifically to the success log box
        if (logEntry.level === 'SUCCESS') {
             if (this.successLogBox) {
                 this.successLogBox.log(formattedMessage);
             }
        }
        // Note: No explicit render() call here; blessed handles log updates efficiently.
        // Calling render() on every log can cause performance issues.
    }

    /**
     * Formats the content for the status box.
     * @param {object} statusData - The current status data.
     * @returns {string} Formatted string for the status box content.
     */
    formatStatusContent(statusData = {}) {
         // Format wallet info string conditionally based on whether totalWallets is known
         const walletInfo = (statusData.totalWallets ?? 0) > 0
             ? `Wallet ${statusData.walletIndex ?? '-'}/${statusData.totalWallets ?? '-'}: ${statusData.loadedWallet || 'N/A'}`
             : `Wallet: ${statusData.loadedWallet || 'N/A'}`; // Simpler display if total isn't set yet

         // Construct the multi-line status string with blessed tags for bold/color
         return ` Status: {bold}${statusData.overallStatus || 'N/A'}{/bold}
 ${walletInfo}
 Active Bots: ${statusData.activeBots ?? 'N/A'}
---------------------------------
 {bold}Controls:{/bold}
    - {yellow-fg}Ctrl+C{/yellow-fg}: Exit
    - {yellow-fg}Tab{/yellow-fg}: Cycle Focus Pane
      ({yellow-fg}Yellow Border{/yellow-fg} = Active)
    - {yellow-fg}Scroll{/yellow-fg}: Mouse Wheel / ↑↓ / PgUp/PgDn
      (in focused pane)`;
    }

     /**
      * Updates the status box content.
      * @param {object} statusUpdateData - New status data fields to update.
      */
     updateStatus(statusUpdateData) {
         // Check if the status box exists and data was provided
         if (this.statusBox && statusUpdateData) {
             // Merge new data into the current status object
             this.currentStatus = { ...this.currentStatus, ...statusUpdateData };
             // Reformat the content string with the updated status
             const formattedContent = this.formatStatusContent(this.currentStatus);
             // Update the content of the blessed element
             this.statusBox.setContent(formattedContent);
             // Re-render the screen to show the updated status content
             this.render();
         }
     }


    /**
     * Renders the TUI screen. Should be called after updates that require redraw.
     */
    render() {
        if (this.screen) {
            this.screen.render();
        }
    }

    /**
     * Destroys the TUI screen (useful for cleanup on exit).
     */
    destroy() {
        logger.info("Destroying TUI screen...");
        if (this.screen) {
            this.screen.destroy(); // Release terminal resources
            this.screen = null; // Prevent further operations on destroyed screen
        }
    }
}

module.exports = TerminalUI;
