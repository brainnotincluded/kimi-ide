# Changelog

All notable changes to Kimi IDE will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Comprehensive documentation consolidation
- New troubleshooting guide
- Improved code review guidelines with automated tools
- Architecture documentation with detailed diagrams

### Changed
- Consolidated all README files into single comprehensive README.md
- Standardized documentation format across all files
- Improved navigation with consistent table of contents

### Removed
- Duplicate documentation files
- Outdated temporary files

---

## [2.0.0] - 2026-02-15

### Added
- Multi-Agent System with 6 specialized agents
- Tree-based File Discovery with AST analysis
- Parallel Multi-Strategy Editing (5 strategies)
- Automatic Code Review with 5 reviewers
- Smart Context Management with relevance scoring
- Wire Protocol for CLI integration
- Terminal integration
- LSP completion provider
- Comprehensive test suite

### Changed
- Improved context resolution accuracy
- Enhanced prompt building
- Better error handling and recovery

### Security
- Input validation on all handlers
- Path traversal prevention
- Type-safe IPC communication
- Secure API key storage

---

## [1.5.0] - 2025-08-20

### Added
- Improved context resolution
- Symbol provider
- Better prompt templates
- Configuration options

### Changed
- Refactored context management
- Improved error messages

### Fixed
- Memory leaks in file watching
- Race conditions in async operations

---

## [1.0.0] - 2025-01-15

### Added
- Initial release of Kimi IDE
- VS Code extension architecture
- Basic chat functionality
- Inline editing (Cmd+K)
- Code actions (Explain, Fix, Optimize)
- File explorer integration
- Monaco Editor integration
- Settings persistence
- GitHub Actions CI/CD

---

## Release Notes Template

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes in existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Now removed features

### Fixed
- Bug fixes

### Security
- Security improvements
```

---

For the complete list of commits, see the [commit history](https://github.com/kimi-ai/kimi-ide/commits/main).
