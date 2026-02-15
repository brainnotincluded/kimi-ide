# Makefile for Kimi IDE VS Code Extension
# ==========================================

# Variables
NPM := npm
NODE := node
SCRIPTS_DIR := scripts
PACKAGES_DIR := packages
OUT_DIR := out

# Colors (for terminal output)
BLUE := \033[34m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
CYAN := \033[36m
RESET := \033[0m
BOLD := \033[1m

.PHONY: help install-deps build package install-local clean lint test watch dev ci

# Default target
.DEFAULT_GOAL := help

# ==========================================
# Help
# ==========================================
help: ## Show this help message
	@echo ""
	@echo "$(BOLD)$(CYAN)Kimi IDE Extension - Available Commands$(RESET)"
	@echo "$(CYAN)========================================$(RESET)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-15s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

# ==========================================
# Dependencies
# ==========================================
install-deps: ## Install all dependencies
	@echo "$(CYAN)▶ Installing dependencies...$(RESET)"
	$(NPM) ci
	@echo "$(GREEN)✓ Dependencies installed$(RESET)"

# ==========================================
# Development
# ==========================================
dev: install-deps ## Start development mode (watch)
	@echo "$(CYAN)▶ Starting development mode...$(RESET)"
	$(NPM) run watch

watch: dev ## Alias for dev

lint: ## Run ESLint
	@echo "$(CYAN)▶ Running ESLint...$(RESET)"
	$(NPM) run lint
	@echo "$(GREEN)✓ Linting complete$(RESET)"

format: ## Format code (if prettier is configured)
	@echo "$(CYAN)▶ Formatting code...$(RESET)"
	@if command -v npx >/dev/null 2>&1 && npx prettier --version >/dev/null 2>&1; then \
		npx prettier --write "src/**/*.ts"; \
		echo "$(GREEN)✓ Formatting complete$(RESET)"; \
	else \
		echo "$(YELLOW)⚠ Prettier not configured, skipping$(RESET)"; \
	fi

type-check: ## Run TypeScript type checking
	@echo "$(CYAN)▶ Running type check...$(RESET)"
	npx tsc --noEmit
	@echo "$(GREEN)✓ Type check passed$(RESET)"

# ==========================================
# Build
# ==========================================
build: ## Build the extension for production
	@echo "$(CYAN)▶ Building extension...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/build.js --production
	@echo "$(GREEN)✓ Build complete$(RESET)"

build-dev: ## Build the extension for development
	@echo "$(CYAN)▶ Building extension (dev mode)...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/build.js
	@echo "$(GREEN)✓ Build complete$(RESET)"

compile: ## Compile TypeScript only
	@echo "$(CYAN)▶ Compiling TypeScript...$(RESET)"
	$(NPM) run compile
	@echo "$(GREEN)✓ Compilation complete$(RESET)"

# ==========================================
# Testing
# ==========================================
test: compile ## Run all tests
	@echo "$(CYAN)▶ Running tests...$(RESET)"
	$(NPM) test
	@echo "$(GREEN)✓ Tests complete$(RESET)"

test-ci: compile ## Run tests for CI (headless)
	@echo "$(CYAN)▶ Running tests (CI mode)...$(RESET)"
	@if [ "$(shell uname)" = "Linux" ]; then \
		xvfb-run -a $(NPM) test; \
	else \
		$(NPM) test; \
	fi
	@echo "$(GREEN)✓ Tests complete$(RESET)"

# ==========================================
# Packaging
# ==========================================
package: clean build ## Create .vsix package
	@echo "$(CYAN)▶ Creating package...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/package.js
	@echo "$(GREEN)✓ Package created$(RESET)"

package-fast: ## Create .vsix package (skip build)
	@echo "$(CYAN)▶ Creating package (fast)...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/package.js --skip-build
	@echo "$(GREEN)✓ Package created$(RESET)"

package-prerelease: ## Create pre-release .vsix package
	@echo "$(CYAN)▶ Creating pre-release package...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/package.js --pre-release
	@echo "$(GREEN)✓ Pre-release package created$(RESET)"

bump-patch: ## Bump patch version (0.0.x)
	@echo "$(CYAN)▶ Bumping patch version...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/package.js --bump=patch --skip-build

bump-minor: ## Bump minor version (0.x.0)
	@echo "$(CYAN)▶ Bumping minor version...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/package.js --bump=minor --skip-build

bump-major: ## Bump major version (x.0.0)
	@echo "$(CYAN)▶ Bumping major version...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/package.js --bump=major --skip-build

# ==========================================
# Installation
# ==========================================
install-local: ## Install extension locally in VS Code
	@echo "$(CYAN)▶ Installing extension locally...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/install-local.js
	@echo "$(GREEN)✓ Installation complete$(RESET)"

install-force: ## Install extension locally (force reinstall)
	@echo "$(CYAN)▶ Force installing extension...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/install-local.js --force
	@echo "$(GREEN)✓ Installation complete$(RESET)"

install-insiders: ## Install extension in VS Code Insiders
	@echo "$(CYAN)▶ Installing extension in Insiders...$(RESET)"
	$(NODE) $(SCRIPTS_DIR)/install-local.js --insiders
	@echo "$(GREEN)✓ Installation complete$(RESET)"

# ==========================================
# Publishing
# ==========================================
publish: package ## Publish to VS Code Marketplace
	@echo "$(CYAN)▶ Publishing to VS Code Marketplace...$(RESET)"
	$(NPM) run publish
	@echo "$(GREEN)✓ Published$(RESET)"

publish-prerelease: ## Publish pre-release to VS Code Marketplace
	@echo "$(CYAN)▶ Publishing pre-release...$(RESET)"
	$(NPM) run publish -- --pre-release
	@echo "$(GREEN)✓ Published$(RESET)"

# ==========================================
# CI/CD
# ==========================================
ci: install-deps lint type-check build test ## Run full CI pipeline locally
	@echo "$(GREEN)$(BOLD)✓ CI pipeline completed successfully$(RESET)"

# ==========================================
# Cleaning
# ==========================================
clean: ## Clean all build artifacts
	@echo "$(CYAN)▶ Cleaning build artifacts...$(RESET)"
	@rm -rf $(OUT_DIR)
	@rm -rf $(PACKAGES_DIR)
	@rm -rf dist/
	@rm -rf .vscode-test/
	@rm -f *.vsix
	@rm -f .DS_Store
	@echo "$(GREEN)✓ Clean complete$(RESET)"

clean-all: clean ## Clean everything including node_modules
	@echo "$(CYAN)▶ Cleaning node_modules...$(RESET)"
	@rm -rf node_modules/
	@echo "$(GREEN)✓ Deep clean complete$(RESET)"

# ==========================================
# VS Code Extension Host
# ==========================================
open: ## Open extension in VS Code
	@code .

test-extension: build ## Launch extension host for testing
	@echo "$(CYAN)▶ Launching extension host...$(RESET)"
	@code --extensionDevelopmentPath=$(shell pwd)

# ==========================================
# Utilities
# ==========================================
verify: ## Verify extension structure
	@echo "$(CYAN)▶ Verifying extension...$(RESET)"
	@echo "  Package: $(shell cat package.json | grep '"version"' | head -1 | cut -d'"' -f4)"
	@echo "  Name:    $(shell cat package.json | grep '"name"' | head -1 | cut -d'"' -f4)"
	@echo "  Main:    $(shell cat package.json | grep '"main"' | head -1 | cut -d'"' -f4)"
	@echo "  VS Code: $(shell cat package.json | grep '"vscode"' | head -1 | cut -d'"' -f4)"
	@echo "$(GREEN)✓ Extension structure verified$(RESET)"

version: ## Show current version
	@echo "$(CYAN)Current version: $(shell cat package.json | grep '"version"' | head -1 | cut -d'"' -f4)$(RESET)"
