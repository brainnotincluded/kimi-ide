# Build Scripts

This directory contains build and deployment scripts for the Kimi IDE VS Code Extension.

## Scripts Overview

### `build.js`
Builds the extension for development or production.

```bash
# Development build
node scripts/build.js

# Production build
node scripts/build.js --production

# With webpack bundling (if webpack.config.js exists)
node scripts/build.js --webpack
```

### `package.js`
Creates a .vsix package for distribution.

```bash
# Create package
node scripts/package.js

# Skip build step
node scripts/package.js --skip-build

# Create pre-release package
node scripts/package.js --pre-release

# Bump version
node scripts/package.js --bump=patch
node scripts/package.js --bump=minor
node scripts/package.js --bump=major

# Target specific platform
node scripts/package.js --target=win32-x64
```

### `install-local.js`
Installs the extension locally in VS Code.

```bash
# Install latest package
node scripts/install-local.js

# Force reinstall
node scripts/install-local.js --force

# Install in VS Code Insiders
node scripts/install-local.js --insiders

# Install specific package
node scripts/install-local.js ./packages/kimi-ide-0.1.0.vsix
```

## Makefile Commands

For convenience, all scripts can be accessed via Makefile:

```bash
# Dependencies
make install-deps

# Development
make dev          # Watch mode
make lint         # Run ESLint
make type-check   # TypeScript check

# Build
make build        # Production build
make build-dev    # Development build

# Testing
make test         # Run tests
make test-ci      # CI tests (headless)

# Packaging
make package              # Create .vsix
make package-fast         # Skip build
make package-prerelease   # Pre-release

# Version management
make bump-patch   # 0.0.x
make bump-minor   # 0.x.0
make bump-major   # x.0.0

# Installation
make install-local   # Install in VS Code
make install-force   # Force reinstall
make install-insiders # Install in Insiders

# CI/CD
make ci           # Full CI pipeline

# Cleaning
make clean        # Clean build artifacts
make clean-all    # Clean everything
```

## CI/CD

GitHub Actions workflow is configured in `.github/workflows/ci.yml`:

- Runs on push to `main`, `master`, `develop`
- Runs on pull requests
- Jobs: Lint → Build → Test → Package
- Creates release artifacts on main branch
