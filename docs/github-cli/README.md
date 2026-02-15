# GitHub CLI (gh) Documentation

> **Location**: `/Users/mac/projects/kimi-ide/docs/github-cli/`
> 
> **Installed Version**: 2.82.0
> 
> **Binary Path**: `/opt/homebrew/bin/gh`

---

## Overview

GitHub CLI (`gh`) is GitHub's official command-line tool. It brings pull requests, issues, and other GitHub concepts to the terminal next to where you are already working with `git`.

### Why Use gh?

- 🚀 **Faster Workflow** - Create PRs, issues, and manage repos without leaving the terminal
- 🔧 **Scripting** - Automate GitHub operations in shell scripts
- 📝 **Code Review** - Review and merge PRs from the command line
- 🔍 **Search** - Find repositories, code, and users quickly

---

## Quick Start

### Check Installation

```bash
# Check if gh is installed
gh --version

# Output: gh version 2.82.0 (2025-10-15)
```

### Authentication

```bash
# Login to GitHub
gh auth login

# Check current authentication status
gh auth status

# Logout
gh auth logout
```

### Basic Usage

```bash
# Get help
gh --help

# Get help for a specific command
gh pr --help
gh repo --help
```

---

## Documentation Files

| File | Description | Use Case |
|------|-------------|----------|
| [README.md](./README.md) | This file - Overview and quick start | First time users |
| [COMMANDS.md](./COMMANDS.md) | Complete command reference | Looking up specific commands |
| [EXAMPLES.md](./EXAMPLES.md) | Real-world usage examples | Learning common workflows |
| [CHEATSHEET.md](./CHEATSHEET.md) | Quick reference | Quick lookup while working |
| [AUTH.md](./AUTH.md) | Authentication & security | Setting up auth, tokens |
| [SCRIPTING.md](./SCRIPTING.md) | Using gh in scripts | Automation and scripting |

---

## Command Categories

### 🔐 Authentication
```bash
gh auth login              # Login
gh auth status             # Check status
gh auth logout             # Logout
gh auth refresh            # Refresh token
```

### 📁 Repositories
```bash
gh repo clone owner/repo   # Clone
gh repo create name        # Create repo
gh repo fork owner/repo    # Fork
gh repo list               # List repos
gh repo view               # View repo
```

### 🔄 Pull Requests
```bash
gh pr create               # Create PR
gh pr list                 # List PRs
gh pr checkout 123         # Checkout PR
gh pr view 123             # View PR
gh pr merge 123            # Merge PR
gh pr review 123           # Review PR
```

### 🐛 Issues
```bash
gh issue create            # Create issue
gh issue list              # List issues
gh issue view 123          # View issue
gh issue close 123         # Close issue
```

### ⚡ Workflows
```bash
gh workflow list           # List workflows
gh workflow run "CI"       # Run workflow
gh run list                # List runs
gh run view 123            # View run
```

### 🏷️ Releases
```bash
gh release create v1.0.0   # Create release
gh release list            # List releases
gh release upload ...      # Upload assets
```

---

## Quick Examples

### Daily Development

```bash
# Create PR
git checkout -b feature/new-feature
git add . && git commit -m "feat: add feature"
git push -u origin feature/new-feature
gh pr create --fill --web

# Review and merge
gh pr checkout 123
gh pr review --approve
gh pr merge --squash --delete-branch
```

### Repository Management

```bash
# Clone and setup
git clone $(gh repo view --json url -q '.url')
gh repo fork owner/repo --clone

# Sync fork
git checkout main
git pull upstream main
git push origin main
```

### Automation

```bash
# Close stale issues
gh issue list --label stale --json number | \
  jq -r '.[].number' | \
  xargs -I {} gh issue close {} --reason "not planned"

# Create release
gh release create "v$(date +%Y.%m.%d)" --generate-notes
```

---

## Configuration

### Environment Variables

```bash
export GH_EDITOR=vim                    # Default editor
export GH_PROMPT_DISABLED=true          # Disable prompts
export GH_TOKEN=ghp_xxx                 # Auth token
export GH_HOST=github.company.com       # Enterprise
```

### Config Commands

```bash
gh config set editor vim
gh config set prompt disabled
gh config get editor
gh config list
```

---

## Tips for AI Agents

### JSON Output (For Parsing)

```bash
# Get structured data
gh pr list --json number,title,author
gh repo view --json name,description,stargazersCount

# Parse with jq
gh pr list --json number | jq -r '.[].number'
```

### Common Checks

```bash
# Check if authenticated
gh auth status > /dev/null 2>&1 && echo "OK" || echo "Auth needed"

# Check if in git repo
git rev-parse --git-dir > /dev/null 2>&1 || echo "Not a git repo"

# Get current repo
gh repo view --json nameWithOwner -q '.nameWithOwner'
```

### Useful Flags

```bash
--web          # Open in browser
--json         # Machine-readable output
--silent       # Minimal output
--fill         # Use commit info for PR
--repo OWNER/REPO  # Specify repo
```

---

## External Resources

- **Official Docs**: https://cli.github.com/manual/
- **GitHub Docs**: https://docs.github.com/en/github-cli
- **Repository**: https://github.com/cli/cli
- **Release Notes**: https://github.com/cli/cli/releases

---

## Version Information

- **Current Version**: 2.82.0
- **Installation Date**: Pre-installed on system
- **Last Updated**: October 2025
- **Platform**: macOS (Apple Silicon)

---

*This documentation is maintained for the Kimi IDE project*
