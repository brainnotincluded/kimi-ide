# GitHub CLI Scripting Guide

How to use `gh` CLI effectively in shell scripts and automation.

---

## Output Formats

### JSON Output (Recommended for Scripts)

```bash
# Get machine-readable output
gh pr list --json number,title,author,state

# Parse with jq
gh pr list --json number,title | jq '.[].number'

# Get specific field
gh repo view --json stargazersCount -q '.stargazersCount'
```

### Template Output

```bash
# Custom formatting
gh pr list --template '{{range .}}#{{.number}}: {{.title}}{{"\n"}}{{end}}'

# Table format
gh pr list --template \
'{{tablerow "Number" "Title" "Author"}}
{{tablerow "---" "---" "---"}}
{{range .}}{{tablerow .number .title .author.login}}{{end}}'
```

### Quiet Mode

```bash
# Suppress all output except errors
gh pr merge 123 --squash --silent && echo "Merged successfully"
```

---

## Error Handling

### Exit Codes

```bash
#!/bin/bash
set -e  # Exit on error

# Check if PR exists
if gh pr view 123 > /dev/null 2>&1; then
    echo "PR exists"
else
    echo "PR not found"
    exit 1
fi

# Or with error handling
gh pr merge 123 || {
    echo "Failed to merge PR"
    exit 1
}
```

### Silent Error Checking

```bash
# Check without output
if gh pr view 123 --silent 2>/dev/null; then
    echo "PR #123 exists"
fi

# Check auth status
if ! gh auth status > /dev/null 2>&1; then
    echo "Not authenticated"
    gh auth login
fi
```

---

## Parsing Output

### Using jq

```bash
# Install jq first: brew install jq / apt-get install jq

# Parse PR list
gh pr list --json number,title,author | jq -r '.[] | "\(.number): \(.title) by @\(.author.login)"'

# Get array of PR numbers
NUMBERS=$(gh pr list --json number | jq -r '.[].number')

# Filter by condition
gh pr list --json number,state | jq -r '.[] | select(.state == "OPEN") | .number'
```

### Using grep/sed/awk

```bash
# Simple text parsing (when not using --json)
gh pr list | grep "feature/" | awk '{print $1}'

# Extract PR number from URL
echo "https://github.com/owner/repo/pull/123" | grep -oE '[0-9]+$'
```

---

## Loops and Batch Operations

### Processing Multiple Items

```bash
# Loop through PRs
gh pr list --json number | jq -r '.[].number' | while read -r num; do
    echo "Processing PR #$num"
    gh pr view "$num" --json title
    sleep 1  # Rate limiting
done

# With parallel processing (using xargs)
gh issue list --json number | jq -r '.[].number' | \
    xargs -P 4 -I {} gh issue edit {} --add-label "processed"
```

### Batch Operations

```bash
# Add label to multiple issues
for num in 123 124 125; do
    gh issue edit "$num" --add-label "bug" || echo "Failed for #$num"
done

# Close issues matching search
gh issue list --search "stale" --json number | \
    jq -r '.[].number' | \
    while read -r num; do
        gh issue close "$num" --reason "not planned"
    done
```

---

## Variables and Substitution

### Dynamic Values

```bash
#!/bin/bash

# Get current branch
BRANCH=$(git branch --show-current)

# Get repo info
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')

# Get default branch
DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef -q '.defaultBranchRef.name')

# Create PR with dynamic values
gh pr create \
    --title "feat: changes from $BRANCH" \
    --body "This PR merges changes from \`$BRANCH\` to \`$DEFAULT_BRANCH\`"
```

### Date Calculations

```bash
# Get date 7 days ago
LAST_WEEK=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d '7 days ago' +%Y-%m-%d)

# Search issues from last week
gh issue list --search "created:>$LAST_WEEK"

# Format date for release
RELEASE_DATE=$(date +%Y.%m.%d)
gh release create "v$RELEASE_DATE"
```

---

## Conditional Logic

### Branch-Based Actions

```bash
#!/bin/bash

BRANCH=$(git branch --show-current)

if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
    echo "On main branch - creating release"
    gh release create "v$(date +%Y%m%d%H%M)"
elif [[ "$BRANCH" == hotfix/* ]]; then
    echo "Hotfix branch - urgent PR"
    gh pr create --title "HOTFIX: $(git log -1 --pretty=%s)" --label hotfix
else
    echo "Feature branch - standard PR"
    gh pr create --fill
fi
```

### File Existence Checks

```bash
# Create PR with body from file if exists
if [ -f PULL_REQUEST_TEMPLATE.md ]; then
    gh pr create --body-file PULL_REQUEST_TEMPLATE.md
else
    gh pr create --fill
fi

# Use different template based on branch
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" == bugfix/* ]]; then
    TEMPLATE=.github/bugfix_template.md
else
    TEMPLATE=.github/feature_template.md
fi

gh pr create --body-file "$TEMPLATE"
```

---

## Functions and Reusability

### Helper Functions

```bash
#!/bin/bash

# Check if authenticated
check_auth() {
    if ! gh auth status > /dev/null 2>&1; then
        echo "Error: Not authenticated to GitHub"
        exit 1
    fi
}

# Get PR number from branch
get_pr_number() {
    local branch=$1
    gh pr list --head "$branch" --json number -q '.[0].number'
}

# Wait for checks to pass
wait_for_checks() {
    local pr_number=$1
    echo "Waiting for checks on PR #$pr_number..."
    gh pr checks "$pr_number" --watch
}

# Main script
check_auth

BRANCH=$(git branch --show-current)
PR_NUM=$(get_pr_number "$BRANCH")

if [ -n "$PR_NUM" ]; then
    wait_for_checks "$PR_NUM"
    gh pr merge "$PR_NUM" --squash
else
    echo "No PR found for branch $BRANCH"
fi
```

### Library Functions

```bash
#!/bin/bash
# gh-lib.sh - Reusable functions for gh scripting

# Source this file in other scripts
# source gh-lib.sh

gh_get_repo() {
    gh repo view --json nameWithOwner -q '.nameWithOwner'
}

gh_get_default_branch() {
    gh repo view --json defaultBranchRef -q '.defaultBranchRef.name'
}

gh_pr_exists() {
    local branch=$1
    gh pr list --head "$branch" --silent > /dev/null 2>&1
}

gh_wait_for_checks() {
    local pr_number=$1
    local timeout=${2:-300}  # 5 minutes default
    
    local start_time=$(date +%s)
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [ $elapsed -gt $timeout ]; then
            echo "Timeout waiting for checks"
            return 1
        fi
        
        # Check if all checks passed
        if gh pr checks "$pr_number" 2>/dev/null | grep -q "pass"; then
            return 0
        fi
        
        sleep 10
    done
}
```

---

## Rate Limiting

### Respect Rate Limits

```bash
#!/bin/bash

# Check current rate limit
gh api rate_limit | jq '.rate'

# Slow down operations
sleep_between_calls() {
    sleep 1  # Wait 1 second between API calls
}

# Process with delay
gh issue list --json number | jq -r '.[].number' | while read -r num; do
    gh issue view "$num" --silent
    sleep_between_calls
done
```

### Handle Rate Limit Errors

```bash
#!/bin/bash

make_request() {
    local retry_count=0
    local max_retries=3
    
    while [ $retry_count -lt $max_retries ]; do
        if gh "$@"; then
            return 0
        fi
        
        # Check if rate limited
        if gh "$@" 2>&1 | grep -q "rate limit"; then
            echo "Rate limited. Waiting 60 seconds..."
            sleep 60
            retry_count=$((retry_count + 1))
        else
            return 1
        fi
    done
    
    echo "Max retries exceeded"
    return 1
}

make_request pr list
```

---

## Input/Output Redirection

### Reading Input

```bash
# Read from stdin
echo "Description of changes:"
cat > /tmp/pr_body.txt
gh pr create --body-file /tmp/pr_body.txt

# Interactive input
read -p "Enter PR title: " title
gh pr create --title "$title"
```

### Capturing Output

```bash
# Capture to variable
PR_URL=$(gh pr create --title "Fix" --body "Bug fix" 2>&1 | tail -1)
echo "Created PR: $PR_URL"

# Capture to file
gh repo view --json readme > repo_info.json

# Filter and capture
ISSUE_COUNT=$(gh issue list --json number | jq 'length')
echo "Open issues: $ISSUE_COUNT"
```

---

## Best Practices

### Script Template

```bash
#!/bin/bash
set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')

# Logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[ERROR] $*" >&2
    exit 1
}

# Validation
if ! gh auth status > /dev/null 2>&1; then
    error "Not authenticated to GitHub"
fi

# Main logic
main() {
    log "Starting script..."
    
    # Your code here
    
    log "Completed successfully"
}

main "$@"
```

### Error Handling Pattern

```bash
#!/bin/bash

# Define cleanup function
cleanup() {
    echo "Cleaning up..."
    # Remove temp files, reset state, etc.
}

trap cleanup EXIT

# Run with error handling
if ! gh pr create --title "Test"; then
    echo "Failed to create PR"
    exit 1
fi
```

### Testing Scripts

```bash
#!/bin/bash
# test-gh-script.sh

# Mock gh command for testing
mock_gh() {
    echo 'Mock gh: $@'
}

# Use mock in test mode
if [ "${TEST_MODE:-}" = "true" ]; then
    GH_CMD=mock_gh
else
    GH_CMD=gh
fi

$GH_CMD repo view
```

---

## Common Patterns

### Find and Replace

```bash
# Update issue labels
gh issue list --label old-label --json number | \
    jq -r '.[].number' | \
    while read -r num; do
        gh issue edit "$num" \
            --remove-label old-label \
            --add-label new-label
    done
```

### Synchronization

```bash
# Sync all forks
gh repo list --fork | while read -r repo; do
    repo_name=$(echo "$repo" | awk '{print $1}')
    echo "Syncing $repo_name..."
    gh repo sync "$repo_name" || echo "Failed to sync $repo_name"
done
```

### Reporting

```bash
# Generate weekly report
#!/bin/bash

REPORT_FILE="weekly-report-$(date +%Y-%m-%d).md"

cat > "$REPORT_FILE" << EOF
# Weekly Report

## PRs Created
$(gh pr list --author @me --search "created:>$(date -v-7d +%Y-%m-%d)" --json title | jq -r '.[].title' | sed 's/^/- /')

## Issues Closed
$(gh issue list --assignee @me --state closed --search "closed:>$(date -v-7d +%Y-%m-%d)" --json title | jq -r '.[].title' | sed 's/^/- /')
EOF

echo "Report saved to $REPORT_FILE"
```

---

*For more scripting tips, see the [GitHub CLI manual](https://cli.github.com/manual/)*
