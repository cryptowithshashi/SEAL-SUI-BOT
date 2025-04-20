// src/tui.js
/**
 * @file Manages the Terminal User Interface (TUI) using the blessed library.
 * v4: Refined layout using a container for the right panel for better alignment.
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
            autoPadding: true, // Automatically handle padding for borders etc.
            // dump: __dirname + '/logs/tui.log', // Uncomment for debugging layout
            // forceUnicode: true,
        });

        this.scrollablePanes = [];
        this.currentFocusIndex = 0;

        this.initComponents();
        this.attachHandlers();

        if (this.scrollablePanes.length > 0) {
            this.scrollablePanes[0].focus(); // Set initial focus
            this.setFocusStyle(this.scrollablePanes[0], true); // Apply initial focus style
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
        const rightPanelWidth = `100% - ${mainLogWidth}`; // Calculate remaining width

        // --- Define common styles ---
        const boxStyle = {
            fg: 'white',
            bg: 'black',
            border: { fg: '#ffffff' }, // Default border color (white)
            label: { bold: true }
        };
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
            content: `{center}${TUI_TITLE}{/center}`,
            tags: true,
            border: { type: 'line' },
            style: { ...boxStyle, bg: 'blue', border: { fg: '#ffffff' } }, // Override background for banner
        });

        // Box 2: Main Log Area (Left)
        this.mainLogBox = blessed.log({
            parent: this.screen,
            label: ` ${TUI_MAIN_LOG_LABEL} `, // Add spaces for padding
            tags: true,
            top: bannerHeight,
            left: 0,
            width: mainLogWidth,
            height: `100% - ${bannerHeight}`, // Fill remaining height
            border: { type: 'line' },
            style: {
                ...boxStyle, // Base style
                label: { ...boxStyle.label, fg: 'cyan' },
                scrollbar: { bg: 'cyan', fg: 'black' },
            },
            focus: focusStyle, // Style applied by blessed on focus
            scrollable: true,
            alwaysScroll: true,
            scrollbar: { ch: ' ', track: { bg: 'cyan' }, style: { inverse: true } },
            mouse: true,
            keys: true,
            vi: true,
        });
        this.scrollablePanes.push(this.mainLogBox);

        // Container for the Right Panel (Success Log + Status)
        this.rightPanelContainer = blessed.box({
            parent: this.screen,
            top: bannerHeight,
            left: rightPanelLeft,
            width: rightPanelWidth,
            height: `100% - ${bannerHeight}`,
            // No border for the container itself, elements inside will have borders
            style: { bg: 'black' } // Match background
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
            border: { type: 'line' },
            style: {
                ...boxStyle,
                label: { ...boxStyle.label, fg: 'green' },
                scrollbar: { bg: 'green', fg: 'black' },
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
        this.statusBox = blessed.log({ // Using log for consistency and scrollability if needed
            parent: this.rightPanelContainer, // Attach to the container
            label: ` ${TUI_STATUS_LABEL} `, // Add spaces for padding
            content: '', // Set later
            tags: true,
            top: successLogHeight, // Position below the success log
            left: 0, // Position at the left of the container
            width: '100%', // Fill container width
            height: `100% - ${successLogHeight}`, // Fill remaining container height
            border: { type: 'line' },
            style: {
                ...boxStyle,
                label: { ...boxStyle.label, fg: 'yellow' },
                scrollbar: { bg: 'yellow', fg: 'black' },
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
     * Sets the visual style for focus state.
     * Blessed handles focus style internally, but this can be used for explicit control if needed.
     * @param {blessed.Widgets.BlessedElement} element - The element to style.
     * @param {boolean} isFocused - Whether the element is focused.
     */
    setFocusStyle(element, isFocused) {
        if (!element || !element.style) return;

        const baseBorderColor = '#ffffff'; // Default border color
        const focusBorderColor = 'yellow'; // Focus border color

        element.style.border = element.style.border || {}; // Ensure border style object exists
        element.style.border.fg = isFocused ? focusBorderColor : baseBorderColor;

        // Optional: Make label bold on focus?
        // element.style.label = element.style.label || {};
        // element.style.label.bold = isFocused;
    }

    /**
     * Attaches event handlers for logger events and screen interactions.
     */
    attachHandlers() {
        // Listen for log events from the central logger
        logger.on('log', (logEntry) => {
            this.addLog(logEntry);
            this.render(); // Render after adding log to ensure update
        });

        // Listen for status update events from the central logger
        logger.on('statusUpdate', (statusData) => {
             this.updateStatus(statusData);
             // updateStatus already calls render
        });

        // Handle screen resize events
        this.screen.on('resize', () => {
            // Blessed elements with percentage dimensions should resize automatically.
            // Re-rendering ensures everything is drawn correctly.
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
            // Remove focus style from current element before switching
            // this.setFocusStyle(this.scrollablePanes[this.currentFocusIndex], false);

            this.currentFocusIndex = (this.currentFocusIndex + 1) % this.scrollablePanes.length;
            this.scrollablePanes[this.currentFocusIndex].focus(); // Blessed handles applying focus style

            // Apply focus style to the new element
            // this.setFocusStyle(this.scrollablePanes[this.currentFocusIndex], true);

            this.screen.render(); // Re-render to show focus change
        });

         // Handle Shift+Tab key for reverse focus cycling
        this.screen.key(['S-tab'], (ch, key) => {
             // this.setFocusStyle(this.scrollablePanes[this.currentFocusIndex], false);

             this.currentFocusIndex = (this.currentFocusIndex - 1 + this.scrollablePanes.length) % this.scrollablePanes.length;
             this.scrollablePanes[this.currentFocusIndex].focus();

             // this.setFocusStyle(this.scrollablePanes[this.currentFocusIndex], true);

             this.screen.render(); // Re-render to show focus change
        });

        // Enable mouse event handling (allows clicking to focus, scrolling)
        this.screen.enableMouse();
    }

    /**
     * Formats a log entry for display in the TUI.
     * @param {object} logEntry - The log object from BotLogger.
     * @returns {string} Formatted log string with timestamp, icon, and message.
     */
    formatLogMessage(logEntry) {
        const timestamp = logEntry.timestamp.toLocaleTimeString();
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
        // Escape potentially problematic characters for blessed tags
        const cleanMessage = blessed.helpers.escape(logEntry.message);
        return `[${timestamp}] ${logEntry.icon} {${color}-fg}${cleanMessage}{/${color}-fg}`;
    }

    /**
     * Adds a log entry to the appropriate log box.
     * @param {object} logEntry - The log object from BotLogger.
     */
    addLog(logEntry) {
        const formattedMessage = this.formatLogMessage(logEntry);

        // Log everything except DEBUG (unless not in production) to main log
        if (logEntry.level !== 'DEBUG' || process.env.NODE_ENV !== 'production') {
             this.mainLogBox.log(formattedMessage);
        }

        // Log SUCCESS messages also to the success log
        if (logEntry.level === 'SUCCESS') {
            this.successLogBox.log(formattedMessage);
        }
        // Note: Calling screen.render() after every log can be CPU intensive.
        // It's often better to render less frequently, e.g., on status updates or key presses.
        // However, blessed.log might handle its own rendering efficiently. Added render in handler for now.
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

         // Instructions emphasize the focus border color
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
       `; // Removed extra trailing spaces/newlines
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
     * Renders the TUI screen. Debounce or throttle if called too frequently.
     */
    render() {
        if (this.screen) {
            // Basic check to prevent rendering if already destroyed
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
            this.screen = null; // Allow garbage collection
        }
    }
}

module.exports = TerminalUI;
