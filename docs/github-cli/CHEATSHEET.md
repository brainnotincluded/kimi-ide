# GitHub CLI Cheatsheet

Quick reference for the most commonly used `gh` commands.

---

## 🔐 Auth

```bash
gh auth login              # Login to GitHub
gh auth status             # Check auth status
gh auth logout             # Logout
gh auth refresh            # Refresh authentication
```

---

## 📁 Repositories

```bash
gh repo clone owner/repo   # Clone repo
gh repo create name        # Create new repo
gh repo fork owner/repo    # Fork repo
gh repo list               # List your repos
gh repo view               # View repo details
gh repo view --web         # Open repo in browser
```

---

## 🔄 Pull Requests

```bash
# Create
gh pr create --title "Title" --body "Body"
gh pr create --fill        # Use commit info
gh pr create --draft       # Create as draft

# List & View
gh pr list                 # List open PRs
gh pr list --state merged  # List merged PRs
gh pr view 123             # View PR details
gh pr view --web           # Open PR in browser

# Checkout
gh pr checkout 123         # Checkout PR locally

# Merge
gh pr merge 123            # Merge PR
gh pr merge 123 --squash   # Squash merge
gh pr merge 123 --rebase   # Rebase merge

# Review
gh pr review 123 --approve
gh pr review 123 --request-changes

# Close/Reopen
gh pr close 123
gh pr reopen 123
```

---

## 🐛 Issues

```bash
# Create
gh issue create --title "Title" --body "Body"

# List
gh issue list
gh issue list --label bug
gh issue list --assignee username

# View & Manage
gh issue view 123
gh issue close 123
gh issue reopen 123
```

---

## ⚡ Actions (Workflows)

```bash
gh workflow list           # List workflows
gh workflow run "CI"       # Run workflow
gh run list                # List runs
gh run view 123456         # View run
gh run watch 123456        # Watch run
```

---

## 🏷️ Releases

```bash
gh release create v1.0.0                    # Create release
gh release create v1.0.0 --title "Title"    # With title
gh release create v1.0.0 --draft            # As draft
gh release upload v1.0.0 file.tar.gz        # Upload asset
gh release list                             # List releases
```

---

## 📋 Gists

```bash
gh gist create file.txt           # Create gist
gh gist create file.txt --public  # Public gist
gh gist list                      # List gists
gh gist view GIST_ID              # View gist
```

---

## 🔍 Search

```bash
gh search repos "query"
gh search issues "query" --repo owner/repo
gh search prs "query" --state open
gh search code "function name" --language ts
```

---

## 🔧 Configuration

```bash
gh config get editor
gh config set editor vim
gh config set editor "code --wait"
gh alias set co "pr checkout"
gh alias list
```

---

## 🌐 API

```bash
gh api user
gh api repos/:owner/:repo
gh api repos/:owner/:repo/issues --method POST \
   --input - <<< '{"title":"New issue"}'
```

---

## Common Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--repo` | Specify repo | `gh pr list --repo cli/cli` |
| `--web` | Open in browser | `gh repo view --web` |
| `--json` | JSON output | `gh pr list --json number,title` |
| `--silent` | Minimal output | `gh pr list --silent` |
| `--help` | Show help | `gh pr create --help` |

---

## JSON Output Fields

### PR Fields
```bash
gh pr list --json number,title,state,author,headRefName,baseRefName,createdAt
```

### Repo Fields
```bash
gh repo view --json name,description,stargazersCount,forksCount,defaultBranchRef
```

### Issue Fields
```bash
gh issue list --json number,title,state,assignees,labels,createdAt
```

---

## Aliases (Useful)

```bash
# Add these to your shell config
git config --global alias.pr '!gh pr'
git config --global alias.issue '!gh issue'

# Or use gh aliases
gh alias set co 'pr checkout'
gh alias set web 'repo view --web'
gh alias set issues 'issue list'
gh alias set prs 'pr list'
```

---

## Environment Variables

```bash
export GH_EDITOR=vim                    # Default editor
export GH_PROMPT_DISABLED=true          # Disable prompts
export GH_REPO=owner/repo               # Default repo
export GH_HOST=github.company.com       # GitHub Enterprise
```

---

## One-Liners

```bash
# Create PR and merge
gh pr create --fill && gh pr merge --squash

# Checkout latest PR
gh pr checkout $(gh pr list --limit 1 --json number -q '.[0].number')

# Create issue from template
gh issue create --title "$(git log -1 --pretty=%s)" --body "$(git log -1 --pretty=%b)"

# Sync fork
gh repo sync && git pull

# Close all issues with label "stale"
gh issue list --label stale --json number -q '.[].number' | xargs -I {} gh issue close {}
```

---

## Scripting Patterns

```bash
# Loop through PRs
gh pr list --json number --jq '.[].number' | while read -r num; do
    echo "Processing PR #$num"
done

# Check PR status
if gh pr view 123 --json state -q '.state' | grep -q "MERGED"; then
    echo "Already merged"
fi

# Create release with all assets
gh release create "v$(date +%Y.%m.%d)" --generate-notes dist/*
```

---

*Print this out or bookmark for quick reference!*
