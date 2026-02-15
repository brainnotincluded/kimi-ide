# Changelog

All notable changes to the Kimi IDE extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Support for new Moonshot AI models
- Enhanced inline completion provider

### Changed
- Improved error handling in Wire Protocol

### Fixed
- Memory leak in long-running sessions

## [0.1.0] - 2024-02-11

### Added
- **Initial release** of Kimi IDE extension
- **Inline Edit (Cmd+K)**: Cursor-like inline editing functionality
  - Select code and press Cmd+K to edit with AI
  - Diff view for reviewing changes
  - Accept/reject with keyboard shortcuts
- **AI Code Actions**:
  - Explain Code - Get detailed explanations
  - Fix Code - Automatically fix bugs
  - Optimize Code - Improve performance
  - Generate Tests - Create unit tests
  - Add Documentation - Generate docstrings
  - Refactor Code - Restructure code
- **Inline Completions**: Ghost text completions as you type
  - Trigger with `// AI: ` or `# AI: ` patterns
  - Debounced AI-powered suggestions
- **Quick Chat**: Ask Kimi anything with Cmd+Shift+K
  - Chat with current file context
  - Responses in side panel
- **Wire Protocol Support**:
  - JSON-RPC over stdio communication with kimi-code-cli
  - Event-driven architecture
  - Automatic reconnection
  - Tool execution and approval system
- **LSP Integration**:
  - Language Server Protocol client
  - AI-powered completions
  - Hover information
  - Signature help
- **Configuration**:
  - API key management
  - Model selection (8k, 32k, 128k)
  - Feature toggles
  - LSP settings
- **Commands**:
  - `kimi.inlineEdit` - Edit selection
  - `kimi.quickChat` - Quick chat
  - `kimi.explainCode` - Explain code
  - `kimi.fixCode` - Fix code
  - `kimi.optimizeCode` - Optimize code
  - `kimi.generateTests` - Generate tests
  - `kimi.addDocs` - Add documentation
  - `kimi.refactorCode` - Refactor code
  - `kimi.configureApiKey` - Configure API key
  - `kimi.validateApiKey` - Validate API key
- **Keyboard Shortcuts**:
  - `Cmd+K` - Inline edit
  - `Cmd+Enter` - Accept edit
  - `Esc` - Reject edit
  - `Cmd+Shift+K` - Quick chat
- **Context Menu**: Kimi submenu in editor context menu
- **Status Bar**: Connection status indicator
- **Welcome Message**: First-time setup guidance

### Technical
- TypeScript 5.3
- VS Code Extension API 1.86+
- Webpack bundling
- ESLint for code quality
- Mocha testing framework
- Makefile for build automation

## Release Roadmap

### [0.2.0] - Planned

#### Added
- Multi-file editing support
- Terminal command suggestions
- Code review mode
- Custom prompt templates

#### Improved
- Faster inline completions
- Better context understanding
- Smaller bundle size

### [0.3.0] - Planned

#### Added
- Git integration (commit messages, PR descriptions)
- Codebase-wide search and replace
- AI-powered debugging assistance
- Voice input support

#### Improved
- Streaming responses for all features
- Better error recovery
- Enhanced diff view

### [1.0.0] - Planned

#### Added
- Full codebase indexing
- Advanced RAG (Retrieval Augmented Generation)
- Custom model endpoints
- Team/collaboration features

#### Improved
- Production-ready stability
- Comprehensive documentation
- Performance optimizations

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2024-02-11 | Initial release |

## Breaking Changes

### 0.1.0
- No breaking changes (initial release)

## Migration Guides

### Upgrading to 0.2.0 (Future)

No migration needed. Settings are backward compatible.

### Upgrading to 1.0.0 (Future)

Settings will be automatically migrated. See migration guide when released.

## Notes

### About This Changelog

- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

### Categories

Each version is categorized as:
- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bug fixes, backward compatible

### Contributing

When adding changes:
1. Add to `[Unreleased]` section
2. Categorize under appropriate heading
3. Include issue/PR reference when applicable
4. Keep descriptions concise but informative
