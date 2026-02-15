<div align="center">
  
  <!-- Logo -->
  <img src="./media/logo.png" alt="Kimi IDE Logo" width="120" height="120">
  
  <h1>Kimi IDE</h1>
  
  <p><strong>Modern, lightweight code editor built with Electron, React, and TypeScript</strong></p>
  
  <!-- Badges -->
  <p>
    <a href="https://github.com/your-username/kimi-ide/actions/workflows/ci.yml">
      <img src="https://github.com/your-username/kimi-ide/workflows/CI/badge.svg" alt="CI">
    </a>
    <a href="https://codecov.io/gh/your-username/kimi-ide">
      <img src="https://codecov.io/gh/your-username/kimi-ide/branch/main/graph/badge.svg" alt="Codecov">
    </a>
    <a href="https://github.com/your-username/kimi-ide/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT">
    </a>
    <a href="https://github.com/your-username/kimi-ide/releases">
      <img src="https://img.shields.io/github/v/release/your-username/kimi-ide" alt="GitHub release">
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

## ✨ Features

- 🚀 **Fast & Lightweight** - Built on Electron with performance in mind
- 🎨 **Beautiful UI** - Modern, clean interface inspired by VS Code
- 📝 **Powerful Editor** - Monaco Editor with syntax highlighting for 50+ languages
- 💻 **Integrated Terminal** - Full PTY support with node-pty
- 📁 **File Explorer** - Navigate your projects with ease
- 🔍 **Global Search** - Find anything in your workspace
- 📊 **Diagnostics Panel** - Problems, Output, and Debug Console
- 🎭 **Customizable** - Themes, keybindings, and settings
- 🔒 **Secure** - Sandboxed renderer with validated IPC
- 🧩 **Extensible** - Plugin architecture (coming soon)

## 🖼️ Screenshots

<div align="center">
  <img src="./media/screenshot-main.png" alt="Main Interface" width="80%">
  <br><br>
  <img src="./media/screenshot-terminal.png" alt="Integrated Terminal" width="80%">
</div>

## 📥 Download

### macOS

```bash
# Using Homebrew (coming soon)
brew install --cask kimi-ide

# Or download directly
# Download the latest .dmg from the Releases page
```

### Windows

```powershell
# Using Chocolatey (coming soon)
choco install kimi-ide

# Or download directly
# Download the latest .exe from the Releases page
```

### Linux

```bash
# Using Snap (coming soon)
sudo snap install kimi-ide

# Or download directly
# Download the latest .AppImage from the Releases page
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/kimi-ide.git
cd kimi-ide

# Install dependencies
npm install

# Build the application
cd ide
npm run build

# Start Kimi IDE
npm start
```

### Development Mode

```bash
# Run in development mode with hot reload
cd ide
npm run dev
```

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Electron 28.x |
| **UI** | React 18.x, TypeScript 5.x |
| **Editor** | Monaco Editor |
| **Terminal** | node-pty, xterm.js |
| **Styling** | CSS3 with CSS Variables |
| **Build** | Webpack 5 |
| **Testing** | Jest, React Testing Library |
| **Linting** | ESLint, Prettier |

## 📁 Project Structure

```
kimi-ide/
├── 📂 ide/                       # Electron application
│   ├── 📂 src/
│   │   ├── 📂 main/             # Main process (Node.js)
│   │   │   ├── main.ts          # Entry point
│   │   │   └── toolHandlers.ts  # IPC handlers
│   │   ├── 📂 renderer/         # Renderer process (React)
│   │   │   ├── components/      # React components
│   │   │   ├── hooks/           # Custom hooks
│   │   │   └── App.tsx          # Root component
│   │   └── 📂 shared/           # Shared types & utilities
│   ├── 📂 dist/                 # Compiled output
│   └── package.json
├── 📂 docs/                     # Documentation
├── 📂 media/                    # Screenshots & assets
├── 📂 .github/                  # GitHub workflows
└── README.md
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch
```

## 📝 Code Style

We follow strict coding standards. Please read our [Code Style Guide](./CODE_STYLE.md) before contributing.

```bash
# Check code style
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Format code
npm run format
```

## 🤝 Contributing

We love your input! We want to make contributing to Kimi IDE as easy and transparent as possible.

- 🐛 Report bugs by opening an [issue](https://github.com/your-username/kimi-ide/issues)
- 💡 Suggest features through [discussions](https://github.com/your-username/kimi-ide/discussions)
- 📝 Improve documentation
- 🔧 Submit bug fixes or feature PRs

Please read our [Contributing Guide](./CONTRIBUTING.md) and [Code of Conduct](./CODE_OF_CONDUCT.md) for details.

### Quick Start for Contributors

1. Fork the repo and create your branch: `git checkout -b feature/amazing-feature`
2. Make your changes following our [Code Style Guide](./CODE_STYLE.md)
3. Run tests and ensure everything passes
4. Commit with [Conventional Commits](https://www.conventionalcommits.org/): `git commit -m 'feat: add amazing feature'`
5. Push to your fork: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📚 Documentation

- [Architecture](./ARCHITECTURE.md) - System architecture and design decisions
- [Code Style](./CODE_STYLE.md) - Coding standards and best practices
- [Contributing](./CONTRIBUTING.md) - Contribution guidelines
- [Code Review](./CODE_REVIEW_GUIDELINES.md) - Code review process

## 🗺️ Roadmap

See our [Roadmap](./ROADMAP.md) for upcoming features and improvements.

### Planned Features

- [ ] Plugin/Extension system
- [ ] LSP (Language Server Protocol) support
- [ ] Git integration
- [ ] Debugging capabilities
- [ ] Multi-cursor editing
- [ ] Vim mode
- [ ] Settings sync
- [ ] Collaboration features

## 📜 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a list of changes.

## 🏆 Acknowledgments

Kimi IDE wouldn't be possible without these amazing projects:

- [Electron](https://www.electronjs.org/) - Cross-platform desktop apps
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - The code editor that powers VS Code
- [React](https://reactjs.org/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [node-pty](https://github.com/microsoft/node-pty) - Pseudo-terminal support

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 💖 Support

If you find Kimi IDE useful, please consider:

- ⭐ Starring the repository
- 🐦 Sharing on social media
- 📝 Writing a blog post about your experience
- 💰 [Sponsoring](https://github.com/sponsors/your-username) the project

---

<div align="center">
  
  **Made with ❤️ by the Kimi IDE team**
  
  <a href="https://github.com/your-username/kimi-ide/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=your-username/kimi-ide" alt="Contributors">
  </a>
  
</div>
