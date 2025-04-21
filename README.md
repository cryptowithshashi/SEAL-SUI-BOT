# SEAL SUI AUTOMATIC BOT

A Node.js script with a Terminal User Interface (TUI) designed to automate interactions with the Sui SEAL Protocol, specifically focusing on creating allowlist/service entries and publishing content for multiple accounts.

## Features

- **Automated Protocol Interaction**: Automates the creation of allowlist entries and service subscriptions.
- **Multi-Wallet Compatibility**: Supports multiple wallet formats, including suiprivkey, base64, hex, and mnemonics.
- **Batch Allowlist Creation**: Add multiple addresses to allowlists with a single command.
- **Blob Uploading**: Randomly selects and uploads blobs to SEAL publishers.
- **Flexible Image Sources**: Supports both local and remote image files for publishing.
- **Proxy Integration**: Rotates requests through proxies listed in `proxies.txt`.
- **Customizable Task Looping**: Set how many times each wallet should execute tasks.
- **Smart Naming System**: Generates human-readable names for published content.

## Pre Requisites

Ensure Git, Node.js, and npm are installed. Use your VPS distribution's package manager:

```bash
sudo apt update
sudo apt install git nodejs npm -y
```

## INSTALLATION GUIDE

### Clone Repository

```bash
git clone https://github.com/cryptowithshashi/SEAL-SUI-BOT.git
cd SEAL-SUI-BOT
```

### Install Dependencies

```bash
npm install
```

## Configuration

- **wallets.txt** - Contains one wallet per line. Supports private keys, hex, base64, or mnemonic phrases. Example:
  ```
  suiprivkey1abc...xyz
  your twelve or twenty four word mnemonic here
  0xabcdef123456...7890
  ```

- **proxies.txt** (Optional) - Contains a list of proxy URLs, one per line. The script matches each proxy with the corresponding cookie by line order:
  ```
  host:port
  host:port:user:pass
  user:pass@host:port
  ```

- **.env** (Optional) - To customize your Sui RPC endpoint:
  ```env
  SUI_RPC_URL=https://fullnode.mainnet.sui.io:443
  ```

## Execute the Bot

```bash
node app.js
```

Enter the number of repetitions per wallet when prompted. The TUI interface will appear and begin processing.

## TUI Controls

- **Focus Panes**: Press `Tab` to switch between log and status views.
- **Scroll**: Use arrow keys, `j/k`, or mouse scroll in the active pane.
- **Exit**: Press `Ctrl+C` to stop the bot.

## Disclaimer

This script interacts with blockchain networks and uses sensitive data such as private keys. Use it responsibly. The author and AI assistant are not responsible for any loss or damages incurred.

## ABOUT ME

- **Twitter**: [https://x.com/SHASHI522004](https://x.com/SHASHI522004)
- **GitHub**: [https://github.com/cryptowithshashi](https://github.com/cryptowithshashi)
````

