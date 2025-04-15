# SEAL BOT TUI (VPS Guide)

A Node.js utility with a Terminal User Interface (TUI) to automate interactions with the Sui SEAL Protocol. This guide focuses on setting up and running the bot on a Virtual Private Server (VPS), typically running Linux.

**Disclaimer:** This tool interacts with blockchain networks and manages private keys/seed phrases. Use it responsibly and at your own risk. Ensure you understand the implications of the actions performed by the bot. Secure your VPS and wallet files appropriately. The original author and the AI assistant are not liable for any loss of funds or other damages.

## Features

-   **Terminal User Interface (TUI):** Monitor bot operations directly in your SSH session.
-   **SEAL Protocol Actions:** Create allowlists, service subscriptions, upload & publish blobs.
-   **Wallet Management:** Supports multiple wallets via `wallets.txt`.
-   **Proxy Support:** Uses proxies defined in `proxies.txt`.
-   **Task Repetition:** Configure tasks to run multiple times per wallet with delays.
-   **Descriptive Naming:** Generates more meaningful names for on-chain entries.

## VPS Prerequisites

You'll need SSH access to your VPS and the following software installed:

1.  **Node.js:** Version 18.0.0 or later is recommended.
2.  **npm:** Usually installed automatically with Node.js.
3.  **git:** To clone the repository.
4.  **(Optional but Recommended) Process Manager:** `screen`, `tmux`, or `pm2` to keep the bot running after you disconnect your SSH session.

**Example Installation Commands (choose based on your VPS OS):**

* **Debian/Ubuntu:**
    ```bash
    sudo apt update
    sudo apt install -y nodejs npm git curl # Install Node.js, npm, git
    # Optional: Install a specific Node.js version using NodeSource or NVM
    # curl -fsSL [https://deb.nodesource.com/setup_18.x](https://deb.nodesource.com/setup_18.x) | sudo -E bash -
    # sudo apt install -y nodejs

    # Install pm2 globally (Recommended Process Manager)
    sudo npm install pm2 -g
    ```

* **CentOS/RHEL:**
    ```bash
    sudo yum update -y
    sudo yum install -y nodejs npm git # Might need EPEL repo or NodeSource setup for recent Node.js
    # Refer to NodeSource documentation for CentOS/RHEL: [https://github.com/nodesource/distributions](https://github.com/nodesource/distributions)

    # Install pm2 globally (Recommended Process Manager)
    sudo npm install pm2 -g
    ```

* **Verify Installation:**
    ```bash
    node -v  # Should show v18.x.x or higher
    npm -v
    git --version
    pm2 --version # If installed
    ```

## Installation

1.  **Connect to your VPS via SSH.**
2.  **Clone the repository:**
    ```bash
    git clone <repository_url> # Replace <repository_url> with the actual URL
    cd seal-bot-tui # Or the name of the directory cloned
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    ```

## Configuration

You'll need to create and edit configuration files using a terminal text editor like `nano` or `vim`.

1.  **Wallets (`wallets.txt`):**
    * Create/Edit: `nano wallets.txt`
    * Add your Sui wallet private keys or mnemonic phrases, one per line. Lines starting with `#` are ignored.
    * **Example:**
        ```
        # Wallet 1
        suiprivkey1abc...xyz
        # Wallet 2 - Mnemonic
        your twelve or twenty four word mnemonic seed phrase here
        # Wallet 3 - Hex Key
        0xabcdef123456...7890
        ```
    * Save the file (In `nano`: `Ctrl+X`, then `Y`, then `Enter`).
    * **Security:** Ensure this file has restrictive permissions: `chmod 600 wallets.txt`

2.  **Proxies (`proxies.txt`) (Optional):**
    * Create/Edit: `nano proxies.txt`
    * Add proxy server details (one per line) if needed. Formats: `host:port`, `host:port:user:pass`, `user:pass@host:port`.
    * Save the file. If you don't need proxies, leave this file empty or delete it.

3.  **Environment Variables (`.env`) (Optional):**
    * Create/Edit: `nano .env`
    * Specify the Sui RPC endpoint if you don't want to use the default (Testnet).
    * **Example:**
        ```dotenv
        SUI_RPC_URL=[https://fullnode.mainnet.sui.io:443](https://fullnode.mainnet.sui.io:443)
        ```
    * Save the file.

## Running the Bot on VPS

You need a way to keep the bot running even after you close your SSH connection.

### Option 1: Using `screen` or `tmux` (Simpler Persistence)

`screen` and `tmux` are terminal multiplexers that allow you to detach sessions and leave processes running.

* **Using `screen`:**
    1.  Start a new screen session: `screen -S sealbot` (You can name it anything)
    2.  You'll get a new terminal prompt inside the screen session. Navigate to the bot directory: `cd /path/to/seal-bot-tui`
    3.  Run the bot: `node app.js`
    4.  The bot will start and ask for the number of repetitions. Enter the value. The TUI will launch.
    5.  **Detach:** Press `Ctrl+A`, then press `D`. You'll return to your original terminal, but the bot keeps running inside the detached 'sealbot' screen session.
    6.  **Reattach:** Later, SSH back into your VPS and run `screen -r sealbot` to view the TUI again.
    7.  **Exit:** While attached, press `Ctrl+C` in the TUI to stop the bot, then type `exit` to close the screen session.

* **Using `tmux`:** (Similar concept, different commands)
    1.  Start: `tmux new -s sealbot`
    2.  Run: `cd /path/to/seal-bot-tui && node app.js`
    3.  Enter repetitions.
    4.  Detach: `Ctrl+B`, then `D`.
    5.  Reattach: `tmux attach -t sealbot`
    6.  Exit: `Ctrl+C` in TUI, then `exit` in the tmux pane.

### Option 2: Using `pm2` (Recommended for Robust Management)

`pm2` is a powerful process manager for Node.js applications. It handles restarts, logging, monitoring, etc.

1.  **Ensure `pm2` is installed globally** (see Prerequisites).
2.  **Navigate to the bot directory:** `cd /path/to/seal-bot-tui`
3.  **Start the bot with `pm2`:**
    ```bash
    pm2 start app.js --name seal-bot -- -- # Note the '-- --' if app.js itself needs args in future
    ```
    * `--name seal-bot`: Assigns a name for easy management.
    * `pm2` will run the script. Since `app.js` now prompts for input *before* the TUI, `pm2` will likely capture the prompt output in its logs. You might need to run `node app.js` once directly to provide the initial repetition count if `pm2` doesn't handle the interactive prompt well on startup. Alternatively, modify `app.js` to read the repetition count from `.env` or a config file instead of prompting.
    * *Correction:* `pm2` is primarily for background daemons. Running an interactive TUI application that requires startup input directly via `pm2 start` can be problematic. **It's generally better to use `screen` or `tmux` for interactive TUI apps on a VPS.** Use `pm2` if you modify the app to be non-interactive (e.g., reads all config from files).

4.  **(If using `pm2` for a non-interactive version):**
    * **View Logs:** `pm2 logs seal-bot`
    * **Monitor:** `pm2 monit`
    * **Stop:** `pm2 stop seal-bot`
    * **Restart:** `pm2 restart seal-bot`
    * **List Processes:** `pm2 list`
    * **Save process list for reboot:** `pm2 save`
    * **Enable startup on boot:** `pm2 startup` (follow the instructions it gives)

**Recommendation:** Use `screen` or `tmux` for this TUI-based bot on a VPS due to the initial interactive prompt.

## Interacting with the TUI (via SSH)

When the bot is running (directly or attached via `screen`/`tmux`):

* **Focus:** Press `Tab` to cycle focus between the log/status panes (the active pane will have a yellow border).
* **Scrolling:** Use your mouse wheel (if your SSH client supports it) or keyboard keys (`Arrow Up/Down`, `Page Up`, `Page Down`, `j`/`k`) *on the focused pane*.
* **Exit:** Press `Ctrl+C` to stop the bot gracefully.

## Troubleshooting

* **Errors on Start:** Check Node.js version (`node -v`), ensure dependencies are installed (`npm install`). Check file permissions for `wallets.txt`.
* **TUI Display Issues:** Your SSH client might affect rendering. Ensure UTF-8 is enabled. Try resizing the terminal window.
* **Bot Not Running After Disconnect:** Make sure you are using `screen`, `tmux`, or `pm2` correctly.
* **Check Logs:** If using `pm2`, check logs with `pm2 logs seal-bot`. If using `screen`/`tmux`, reattach to see terminal output.

## License

MIT
