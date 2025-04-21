# CORESKY BOT

A Node.js script built with a Terminal User Interface (TUI) that automates interactions with the CoreSky protocol, focusing on simplifying and managing multiple wallet tasks efficiently.

## Features

- **Automated CoreSky Tasks**: Executes predefined tasks on the CoreSky protocol automatically.
- **Multi-Wallet Compatibility**: Accepts multiple wallet formats like private keys, mnemonics, or hex strings.
- **Batch Processing**: Perform actions for multiple wallets in one go.
- **Proxy Support**: Supports rotating proxies for safer and distributed execution.
- **Random Task Looping**: Customize how many times each wallet performs the set of tasks.
- **User-Friendly TUI**: Interactive and informative Terminal UI for real-time status and logs.

## Pre Requisites

Make sure Git, Node.js, and npm are installed on your system.

```bash
sudo apt update
sudo apt install git nodejs npm -y
```

## INSTALLATION GUIDE

### Clone Repository

```bash
git clone https://github.com/cryptowithshashi/CORESKY-BOT.git
cd CORESKY-BOT
```

### Install Dependencies

```bash
npm install
```

## Configuration

- **wallets.txt** - This should contain your CoreSky tokens, one per line. 
  - To get the token:
    1. Visit [https://coresky.com](https://coresky.com) and sign in.
    2. Open Developer Tools (right-click -> Inspect).
    3. Go to the **Network** tab.
    4. Refresh the page or perform an action.
    5. Look for a request that includes the token in the headers or payload.
    6. Copy the token and paste it line by line in `wallets.txt`.

- **proxies.txt** (Optional) - Add proxies line by line. Format examples:
  ```
  host:port
  host:port:user:pass
  user:pass@host:port
  ```

- **.env** (Optional) - Customize your CoreSky RPC endpoint:
  ```env
  CORESKY_RPC_URL=https://rpc.coresky.network
  ```

## Execute the Bot

```bash
node app.js
```

You will be prompted to enter the number of repetitions per wallet. The TUI will then appear and begin processing.

## TUI Controls

- **Switch Views**: Press `Tab` to toggle between the log and status panes.
- **Scroll**: Use arrow keys, `j/k`, or mouse scroll.
- **Exit**: Press `Ctrl+C` to terminate the script.

## Disclaimer

This script handles sensitive wallet data and interacts with blockchain networks. Use it at your own risk. The author and AI assistant hold no responsibility for any losses or damages.

## ABOUT ME

- **Twitter**: [https://x.com/SHASHI522004](https://x.com/SHASHI522004)
- **GitHub**: [https://github.com/cryptowithshashi](https://github.com/cryptowithshashi)
