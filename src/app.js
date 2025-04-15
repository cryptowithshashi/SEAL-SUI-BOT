// app.js
/**
 * @file Main application file for the Seal Bot TUI.
 * v2.1: Corrected path require typo. Added task repetition per wallet with delay.
 * Orchestrates the TUI, wallet/proxy loading, and bot actions.
 */

// Corrected line: removed duplicate 'path ='
const path = require('path');
const readline = require('readline').createInterface({ // For initial prompts
  input: process.stdin,
  output: process.stdout,
});
const logger = require('./src/bot_logger'); // Central event emitter/logger
const TerminalUI = require('./src/tui');
const WalletManager = require('./src/wallet_manager');
const ProxyManager = require('./src/proxy_manager');
const SuiActions = require('./src/sui_actions');
const {
    DEFAULT_IMAGE_URL,
    LOCAL_IMAGE_PATH,
    TASK_REPEAT_DELAY_MS // Import the delay constant
} = require('./src/config');

// --- Helper function for async prompt ---
function askQuestion(query) {
    // Simple promise wrapper around readline.question
    return new Promise(resolve => readline.question(query, resolve));
}

// --- Main Application Class ---

class SealBotApp {
    constructor() {
        this.ui = null;
        this.walletManager = null;
        this.proxyManager = null;
        this.isRunning = false;
        this.repetitionsPerWallet = 1; // Default value for task repetitions
    }

    /**
     * Initializes managers, gets user input for repetitions, and starts the TUI.
     */
    async initialize() {
        // Initialize managers first (logging will go to console initially)
        this.proxyManager = new ProxyManager();
        this.walletManager = new WalletManager();

        // Check if wallets were loaded successfully
        if (!this.walletManager.hasWallets()) {
            console.error("Initialization failed: No wallets loaded. Please check wallets.txt.");
            readline.close(); // Ensure readline is closed before exiting
            process.exit(1); // Exit if no wallets are found
        }

        // --- Get User Input Before Starting TUI ---
        try {
            // Ask user how many times to repeat tasks for each wallet
            const repeatInput = await askQuestion(`How many times do you want to repeat the tasks per wallet? (Default: 1): `);
            const repeatNum = parseInt(repeatInput.trim(), 10); // Parse input as integer

            // Validate the input number
            if (!isNaN(repeatNum) && repeatNum > 0) {
                this.repetitionsPerWallet = repeatNum; // Use valid user input
            } else if (repeatInput.trim() !== '') {
                // Warn if input was provided but invalid, then use default
                console.warn(`Invalid input "${repeatInput}". Using default: 1 repetition.`);
                this.repetitionsPerWallet = 1;
            } else {
                 this.repetitionsPerWallet = 1; // Use default if input was empty
            }
            console.log(`Okay, will perform tasks ${this.repetitionsPerWallet} time(s) per wallet.`);

            // --- Placeholder for more pre-TUI prompts ---
            // Example: Ask for action type (allowlist/subscription)
            // const actionTypeInput = await askQuestion('Enter action type (allowlist/subscription): ');
            // Example: Ask for image source
            // const imageSourceInput = await askQuestion('Enter image URL or local path (leave blank for default): ');
            // --- End Placeholder ---

        } catch (e) {
             // Handle potential errors during user input phase
             console.error("Error getting user input:", e);
             this.repetitionsPerWallet = 1; // Fallback to default on error
        } finally {
             // IMPORTANT: Close the readline interface *after* getting all inputs
             readline.close();
        }
        // --- End User Input ---


        // Now initialize TUI - subsequent logs will appear in the UI
        this.ui = new TerminalUI();
        logger.info('Terminal UI Initialized.');

        // Re-log manager status to TUI for visibility
        logger.success(`Loaded ${this.walletManager.getWalletCount()} wallet(s).`);
        if (this.proxyManager.hasProxies()) {
             logger.success(`Loaded ${this.proxyManager.proxies.length} proxies.`);
        } else {
             logger.warn(`No proxies loaded or found.`);
        }

        // Log the repetition setting to the TUI
        logger.info(`Task repetitions per wallet set to: ${this.repetitionsPerWallet}`);
        logger.info('Application Initialized Successfully.');
        logger.updateOverallStatus('Ready'); // Update TUI status
        logger.updateActiveBots(0); // Initial active bot count
        logger.updateStatus({ totalWallets: this.walletManager.getWalletCount() }); // Update total wallet count in TUI
    }

    /**
     * Main bot processing loop. Iterates through wallets and repetitions.
     */
    async runBotLogic() {
        this.isRunning = true;
        logger.updateOverallStatus('Running'); // Update TUI status

        const wallets = this.walletManager.getWallets();
        const totalWallets = wallets.length;
        logger.updateActiveBots(totalWallets); // Update TUI with initial number of active wallets

        // --- Workflow Setup (Example - replace/expand with user choices if prompted earlier) ---
        const actionType = 'allowlist'; // Hardcoded example: 'allowlist' or 'subscription'
        const imageSource = DEFAULT_IMAGE_URL; // Hardcoded example: Use default image URL
        const additionalAddresses = []; // Hardcoded example: No additional addresses for allowlist

        // Log workflow parameters
        logger.info(`Starting ${actionType} workflow for ${totalWallets} wallet(s)...`);
        logger.info(`Using image source: ${imageSource}`);
        logger.info(`Tasks per wallet: ${this.repetitionsPerWallet} repetition(s)`);
        if (TASK_REPEAT_DELAY_MS > 0 && this.repetitionsPerWallet > 1) { // Only log delay if relevant
            logger.info(`Delay between repetitions: ${TASK_REPEAT_DELAY_MS / 1000} seconds`);
        }

        // --- Wallet Loop ---
        for (let i = 0; i < totalWallets; i++) {
            const walletKey = wallets[i];
            const walletLogPrefix = `Wallet ${i + 1}/${totalWallets}`; // For clearer logs
            logger.info(`--- Processing ${walletLogPrefix} ---`);

            let suiActions; // Declare outside try block for access in finally/catch
            try {
                // Create a new SuiActions instance for each wallet to manage its keypair/state
                suiActions = new SuiActions(walletKey, this.proxyManager);
                const address = suiActions.getAddress();
                const maskedAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;

                // Update TUI status for the currently processing wallet
                logger.walletLoaded(address, maskedAddress, i + 1, totalWallets);
                logger.updateOverallStatus(`Processing ${walletLogPrefix}`);

                // --- Repetition Loop (Inner Loop) ---
                for (let rep = 1; rep <= this.repetitionsPerWallet; rep++) {
                    const taskLogPrefix = `Task Repetition ${rep}/${this.repetitionsPerWallet}`;
                    logger.info(`Starting ${taskLogPrefix} for ${walletLogPrefix}`);
                    try {
                        // Execute the chosen action based on workflow setup
                        if (actionType === 'allowlist') {
                            await suiActions.runCompleteAllowlistWorkflow(imageSource, additionalAddresses);
                        } else if (actionType === 'subscription') {
                            await suiActions.runCompleteSubscriptionWorkflow(imageSource); // Pass amount/duration if needed
                        } else {
                             logger.error(`Unknown action type configured: ${actionType}`);
                             break; // Exit repetition loop for this wallet if action is invalid
                        }
                        logger.success(`${taskLogPrefix} completed for ${walletLogPrefix}`);

                        // --- Delay Logic ---
                        // Add delay only if it's not the last repetition and delay is configured
                        if (rep < this.repetitionsPerWallet && TASK_REPEAT_DELAY_MS > 0) {
                            logger.wait(`Waiting ${TASK_REPEAT_DELAY_MS / 1000}s before next repetition for ${walletLogPrefix}...`);
                            // Use async/await with setTimeout wrapped in a Promise for delay
                            await new Promise(resolve => setTimeout(resolve, TASK_REPEAT_DELAY_MS));
                        }
                        // --- End Delay ---

                    } catch (taskError) {
                        // Log errors specific to a task repetition
                        logger.error(`${taskLogPrefix} failed for ${walletLogPrefix}`, taskError);
                        // Optional: Decide whether to stop all repetitions for this wallet on failure
                        // break; // Uncomment to stop further repetitions for this wallet after an error
                    }
                } // --- End Repetition Loop ---

            } catch (walletError) {
                // Log errors related to wallet initialization or fatal errors for a wallet
                logger.error(`Failed to initialize or process ${walletLogPrefix}`, walletError);
                // Optional: Decide whether to continue with the next wallet or stop entirely
            } finally {
                 // Log completion for the current wallet
                 logger.info(`--- Finished Processing ${walletLogPrefix} ---`);
                 // Update the count of remaining active bots in the TUI
                 logger.updateActiveBots(totalWallets - (i + 1));
            }

            // Optional: Add a small delay between processing *different* wallets
             // if (i < totalWallets - 1) {
             //    logger.wait(`Waiting briefly before starting next wallet...`);
             //    await new Promise(resolve => setTimeout(resolve, 2000)); // e.g., 2 second delay
             // }

        } // --- End Wallet Loop ---

        logger.success('--- All Wallet Processing Finished ---');
        logger.updateOverallStatus('Completed'); // Final status update
        this.isRunning = false;
    }

    /**
     * Gracefully shuts down the application, destroying the TUI.
     */
    shutdown() {
        logger.info("Shutting down application...");
        if (this.ui) {
            this.ui.destroy(); // Clean up blessed screen resources
        }
        if (readline && !readline.closed) { // Ensure readline is closed if shutdown happens early
             readline.close();
        }
        this.isRunning = false;
        console.log("Application exited."); // Final message to console after TUI is gone
    }

    /**
     * Starts the application initialization and main logic sequence.
     */
    async start() {
        try {
            await this.initialize(); // Includes user prompts now

            // Run the main bot logic within a try...finally block
            // to ensure shutdown occurs even if runBotLogic throws an error
            try {
                 await this.runBotLogic();
            } finally {
                 // After logic completes (or fails), check if exit wasn't already triggered
                 if (!process.exitCode) {
                     logger.info("Processing complete. Press Ctrl+C to exit.");
                     // Keep the TUI alive until user manually exits (Ctrl+C is handled by TUI)
                 } else {
                     // If an exit code is already set (e.g., by an error handler), perform shutdown
                     this.shutdown();
                 }
            }

        } catch (error) {
            // Catch errors during initialization or unhandled errors from runBotLogic
            // Log error to console as TUI might not be initialized or might fail
            console.error('Unhandled error during application startup or run:', error);
            // Also log to TUI logger if available (might not show if TUI failed)
            if (logger) {
                logger.error('Unhandled error during application startup or run:', error);
            }
            this.shutdown(); // Attempt graceful shutdown
            process.exit(1); // Exit with error code
        }
    }
}

// --- Application Entry Point ---
// Ensures the code runs only when the script is executed directly
if (require.main === module) {
    const app = new SealBotApp();
    app.start(); // Start the application lifecycle

    // --- Global Error Handlers (Optional but Recommended) ---
    // Catch unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        if (logger) logger.error('Unhandled Rejection:', reason);
        // Consider exiting gracefully, but be cautious in async contexts
        // It might be safer to just log here and let the main flow handle exit
        // app.shutdown(); process.exit(1);
    });

    // Catch uncaught synchronous exceptions
    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        if (logger) logger.error('Uncaught Exception:', error);
        // Mandatory exit after uncaught exception according to Node.js best practices
        app.shutdown(); // Attempt to clean up TUI
        process.exit(1); // Exit immediately
    });
    // --- End Global Error Handlers ---
}
