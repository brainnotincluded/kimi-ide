# Frequently Asked Questions (FAQ)

Common questions and answers about Kimi IDE extension.

## Table of Contents

- [General Questions](#general-questions)
- [Installation & Setup](#installation--setup)
- [API Key Issues](#api-key-issues)
- [Features & Usage](#features--usage)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

## General Questions

### What is Kimi IDE?

Kimi IDE is a VS Code extension that brings Cursor-like AI-powered coding features to your editor. It provides inline editing, code actions, completions, and chat powered by Moonshot AI's Kimi models.

### Is Kimi IDE free?

The extension is free and open source (MIT license). However, you need an API key from Moonshot AI, which has its own pricing. Check [Moonshot AI pricing](https://platform.moonshot.cn/) for details.

### How is this different from GitHub Copilot?

| Feature | Kimi IDE | GitHub Copilot |
|---------|----------|----------------|
| Inline Edit (Cmd+K) | ✅ Yes | ❌ No |
| Code Actions | ✅ Explain, Fix, Optimize | Limited |
| Model | Moonshot Kimi | OpenAI Codex |
| Open Source | ✅ Yes | ❌ No |
| Local CLI | ✅ Optional kimi-cli | ❌ No |

### What models are supported?

- `moonshot-v1-8k` - 8K context (fastest)
- `moonshot-v1-32k` - 32K context (balanced)
- `moonshot-v1-128k` - 128K context (largest context)

### Is my code sent to the cloud?

Yes, when using AI features, your code is sent to Moonshot AI's API for processing. Review their [privacy policy](https://platform.moonshot.cn/) for details. API keys are stored locally in VS Code's secure storage.

## Installation & Setup

### How do I install Kimi IDE?

**From VS Code Marketplace:**
1. Open VS Code
2. Go to Extensions (`Cmd+Shift+X`)
3. Search for "Kimi IDE"
4. Click Install

**From .vsix:**
```bash
code --install-extension kimi-ide-0.1.0.vsix
```

### What are the system requirements?

- VS Code 1.86.0 or higher
- Node.js 18+ (for building from source)
- Moonshot AI API key

### How do I get an API key?

1. Visit [Moonshot AI Platform](https://platform.moonshot.cn/)
2. Sign up or log in
3. Go to API Keys section
4. Generate a new key
5. Copy and save it securely

### How do I configure the API key?

**Option 1: Command Palette**
```
Cmd+Shift+P → "Kimi: Configure API Key"
```

**Option 2: Settings**
```
Cmd+, → Search "kimi apiKey" → Enter key
```

**Option 3: settings.json**
```json
{
  "kimi.apiKey": "your-api-key-here"
}
```

## API Key Issues

### "API key not configured" error

**Problem:** Extension can't find your API key

**Solutions:**
1. Run `Cmd+Shift+P` → "Kimi: Configure API Key"
2. Verify key is saved in settings.json
3. Check if using correct settings level (User vs Workspace)
4. Try setting key in User settings (global)

### "Invalid API key" error

**Problem:** API key is rejected by Moonshot API

**Solutions:**
1. Verify key at [Moonshot AI Platform](https://platform.moonshot.cn/)
2. Run "Kimi: Validate API Key" command
3. Check for extra spaces or characters in key
4. Generate a new key if necessary
5. Check if your account has available credits

### "Connection failed" error

**Problem:** Can't reach Moonshot API

**Solutions:**
1. Check internet connection
2. Verify firewall/proxy settings
3. Try accessing https://api.moonshot.cn in browser
4. Check if VPN is required in your region
5. Wait and retry (service might be temporarily unavailable)

### Can I use environment variables for the API key?

Yes:
```bash
export KIMI_API_KEY="your-key-here"
```

Then in settings.json:
```json
{
  "kimi.apiKey": "${env:KIMI_API_KEY}"
}
```

## Features & Usage

### How do I use inline editing?

1. **Select** code in editor
2. Press **`Cmd+K`** (Mac) or **`Ctrl+K`** (Windows/Linux)
3. **Type** what you want to change (e.g., "Add error handling")
4. **Review** the suggested changes
5. Press **`Cmd+Enter`** to accept or **`Esc`** to reject

### Why doesn't Cmd+K work?

**Common causes:**
- No code selected - select some text first
- Keybinding conflict - check VS Code keyboard shortcuts
- Extension not activated - reload window

**To check/fix keybinding:**
```
Cmd+Shift+P → "Preferences: Open Keyboard Shortcuts"
Search "kimi.inlineEdit"
```

### How do I trigger inline completions?

Type one of these patterns:
- `// AI: ` (JavaScript/TypeScript/C/C++)
- `# AI: ` (Python/Ruby)
- `-- AI: ` (SQL/Haskell)
- `<!-- AI: -->` (HTML/XML)

Then describe what you want, and wait for ghost text to appear.

### Can I customize the keyboard shortcuts?

Yes! Add to your `keybindings.json`:

```json
[
  {
    "key": "cmd+alt+e",
    "command": "kimi.explainCode",
    "when": "editorHasSelection"
  }
]
```

### How do I chat with Kimi about my code?

**Quick Chat:**
```
Cmd+Shift+P → "Kimi: Quick Chat"
```

**Chat with Current File:**
```
Cmd+Shift+P → "Kimi: Chat with Current File"
```

### What context does Kimi see?

When you use AI features, Kimi can see:
- Selected code
- Current file content
- Open files (optional)
- File language/type

It does NOT see:
- Other files in workspace (unless specified)
- Your API key
- Other VS Code settings

### Can I use Kimi IDE offline?

No, an internet connection is required to communicate with Moonshot AI's API.

### Which model should I choose?

| Model | Best For |
|-------|----------|
| `moonshot-v1-8k` | Quick edits, small files, faster responses |
| `moonshot-v1-32k` | Medium-sized projects, balanced performance |
| `moonshot-v1-128k` | Large files, complex analysis, maximum context |

Change in settings: `kimi.model`

## Performance

### Why are responses slow?

**Possible causes:**
1. Using 128k model (slower but more capable)
2. Large context being sent
3. Network latency
4. Moonshot API load

**Solutions:**
1. Try 8k or 32k model for faster responses
2. Select only relevant code
3. Close unnecessary files
4. Check your internet connection

### How do I reduce API costs?

1. Use `moonshot-v1-8k` model (cheapest)
2. Select smaller code snippets
3. Disable inline completions if not needed
4. Use shorter, more specific prompts

### Is there a way to cache responses?

LSP features have built-in caching. You can configure:
```json
{
  "kimi.lsp.cacheTimeout": 300  // seconds
}
```

### Why is VS Code slow after installing?

Kimi IDE should not significantly impact VS Code performance. If you experience slowness:

1. Disable LSP: `"kimi.enableLSP": false`
2. Disable inline completions: `"kimi.enableInlineCompletions": false`
3. Check Output panel for errors
4. Report issue with performance profile

## Troubleshooting

### Extension won't activate

**Check:**
1. VS Code version (need 1.86.0+)
2. Extension is enabled in Extensions panel
3. No errors in Output → "Kimi IDE"
4. Try: `Cmd+Shift+P` → "Developer: Reload Window"

### Commands not appearing

**Solutions:**
1. Wait for extension to fully activate
2. Check if in correct context (some commands need selection)
3. Reload VS Code window
4. Reinstall extension

### How do I view extension logs?

1. Open Output panel (`Cmd+Shift+U` or `Ctrl+Shift+U`)
2. Select "Kimi IDE" from dropdown
3. Enable debug mode for more logs:
   ```json
   { "kimi.debug": true }
   ```

### "Cannot find module" error when building

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run compile
```

### Extension crashes VS Code

1. Start VS Code with extensions disabled:
   ```bash
   code --disable-extensions
   ```
2. Enable only Kimi IDE
3. Check for conflicting extensions
4. Report issue with crash logs

### How do I completely reset the extension?

1. Uninstall extension
2. Remove settings:
   ```json
   // Remove all kimi.* settings from settings.json
   ```
3. Clear extension storage:
   ```bash
   rm -rf ~/.vscode/extensions/kimi-ide*
   ```
4. Reinstall extension

## Development

### How do I build from source?

```bash
git clone https://github.com/yourusername/kimi-vscode.git
cd kimi-vscode
npm install
npm run compile
```

### How do I run the extension locally?

```bash
# In VS Code
# 1. Open project
# 2. Press F5 (opens Extension Development Host)
```

Or:
```bash
make test-extension
```

### How do I run tests?

```bash
npm test
# or
make test
```

### How do I contribute?

See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Development setup
- Coding style
- Pull request process
- Testing guidelines

### Where can I report bugs?

Open an issue on GitHub with:
- VS Code version
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Logs from Output panel

### Where can I request features?

Open a GitHub issue with the "feature request" label. Describe:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

## Advanced

### What is kimi-code-cli?

Optional companion CLI that enables:
- Wire Protocol communication
- Terminal integration
- Tool execution
- Local processing

Install: `pip install kimi-code-cli`

### How does Wire Protocol work?

Wire Protocol is JSON-RPC over stdio:
1. Extension spawns kimi-cli process
2. Communication via stdin/stdout
3. Event-driven bidirectional messages
4. Supports streaming and tools

See [ARCHITECTURE.md](./ARCHITECTURE.md) for details.

### Can I use a custom API endpoint?

Yes:
```json
{
  "kimi.baseUrl": "https://your-custom-endpoint.com/v1"
}
```

### Can I disable specific features?

Yes, in settings:
```json
{
  "kimi.enableInlineCompletions": false,
  "kimi.enableLSP": false
}
```

### Does Kimi IDE work with VS Code Insiders?

Yes! Install with:
```bash
code-insiders --install-extension kimi-ide.kimi-ide
```

Or use Make:
```bash
make install-insiders
```

### Does it work on remote (SSH/Container)?

Yes, Kimi IDE works in remote development environments. The extension runs on the remote host.

## Still Have Questions?

- Check [GitHub Issues](https://github.com/yourusername/kimi-vscode/issues)
- Read [Architecture Overview](./ARCHITECTURE.md)
- Review [API Reference](./API.md)
- Join our community Discord
