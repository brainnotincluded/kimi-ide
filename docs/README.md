# Kimi IDE for VS Code

<p align="center">
  <img src="../resources/icon.png" alt="Kimi IDE Logo" width="128" height="128">
</p>

<p align="center">
  <strong>AI-powered coding assistant with inline editing, powered by Moonshot AI (Kimi)</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=kimi-ide.kimi-ide">
    <img src="https://img.shields.io/visual-studio-marketplace/v/kimi-ide.kimi-ide" alt="Version">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=kimi-ide.kimi-ide">
    <img src="https://img.shields.io/visual-studio-marketplace/d/kimi-ide.kimi-ide" alt="Downloads">
  </a>
  <a href="https://github.com/yourusername/kimi-vscode/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  </a>
</p>

---

Kimi IDE brings Cursor-like AI-powered coding experience directly into VS Code. Inspired by Cursor's Cmd+K functionality, it provides intelligent inline code editing, AI code actions, and contextual chat powered by Moonshot AI's Kimi models.

## ✨ Features

### 🚀 Inline Edit (Cmd+K)

The signature feature - select any code and edit it with natural language:

![Inline Edit Demo](screenshots/inline-edit.gif)

1. **Select code** in the editor
2. **Press `Cmd+K`** (Mac) or **`Ctrl+K`** (Windows/Linux) to open the inline input
3. **Describe** what you want to change (e.g., "Add error handling", "Optimize this loop")
4. **Review** the suggested changes with diff view
5. **Accept** (`Cmd+Enter`) or **reject** (`Esc`) the edit

### 💡 AI Code Actions

Right-click on selected code to access AI-powered actions:

| Action | Description | Shortcut |
|--------|-------------|----------|
| **Explain Code** | Get detailed explanation of what the code does | - |
| **Fix Code** | Automatically fix bugs and issues | - |
| **Optimize Code** | Improve performance and readability | - |
| **Generate Tests** | Create unit tests for selected code | - |
| **Add Documentation** | Generate docstrings and comments | - |
| **Refactor Code** | Restructure for better design | - |

![Code Actions](screenshots/code-actions.png)

### 🤖 Inline Completions

Ghost text completions appear as you type. Trigger with patterns like:
- `// AI: ` (JavaScript/TypeScript/C/C++)
- `# AI: ` (Python/Ruby)
- `-- AI: ` (SQL/Haskell)
- `<!-- AI: -->` (HTML/XML)

![Inline Completions](screenshots/inline-completions.png)

### 💬 Quick Chat

Ask Kimi anything with full context of your codebase:

- **`Cmd+Shift+K`** - Open Quick Chat
- **Chat with Current File** - Ask about the current file

![Quick Chat](screenshots/quick-chat.png)

### 🔌 LSP Integration

Advanced Language Server Protocol support for:
- Smart completions with AI context
- Hover information
- Signature help
- Real-time code analysis

## 🚀 Quick Start

### 1. Install the Extension

```bash
# From VS Code Marketplace
code --install-extension kimi-ide.kimi-ide

# Or install from .vsix
code --install-extension kimi-ide-0.1.0.vsix
```

### 2. Configure API Key

Get your API key from [Moonshot AI Platform](https://platform.moonshot.cn/):

```bash
# Option 1: Use VS Code command
Cmd+Shift+P → "Kimi: Configure API Key"

# Option 2: Set in settings.json
{
  "kimi.apiKey": "your-api-key-here"
}
```

### 3. Start Coding!

Select code and press `Cmd+K` to try inline editing.

## 📦 Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Cmd+Shift+X`)
3. Search for "Kimi IDE"
4. Click Install

### From Source

```bash
git clone https://github.com/yourusername/kimi-vscode.git
cd kimi-vscode
npm install
npm run compile

# Press F5 to open Extension Development Host
```

### Local Installation

```bash
# Build and install locally
make package
make install-local

# Or force reinstall
make install-force
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+K` | Edit selected code | Editor with selection |
| `Cmd+Enter` | Accept suggested edit | During inline edit |
| `Esc` | Reject suggested edit | During inline edit |
| `Cmd+Shift+K` | Quick chat | Global |

### Custom Keybindings

Add to your `keybindings.json`:

```json
{
  "key": "cmd+alt+k",
  "command": "kimi.explainCode",
  "when": "editorHasSelection"
}
```

## 🎛️ Available Models

| Model | Context | Best For |
|-------|---------|----------|
| `moonshot-v1-8k` | 8K tokens | Fast responses, simple tasks |
| `moonshot-v1-32k` | 32K tokens | Balanced performance |
| `moonshot-v1-128k` | 128K tokens | Large files, complex analysis |

## 📋 Commands

All commands available in Command Palette (`Cmd+Shift+P`):

| Command | ID | Description |
|---------|-----|-------------|
| Kimi: Edit Selection | `kimi.inlineEdit` | Inline edit selected code |
| Kimi: Accept Edit | `kimi.acceptEdit` | Accept suggested changes |
| Kimi: Reject Edit | `kimi.rejectEdit` | Reject suggested changes |
| Kimi: Explain Code | `kimi.explainCode` | Explain selected code |
| Kimi: Fix Code | `kimi.fixCode` | Fix issues in code |
| Kimi: Optimize Code | `kimi.optimizeCode` | Optimize selected code |
| Kimi: Generate Tests | `kimi.generateTests` | Generate unit tests |
| Kimi: Add Documentation | `kimi.addDocs` | Add documentation |
| Kimi: Refactor Code | `kimi.refactorCode` | Refactor code structure |
| Kimi: Quick Chat | `kimi.quickChat` | Quick chat with Kimi |
| Kimi: Chat with Current File | `kimi.chatWithContext` | Chat about current file |
| Kimi: Configure API Key | `kimi.configureApiKey` | Set up API key |
| Kimi: Validate API Key | `kimi.validateApiKey` | Verify API key |
| Kimi: Open Settings | `kimi.openSettings` | Open extension settings |

## ⚙️ Configuration

### VS Code Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `kimi.apiKey` | string | `""` | Your Moonshot AI API key |
| `kimi.baseUrl` | string | `https://api.moonshot.cn/v1` | API base URL |
| `kimi.model` | enum | `moonshot-v1-8k` | Model to use |
| `kimi.enableInlineCompletions` | boolean | `true` | Enable ghost text |
| `kimi.enableLSP` | boolean | `true` | Enable LSP features |

### Example Settings

```json
{
  "kimi.apiKey": "${env:KIMI_API_KEY}",
  "kimi.model": "moonshot-v1-32k",
  "kimi.enableInlineCompletions": true,
  "kimi.enableLSP": true,
  "kimi.lsp.completionDebounceMs": 300,
  "kimi.lsp.maxCompletions": 5
}
```

## 🔒 Privacy & Security

- Your code is sent to Moonshot AI API for processing
- API keys are stored in VS Code's secure storage
- Review [Moonshot AI's privacy policy](https://platform.moonshot.cn/) for data handling details

## 🆘 Troubleshooting

### API Key Not Working

1. Verify key at [Moonshot AI Platform](https://platform.moonshot.cn/)
2. Run "Kimi: Validate API Key" command
3. Check VS Code settings: `Cmd+Shift+P` → "Preferences: Open Settings (JSON)"

### Inline Edit Not Appearing

1. Ensure code is selected
2. Check keybinding: `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux)
3. Verify `kimi.enableInlineEdit` is enabled

### Extension Not Loading

1. Check VS Code version: requires 1.86.0+
2. Check Output panel → "Kimi IDE" for errors
3. Try reloading window: `Cmd+Shift+P` → "Developer: Reload Window"

## 📚 Documentation

- [Setup Guide](./SETUP.md) - Detailed installation and configuration
- [Architecture](./ARCHITECTURE.md) - Technical architecture and wire protocol
- [API Reference](./API.md) - API and protocol documentation
- [Contributing](./CONTRIBUTING.md) - How to contribute
- [Changelog](./CHANGELOG.md) - Version history
- [FAQ](./FAQ.md) - Frequently asked questions

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](../LICENSE) file.

## 🙏 Credits

- Powered by [Moonshot AI (Kimi)](https://www.moonshot.cn/)
- Inspired by [Cursor](https://cursor.sh/)

---

<p align="center">
  Made with ❤️ for the developer community
</p>
