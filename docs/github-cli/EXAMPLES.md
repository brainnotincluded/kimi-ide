# GitHub CLI Usage Examples

Real-world examples and workflows using `gh` CLI.

---

## Table of Contents

- [Daily Development Workflow](#daily-development-workflow)
- [Release Management](#release-management)
- [Issue Management](#issue-management)
- [Code Review Workflow](#code-review-workflow)
- [Automation Scripts](#automation-scripts)
- [CI/CD Integration](#cicd-integration)
- [Team Collaboration](#team-collaboration)

---

## Daily Development Workflow

### Starting a New Feature

```bash
# 1. Create and switch to new branch
git checkout -b feature/new-feature

# 2. Make changes and commit
git add .
git commit -m "feat: add new feature"

# 3. Push branch
git push -u origin feature/new-feature

# 4. Create pull request
gh pr create --title "feat: add new feature" \
             --body "This PR implements the new feature." \
             --reviewer username1,username2

# 5. View PR status
gh pr view --web
```

### Quick Fix Workflow

```bash
# Create, push, and PR in one go
git checkout -b fix/bug-fix
# ... fix the bug ...
git add . && git commit -m "fix: resolve bug"
git push -u origin fix/bug-fix
gh pr create --fill --reviewer username
```

### Continuing Work on Existing PR

```bash
# Checkout existing PR
gh pr checkout 123

# Make changes
git add . && git commit -m "address review feedback"
git push

# View PR checks
gh pr checks --watch
```

---

## Release Management

### Semantic Versioning Release

```bash
#!/bin/bash
# release.sh - Automated release script

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "Usage: ./release.sh v1.0.0"
    exit 1
fi

# 1. Run tests
npm test

# 2. Build
npm run build

# 3. Update version in package.json
npm version "${VERSION#v}" --no-git-tag-version

# 4. Commit version bump
git add package.json package-lock.json
git commit -m "chore: bump version to $VERSION"

# 5. Create and push tag
git tag -a "$VERSION" -m "Release $VERSION"
git push origin main --tags

# 6. Create GitHub release with assets
gh release create "$VERSION" \
    --title "Release $VERSION" \
    --generate-notes \
    ./dist/*.tar.gz ./dist/*.zip

echo "Released $VERSION!"
```

### Hotfix Release

```bash
# 1. Create hotfix branch from main
git checkout main
git pull
git checkout -b hotfix/critical-fix

# 2. Fix and commit
# ... make changes ...
git add . && git commit -m "fix: critical bug fix"

# 3. Create PR and merge quickly
gh pr create --title "hotfix: critical bug" --body "Urgent fix" --label hotfix
gh pr merge --squash --admin

# 4. Create release
gh release create "v$(date +%Y%m%d%H%M)" --notes "Hotfix release"
```

---

## Issue Management

### Bug Report Triage

```bash
#!/bin/bash
# triage-bugs.sh

echo "=== Open Bug Reports ==="
gh issue list --label bug --state open --limit 20

echo -e "\n=== Bugs needing response (no comments) ==="
gh issue list --label bug --json number,title,comments \
  --jq '.[] | select(.comments.totalCount == 0) | "#\(.number): \(.title)"'

echo -e "\n=== Stale bugs (>30 days) ==="
gh issue list --label bug --json number,title,createdAt \
  --jq '.[] | select(.createdAt < "'$(date -v-30d +%Y-%m-%d)'") | "#\(.number): \(.title)"'
```

### Issue Templates

```bash
# Create bug report
gh issue create --title "[BUG] " \
  --label bug \
  --template bug_report.md

# Create feature request
gh issue create --title "[FEATURE] " \
  --label enhancement \
  --template feature_request.md
```

### Bulk Issue Operations

```bash
# Close all issues with label "wontfix"
gh issue list --label wontfix --state open --json number \
  --jq '.[].number' | xargs -I {} gh issue close {} --reason "not planned"

# Add label to multiple issues
for num in 123 124 125; do
    gh issue edit $num --add-label "priority-high"
done

# Assign issues to team member
gh issue list --label bug --json number \
  --jq '.[].number' | xargs -I {} gh issue edit {} --add-assignee username
```

---

## Code Review Workflow

### Daily Review Session

```bash
#!/bin/bash
# daily-review.sh

echo "=== PRs awaiting your review ==="
gh pr list --search "review-requested:@me state:open" --json number,title,author \
  --template '{{range .}}#{{.number}} by @{{.author.login}}: {{.title}}{{"\n"}}{{end}}'

echo -e "\n=== Approved PRs ready to merge ==="
gh pr list --search "review:approved state:open" --json number,title \
  --template '{{range .}}#{{.number}}: {{.title}}{{"\n"}}{{end}}'

echo -e "\n=== Your open PRs ==="
gh pr list --author @me --state open
```

### Review and Merge

```bash
# 1. Checkout PR
gh pr checkout 123

# 2. Review changes
git diff main...HEAD

# 3. Test locally
npm test

# 4. Approve if good
gh pr review --approve --body "LGTM! 🚀"

# 5. Merge
gh pr merge --squash --delete-branch

# 6. Go back to main
git checkout main
git pull
```

### Dependabot PRs Management

```bash
# List all Dependabot PRs
gh pr list --author dependabot[bot] --state open

# Approve and merge all Dependabot minor updates
gh pr list --author dependabot[bot] --state open --json number,title \
  --jq '.[] | select(.title | contains("bump")) | .number' | \
  while read -r num; do
    echo "Processing PR #$num"
    gh pr review $num --approve --body "@dependabot merge"
done
```

---

## Automation Scripts

### Sync Fork with Upstream

```bash
#!/bin/bash
# sync-fork.sh

UPSTREAM="upstream"
BRANCH="main"

# Add upstream if not exists
if ! git remote | grep -q "$UPSTREAM"; then
    echo "Adding upstream remote..."
    gh repo view --json parent \
      --jq '.parent | "git remote add upstream \(.url)"' | sh
fi

# Fetch and merge
git fetch upstream
git checkout $BRANCH
git merge upstream/$BRANCH
git push origin $BRANCH

echo "Fork synced!"
```

### Find Large Files in History

```bash
#!/bin/bash
# find-large-files.sh

gh api graphql -f query='
query {
  repository(owner: "'$(gh repo view --json owner -q '.owner.login')'", name: "'$(gh repo view --json name -q '.name')'") {
    object(expression: "HEAD") {
      ... on Commit {
        file(path: "") {
          entries {
            name
            extension
            object {
              ... on Blob {
                byteSize
              }
            }
          }
        }
      }
    }
  }
}'
```

### Check Repository Health

```bash
#!/bin/bash
# repo-health.sh

REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')

echo "=== Repository: $REPO ==="

echo -e "\n📊 Statistics:"
gh repo view --json stargazersCount,forksCount,openIssuesCount,defaultBranchRef

echo -e "\n🐛 Open Issues:"
gh issue list --state open --limit 5

echo -e "\n🔄 Open PRs:"
gh pr list --state open --limit 5

echo -e "\n⚠️ Failed Workflow Runs:"
gh run list --status failure --limit 5

echo -e "\n📦 Latest Release:"
gh release list --limit 1
```

---

## CI/CD Integration

### GitHub Actions with gh

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Create Release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          VERSION=$(node -p "require('./package.json').version")
          gh release create "v$VERSION" \
            --title "Release v$VERSION" \
            --generate-notes \
            ./dist/*
```

### Deployment Notification

```bash
#!/bin/bash
# notify-deploy.sh

STATUS=$1  # success or failure
VERSION=$2

if [ "$STATUS" == "success" ]; then
    gh issue create \
        --title "✅ Deployment v$VERSION Successful" \
        --label deployment \
        --body "Version $VERSION was successfully deployed."
else
    gh issue create \
        --title "❌ Deployment v$VERSION Failed" \
        --label deployment,urgent \
        --body "Deployment of version $VERSION failed. Please check logs."
fi
```

---

## Team Collaboration

### Weekly Team Report

```bash
#!/bin/bash
# weekly-report.sh

echo "# Weekly Team Report"
echo "Generated: $(date)"
echo ""

echo "## 📊 Activity Summary"
echo ""

echo "### Merged PRs (Last 7 Days)"
gh pr list --state merged --search "merged:>$(date -v-7d +%Y-%m-%d)" \
  --json number,title,author,mergedAt \
  --template '{{range .}}- #{{.number}} by @{{.author.login}}: {{.title}} ({{.mergedAt}}){{"\n"}}{{end}}'

echo ""
echo "### New Issues"
gh issue list --state all --search "created:>$(date -v-7d +%Y-%m-%d)" \
  --json number,title,author \
  --template '{{range .}}- #{{.number}} by @{{.author.login}}: {{.title}}{{"\n"}}{{end}}'

echo ""
echo "### Closed Issues"
gh issue list --state closed --search "closed:>$(date -v-7d +%Y-%m-%d)" \
  --json number,title \
  --template '{{range .}}- #{{.number}}: {{.title}}{{"\n"}}{{end}}'
```

### On-Call Issue Triage

```bash
#!/bin/bash
# oncall-triage.sh

echo "=== Issues requiring attention ==="
echo ""

echo "🔴 Critical (label: critical, no assignee):"
gh issue list --label critical --no-assignee --state open

echo -e "\n🟠 High Priority (> 7 days old):"
gh issue list --search "created:<$(date -v-7d +%Y-%m-%d) state:open" --limit 10

echo -e "\n🔧 Stale PRs (no activity > 3 days):"
gh pr list --search "updated:<$(date -v-3d +%Y-%m-%d) state:open" --limit 10
```

### Contributor Welcome

```bash
#!/bin/bash
# welcome-contributor.sh

USERNAME=$1

echo "Welcoming @$USERNAME..."

# Comment on their first PR
gh pr list --author "$USERNAME" --state all --limit 1 --json number \
  --jq '.[0].number' | xargs -I {} gh pr comment {} \
  --body "Welcome @$USERNAME! 🎉 Thanks for your first contribution!"

# Add to contributors team (if org)
# gh api -X PUT /orgs/{org}/teams/contributors/memberships/$USERNAME
```

---

## Advanced Patterns

### Interactive PR Creation

```bash
#!/bin/bash
# interactive-pr.sh

# Get current branch
BRANCH=$(git branch --show-current)

# Extract issue number from branch name (e.g., feature/123-description)
ISSUE=$(echo "$BRANCH" | grep -oE '^[a-z]+/[0-9]+' | cut -d'/' -f2)

# Get issue title if issue number found
if [ -n "$ISSUE" ]; then
    TITLE=$(gh issue view "$ISSUE" --json title -q '.title')
    PR_TITLE="feat: $TITLE (closes #$ISSUE)"
else
    # Use last commit message
    PR_TITLE=$(git log -1 --pretty=%s)
fi

# Create PR with template
gh pr create \
    --title "$PR_TITLE" \
    --body-file .github/pull_request_template.md \
    --reviewer $(gh repo view --json defaultBranchRef -q '.defaultBranchRef.name' | xargs -I {} git log --merges --grep="Merge pull request" --pretty=%an origin/{}..HEAD | sort -u | head -3 | paste -sd ',' -)
```

### Backup Repository

```bash
#!/bin/bash
# backup-repo.sh

REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
BACKUP_DIR="./backups/$(date +%Y%m%d)"

mkdir -p "$BACKUP_DIR"

echo "Backing up $REPO..."

# Clone mirror
git clone --mirror "https://github.com/$REPO.git" "$BACKUP_DIR/$REPO.git"

# Backup issues
echo "Backing up issues..."
gh issue list --state all --limit 1000 --json number,title,body,state,labels,assignees,createdAt,updatedAt \
    > "$BACKUP_DIR/issues.json"

# Backup PRs
echo "Backing up PRs..."
gh pr list --state all --limit 1000 --json number,title,body,state,author,createdAt,mergedAt \
    > "$BACKUP_DIR/prs.json"

# Backup releases
echo "Backing up releases..."
gh release list --limit 100 --json tagName,name,body,createdAt \
    > "$BACKUP_DIR/releases.json"

echo "Backup complete: $BACKUP_DIR"
```

---

*For more examples, check the [official docs](https://cli.github.com/manual/)*
