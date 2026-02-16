#!/bin/bash
#
# GitHub Setup Script for Kimi IDE
# Automates creating GitHub repo and pushing code
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REPO_NAME="kimi-ide"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🚀 Kimi IDE GitHub Setup${NC}"
echo "========================"
echo ""

# Check if we're in the right directory
cd "$PROJECT_DIR"

# Check git status
echo -e "${BLUE}📋 Checking git status...${NC}"
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Not a git repository!${NC}"
    exit 1
fi

# Show current commits
echo -e "${GREEN}✓ Git repository found${NC}"
echo ""
echo "Commits to push:"
git log --oneline -10
echo ""

# Check if already has remote
if git remote -v > /dev/null 2>&1 && [ -n "$(git remote)" ]; then
    echo -e "${YELLOW}⚠️  Remote already configured:${NC}"
    git remote -v
    echo ""
    read -p "Push to existing remote? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}📤 Pushing to existing remote...${NC}"
        git push -u origin main
        echo -e "${GREEN}✅ Pushed successfully!${NC}"
        exit 0
    fi
fi

# Check for GitHub CLI
echo -e "${BLUE}🔧 Checking for GitHub CLI...${NC}"
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}⚠️  GitHub CLI (gh) not found${NC}"
    echo ""
    echo "Install it with:"
    echo "  brew install gh    # macOS"
    echo "  apt install gh     # Ubuntu/Debian"
    echo "  winget install --id GitHub.cli  # Windows"
    echo ""
    echo "Or download from: https://cli.github.com/"
    echo ""
    
    # Offer manual setup
    read -p "Continue with manual setup instead? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        manual_setup
    fi
    exit 1
fi

echo -e "${GREEN}✓ GitHub CLI found${NC}"

# Check authentication
echo -e "${BLUE}🔐 Checking GitHub authentication...${NC}"
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not authenticated to GitHub${NC}"
    echo ""
    read -p "Run 'gh auth login' now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh auth login
    else
        echo -e "${RED}❌ Authentication required${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Authenticated to GitHub${NC}"

# Get GitHub username
echo -e "${BLUE}👤 Getting GitHub info...${NC}"
GITHUB_USER=$(gh api user -q '.login' 2>/dev/null || echo "")
if [ -z "$GITHUB_USER" ]; then
    read -p "Enter your GitHub username: " GITHUB_USER
fi
echo -e "${GREEN}✓ GitHub user: $GITHUB_USER${NC}"

# Check if repo exists
echo -e "${BLUE}📁 Checking if repository exists...${NC}"
if gh repo view "$GITHUB_USER/$REPO_NAME" &> /dev/null; then
    echo -e "${YELLOW}⚠️  Repository '$REPO_NAME' already exists!${NC}"
    read -p "Continue and push to existing repo? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    REPO_EXISTS=true
else
    REPO_EXISTS=false
fi

# Create or configure repo
if [ "$REPO_EXISTS" = false ]; then
    echo ""
    echo "Repository options:"
    echo "  1) Public (recommended for open source)"
    echo "  2) Private"
    read -p "Choose (1/2): " -n 1 -r
    echo
    
    if [[ $REPLY == "2" ]]; then
        VISIBILITY="--private"
        VISIBILITY_TEXT="private"
    else
        VISIBILITY="--public"
        VISIBILITY_TEXT="public"
    fi
    
    echo -e "${BLUE}📦 Creating $VISIBILITY_TEXT repository '$REPO_NAME'...${NC}"
    gh repo create "$REPO_NAME" $VISIBILITY --source=. --remote=origin --push
    echo -e "${GREEN}✅ Repository created and code pushed!${NC}"
else
    # Add remote and push
    echo -e "${BLUE}🔗 Adding remote...${NC}"
    git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git" 2>/dev/null || true
    
    echo -e "${BLUE}📤 Pushing code...${NC}"
    git push -u origin main
    echo -e "${GREEN}✅ Code pushed!${NC}"
fi

# Success message
echo ""
echo -e "${GREEN}🎉 Success!${NC}"
echo ""
echo "Repository URL: https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""
echo "Next steps:"
echo "  1. Visit: https://github.com/$GITHUB_USER/$REPO_NAME"
echo "  2. Add a description and topics"
echo "  3. Enable GitHub Actions for CI/CD"
echo "  4. Set up branch protection rules"
echo ""

# Open browser (optional)
read -p "Open repository in browser? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open "https://github.com/$GITHUB_USER/$REPO_NAME"
fi

exit 0
