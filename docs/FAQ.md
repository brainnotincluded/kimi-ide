# Frequently Asked Questions (FAQ)

Common questions and answers about Kimi IDE.

---

## Table of Contents

- [General Questions](#general-questions)
- [Installation & Setup](#installation--setup)
- [Features & Usage](#features--usage)
- [Pricing & API](#pricing--api)
- [Privacy & Security](#privacy--security)
- [Development](#development)

---

## General Questions

### What is Kimi IDE?

Kimi IDE is a VS Code extension that brings AI-powered coding capabilities to your editor. It features a Multi-Agent System, Tree-based File Discovery, Parallel Multi-Strategy Editing, and Automatic Code Review - all powered by Moonshot AI's Kimi models.

### Is Kimi IDE free?

The extension is **free and open source** (MIT license). However, you need an API key from Moonshot AI, which has its own pricing based on usage. Check [Moonshot AI pricing](https://platform.moonshot.cn/) for details.

### How is this different from other AI coding assistants?

| Feature | Kimi IDE | GitHub Copilot | Cursor |
|---------|----------|----------------|--------|
| **Multi-Agent System** | ✅ Full | ❌ None | ⚠️ Limited |
| **Inline Edit (Cmd+K)** | ✅ Yes | ❌ No | ✅ Yes |
| **Code Actions** | ✅ 6 types | ⚠️ Limited | ✅ Multiple |
| **Tree-based Discovery** | ✅ AST-based | ❌ None | ⚠️ Basic |
| **Parallel Editing** | ✅ 5 strategies | ❌ Single | ⚠️ 2 strategies |
| **Open Source** | ✅ Yes | ❌ No | ❌ No |
| **Pricing** | Pay per use | $10-19/mo | $20/mo |

### What programming languages are supported?

Kimi IDE works best with:
- **TypeScript/JavaScript** - Full support with AST analysis
- **Python** - Good support
- **Java** - Good support
- **C/C++** - Supported
- **Go** - Supported
- **Rust** - Supported

More languages are being added continuously.

---

## Installation & Setup

### What are the system requirements?

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| VS Code | 1.86.0 | Latest |
| RAM | 4GB | 8GB+ |
| CPU | 2 cores | 4 cores+ |
| Node.js | 18.x | 20.x |

### How do I install Kimi IDE?

**From VS Code Marketplace:**
1. Open VS Code
2. Press `Cmd+Shift+X` (Extensions)
3. Search "Kimi IDE"
4. Click Install

**From VSIX:**
```bash
code --install-extension kimi-ide-x.x.x.vsix
```

### How do I get an API key?

1. Visit [Moonshot AI Platform](https://platform.moonshot.cn/)
2. Sign up or log in
3. Go to API Keys section
4. Generate a new key
5. Copy and save it securely

### How do I configure the API key?

**Quick setup:**
1. Press `Cmd+Shift+P`
2. Type "Kimi: Configure API Key"
3. Enter your key

**Or via settings.json:**
```json
{
  "kimi.apiKey": "your-api-key-here"
}
```

**Or use environment variable:**
```json
{
  "kimi.apiKey": "${env:KIMI_API_KEY}"
}
```

### Which model should I choose?

| Model | Context | Speed | Best For |
|-------|---------|-------|----------|
| `moonshot-v1-8k` | 8K | Fastest | Quick edits, small files |
| `moonshot-v1-32k` | 32K | Medium | Medium projects, balanced |
| `moonshot-v1-128k` | 128K | Slower | Large files, complex analysis |

---

## Features & Usage

### How do I use inline editing?

1. **Select** code in the editor
2. Press **`Cmd+K`** (Mac) or **`Ctrl+K`** (Windows/Linux)
3. **Type** what you want to change
4. **Review** suggested changes
5. Press **`Cmd+Enter`** to accept or **`Esc`** to reject

### What code actions are available?

Right-click selected code for:
- **Explain Code** - Get detailed explanation
- **Fix Code** - Automatically fix issues
- **Optimize Code** - Improve performance
- **Generate Tests** - Create unit tests
- **Add Documentation** - Generate docstrings
- **Refactor Code** - Restructure for better design

### How do I chat with Kimi?

**Quick Chat:**
- Press `Cmd+Shift+K`
- Type your question

**Chat with Current File:**
- `Cmd+Shift+P` → "Kimi: Chat with Current File"

### Can I customize keyboard shortcuts?

Yes! Add to your `keybindings.json`:

```json
[
  {
    "key": "cmd+shift+a",
    "command": "kimi.agent.executeWorkflow",
    "when": "editorTextFocus"
  }
]
```

### What context does Kimi see?

**Visible to Kimi:**
- Selected code
- Current file content
- Open files (optional)
- File language/type

**NOT visible:**
- Other files (unless discovered)
- Your API key
- Other VS Code settings

### Can I use Kimi IDE offline?

No, an internet connection is required to communicate with Moonshot AI's API.

---

## Pricing & API

### How much does it cost?

Kimi IDE itself is free. You only pay for API usage:

| Model | Price per 1K tokens |
|-------|---------------------|
| moonshot-v1-8k | ~$0.006 |
| moonshot-v1-32k | ~$0.012 |
| moonshot-v1-128k | ~$0.024 |

Typical usage: $5-20/month for regular coding.

### How do I reduce API costs?

1. Use `moonshot-v1-8k` model (cheapest)
2. Select smaller code snippets
3. Disable inline completions if not needed
4. Use shorter, more specific prompts

### Is there a free tier?

Moonshot AI typically offers free credits for new accounts. Check their website for current promotions.

---

## Privacy & Security

### Is my code sent to the cloud?

Yes, when using AI features, your code is sent to Moonshot AI's API for processing. Review their [privacy policy](https://platform.moonshot.cn/) for details.

### How is my API key stored?

Your API key is stored securely in VS Code's encrypted storage. It is:
- Never logged
- Never shared
- Only used for API calls

### Can I use a custom API endpoint?

Yes:
```json
{
  "kimi.baseUrl": "https://your-custom-endpoint.com/v1"
}
```

### What data is collected?

Kimi IDE collects minimal data:
- Anonymous usage statistics (optional)
- Error reports (optional)

No code or personal information is collected.

---

## Development

### How do I build from source?

```bash
git clone https://github.com/kimi-ai/kimi-ide.git
cd kimi-ide
npm install
npm run compile
```

### How do I run the extension locally?

```bash
# In VS Code
npm run watch
# Then press F5
```

### How do I run tests?

```bash
npm test
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

### Does Kimi IDE work with VS Code Insiders?

Yes! Install with:
```bash
code-insiders --install-extension kimi-ide.kimi-ide
```

### Does it work on remote (SSH/Container)?

Yes, Kimi IDE works in remote development environments.

---

## Troubleshooting

For detailed troubleshooting, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

### Quick fixes:

| Issue | Solution |
|-------|----------|
| Extension not working | Reload window (`Cmd+Shift+P` → "Developer: Reload Window") |
| API key error | Configure in settings or use command palette |
| Slow responses | Close unused files, use smaller model |
| Commands not showing | Wait for extension to activate |

---

## Still Have Questions?

- 📖 [Documentation](./)
- 🔧 [Troubleshooting](./TROUBLESHOOTING.md)
- 🐛 [GitHub Issues](https://github.com/kimi-ai/kimi-ide/issues)
- 💬 [GitHub Discussions](https://github.com/kimi-ai/kimi-ide/discussions)
