# 🔍 Trench - Open Source Research Engine

> **Better than Perplexity. Your own research assistant.**

Trench is an open-source research tool that combines web search, academic papers, code repositories, and community discussions into synthesized, cited answers. Built for developers who need deep research without leaving the terminal.

---

## ✨ Why Trench is Better

| Feature | Perplexity | Trench |
|---------|-----------|--------|
| **Cost** | $20/month | **Free** |
| **Open Source** | ❌ | ✅ |
| **GitHub Code Search** | ❌ Basic | ✅ Deep semantic |
| **ArXiv Integration** | ⚠️ Limited | ✅ Full + PDF download |
| **Community Search** | ❌ | ✅ HN, Reddit, StackExchange |
| **Site Archival** | ❌ | ✅ Full assets + videos |
| **Site Remix** | ❌ | ✅ Modernize old sites |
| **VS Code Integration** | ❌ | ✅ Native extension |
| **Self-hosted** | ❌ | ✅ Your infrastructure |

---

## 🚀 Quick Start

```bash
# Install
npm install -g @trench/cli

# Or use with npx
npx @trench/cli research "How do React Server Components work?"

# Deep research with synthesis
trench research "Vercel Edge Caching architecture" --depth comprehensive

# Search code on GitHub
trench code "distributed training PyTorch" --stars >1000 --language python

# Find academic papers
trench papers "attention mechanism transformers" --since 2023

# Archive a website
trench archive ardupilot.org --full-assets --output ./ardupilot

# Analyze and remix
trench analyze ./ardupilot
trench remix ./ardupilot --theme modern-docs --dark-mode --deploy

# Community opinions
trench community "Is Rust worth learning 2024?" --sources hn,reddit
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Trench CLI                               │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Search     │   │   Browser    │   │   Synthesis  │
│   APIs       │   │   MCP        │   │   Engine     │
│              │   │              │   │              │
│ • DuckDuckGo │   │ • Playwright │   │ • Cross-ref  │
│ • GitHub     │   │ • Archival   │   │ • Fact extr. │
│ • arXiv      │   │ • Assets     │   │ • Confidence │
│ • HN/Reddit  │   │ • Remix      │   │ • Citations  │
└──────────────┘   └──────────────┘   └──────────────┘
```

---

## 🔍 Search Providers (All Free)

### Web Search
- **DuckDuckGo** - HTML scraping (no API key)
- **Bing API** - 1000 queries/month free
- **Google CSE** - 100 queries/day free
- **SearXNG** - Self-hosted option

### Code Search
- **GitHub API** - 60 req/hour (5000 with token)
- Semantic code analysis
- Pattern extraction

### Academic
- **arXiv API** - Completely free
- PDF download and parsing
- Citation analysis

### Community
- **Hacker News** - Algolia API (36K req/hour)
- **Reddit** - JSON API (600 req/hour)
- **Stack Exchange** - 300 req/hour

---

## 🌐 Archival Browser

Download complete websites with:
- ✅ Full JavaScript execution (SPAs)
- ✅ All assets (images, CSS, fonts)
- ✅ Videos and animations
- ✅ Canvas/WebGL recordings
- ✅ Network request logs

```bash
# Archive with all assets
trench archive https://example.com --full-assets --video

# Analyze archived site
trench analyze ./example.com

# Replay locally
trench replay ./example.com -p 8080
```

---

## 🎨 Site Remix

Transform old websites into modern versions:

```bash
# Remix with modern docs theme
trench remix ./old-site --theme modern-docs --dark-mode --search

# Themes available:
# - modern-docs (Docusaurus/VitePress style)
# - blog (Jekyll/Hugo style)
# - landing (Tailwind CSS)
# - knowledge-base (Notion style)
# - minimal (clean and fast)
```

Auto-improvements:
- Responsive design
- Dark mode
- Search functionality
- PWA capabilities
- Optimized assets

---

## 🧠 Research Synthesis

Trench doesn't just search - it synthesizes:

```bash
trench research "How does Vercel Edge Caching work?"
```

**Output:**
- ✓ Confidence score (High 87%)
- ✓ Key takeaways
- ✓ Structured answer with inline citations [1], [2]
- ✓ Source diversity (web + GitHub + arXiv)
- ✓ Contradictions highlighted
- ✓ Further reading suggestions

---

## 🔌 MCP Integration

Use Trench as an MCP server for AI assistants:

```bash
# Start MCP server
trench mcp

# Or with stdio transport for Kimi Code CLI
trench mcp --transport stdio
```

**Available tools:**
- `search` - Multi-source search
- `research` - Deep research with synthesis
- `archive` - Website archival
- `code_search` - GitHub code search
- `paper_search` - arXiv search

---

## 💻 VS Code Extension

```bash
# Install from marketplace
code --install-extension trench.trench-vscode

# Or manually
cd /Users/mac/kimi-vscode && make install-local
```

**Features:**
- Research panel
- Inline search results
- Archive browser
- One-click remix and deploy

---

## ⚙️ Configuration

```bash
# Create config
trench config init

# Edit ~/.trench/config.json
{
  "search": {
    "providers": ["duckduckgo", "github", "arxiv"],
    "github_token": "ghp_xxx",
    "bing_key": "optional"
  },
  "cache": {
    "enabled": true,
    "ttl": 86400,
    "maxSize": "1GB"
  },
  "output": {
    "format": "markdown",
    "colors": true
  }
}
```

---

## 📊 Comparison with Alternatives

| Tool | Price | Open | Code | Papers | Archive | Remix |
|------|-------|------|------|--------|---------|-------|
| Perplexity | $20/mo | ❌ | ❌ | ⚠️ | ❌ | ❌ |
| Elicit | $12/mo | ❌ | ❌ | ✅ | ❌ | ❌ |
| Consensus | $8/mo | ❌ | ❌ | ✅ | ❌ | ❌ |
| Phind | Free | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Trench** | **Free** | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🛠️ Development

```bash
# Clone
git clone https://github.com/daniil/trench.git
cd trench

# Install
npm install

# Build
npm run build

# Test
npm test

# Link for local development
npm link
```

---

## 🗺️ Roadmap

- [x] Multi-source search (web, GitHub, arXiv, community)
- [x] Archival browser with asset capture
- [x] Site remix engine
- [x] Research synthesis with citations
- [x] MCP server integration
- [x] VS Code extension
- [ ] Browser extension
- [ ] Mobile app
- [ ] Collaborative research
- [ ] AI agent integration

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## 📜 License

MIT License - see [LICENSE](./LICENSE)

---

**Built with ❤️ by Daniil and the Trench community**
