# GitHub CLI Command Reference

Complete reference for all `gh` commands organized by category.

---

## Table of Contents

- [Auth Commands](#auth-commands)
- [Repository Commands](#repository-commands)
- [Pull Request Commands](#pull-request-commands)
- [Issue Commands](#issue-commands)
- [Workflow Commands](#workflow-commands)
- [Release Commands](#release-commands)
- [Gist Commands](#gist-commands)
- [Codespace Commands](#codespace-commands)
- [Miscellaneous Commands](#miscellaneous-commands)

---

## Auth Commands

Manage authentication with GitHub.

```bash
# Login to GitHub
gh auth login
gh auth login --hostname github.company.com  # GitHub Enterprise

# Check authentication status
gh auth status
gh auth status --hostname github.company.com

# Logout
gh auth logout
gh auth logout --hostname github.company.com

# Refresh authentication
gh auth refresh
gh auth refresh --scopes repo,workflow

# Setup git credentials
gh auth setup-git
```

### Token Scopes

Common scopes for `gh auth login`:
- `repo` - Full control of private repositories
- `workflow` - Update GitHub Action workflows
- `read:org` - Read org membership
- `gist` - Create gists

---

## Repository Commands

### repo clone

```bash
# Clone a repository
gh repo clone cli/cli
gh repo clone https://github.com/cli/cli
gh repo clone owner/repo -- --depth 1  # pass git flags
```

### repo create

```bash
# Create a new repository
gh repo create my-project
gh repo create my-project --public
gh repo create my-project --private
gh repo create my-project --internal
gh repo create my-project --template owner/template-repo

# Create from current directory
gh repo create --source=. --remote=origin --push
```

### repo fork

```bash
# Fork a repository
gh repo fork cli/cli
gh repo fork cli/cli --clone
gh repo fork cli/cli --remote
```

### repo list

```bash
# List repositories
gh repo list
gh repo list --limit 100
gh repo list --visibility public
gh repo list --visibility private
gh repo list --source  # exclude forks
gh repo list --fork    # only forks
gh repo list --language go
gh repo list --topic ai
```

### repo view

```bash
# View repository details
gh repo view
gh repo view cli/cli
gh repo view --web
gh repo view --json name,description,stargazersCount
```

### repo delete

```bash
# Delete a repository (DANGER)
gh repo delete owner/repo --yes
```

### repo sync

```bash
# Sync fork with upstream
gh repo sync
gh repo sync owner/repo --branch main
```

---

## Pull Request Commands

### pr create

```bash
# Create a pull request
gh pr create
gh pr create --title "Fix bug" --body "Description"
gh pr create --fill  # use commit info for title/body
gh pr create --draft
gh pr create --base main
gh pr create --head feature-branch
gh pr create --reviewer user1,user2
gh pr create --assignee user
gh pr create --label bug,urgent
gh pr create --milestone "v1.0"
gh pr create --project "Roadmap"
```

### pr list

```bash
# List pull requests
gh pr list
gh pr list --state open
gh pr list --state closed
gh pr list --state merged
gh pr list --author username
gh pr list --assignee username
gh pr list --label bug
gh pr list --base main
gh pr list --head feature
gh pr list --limit 50
gh pr list --json number,title,author
```

### pr view

```bash
# View pull request details
gh pr view 123
gh pr view https://github.com/owner/repo/pull/123
gh pr view --web
gh pr view --comments
gh pr view --json number,title,body,state
```

### pr checkout

```bash
# Checkout a PR locally
gh pr checkout 123
gh pr checkout 123 --branch my-branch
gh pr checkout 123 --force
gh pr checkout 123 --recurse-submodules
```

### pr merge

```bash
# Merge a pull request
gh pr merge 123
gh pr merge 123 --merge       # create merge commit
gh pr merge 123 --squash      # squash and merge
gh pr merge 123 --rebase      # rebase and merge
gh pr merge 123 --auto        # enable auto-merge
gh pr merge 123 --admin       # use admin privileges
gh pr merge 123 --delete-branch
```

### pr review

```bash
# Review a pull request
gh pr review 123
gh pr review 123 --approve
gh pr review 123 --request-changes --body "Needs work"
gh pr review 123 --comment --body "LGTM"
gh pr review 123 --body-file review.txt
```

### pr close

```bash
# Close a pull request
gh pr close 123
gh pr close 123 --delete-branch
```

### pr reopen

```bash
# Reopen a pull request
gh pr reopen 123
```

### pr ready

```bash
# Mark draft PR as ready
gh pr ready 123
```

### pr draft

```bash
# Mark PR as draft
gh pr draft 123
```

### pr checks

```bash
# View PR checks
gh pr checks 123
gh pr checks 123 --watch
gh pr checks 123 --fail-fast
```

### pr diff

```bash
# View PR diff
gh pr diff 123
gh pr diff 123 --patch
gh pr diff 123 --name-only
```

---

## Issue Commands

### issue create

```bash
# Create an issue
gh issue create --title "Bug report" --body "Description"
gh issue create --label bug,urgent
gh issue create --assignee user1,user2
gh issue create --milestone "v1.0"
gh issue create --project "Backlog"
gh issue create --body-file description.md
```

### issue list

```bash
# List issues
gh issue list
gh issue list --state open
gh issue list --state closed
gh issue list --state all
gh issue list --label bug
gh issue list --label "help wanted"
gh issue list --assignee username
gh issue list --author username
gh issue list --milestone "v1.0"
gh issue list --search "error in production"
```

### issue view

```bash
# View issue details
gh issue view 123
gh issue view 123 --web
gh issue view 123 --comments
```

### issue close

```bash
# Close an issue
gh issue close 123
gh issue close 123 --reason "not planned"
```

### issue reopen

```bash
# Reopen an issue
gh issue reopen 123
```

### issue edit

```bash
# Edit an issue
gh issue edit 123 --title "New title"
gh issue edit 123 --body "New description"
gh issue edit 123 --add-label bug
gh issue edit 123 --remove-label feature
gh issue edit 123 --add-assignee user
gh issue edit 123 --remove-assignee user
```

### issue comment

```bash
# Add a comment
gh issue comment 123 --body "Thanks for the report!"
gh issue comment 123 --body-file comment.md
gh issue comment 123 --edit-last
```

---

## Workflow Commands

### workflow list

```bash
# List workflows
gh workflow list
gh workflow list --all
```

### workflow view

```bash
# View workflow
gh workflow view "CI"
gh workflow view 123456
gh workflow view --yaml
gh workflow view --web
```

### workflow run

```bash
# Run a workflow
gh workflow run "CI"
gh workflow run ci.yml --ref main
gh workflow run deploy.yml -f environment=production
```

### workflow disable

```bash
# Disable a workflow
gh workflow disable "CI"
```

### workflow enable

```bash
# Enable a workflow
gh workflow enable "CI"
```

### run list

```bash
# List workflow runs
gh run list
gh run list --workflow "CI"
gh run list --branch main
gh run list --user username
gh run list --limit 20
```

### run view

```bash
# View workflow run
gh run view 1234567890
gh run view 1234567890 --log
gh run view 1234567890 --log-failed
gh run view --job 9876543210
```

### run watch

```bash
# Watch a run in progress
gh run watch 1234567890
gh run watch 1234567890 --exit-status
```

### run rerun

```bash
# Rerun a workflow
gh run rerun 1234567890
gh run rerun 1234567890 --failed
```

### run download

```bash
# Download artifacts
gh run download 1234567890
gh run download 1234567890 --name artifact-name
gh run download 1234567890 --dir ./artifacts
```

---

## Release Commands

### release create

```bash
# Create a release
gh release create v1.0.0
gh release create v1.0.0 --title "Version 1.0.0"
gh release create v1.0.0 --notes "Release notes"
gh release create v1.0.0 --notes-file release-notes.md
gh release create v1.0.0 --draft
gh release create v1.0.0 --prerelease
gh release create v1.0.0 --target main
```

### release list

```bash
# List releases
gh release list
gh release list --limit 20
```

### release view

```bash
# View release
gh release view v1.0.0
gh release view v1.0.0 --json tagName,name,body
```

### release upload

```bash
# Upload assets
gh release upload v1.0.0 ./app.tar.gz
gh release upload v1.0.0 ./app.tar.gz ./checksums.txt
gh release upload v1.0.0 ./app.tar.gz --clobber
```

### release download

```bash
# Download release assets
gh release download v1.0.0
gh release download v1.0.0 --pattern "*.tar.gz"
gh release download v1.0.0 --dir ./downloads
```

### release delete

```bash
# Delete a release
gh release delete v1.0.0
gh release delete v1.0.0 --yes
```

---

## Gist Commands

### gist create

```bash
# Create a gist
gh gist create file.txt
gh gist create file.txt --public
gh gist create file.txt --secret
gh gist create file.txt --desc "Description"
gh gist create file1.txt file2.txt
```

### gist list

```bash
# List gists
gh gist list
gh gist list --limit 20
gh gist list --public
gh gist list --secret
```

### gist view

```bash
# View gist
gh gist view GIST_ID
gh gist view GIST_ID --files
gh gist view GIST_ID --raw
gh gist view GIST_ID --web
```

### gist edit

```bash
# Edit gist
gh gist edit GIST_ID
gh gist edit GIST_ID --filename file.txt
```

### gist delete

```bash
# Delete gist
gh gist delete GIST_ID
```

### gist clone

```bash
# Clone a gist
gh gist clone GIST_ID
```

---

## Codespace Commands

### codespace create

```bash
# Create a codespace
gh codespace create --repo owner/repo
gh codespace create --repo owner/repo --branch main
gh codespace create --repo owner/repo --machine basicLinux32gb
```

### codespace list

```bash
# List codespaces
gh codespace list
gh codespace list --limit 20
```

### codespace code

```bash
# Open codespace in VS Code
gh codespace code
gh codespace code -c CODESPACE_NAME
```

### codespace stop

```bash
# Stop a codespace
gh codespace stop
gh codespace stop -c CODESPACE_NAME
```

### codespace delete

```bash
# Delete a codespace
gh codespace delete
gh codespace delete -c CODESPACE_NAME
```

---

## Miscellaneous Commands

### alias

```bash
# Create an alias
gh alias set co 'pr checkout'
gh alias set web 'repo view --web'

# List aliases
gh alias list

# Delete alias
gh alias delete co
```

### api

```bash
# Make API requests
gh api user
gh api repos/:owner/:repo
gh api repos/:owner/:repo/issues --method POST --input - <<EOF
{"title": "New issue"}
EOF
gh api graphql -f query='
  query {
    viewer {
      login
    }
  }
'
```

### browse

```bash
# Open GitHub in browser
gh browse
gh browse --branch main
gh browse --commit HEAD
gh browse issues
gh browse pulls
gh browse settings
```

### completion

```bash
# Generate shell completion scripts
gh completion --shell bash
gh completion --shell zsh
gh completion --shell fish
```

### config

```bash
# Get/set configuration
gh config get editor
gh config set editor vim
gh config set prompt disabled
gh config set pager less
gh config list
```

### extension

```bash
# Manage extensions
gh extension install owner/gh-extension
gh extension list
gh extension remove owner/gh-extension
gh extension upgrade owner/gh-extension
gh extension upgrade --all

# Create extension
gh extension create my-extension
```

### gpg-key

```bash
# Manage GPG keys
gh gpg-key list
gh gpg-key add key.asc
gh gpg-key delete KEY_ID
```

### label

```bash
# Manage labels
gh label list
gh label create bug --color ff0000 --description "Bug reports"
gh label delete bug
```

### project

```bash
# Manage projects
gh project list
gh project view 1
gh project create --title "Roadmap" --owner owner
```

### search

```bash
# Search GitHub
gh search repos "machine learning"
gh search repos "machine learning" --language python
gh search repos --stars ">1000"
gh search issues "error" --repo owner/repo
gh search prs "fix" --state open
gh search code "function name" --language typescript
```

### secret

```bash
# Manage secrets
gh secret list
gh secret set MY_SECRET --body "value"
gh secret set MY_SECRET --env production
gh secret delete MY_SECRET
```

### ssh-key

```bash
# Manage SSH keys
gh ssh-key list
gh ssh-key add ~/.ssh/id_ed25519.pub
gh ssh-key delete KEY_ID
```

### status

```bash
# View status of relevant issues/PRs
gh status
```

### variable

```bash
# Manage variables
gh variable list
gh variable set MY_VAR --body "value"
gh variable set MY_VAR --env production
gh variable delete MY_VAR
```

---

## Global Flags

These flags work with most commands:

```bash
# Specify repository
gh pr list --repo owner/repo
gh pr view 123 --repo owner/repo

# JSON output
gh pr list --json number,title,author
gh repo view --json name,description

# Quiet mode
gh pr list --silent

# Verbose output
gh pr list --verbose

# Help
gh pr --help
gh pr create --help
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Generic error |
| 2 | Authentication error |
| 4 | Cancelled by user |
| 8 | API rate limit exceeded |

---

*For more details on any command, run `gh <command> --help`*
