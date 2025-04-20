// src/config.js
/**
 * @file Configuration constants for the Seal Bot TUI application.
 * v2: Added TASK_REPEAT_DELAY_MS
 * v3: Increased default delays and added MAX_BACKOFF_DELAY_MS for blob uploads
 */

require('dotenv').config();
const { getFullnodeUrl } = require('@mysten/sui.js/client');

// --- Core Protocol Configuration ---
const SEAL_PACKAGE_ID = process.env.SEAL_PACKAGE_ID || '0x4cb081457b1e098d566a277f605ba48410e26e66eaab5b3be4f6c560e9501800'; // Example ID, verify this

// --- Network Configuration ---
const SUI_RPC_URL = process.env.SUI_RPC_URL || getFullnodeUrl('testnet');

// --- Publisher Configuration ---
// Ensure these are valid and working publisher endpoints
const PUBLISHER_URLS = process.env.PUBLISHER_URLS
    ? process.env.PUBLISHER_URLS.split(',')
    : [
        'https://seal-example.vercel.app/publisher1/v1/blobs', // Example, replace if needed
        'https://seal-example.vercel.app/publisher2/v1/blobs',
        'https://seal-example.vercel.app/publisher3/v1/blobs',
        'https://seal-example.vercel.app/publisher4/v1/blobs',
        'https://seal-example.vercel.app/publisher5/v1/blobs',
        'https://seal-example.vercel.app/publisher6/v1/blobs',
      ];

// --- Bot Operation Settings ---
const DEFAULT_GAS_BUDGET = 10000000; // 0.01 SUI
const DEFAULT_BLOB_EPOCHS = 1;
const MAX_BLOB_UPLOAD_RETRIES = 5; // Keep retries, but increase delays

// --- Increased Delays ---
// Initial delay before retrying a failed blob upload (milliseconds)
// Increased from 3000ms
const BLOB_UPLOAD_RETRY_DELAY_MS = 5000; // Start with 5 seconds

// Maximum delay for exponential backoff during blob upload retries (milliseconds)
// Added this constant for clarity and control. Backoff will double delay each time up to this max.
const MAX_BACKOFF_DELAY_MS = 60000; // Max wait 60 seconds between retries

// Delay between repeating the *entire task* for the *same* wallet (milliseconds)
// Increased from 10000ms
const TASK_REPEAT_DELAY_MS = 15000; // 15 seconds

// --- Image Settings ---
const DEFAULT_IMAGE_URL = 'https://picsum.photos/seed/sui-seal-bot/800/600';
const LOCAL_IMAGE_PATH = 'image.jpg';

// --- TUI Configuration ---
const TUI_TITLE = 'SEAL BOT -- BY CRYPTO WITH SHASHI | CWS';
const TUI_MAIN_LOG_LABEL = ' Main Log ';
const TUI_SUCCESS_LOG_LABEL = ' Success Log ';
const TUI_STATUS_LABEL = ' Status ';

// --- File Paths ---
const WALLET_FILE_PATH = 'wallets.txt';
const PROXY_FILE_PATH = 'proxies.txt';

// --- Exported Configuration ---
module.exports = {
    SEAL_PACKAGE_ID,
    SUI_RPC_URL,
    PUBLISHER_URLS,
    DEFAULT_GAS_BUDGET,
    DEFAULT_BLOB_EPOCHS,
    MAX_BLOB_UPLOAD_RETRIES,
    BLOB_UPLOAD_RETRY_DELAY_MS, // Export updated initial delay
    MAX_BACKOFF_DELAY_MS,      // Export new max backoff delay
    TASK_REPEAT_DELAY_MS,      // Export updated repeat delay
    DEFAULT_IMAGE_URL,
    LOCAL_IMAGE_PATH,
    TUI_TITLE,
    TUI_MAIN_LOG_LABEL,
    TUI_SUCCESS_LOG_LABEL,
    TUI_STATUS_LABEL,
    WALLET_FILE_PATH,
    PROXY_FILE_PATH,
};
