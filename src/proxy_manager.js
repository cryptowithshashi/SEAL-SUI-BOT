// src/proxy_manager.js
/**
 * @file Manages loading and cycling through proxies from a file.
 */

const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');
const logger = require('./bot_logger'); // Use the event-based logger
const { PROXY_FILE_PATH } = require('./config');

class ProxyManager {
    constructor(proxyFilePath = PROXY_FILE_PATH) {
        this.proxyFilePath = path.resolve(__dirname, '..', proxyFilePath); // Ensure correct path from src
        this.proxies = [];
        this.currentProxyIndex = 0;
        this.loadProxies();
    }

    /**
     * Loads proxies from the specified file path.
     */
    loadProxies() {
        try {
            if (fs.existsSync(this.proxyFilePath)) {
                const proxyData = fs.readFileSync(this.proxyFilePath, 'utf8');
                this.proxies = proxyData
                    .split(/[\r\n]+/) // Split by newlines (Windows/Unix)
                    .map(proxy => proxy.trim())
                    .filter(proxy => proxy && !proxy.startsWith('#')); // Ignore empty lines and comments

                if (this.proxies.length > 0) {
                    logger.success(`Loaded ${this.proxies.length} proxies from ${this.proxyFilePath}`);
                } else {
                    logger.warn(`No valid proxies found in ${this.proxyFilePath}. Proceeding without proxies.`);
                }
            } else {
                logger.warn(`Proxy file not found: ${this.proxyFilePath}. Proceeding without proxies.`);
            }
        } catch (error) {
            logger.error(`Error loading proxies from ${this.proxyFilePath}`, error);
            this.proxies = []; // Ensure proxies array is empty on error
        }
    }

    /**
     * Checks if any proxies were loaded.
     * @returns {boolean} True if proxies are available, false otherwise.
     */
    hasProxies() {
        return this.proxies.length > 0;
    }

    /**
     * Gets the next proxy URL string in the list, cycling back to the start.
     * @returns {string | null} The formatted proxy URL or null if no proxies are loaded.
     */
    getNextProxyUrl() {
        if (!this.hasProxies()) {
            return null;
        }

        const proxyString = this.proxies[this.currentProxyIndex];
        this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length; // Cycle through proxies

        // Format the proxy string into a URL expected by HttpsProxyAgent
        // Handles formats: host:port, user:pass@host:port, host:port:user:pass
        let formattedProxy = proxyString;
        if (!proxyString.startsWith('http://') && !proxyString.startsWith('https://')) {
             // Basic check for user:pass@host:port or host:port:user:pass
            const parts = proxyString.split(':');
            const atParts = proxyString.split('@');

            if (atParts.length === 2 && parts.length === 3) { // user:pass@host:port
                 formattedProxy = `http://${proxyString}`;
            } else if (parts.length === 4) { // host:port:user:pass
                 formattedProxy = `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
            } else if (parts.length === 2) { // host:port
                 formattedProxy = `http://${proxyString}`;
            } else {
                logger.warn(`Unsupported proxy format skipped: ${proxyString}. Expected host:port, user:pass@host:port, or host:port:user:pass.`);
                // Try the next one recursively, guarding against infinite loops if all are bad
                if (this.proxies.length > 1 && this.currentProxyIndex !== 0) {
                     return this.getNextProxyUrl();
                } else {
                     return null; // No valid proxies left or only one invalid proxy
                }
            }
        }
         logger.debug(`Using proxy: ${formattedProxy.replace(/:.*@/, ':***@')}`); // Mask credentials in log
        return formattedProxy;
    }

    /**
     * Creates an HttpsProxyAgent instance using the next available proxy.
     * @returns {HttpsProxyAgent | null} An agent instance or null if no proxies are available/valid.
     */
    createProxyAgent() {
        const proxyUrl = this.getNextProxyUrl();
        if (!proxyUrl) {
            return null;
        }

        try {
            return new HttpsProxyAgent(proxyUrl);
        } catch (error) {
            logger.error(`Failed to create proxy agent for URL: ${proxyUrl}`, error);
            return null;
        }
    }
}

module.exports = ProxyManager;
