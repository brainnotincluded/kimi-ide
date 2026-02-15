# 🔍 Trench CLI

> Perplexity-like research from the terminal. Search, archive, analyze, and remix the web.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/trench-cli)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## ✨ Features

- **🔍 Universal Search** - Search across web, GitHub, arXiv, Hacker News, Reddit, and more
- **🔬 Deep Research** - AI-powered synthesis like Perplexity
- **📦 Web Archiving** - Archive complete websites for offline use
- **📊 Site Analysis** - Analyze structure, content, and tech stack
- **🎨 Theme Remixing** - Transform archived sites with modern themes
- **💻 Code Search** - Find code on GitHub with advanced filters
- **📄 Paper Search** - Search academic papers from arXiv and Semantic Scholar
- **💬 Community Search** - Search Hacker News, Reddit, Dev.to discussions
- **🤖 MCP Integration** - Works as MCP server for AI systems

## 📦 Installation

```bash
# Install globally
npm install -g trench-cli

# Or use with npx
npx trench-cli <command>
```

## 🚀 Quick Start

```bash
# Search with synthesis like Perplexity
trench research "React Server Components performance"

# Archive a website
trench archive https://ardupilot.org --output ./ardupilot-archive

# Analyze a website
trench analyze https://example.com --type full

# Remix an archived site
trench remix ./ardupilot-archive --theme docusaurus

# Search code on GitHub
trench code "distributed training PyTorch" --language python --min-stars 1000

# Search academic papers
trench papers "attention mechanism transformers" --since 2023

# Search community discussions
trench community "Is Rust worth learning 2024?" --sources hn,reddit
```

## 📖 Commands

### 🔍 `search` - Universal Search

Search across multiple sources simultaneously.

```bash
trench search "machine learning"
trench search "Rust async" --sources github,reddit
trench search "climate change" --limit 20 --format json
```

**Options:**
- `-s, --sources <sources>` - Comma-separated sources (web, github, arxiv, hn, reddit, stackoverflow)
- `-l, --limit <n>` - Maximum results (default: 10)
- `--no-cache` - Skip cache

### 🔬 `research` - Deep Research

AI-powered research with synthesis like Perplexity.

```bash
trench research "quantum computing applications"
trench research "React Server Components" --depth comprehensive
trench research "AI safety" --max-sources 50
```

**Options:**
- `-d, --depth <depth>` - Research depth: quick, standard, comprehensive (default: standard)
- `-m, --max-sources <n>` - Maximum sources to analyze (default: 20)

### 📦 `archive` - Web Archiving

Archive complete websites for offline use.

```bash
trench archive https://docs.python.org --output ./python-docs
trench archive https://example.com --full-assets --max-pages 50
trench archive https://site.com --js --depth 5
```

**Options:**
- `-o, --output <dir>` - Output directory (default: ./archive)
- `--full-assets` - Download all assets (default: true)
- `--no-assets` - Skip asset downloading
- `--js` - Include JavaScript (default: false)
- `-d, --depth <n>` - Crawl depth (default: 3)
- `--max-pages <n>` - Maximum pages to archive (default: 100)

### 📊 `analyze` - Site Analysis

Analyze website structure, content, or tech stack.

```bash
trench analyze https://example.com
trench analyze ./my-archive --type tech
trench analyze https://site.com --type content --format html
```

**Analysis Types:**
- `structure` - Internal/external links, depth, broken links
- `content` - Word count, readability, keywords, headings, images
- `tech` - Frameworks, libraries, analytics, CDN
- `full` - All of the above

### 🎨 `remix` - Theme Remixing

Transform archived sites with modern themes.

```bash
trench remix ./archive --theme modern
trench remix ./docs --theme docusaurus --output ./remixed-docs
trench remix ./site --theme vitepress --deploy
```

**Themes:**
- `modern` - Clean, responsive design with Tailwind CSS
- `minimal` - Simple, content-focused design
- `docs` - Documentation-optimized layout
- `docusaurus` - Docusaurus-like theme
- `vitepress` - VitePress-like theme
- `mkdocs` - Material for MkDocs theme

### 💻 `code` - Code Search

Search code on GitHub with advanced filters.

```bash
trench code "neural network"
trench code "machine learning" --language python --min-stars 500
trench code "async await" --language rust --sort stars
```

**Options:**
- `-l, --language <lang>` - Programming language filter
- `--min-stars <n>` - Minimum repository stars
- `--max-stars <n>` - Maximum repository stars
- `--created-after <date>` - Created after date (YYYY-MM-DD)
- `--updated-after <date>` - Updated after date (YYYY-MM-DD)
- `--sort <sort>` - Sort by: relevance, stars, updated
- `--order <order>` - Sort order: asc, desc

### 📄 `papers` - Paper Search

Search academic papers from arXiv and Semantic Scholar.

```bash
trench papers "transformer architecture"
trench papers "climate modeling" --since 2023 --limit 20
trench papers "reinforcement learning" --categories cs.LG,cs.AI
```

**Options:**
- `--since <date>` - Start date (YYYY-MM-DD)
- `--until <date>` - End date (YYYY-MM-DD)
- `--authors <authors>` - Comma-separated author names
- `--categories <cats>` - Comma-separated arXiv categories
- `--sort <sort>` - Sort by: relevance, date, citations
- `-l, --limit <n>` - Maximum results (default: 10)

### 💬 `community` - Community Search

Search community discussions from Hacker News, Reddit, and more.

```bash
trench community "best programming language 2024"
trench community "remote work" --sources hn,reddit --time month
trench community "startup advice" --min-score 100
```

**Options:**
- `-s, --sources <sources>` - Comma-separated sources (hn, reddit, devto)
- `-t, --time <range>` - Time range: day, week, month, year, all (default: month)
- `--min-score <n>` - Minimum score threshold
- `--sort <sort>` - Sort by: relevance, score, date

## ⚙️ Configuration

### Environment Variables

```bash
# API Keys
export TRENCH_GITHUB_API_KEY="your_github_token"
export TRENCH_BING_API_KEY="your_bing_key"
export TRENCH_BRAVE_API_KEY="your_brave_key"
export TRENCH_OPENAI_API_KEY="your_openai_key"
export TRENCH_ANTHROPIC_API_KEY="your_anthropic_key"
```

### Config File

```bash
# Show config
trench config show

# Set API key
trench config set-key github your_token_here

# Set default output format
trench config set-default outputFormat json

# Show config path
trench config path
```

### Config Locations

- macOS: `~/Library/Application Support/trench/trench.config.json`
- Linux: `~/.config/trench/trench.config.json`
- Windows: `%APPDATA%\trench\trench.config.json`

## 🤖 MCP Integration

Trench can run as an MCP (Model Context Protocol) server for AI integration.

```bash
# Start MCP server
trench mcp

# With custom port
trench mcp --port 3456
```

### Kimi Code CLI Integration

Add to your Kimi Code CLI config:

```json
{
  "mcpServers": {
    "trench": {
      "command": "npx",
      "args": ["-y", "trench-cli", "mcp"],
      "description": "Trench CLI - Search, research, archive, and analyze"
    }
  }
}
```

## 🎨 Output Formats

```bash
# Interactive terminal output (default)
trench search "AI" --format interactive

# Markdown
trench research "topic" --format markdown

# JSON (for piping)
trench search "query" --format json | jq '.[0].title'

# HTML report
trench analyze https://site.com --format html --output report.html
```

## 💾 Cache Management

```bash
# Show cache stats
trench cache stats

# Clear all cache
trench cache clear

# Remove expired entries
trench cache cleanup
```

## 📚 Examples

### Research Workflow

```bash
# 1. Research a topic
trench research "WebAssembly performance" --depth comprehensive

# 2. Archive key sources
trench archive https://webassembly.org --output ./wasm-docs

# 3. Analyze the site
trench analyze https://webassembly.org --type tech

# 4. Remix with modern theme
trench remix ./wasm-docs --theme docs --output ./wasm-remixed
```

### Code Discovery

```bash
# Find trending Rust projects
trench code "async runtime" --language rust --min-stars 1000 --sort stars

# Search for specific patterns
trench code "useState hook" --language typescript

# Find recent high-quality projects
trench code "machine learning" --min-stars 500 --created-after 2024-01-01
```

### Academic Research

```bash
# Recent papers on a topic
trench papers "large language models" --since 2024-01-01

# Papers from specific categories
trench papers "reinforcement learning" --categories cs.LG,cs.AI

# Sort by citations
trench papers "neural networks" --sort citations
```

### Community Insights

```bash
# What's trending in tech
trench community "AI tools" --sources hn,reddit --time week

# Historical discussions
trench community "bitcoin" --time year --sort score

# Developer opinions
trench community "TypeScript vs JavaScript" --sources reddit,devto
```

## 🔧 Development

```bash
# Clone repository
git clone https://github.com/yourusername/trench-cli.git
cd trench-cli

# Install dependencies
npm install

# Build
npm run build

# Run locally
npm run dev -- search "query"

# Run tests
npm test

# Lint
npm run lint
```

## 📝 License

MIT © [Your Name](https://github.com/yourusername)

## 🙏 Acknowledgments

- Inspired by [Perplexity](https://perplexity.ai) for the research interface
- [DuckDuckGo](https://duckduckgo.com) for free search API
- [Hacker News](https://news.ycombinator.com) and [Reddit](https://reddit.com) communities
- [arXiv](https://arxiv.org) for academic paper access
- [GitHub](https://github.com) for code search
