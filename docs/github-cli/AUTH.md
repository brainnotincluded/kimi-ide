# GitHub CLI Authentication & Security

Complete guide to authentication methods, token management, and security best practices for `gh` CLI.

---

## Authentication Methods

### 1. Interactive Login (Recommended)

```bash
# Login with browser flow
gh auth login

? What account do you want to log into? GitHub.com
? What is your preferred protocol for Git operations? HTTPS
? Authenticate Git with your GitHub credentials? Yes
? How would you like to authenticate GitHub CLI? Login with a web browser

! First copy your one-time code: XXXX-XXXX
- Press Enter to open github.com in your browser...
```

### 2. Token-Based Authentication

```bash
# Login with personal access token
gh auth login --with-token < my-token.txt

# Or via environment variable
export GH_TOKEN=ghp_xxxxxxxxxxxx
gh auth status
```

### 3. GitHub Enterprise Server

```bash
# Login to GitHub Enterprise
gh auth login --hostname github.company.com

# Set as default host
export GH_HOST=github.company.com
```

---

## Token Types

### Personal Access Token (Classic)

**Scopes needed for full functionality:**

| Scope | Purpose |
|-------|---------|
| `repo` | Full control of private repositories |
| `workflow` | Update GitHub Action workflows |
| `read:org` | Read organization membership |
| `gist` | Create and manage gists |
| `delete_repo` | Delete repositories |
| `write:packages` | Upload packages |

**Create token:** https://github.com/settings/tokens

### Fine-Grained Personal Access Token

More secure, repository-scoped tokens:

```bash
# List repositories for token
gh api user/repos --paginate

# Token permissions are configured during creation at:
# https://github.com/settings/personal-access-tokens
```

### GitHub App Installation Token

```bash
# For GitHub Apps, use installation tokens
export GH_TOKEN=$(./get-app-token.sh)
```

---

## Token Management

### Store Tokens Securely

```bash
# macOS Keychain (automatically done by gh)
security find-generic-password -s "gh:github.com" -g

# Linux (secret-tool)
secret-tool store --label="GitHub CLI" host github.com

# Windows Credential Manager
# Automatically managed by gh
```

### Rotate Tokens

```bash
# 1. Generate new token in GitHub settings
# 2. Login with new token
gh auth login --with-token < new-token.txt

# 3. Verify new authentication
gh auth status

# 4. Delete old token in GitHub settings
```

### Multiple Accounts

```bash
# Switch between accounts
gh auth login --hostname github.com  # Personal
gh auth login --hostname github.work.com  # Work

# Use specific account for command
GH_HOST=github.work.com gh repo list
```

---

## Environment Variables

### Essential Variables

```bash
# Authentication
export GH_TOKEN=ghp_xxxxxxxxxxxx           # Personal access token
export GH_ENTERPRISE_TOKEN=ghp_xxxxxxxxxxx # Enterprise token
export GH_HOST=github.company.com          # Default host

# Configuration
export GH_EDITOR=vim                       # Default editor
export GH_BROWSER=firefox                  # Default browser
export GH_PAGER=less                       # Default pager
export GH_PROMPT_DISABLED=1                # Disable interactive prompts
export GH_DEBUG=api                        # Debug mode (api, http, oauth)
```

### Temporary Authentication

```bash
# One-time command with different token
GH_TOKEN=ghp_other_token gh repo list --repo owner/other-repo
```

---

## Security Best Practices

### 1. Token Storage

```bash
# ❌ DON'T: Hardcode tokens
gh auth login --with-token <<< "ghp_hardcoded_token"

# ✅ DO: Use secure storage
echo "$TOKEN" | gh auth login --with-token
# Or let gh handle it securely via browser flow
```

### 2. Least Privilege Principle

```bash
# Use fine-grained tokens with minimal permissions
# Only request scopes you actually need

# Read-only operations
gh auth login --scopes ""

# Repository operations only
gh auth login --scopes "repo"

# Full access (including delete)
gh auth login --scopes "repo,delete_repo,workflow"
```

### 3. CI/CD Security

```yaml
# ✅ DO: Use secrets in GitHub Actions
- name: Run gh command
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: gh repo view

# ❌ DON'T: Hardcode tokens
- name: Bad example
  run: gh auth login --with-token <<< "ghp_hardcoded"
```

### 4. Token Expiration

```bash
# Set token expiration (7-365 days)
# Created at: https://github.com/settings/tokens

# Check token expiration
gh auth status
# Shows: ✓ Logged in to github.com as username (GH_TOKEN)
```

---

## Troubleshooting Auth

### Check Authentication Status

```bash
# Full status
gh auth status

# Output:
# github.com
#   ✓ Logged in to github.com as username (GH_TOKEN)
#   ✓ Git operations for github.com configured to use https protocol.
#   ✓ Token: ghp_********************
#   ✓ Token scopes: gist, read:org, repo, workflow
```

### Fix Authentication Issues

```bash
# Re-authenticate
gh auth refresh

# Force re-authentication
gh auth logout
gh auth login

# Check for token issues
gh auth status 2>&1 | grep -i error
```

### Debug Authentication

```bash
# Enable debug mode
export GH_DEBUG=api
gh repo view

# Check API rate limits
gh api rate_limit

# Test token
gh api user
```

### Common Errors

| Error | Solution |
|-------|----------|
| `401 Bad credentials` | Token expired or revoked. Run `gh auth login` |
| `403 Resource not accessible` | Token lacks required scopes. Use `gh auth refresh --scopes repo,workflow` |
| `404 Not Found` | Repo private and token lacks access, or doesn't exist |
| `Connection refused` | Check `GH_HOST` or network/proxy settings |

---

## Enterprise Configuration

### GitHub Enterprise Server

```bash
# Configure enterprise host
gh auth login --hostname github.company.com

# Verify SSL certificates (default: yes)
gh auth login --hostname github.company.com --insecure-hostname

# Use custom CA bundle
export SSL_CERT_FILE=/path/to/ca-bundle.crt
gh auth login --hostname github.company.com
```

### Proxy Configuration

```bash
# HTTP/HTTPS proxy
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
export NO_PROXY=localhost,127.0.0.1,.company.com

# SOCKS5 proxy
export ALL_PROXY=socks5://proxy.company.com:1080
```

---

## Script Security

### Safe Token Handling

```bash
#!/bin/bash
# secure-script.sh

# Read token from secure location
TOKEN=$(security find-generic-password -s "gh:github.com" -w 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "Error: No GitHub token found"
    exit 1
fi

# Use token without exposing it
GH_TOKEN="$TOKEN" gh repo list

# Clean up
unset TOKEN
```

### Avoiding Token Leaks

```bash
# ❌ DON'T: Include token in command history
echo "ghp_token" | gh auth login --with-token

# ✅ DO: Read from file
gh auth login --with-token < ~/.github/token

# ❌ DON'T: Log full commands
set -x  # This will log tokens!
gh auth login --with-token <<< "$TOKEN"

# ✅ DO: Disable logging for sensitive lines
set +x
echo "$TOKEN" | gh auth login --with-token
set -x
```

---

## Advanced Security

### SSH Authentication for Git

```bash
# Setup SSH for git operations
gh auth login
# ? Authenticate Git with your GitHub credentials? Yes
# ? How would you like to authenticate Git? SSH

# Or manually configure
git config --global url."git@github.com:".insteadOf "https://github.com/"
```

### GPG Signing

```bash
# Enable commit signing
gh auth setup-git
git config --global commit.gpgsign true
git config --global user.signingkey YOUR_GPG_KEY_ID
```

### 2FA Considerations

```bash
# When 2FA is enabled, tokens are required for API access
# Browser-based auth handles 2FA automatically
gh auth login

# For token-based auth, token must be pre-generated with 2FA
gh auth login --with-token < token.txt
```

---

## Security Checklist

- [ ] Use fine-grained tokens when possible
- [ ] Rotate tokens regularly (every 90 days)
- [ ] Store tokens in secure keychain/vault
- [ ] Use minimal required scopes
- [ ] Enable 2FA on GitHub account
- [ ] Monitor token usage in GitHub settings
- [ ] Revoke unused tokens
- [ ] Use `GH_TOKEN` environment variable in CI/CD
- [ ] Never commit tokens to git
- [ ] Review authorized apps regularly

---

## Quick Commands

```bash
# Check who you are
gh api user -q '.login'

# Check token scopes
gh auth status | grep "Token scopes"

# Verify API access
gh api rate_limit

# Logout everywhere
gh auth logout
```

---

*For more security information, visit [GitHub Security](https://docs.github.com/en/authentication)*
