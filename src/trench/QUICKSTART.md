# 🚀 Trench CLI - Quick Start

## Installation

```bash
# Clone and setup
cd /Users/mac/kimi-vscode/src/trench
npm install
npm run build

# Link for global usage
npm link
# or
npx tsx src/cli.ts
```

## Basic Usage

```bash
# Search
trench search "React Server Components"

# Research with AI synthesis
trench research "quantum computing applications" --depth comprehensive

# Archive a website
trench archive https://ardupilot.org --output ./ardupilot-docs

# Analyze
trench analyze https://example.com

# Remix archived site
trench remix ./ardupilot-docs --theme docusaurus

# Search code
trench code "distributed training" --language python --min-stars 1000

# Search papers
trench papers "attention mechanism" --since 2023

# Search community
trench community "Rust vs Go" --sources hn,reddit
```

## Environment Setup

```bash
# Add to ~/.bashrc or ~/.zshrc
export TRENCH_GITHUB_API_KEY="your_github_token"
export TRENCH_OPENAI_API_KEY="your_openai_key"  # Optional, for AI synthesis
```

## MCP Server

```bash
# Start MCP server for AI integration
trench mcp
```

## Output Formats

```bash
# JSON for piping
trench search "AI" --format json | jq '.[0]'

# HTML report
trench analyze https://site.com --format html -o report.html

# Markdown (default)
trench research "topic" --format markdown
```
