// src/sui_actions.js
/**
 * @file Core logic for interacting with Sui blockchain and SEAL protocol.
 * v2: Updated generateRandomName for more descriptive names.
 */

const { Ed25519Keypair } = require('@mysten/sui.js/keypairs/ed25519');
const { getFullnodeUrl, SuiClient } = require('@mysten/sui.js/client');
const { TransactionBlock } = require('@mysten/sui.js/transactions');
const { decodeSuiPrivateKey } = require('@mysten/sui.js/cryptography');
const axios = require('axios');
const fs = require('fs').promises; // Use promises for async file reading
const path = require('path');
const logger = require('./bot_logger');
const {
    SUI_RPC_URL,
    SEAL_PACKAGE_ID,
    DEFAULT_GAS_BUDGET,
    PUBLISHER_URLS,
    DEFAULT_BLOB_EPOCHS,
    MAX_BLOB_UPLOAD_RETRIES,
    BLOB_UPLOAD_RETRY_DELAY_MS,
    DEFAULT_IMAGE_URL,
    LOCAL_IMAGE_PATH,
    // TASK_REPEAT_DELAY_MS is used in app.js
} = require('./config');

// --- Word lists for random names ---
const ADJECTIVES = ['Quick', 'Lazy', 'Sleepy', 'Shiny', 'Brave', 'Clever', 'Happy', 'Silent', 'Witty', 'Gentle', 'Ancient', 'Mystic', 'Golden', 'Iron', 'Cosmic'];
const NOUNS = ['Fox', 'Dog', 'Cat', 'Tiger', 'Lion', 'Panda', 'Robot', 'Dragon', 'Wizard', 'Golem', 'Sphinx', 'Phoenix', 'Star', 'Moon', 'Planet'];
const NAMES = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank', 'Grace', 'Heidi', 'Ivan', 'Judy', 'Ken', 'Leo', 'Mia', 'Noah', 'Olivia'];
const PROJECT_WORDS = ['Entry', 'Item', 'Project', 'Service', 'List', 'Task', 'Blob', 'Data', 'Asset', 'Record'];


class SuiActions {
    constructor(walletInput, proxyManager = null) {
        this.client = new SuiClient({ url: SUI_RPC_URL });
        this.proxyManager = proxyManager; // ProxyManager instance
        this.keypair = this.initializeKeypair(walletInput);
        this.address = this.keypair.getPublicKey().toSuiAddress();

        const maskedAddress = `${this.address.substring(0, 6)}...${this.address.substring(this.address.length - 4)}`;
        logger.info(`Initialized wallet: ${maskedAddress}`);
    }

    /**
     * Initializes the Ed25519Keypair from various input formats.
     * @param {string} keyInput - Mnemonic phrase, private key (suiprivkey, hex, base64).
     * @returns {Ed25519Keypair} The initialized keypair.
     * @throws {Error} If the key input format is invalid or initialization fails.
     */
    initializeKeypair(keyInput) {
        try {
            if (keyInput.startsWith('suiprivkey')) {
                const { secretKey } = decodeSuiPrivateKey(keyInput);
                return Ed25519Keypair.fromSecretKey(secretKey);
            }
            if (/^[A-Za-z0-9+/=]+$/.test(keyInput) && keyInput.length === 44) {
                 try {
                    const privateKeyBytes = Buffer.from(keyInput, 'base64');
                    if (privateKeyBytes.length === 32) {
                         return Ed25519Keypair.fromSecretKey(privateKeyBytes);
                    }
                 } catch (e) { /* Ignore */ }
            }
            const hexKey = keyInput.startsWith('0x') ? keyInput.slice(2) : keyInput;
            if (/^[0-9a-fA-F]{64}$/.test(hexKey)) {
                const privateKeyBytes = Buffer.from(hexKey, 'hex');
                 return Ed25519Keypair.fromSecretKey(privateKeyBytes);
            }
            return Ed25519Keypair.deriveKeypair(keyInput);
        } catch (error) {
            logger.error(`Failed to initialize keypair from input: ${keyInput.substring(0,10)}...`, error);
            throw new Error(`Invalid key/phrase format or derivation failed: ${error.message}`);
        }
    }

    /**
     * Gets the Sui address associated with the initialized keypair.
     * @returns {string} The Sui address.
     */
    getAddress() {
        return this.address;
    }

    /**
     * Generates a descriptive random name using word lists.
     * @param {string} [type='entry'] - Optional type hint ('allowlist', 'service', 'entry').
     * @returns {string} A randomly generated name like "Brave-Fox-Entry-1234".
     */
    generateRandomName(type = 'entry') {
        const randomAdjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
        const randomNoun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
        // const randomName = NAMES[Math.floor(Math.random() * NAMES.length)]; // Alternative
        const randomProjectType = PROJECT_WORDS[Math.floor(Math.random() * PROJECT_WORDS.length)];
        const randomNum = Math.floor(Math.random() * 10000); // Keep number for uniqueness

        // Combine elements based on type or just use a standard pattern
        let baseName;
        if (type === 'allowlist') {
            baseName = `${randomAdjective}-${randomNoun}-List`;
        } else if (type === 'service') {
            baseName = `${randomAdjective}-${randomProjectType}-Service`;
        } else {
            baseName = `${randomAdjective}-${randomNoun}-${randomProjectType}`; // Default pattern
        }

        return `${baseName}-${randomNum}`;
    }

    /**
     * Executes a Sui transaction block.
     * @param {TransactionBlock} txb - The transaction block to execute.
     * @param {string} actionName - Name of the action for logging purposes.
     * @returns {Promise<import('@mysten/sui.js/client').SuiTransactionBlockResponse>} The transaction response.
     * @throws {Error} If the transaction fails.
     */
    async executeTransaction(txb, actionName) {
        logger.info(`Executing transaction: ${actionName}`);
        txb.setGasBudget(DEFAULT_GAS_BUDGET);

        try {
            const result = await this.client.signAndExecuteTransactionBlock({
                transactionBlock: txb,
                signer: this.keypair,
                options: { showEffects: true, showObjectChanges: true, showEvents: true },
                requestType: 'WaitForLocalExecution',
            });

            if (result.effects?.status?.status !== 'success') {
                 throw new Error(`Transaction failed: ${result.effects?.status?.error || 'Unknown error'}`);
            }

            logger.success(`Transaction successful: ${actionName} | Digest: ${result.digest.substring(0, 10)}...`); // Shorten digest in log
            return result;
        } catch (error) {
            logger.error(`Transaction failed: ${actionName}`, error);
            throw error;
        }
    }

    // --- SEAL Protocol Actions ---

    /**
     * Creates a new allowlist entry on the SEAL protocol.
     * Uses the updated generateRandomName.
     * @param {string} [name] - Optional name for the allowlist entry. If null, generates one.
     * @returns {Promise<{allowlistId: string, entryObjectId: string}>} Object containing the IDs.
     */
    async createAllowlistEntry(name = this.generateRandomName('allowlist')) { // Pass type hint
        logger.info(`Creating allowlist entry: ${name}`);
        const txb = new TransactionBlock();
        txb.moveCall({
            target: `${SEAL_PACKAGE_ID}::allowlist::create_allowlist_entry`,
            arguments: [txb.pure(name)],
        });

        const result = await this.executeTransaction(txb, `Create Allowlist Entry (${name})`);

        const createdObjects = result.objectChanges?.filter(obj => obj.type === 'created');
        const entryObject = createdObjects?.find(obj => obj.owner?.AddressOwner === this.address);
        const allowlistObject = createdObjects?.find(obj => obj.owner?.Shared);

        if (!entryObject?.objectId || !allowlistObject?.objectId) {
            logger.error('Could not find created allowlist or entry object ID in transaction effects.', result.effects);
            throw new Error('Failed to retrieve allowlistId or entryObjectId after creation.');
        }

        const ids = { allowlistId: allowlistObject.objectId, entryObjectId: entryObject.objectId };
        logger.success(`Allowlist entry created: Name=${name}, AllowlistID=${ids.allowlistId.substring(0,10)}..., EntryID=${ids.entryObjectId.substring(0,10)}...`); // Shorten IDs
        return ids;
    }

    /**
     * Adds an address to an existing allowlist.
     * @param {string} allowlistId - The shared allowlist object ID.
     * @param {string} entryObjectId - The user's entry object ID (capability).
     * @param {string} addressToAdd - The Sui address to add to the list.
     * @returns {Promise<boolean>} True if successful.
     */
    async addAddressToAllowlist(allowlistId, entryObjectId, addressToAdd) {
        const shortAddr = addressToAdd.substring(0,6);
        logger.info(`Adding address ${shortAddr}... to allowlist ${allowlistId.substring(0,6)}...`);
        const txb = new TransactionBlock();
        txb.moveCall({
            target: `${SEAL_PACKAGE_ID}::allowlist::add`,
            arguments: [
                txb.object(allowlistId),
                txb.object(entryObjectId),
                txb.pure(addressToAdd),
            ],
        });

        await this.executeTransaction(txb, `Add Address to Allowlist (${shortAddr}...)`);
        logger.success(`Successfully added ${shortAddr}... to allowlist.`);
        return true;
    }

    /**
     * Creates a new service subscription entry on the SEAL protocol.
     * Uses the updated generateRandomName.
     * @param {number|string} amount - The amount for the service.
     * @param {number|string} duration - The duration for the service.
     * @param {string} [name] - Optional name for the service entry. If null, generates one.
     * @returns {Promise<{sharedObjectId: string, serviceEntryId: string}>} Object containing the IDs.
     */
    async createServiceSubscriptionEntry(amount, duration, name = this.generateRandomName('service')) { // Pass type hint
        logger.info(`Creating service subscription entry: ${name} (Amount: ${amount}, Duration: ${duration})`);
        const txb = new TransactionBlock();
        txb.moveCall({
            target: `${SEAL_PACKAGE_ID}::subscription::create_service_entry`,
            arguments: [
                txb.pure(amount, 'u64'),
                txb.pure(duration, 'u64'),
                txb.pure(name),
            ],
        });

        const result = await this.executeTransaction(txb, `Create Service Entry (${name})`);

        const createdObjects = result.objectChanges?.filter(obj => obj.type === 'created');
        const entryObject = createdObjects?.find(obj => obj.owner?.AddressOwner === this.address);
        const sharedObject = createdObjects?.find(obj => obj.owner?.Shared);

        if (!entryObject?.objectId || !sharedObject?.objectId) {
            logger.error('Could not find created service or shared object ID in transaction effects.', result.effects);
            throw new Error('Failed to retrieve sharedObjectId or serviceEntryId after creation.');
        }

        const ids = { sharedObjectId: sharedObject.objectId, serviceEntryId: entryObject.objectId };
        logger.success(`Service entry created: Name=${name}, SharedID=${ids.sharedObjectId.substring(0,10)}..., EntryID=${ids.serviceEntryId.substring(0,10)}...`); // Shorten IDs
        return ids;
    }

    /**
     * Fetches image data from a URL.
     * @param {string} imageUrl - The URL of the image.
     * @returns {Promise<Buffer>} The image data as a Buffer.
     */
    async fetchImageFromUrl(imageUrl) {
        logger.info(`Fetching image from URL: ${imageUrl}`);
        const agent = this.proxyManager?.createProxyAgent();
        const config = { method: 'get', url: imageUrl, responseType: 'arraybuffer', httpsAgent: agent, httpAgent: agent };

        try {
            const response = await axios(config);
            const imageData = Buffer.from(response.data);
            logger.success(`Image fetched successfully: ${(imageData.length / 1024).toFixed(2)} KB`);
            return imageData;
        } catch (error) {
            logger.error(`Failed to fetch image from URL: ${imageUrl}`, error);
            throw error;
        }
    }

    /**
     * Loads image data from a local file path.
     * @param {string} imagePath - The path to the local image file.
     * @returns {Promise<Buffer>} The image data as a Buffer.
     */
    async loadLocalImage(imagePath = LOCAL_IMAGE_PATH) {
        const absolutePath = path.resolve(__dirname, '..', imagePath);
        logger.info(`Loading local image from: ${absolutePath}`);
        try {
            const imageData = await fs.readFile(absolutePath);
            logger.success(`Local image loaded successfully: ${(imageData.length / 1024).toFixed(2)} KB`);
            return imageData;
        } catch (error) {
            logger.error(`Failed to load local image: ${absolutePath}`, error);
            if (error.code === 'ENOENT') {
                throw new Error(`Local image file not found at ${absolutePath}. Please ensure it exists.`);
            }
            throw error;
        }
    }

    /**
     * Uploads image data as a blob to a randomly selected SEAL publisher.
     * Retries on failure.
     * @param {Buffer|string} imageSource - Image data Buffer, local path, or URL.
     * @param {number} [epochs=DEFAULT_BLOB_EPOCHS] - Number of epochs for the blob.
     * @returns {Promise<string>} The blob ID upon successful upload.
     */
    async uploadBlob(imageSource, epochs = DEFAULT_BLOB_EPOCHS) {
        let imageData;
        if (Buffer.isBuffer(imageSource)) { imageData = imageSource; }
        else if (typeof imageSource === 'string') {
            if (imageSource.match(/^https?:\/\//)) { imageData = await this.fetchImageFromUrl(imageSource); }
            else { imageData = await this.loadLocalImage(imageSource); }
        } else { throw new Error('Invalid imageSource provided to uploadBlob.'); }

        logger.info(`Starting blob upload process (${(imageData.length / 1024).toFixed(2)} KB, ${epochs} epochs)`);
        if (!PUBLISHER_URLS || PUBLISHER_URLS.length === 0) { throw new Error('No publisher URLs configured.'); }

        let lastError = null;
        const shuffledPublishers = [...PUBLISHER_URLS].sort(() => 0.5 - Math.random());

        for (let attempt = 1; attempt <= MAX_BLOB_UPLOAD_RETRIES; attempt++) {
            const publisherIndex = (attempt - 1) % shuffledPublishers.length;
            const publisherBaseUrl = shuffledPublishers[publisherIndex];
            const publisherUrl = `${publisherBaseUrl}?epochs=${epochs}`;
            const publisherName = publisherBaseUrl.split('/')[2] || `Publisher ${publisherIndex + 1}`;

            logger.wait(`Attempt ${attempt}/${MAX_BLOB_UPLOAD_RETRIES}: Uploading blob to ${publisherName}...`);
            const agent = this.proxyManager?.createProxyAgent();
            const config = { method: 'put', url: publisherUrl, headers: { 'Content-Type': 'application/octet-stream' }, data: imageData, httpsAgent: agent, httpAgent: agent, timeout: 30000 };

            try {
                const response = await axios(config);
                let blobId;
                if (response.data?.newlyCreated?.blobObject?.blobId) { blobId = response.data.newlyCreated.blobObject.blobId; logger.debug(`Blob newly created by ${publisherName}.`); }
                else if (response.data?.alreadyCertified?.blobId) { blobId = response.data.alreadyCertified.blobId; logger.debug(`Blob already certified by ${publisherName}.`); }
                else if (response.data?.blobId) { blobId = response.data.blobId; }
                else { logger.warn(`Unexpected response structure from ${publisherName}: ${JSON.stringify(response.data)}`); throw new Error(`Invalid response from publisher ${publisherName}`); }

                if (!blobId) { throw new Error(`Blob ID missing in response from ${publisherName}`); }

                logger.success(`Blob uploaded successfully via ${publisherName}! Blob ID: ${blobId.substring(0,10)}...`); // Shorten ID
                return blobId;
            } catch (error) {
                lastError = error;
                let errorMessage = `Blob upload attempt ${attempt} failed with ${publisherName}`;
                if (error.response) { errorMessage += ` | Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`; }
                else if (error.request) { errorMessage += ` | No response received. Network issue or timeout?`; }
                else { errorMessage += ` | Error: ${error.message}`; }
                logger.error(errorMessage);

                if (attempt < MAX_BLOB_UPLOAD_RETRIES) {
                    logger.wait(`Retrying in ${BLOB_UPLOAD_RETRY_DELAY_MS / 1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, BLOB_UPLOAD_RETRY_DELAY_MS));
                }
            }
        }
        logger.error(`Blob upload failed after ${MAX_BLOB_UPLOAD_RETRIES} attempts.`);
        throw new Error(`Failed to upload blob after maximum retries. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    /**
     * Publishes a blob to a specific allowlist entry.
     * @param {string} allowlistId - The shared allowlist object ID.
     * @param {string} entryObjectId - The user's entry object ID (capability).
     * @param {string} blobId - The ID of the blob to publish.
     * @returns {Promise<boolean>} True if successful.
     */
    async publishBlobToAllowlist(allowlistId, entryObjectId, blobId) {
        const shortBlob = blobId.substring(0,6);
        logger.info(`Publishing blob ${shortBlob}... to allowlist ${allowlistId.substring(0,6)}...`);
        const txb = new TransactionBlock();
        txb.moveCall({
            target: `${SEAL_PACKAGE_ID}::allowlist::publish`,
            arguments: [ txb.object(allowlistId), txb.object(entryObjectId), txb.pure(blobId) ],
        });

        await this.executeTransaction(txb, `Publish Blob to Allowlist (${shortBlob}...)`);
        logger.success(`Successfully published blob ${shortBlob}... to allowlist.`);
        return true;
    }

    /**
     * Publishes a blob to a specific service subscription entry.
     * @param {string} sharedObjectId - The shared subscription service object ID.
     * @param {string} serviceEntryId - The user's service entry object ID (capability).
     * @param {string} blobId - The ID of the blob to publish.
     * @returns {Promise<boolean>} True if successful.
     */
    async publishBlobToSubscription(sharedObjectId, serviceEntryId, blobId) {
        const shortBlob = blobId.substring(0,6);
        logger.info(`Publishing blob ${shortBlob}... to subscription ${sharedObjectId.substring(0,6)}...`);
        const txb = new TransactionBlock();
        txb.moveCall({
            target: `${SEAL_PACKAGE_ID}::subscription::publish`,
            arguments: [ txb.object(sharedObjectId), txb.object(serviceEntryId), txb.pure(blobId) ],
        });

        await this.executeTransaction(txb, `Publish Blob to Subscription (${shortBlob}...)`);
         logger.success(`Successfully published blob ${shortBlob}... to subscription.`);
        return true;
    }

    // --- Workflow Examples ---

    /**
     * Runs the full workflow for creating an allowlist, adding self, uploading, and publishing.
     * @param {string|Buffer} imageSource - URL, local path, or Buffer of the image.
     * @param {string[]} [additionalAddresses=[]] - Optional array of other addresses to add.
     * @returns {Promise<object>} Result object containing IDs.
     */
    async runCompleteAllowlistWorkflow(imageSource = DEFAULT_IMAGE_URL, additionalAddresses = []) {
        logger.info("--- Starting Complete Allowlist Workflow ---");
        try {
            const { allowlistId, entryObjectId } = await this.createAllowlistEntry(); // Uses new name generator
            await this.addAddressToAllowlist(allowlistId, entryObjectId, this.address);
            for (const addr of additionalAddresses) {
                if (addr && typeof addr === 'string') { await this.addAddressToAllowlist(allowlistId, entryObjectId, addr); }
                else { logger.warn(`Skipping invalid additional address: ${addr}`); }
            }
            const blobId = await this.uploadBlob(imageSource);
            await this.publishBlobToAllowlist(allowlistId, entryObjectId, blobId);

            const result = { allowlistId, entryObjectId, blobId };
            logger.success("--- Complete Allowlist Workflow Successful ---", { /* result details can be logged here if needed */ });
            return result;
        } catch (error) {
            logger.error("--- Complete Allowlist Workflow Failed ---", error);
            throw error;
        }
    }

     /**
     * Runs the full workflow for creating a service subscription, uploading, and publishing.
     * @param {string|Buffer} imageSource - URL, local path, or Buffer of the image.
     * @param {number|string} amount - Subscription amount.
     * @param {number|string} duration - Subscription duration.
     * @returns {Promise<object>} Result object containing IDs.
     */
    async runCompleteSubscriptionWorkflow(imageSource = DEFAULT_IMAGE_URL, amount = 10, duration = 60000000) {
        logger.info("--- Starting Complete Subscription Workflow ---");
        try {
            const { sharedObjectId, serviceEntryId } = await this.createServiceSubscriptionEntry(amount, duration); // Uses new name generator
            const blobId = await this.uploadBlob(imageSource);
            await this.publishBlobToSubscription(sharedObjectId, serviceEntryId, blobId);

            const result = { sharedObjectId, serviceEntryId, blobId };
            logger.success("--- Complete Subscription Workflow Successful ---", { /* result details */ });
            return result;
        } catch (error) {
            logger.error("--- Complete Subscription Workflow Failed ---", error);
            throw error;
        }
    }
}

module.exports = SuiActions;
