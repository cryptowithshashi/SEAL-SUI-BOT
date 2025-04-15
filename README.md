# SEAL BOT TUI

A Node.js utility with a Terminal User Interface (TUI) to automate interactions with the Sui SEAL Protocol.

**Disclaimer:** This tool interacts with blockchain networks and manages private keys/seed phrases. Use it responsibly and at your own risk. Ensure you understand the implications of the actions performed by the bot. Secure your wallet files appropriately. The original author and the AI assistant are not liable for any loss of funds or other damages.

## Features

-   **Terminal User Interface (TUI):** Monitor bot operations directly in your terminal.
-   **SEAL Protocol Actions:** Create allowlists, service subscriptions, upload & publish blobs.
-   **Wallet Management:** Supports multiple wallets via `wallets.txt`.
-   **Proxy Support:** Uses proxies defined in `proxies.txt`.
-   **Task Repetition:** Configure tasks to run multiple times per wallet with delays.
-   **Descriptive Naming:** Generates more meaningful names for on-chain entries.

## Prerequisites

You will need the following software installed on your system (PC or VPS):

1.  **Node.js:** Version 18.0.0 or later recommended.
2.  **npm:** Usually installed automatically with Node.js.
3.  **git:** For cloning the repository.

## Installation

1.  **Open your terminal or connect to your VPS via SSH.**
2.  **Clone the repository:**
    ```bash
    git clone https://github.com/cryptowithshashi/SEAL-SUI-BOT.git
    cd seal-bot-tui 
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    ```

## Configuration

Create and edit configuration files using a terminal text editor like `nano` or `vim`, or a standard text editor if running locally.

1.  **Wallets (`wallets.txt`):**
    * Create/Edit: `nano wallets.txt`
    * Add your Sui wallet private keys or mnemonic phrases, one per line.
    * **Example:**
        ```
        suiprivkey1abc...xyz
        your twelve or twenty four word mnemonic seed phrase here
        0xabcdef123456...7890
        ```
    * Save the file (In `nano`: `Ctrl+X`, then `Y`, then `Enter`).
    * **Security:** Ensure this file has restrictive permissions, especially on a shared system or VPS: `chmod 600 wallets.txt`

2.  **Proxies (`proxies.txt`) (Optional):**
    * Create/Edit: `nano proxies.txt`
    * Add proxy server details (one per line) if needed. Formats: `host:port`, `host:port:user:pass`, `user:pass@host:port`.
    * Save the file. If you don't need proxies, leave this file empty.

3.  **Environment Variables (`.env`) (Optional):**
    * Create/Edit: `nano .env`
    * Specify the Sui RPC endpoint if you don't want to use the default (Testnet).
    * **Example:**
        ```dotenv
        SUI_RPC_URL=[https://fullnode.mainnet.sui.io:443](https://fullnode.mainnet.sui.io:443)
        ```
    * Save the file.

## Running the Bot

1.  **Navigate to the bot's directory in your terminal:**
    ```bash
    cd /path/to/seal-bot-tui
    ```
2.  **Run the application:**
    ```bash
    node app.js
    ```
3.  The script will first ask you in the terminal how many times to repeat tasks per wallet. Enter a number and press Enter.
4.  The Terminal User Interface (TUI) will then launch.

*Note: If running on a VPS, this command runs the bot in the foreground. If you close your SSH session, the bot will stop. Use tools like `screen` or `tmux` if you need it to run persistently after disconnecting.*

## Interacting with the TUI

When the TUI is running:

* **Focus:** Press `Tab` to cycle focus between the log/status panes (the active pane will have a yellow border).
* **Scrolling:** Use your mouse wheel (if your terminal/SSH client supports it) or keyboard keys (`Arrow Up/Down`, `Page Up`, `Page Down`, `j`/`k`) *on the focused pane*.
* **Exit:** Press `Ctrl+C` to stop the bot gracefully.

## License

MIT
