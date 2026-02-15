# Setup Guide

Complete guide for installing and configuring Kimi IDE extension for VS Code.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [kimi-cli Setup](#kimi-cli-setup)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required

| Requirement | Version | Notes |
|-------------|---------|-------|
| VS Code | 1.86.0+ | Check with `code --version` |
| Node.js | 18.x+ | For building from source |
| npm | 9.x+ | Comes with Node.js |

### Optional

| Tool | Purpose |
|------|---------|
| kimi-code-cli | Advanced features via Wire Protocol |
| Git | For development |
| Make | For using Makefile commands |

### Check Prerequisites

```bash
# Check VS Code version
code --version
# Expected: 1.86.0 or higher

# Check Node.js version
node --version
# Expected: v18.x.x or higher

# Check npm version
npm --version
# Expected: 9.x.x or higher
```

## Installation

### Option 1: VS Code Marketplace (Recommended)

1. Open VS Code
2. Press `Cmd+Shift+X` (Mac) or `Ctrl+Shift+X` (Windows/Linux)
3. Search for "Kimi IDE"
4. Click **Install**

Or via command line:

```bash
code --install-extension kimi-ide.kimi-ide
```

### Option 2: Install from .vsix

```bash
# Download .vsix from releases
code --install-extension kimi-ide-0.1.0.vsix

# Or force reinstall
code --install-extension kimi-ide-0.1.0.vsix --force
```

### Option 3: Build from Source

```bash
# Clone repository
git clone https://github.com/yourusername/kimi-vscode.git
cd kimi-vscode

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Open in VS Code
code .

# Press F5 to launch Extension Development Host
```

### Option 4: Using Makefile

```bash
# Install dependencies and build
make install-deps
make build

# Install locally
make install-local

# Or force reinstall
make install-force
```

## Configuration

### Step 1: Get API Key

1. Visit [Moonshot AI Platform](https://platform.moonshot.cn/)
2. Sign up or log in
3. Navigate to API Keys section
4. Generate a new API key
5. **Copy the key** (you won't see it again!)

### Step 2: Configure in VS Code

#### Method 1: Using Command Palette

```
Cmd+Shift+P → "Kimi: Configure API Key"
```

Paste your API key when prompted.

#### Method 2: Using Settings UI

```
Cmd+, (or Ctrl+,) → Search "Kimi" → Enter API Key
```

#### Method 3: settings.json

```json
{
  "kimi.apiKey": "your-api-key-here",
  "kimi.model": "moonshot-v1-32k",
  "kimi.enableInlineCompletions": true
}
```

#### Method 4: Environment Variable

```bash
# Add to your shell profile (.bashrc, .zshrc, etc.)
export KIMI_API_KEY="your-api-key-here"
```

Then in VS Code settings:

```json
{
  "kimi.apiKey": "${env:KIMI_API_KEY}"
}
```

### Step 3: Validate Configuration

```
Cmd+Shift+P → "Kimi: Validate API Key"
```

You should see: "API key is valid" ✓

## kimi-cli Setup

For advanced features (Wire Protocol, terminal integration), install kimi-code-cli:

### Install kimi-code-cli

```bash
# Using pip
pip install kimi-code-cli

# Using uv
uv tool install kimi-code-cli

# From source
git clone https://github.com/yourusername/kimi-cli.git
cd kimi-cli
pip install -e .
```

### Configure kimi-cli

```bash
# Set API key
kimi config set api_key "your-api-key-here"

# Set model
kimi config set model "moonshot-v1-32k"

# Verify configuration
kimi config get
```

### Wire Protocol Mode

When kimi-cli is installed, Kimi IDE automatically uses Wire Protocol for:
- Streaming responses
- Terminal integration
- Tool execution
- File operations

### Verify kimi-cli Installation

```bash
# Check version
kimi --version

# Test wire protocol
kimi --wire-stdio
```

## Verification

### Test Inline Edit

1. Open any code file
2. Select some code
3. Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)
4. Type: "Add comments"
5. Press Enter
6. Accept with `Cmd+Enter`

### Test Quick Chat

1. Press `Cmd+Shift+K`
2. Ask: "How do I write a Python function?"
3. View response in side panel

### Test Code Actions

1. Select code
2. Right-click
3. Choose "Kimi" submenu
4. Select "Explain this code"

## Configuration Options

### Full Configuration Example

```json
{
  // API Configuration
  "kimi.apiKey": "${env:KIMI_API_KEY}",
  "kimi.baseUrl": "https://api.moonshot.cn/v1",
  "kimi.model": "moonshot-v1-32k",
  
  // Feature Toggles
  "kimi.enableInlineCompletions": true,
  "kimi.enableLSP": true,
  "kimi.hasSeenWelcome": true,
  
  // LSP Settings
  "kimi.lsp.completionDebounceMs": 300,
  "kimi.lsp.maxCompletions": 5,
  "kimi.lsp.cacheTimeout": 300
}
```

### Per-Workspace Configuration

Create `.vscode/settings.json` in your project:

```json
{
  "kimi.model": "moonshot-v1-128k",
  "kimi.enableInlineCompletions": false
}
```

### Model Selection Guide

| Model | Context | Use Case |
|-------|---------|----------|
| `moonshot-v1-8k` | 8K | Quick edits, small files |
| `moonshot-v1-32k` | 32K | Medium projects, general use |
| `moonshot-v1-128k` | 128K | Large files, complex analysis |

## Troubleshooting

### "API key not configured" Error

**Problem**: Extension can't find API key

**Solutions**:
1. Run "Kimi: Configure API Key" command
2. Check settings.json syntax
3. Verify environment variable is loaded
4. Check VS Code has access to environment

### "Connection failed" Error

**Problem**: Can't reach Moonshot API

**Solutions**:
1. Check internet connection
2. Verify baseUrl in settings
3. Check if API service is available
4. Try with VPN if in restricted region

### Extension Commands Not Appearing

**Problem**: Extension not activated

**Solutions**:
1. Reload window: `Cmd+Shift+P` → "Developer: Reload Window"
2. Check Extension panel for errors
3. View Output → "Kimi IDE" for logs
4. Reinstall extension

### Build Errors from Source

**Problem**: Can't compile extension

**Solutions**:
```bash
# Clean and reinstall
make clean-all
make install-deps
make build

# Or manually
rm -rf node_modules out
npm ci
npm run compile
```

### kimi-cli Not Detected

**Problem**: Wire Protocol features unavailable

**Solutions**:
1. Verify kimi-cli in PATH: `which kimi`
2. Check version compatibility
3. Reinstall kimi-cli
4. Check VS Code integrated terminal PATH

## Advanced Configuration

### Custom Keybindings

Add to `keybindings.json`:

```json
[
  {
    "key": "cmd+alt+e",
    "command": "kimi.explainCode",
    "when": "editorHasSelection"
  },
  {
    "key": "cmd+alt+f",
    "command": "kimi.fixCode",
    "when": "editorHasSelection"
  }
]
```

### Debug Mode

Enable debug logging:

```json
{
  "kimi.debug": true
}
```

View logs in Output panel → "Kimi IDE"

### Proxy Configuration

If behind corporate proxy:

```json
{
  "http.proxy": "http://proxy.company.com:8080",
  "http.proxyStrictSSL": false
}
```

## Next Steps

- Read [Architecture Overview](./ARCHITECTURE.md)
- Explore [API Reference](./API.md)
- Check [FAQ](./FAQ.md) for common questions
