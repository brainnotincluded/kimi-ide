<div align="center">
  
  <!-- Logo -->
  <img src="./media/logo.png" alt="Kimi IDE Logo" width="120" height="120">
  
  <h1>Kimi IDE</h1>
  
  <p><strong>AI-Powered Coding Assistant for VS Code with Multi-Agent Intelligence</strong></p>
  
  <!-- Badges -->
  <p>
    <a href="https://github.com/kimi-ai/kimi-ide/releases">
      <img src="https://img.shields.io/badge/version-2.0.0-blue.svg" alt="Version">
    </a>
    <a href="https://marketplace.visualstudio.com/items?itemName=kimi-ide.kimi-ide">
      <img src="https://img.shields.io/badge/VS%20Code-1.86%2B-blue.svg" alt="VS Code">
    </a>
    <a href="https://github.com/kimi-ai/kimi-ide/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License: MIT">
    </a>
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
  </p>
  
  <!-- Platform Support -->
  <p>
    <img src="https://img.shields.io/badge/macOS-000000?style=flat&logo=apple&logoColor=white" alt="macOS">
    <img src="https://img.shields.io/badge/Windows-0078D6?style=flat&logo=windows&logoColor=white" alt="Windows">
    <img src="https://img.shields.io/badge/Linux-FCC624?style=flat&logo=linux&logoColor=black" alt="Linux">
  </p>
  
</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Usage](#-usage)
- [Architecture](#-architecture)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)
- [Troubleshooting](#-troubleshooting)
- [Roadmap](#-roadmap)

---

## Overview

Kimi IDE brings advanced AI coding capabilities to VS Code, featuring a **Multi-Agent System**, **Tree-based File Discovery**, **Parallel Multi-Strategy Editing**, and **Automatic Code Review**. Built with TypeScript and inspired by the best innovations in AI coding tools.

### Why Kimi IDE?

| Feature | Kimi IDE | Codebuff | Cursor | GitHub Copilot |
|---------|----------|----------|--------|----------------|
| **Multi-Agent System** | ✅ Full | ✅ Full | ⚠️ Limited | ❌ None |
| **Tree-based Discovery** | ✅ AST + AI | ✅ LLM only | ⚠️ Basic | ❌ None |
| **Parallel Editing** | ✅ 5 strategies | ✅ Multiple | ⚠️ 2 strategies | ❌ Single |
| **Auto Code Review** | ✅ 5 reviewers | ✅ Pre-display | ⚠️ Basic | ❌ None |
| **VS Code Integration** | ✅ Native | ⚠️ Basic | ✅ Good | ✅ Good |
| **AST Understanding** | ✅ Full | ❌ Text | ⚠️ Partial | ⚠️ Partial |
| **Open Source** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Pricing** | API costs only | $20-50/mo | $20/mo | $10-19/mo |

---

## ✨ Features

### 🤖 Multi-Agent System

Six specialized AI agents work together to handle complex coding tasks:

| Agent | Responsibility |
|-------|---------------|
| **Orchestrator** | Coordinates workflows and decides execution strategy |
| **FileDiscovery** | Finds relevant files using AST-based tree search |
| **Planner** | Creates detailed execution plans with dependency graphs |
| **Editor** | Generates code edits using multiple strategies |
| **Reviewer** | Performs automatic code review with quality checks |
| **Testing** | Generates and runs tests to verify changes |

### 🌳 Tree-based File Discovery

Replaces simple grep with intelligent file discovery:
- **AST Analysis** - Understands code structure, not just text
- **Semantic Search** - Finds files by meaning, not just keywords
- **Dependency Tracking** - Follows import/export relationships
- **AI-Powered Ranking** - Uses LLM to rank file relevance

### ⚡ Parallel Multi-Strategy Editing

Runs multiple editing strategies simultaneously for best results:

| Strategy | Approach |
|----------|----------|
| **Conservative** | Minimal, safe changes |
| **Balanced** | Best practices and idiomatic code |
| **Aggressive** | Maximum improvement and optimization |
| **Test-First** | TDD approach with tests before code |
| **Minimal-Diff** | Smallest possible changes |

### 🔍 Automatic Code Review

Catches issues before showing results:
- **Semantic Review** - Logic bugs, edge cases
- **Style Review** - Project conventions
- **Security Review** - Vulnerability detection
- **Performance Review** - Optimization suggestions
- **Test Review** - Coverage analysis

### 🧠 Smart Context Management

Intelligently selects the most relevant code context:
- **Relevance Scoring** - Prioritizes open files, recent edits, imports
- **Token Optimization** - Fits within LLM context limits
- **Automatic Summarization** - Condenses less relevant files
- **Dependency Expansion** - Includes related symbols

---

## 🚀 Quick Start

### Prerequisites

- VS Code 1.86.0 or higher
- Node.js 18.x or higher
- npm 9.x or higher
- Kimi API key (get one at [platform.moonshot.cn](https://platform.moonshot.cn))

### Installation

**From VS Code Marketplace:**

1. Open VS Code
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type "Extensions: Install Extensions"
4. Search for "Kimi IDE"
5. Click Install

**From Source:**

```bash
# Clone the repository
git clone https://github.com/kimi-ai/kimi-ide.git
cd kimi-ide

# Install dependencies
npm install

# Build the extension
npm run compile

# Install in VS Code
npm run install-local
```

### Initial Setup

1. **Set API Key:**
   - Press `Cmd+Shift+P` → "Kimi: Configure API Key"
   - Enter your Kimi API key

2. **Choose Model:**
   - Press `Cmd+Shift+P` → "Kimi: Select Model"
   - Choose from Kimi K2.5, K2.5 Lite, or K1.5

---

## 🎮 Usage

### Inline Edit (Cmd+K)

1. Select code in the editor
2. Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)
3. Describe what you want to change
4. Review the suggested changes in diff view
5. Press `Cmd+Enter` to accept or `Esc` to reject

### Chat with AI (Cmd+Shift+K)

1. Press `Cmd+Shift+K` to open chat panel
2. Ask questions about your code
3. Use context from open files automatically

### Code Actions

Right-click on selected code to access:
- **Explain Code** - Get detailed explanation
- **Fix Code** - Automatically fix issues
- **Optimize Code** - Improve performance
- **Generate Tests** - Create unit tests
- **Add Documentation** - Generate docstrings
- **Refactor Code** - Restructure for better design

### Multi-Agent Workflows

For complex tasks, the Multi-Agent System automatically:
1. Discovers relevant files
2. Creates an execution plan
3. Generates code changes
4. Reviews for quality
5. Runs tests to verify

Access via: `Cmd+Shift+P` → "Kimi: Execute Agent Workflow"

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Edit selected code (inline) |
| `Cmd+Enter` | Accept suggested edit |
| `Esc` | Reject suggested edit |
| `Cmd+Shift+K` | Open chat panel |
| `Cmd+Shift+R` | Review current file |
| `Cmd+Shift+P` → "Kimi..." | All Kimi commands |

### Custom Shortcuts

Add to `keybindings.json`:

```json
{
  "key": "cmd+shift+a",
  "command": "kimi.agent.executeWorkflow",
  "when": "editorTextFocus"
}
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     KIMI IDE VS CODE                        │
│                    Multi-Agent System                       │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Orchestrator │   │  VS Code UI  │   │   Context    │
│    Agent     │◄──┤  Integration │◄──┤   Manager    │
└──────┬───────┘   └──────────────┘   └──────────────┘
       │
       ├──► File Discovery Agent (AST-based)
       ├──► Planner Agent (Dependency Graph)
       ├──► Editor Agent (Parallel Strategies)
       ├──► Reviewer Agent (Auto Code Review)
       └──► Testing Agent (Auto Test Gen)
```

### Project Structure

```
kimi-ide/
├── src/
│   ├── agents/              # Multi-Agent System
│   │   ├── orchestrator.ts
│   │   ├── fileDiscoveryAgent.ts
│   │   ├── plannerAgent.ts
│   │   ├── editorAgent.ts
│   │   ├── reviewerAgent.ts
│   │   └── testingAgent.ts
│   │
│   ├── discovery/           # Tree-based Discovery
│   │   ├── codeTreeBuilder.ts
│   │   ├── treeSearch.ts
│   │   └── smartFilePicker.ts
│   │
│   ├── editing/             # Parallel Editing
│   │   ├── parallelEditor.ts
│   │   ├── strategyTemplates.ts
│   │   └── resultSelector.ts
│   │
│   ├── review/              # Auto Code Review
│   │   ├── reviewEngine.ts
│   │   └── reviewers/
│   │       ├── semanticReviewer.ts
│   │       ├── styleReviewer.ts
│   │       ├── securityReviewer.ts
│   │       ├── performanceReviewer.ts
│   │       └── testReviewer.ts
│   │
│   ├── context/             # Smart Context Management
│   │   ├── contextManager.ts
│   │   ├── compactionEngine.ts
│   │   └── tokenBudget.ts
│   │
│   ├── kimi/                # Wire Protocol Client
│   ├── panels/              # Chat UI
│   ├── providers/           # Inline Edit, Code Actions
│   ├── terminal/            # Terminal Integration
│   ├── lsp/                 # Language Server Protocol
│   ├── commands/            # VS Code Commands
│   ├── utils/               # Utilities
│   └── extension.ts         # Main Entry Point
│
├── docs/                    # Documentation
├── media/                   # Icons and Assets
├── resources/               # Snippets and Prompts
└── scripts/                 # Build Scripts
```

### Wire Protocol

Kimi IDE uses JSON-RPC 2.0 over stdio for communication with the AI backend:

```typescript
// Example message
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "sendMessage",
    "params": {
        "content": "Hello, Kimi!",
        "context": {
            "current_file": "/path/to/file.ts",
            "selected_text": "const x = 1;"
        }
    }
}
```

See [docs/API.md](./docs/API.md) for complete API reference.

---

## 📚 API Documentation

### Configuration Options

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `kimi.apiKey` | `string` | `""` | Moonshot AI API key |
| `kimi.baseUrl` | `string` | `https://api.moonshot.cn/v1` | API base URL |
| `kimi.model` | `enum` | `moonshot-v1-8k` | Model to use |
| `kimi.enableInlineCompletions` | `boolean` | `true` | Enable ghost text completions |
| `kimi.enableLSP` | `boolean` | `true` | Enable Language Server Protocol |

### Available Models

- `moonshot-v1-8k` - 8K context window (fastest)
- `moonshot-v1-32k` - 32K context window (balanced)
- `moonshot-v1-128k` - 128K context window (largest context)

### Extension Commands

| Command | ID | Description |
|---------|-----|-------------|
| Edit Selection | `kimi.inlineEdit` | Open inline edit for selection |
| Accept Edit | `kimi.acceptEdit` | Accept suggested changes |
| Reject Edit | `kimi.rejectEdit` | Reject suggested changes |
| Explain Code | `kimi.explainCode` | Explain selected code |
| Fix Code | `kimi.fixCode` | Fix issues in code |
| Generate Tests | `kimi.generateTests` | Generate unit tests |

For complete API documentation, see [docs/API.md](./docs/API.md).

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./docs/CONTRIBUTING.md) for details.

### Quick Start for Contributors

```bash
# Fork and clone
git clone https://github.com/your-username/kimi-ide.git
cd kimi-ide

# Install dependencies
npm install

# Run in development mode
npm run watch
# Press F5 in VS Code to open Extension Development Host
```

### Development Commands

```bash
# Build
npm run compile

# Watch mode
npm run watch

# Run tests
npm test

# Run linting
npm run lint

# Package extension
npm run package

# Create VSIX
npm run vsix
```

### Code Style

We follow strict coding standards. Key points:
- TypeScript with strict mode enabled
- ESLint for code quality
- Prettier for formatting
- Conventional Commits for commit messages

See [CODE_STYLE.md](./CODE_STYLE.md) for complete guidelines.

### Code Review Process

All contributions go through code review. See [CODE_REVIEW_GUIDELINES.md](./CODE_REVIEW_GUIDELINES.md) for:
- Review checklist
- Comment conventions
- Automated tools
- Best practices

---

## 🔧 Troubleshooting

### Common Issues

#### "API key not configured" error

1. Run `Cmd+Shift+P` → "Kimi: Configure API Key"
2. Verify key is saved in settings.json
3. Check if using correct settings level (User vs Workspace)

#### "Invalid API key" error

1. Verify key at [Moonshot AI Platform](https://platform.moonshot.cn/)
2. Run "Kimi: Validate API Key" command
3. Check for extra spaces or characters in key
4. Check if your account has available credits

#### Extension won't activate

1. Check VS Code version (need 1.86.0+)
2. Extension is enabled in Extensions panel
3. No errors in Output → "Kimi IDE"
4. Try: `Cmd+Shift+P` → "Developer: Reload Window"

#### Commands not appearing

1. Wait for extension to fully activate
2. Check if in correct context (some commands need selection)
3. Reload VS Code window
4. Reinstall extension

### Getting Help

- **FAQ:** See [docs/FAQ.md](./docs/FAQ.md)
- **Issues:** [GitHub Issues](https://github.com/kimi-ai/kimi-ide/issues)
- **Discussions:** [GitHub Discussions](https://github.com/kimi-ai/kimi-ide/discussions)

### Debug Mode

Enable debug logging:
```json
{
  "kimi.debug": true
}
```

View logs: Output panel → "Kimi IDE"

---

## 🗺️ Roadmap

### Current (v2.0.0)
- ✅ Multi-Agent System
- ✅ Tree-based Discovery
- ✅ Parallel Editing
- ✅ Auto Code Review
- ✅ Smart Context Management

### Next (v2.1.0)
- 🚧 Voice interface
- 🚧 Enhanced LSP features
- 🚧 Team collaboration
- 🚧 More language support

### Future (v3.0.0)
- 📋 Predictive editing
- 📋 AI learning patterns
- 📋 Knowledge graph
- 📋 Autonomous coding

See [ROADMAP.md](./ROADMAP.md) for full details.

---

## 📊 Performance

| Metric | Result |
|--------|--------|
| File Discovery (10k files) | 2s |
| Parallel Edit Generation | 3-5s |
| AST Parsing Speed | 1000 files/sec |
| Memory Usage | <500MB typical |
| Startup Time | <1s |

### System Requirements

- **Minimum:** 4GB RAM, 2 CPU cores
- **Recommended:** 8GB RAM, 4 CPU cores
- **Large Codebases:** 16GB RAM, 8 CPU cores

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 🏆 Acknowledgments

Kimi IDE wouldn't be possible without these amazing projects:

- [Moonshot AI](https://www.moonshot.cn) - Kimi models
- [VS Code Extension API](https://code.visualstudio.com/api) - Extension platform
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) - AST parsing
- Inspired by innovations from [Codebuff](https://codebuff.com)

---

## 💖 Support

If you find Kimi IDE useful, please consider:

- ⭐ Starring the repository
- 🐦 Sharing on social media
- 📝 Writing a blog post about your experience
- 💰 [Sponsoring](https://github.com/sponsors/kimi-ai) the project

---

<div align="center">
  
  **Made with ❤️ by the Kimi IDE team**
  
  <a href="https://github.com/kimi-ai/kimi-ide/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=kimi-ai/kimi-ide" alt="Contributors">
  </a>
  
</div>
