# 🎨 Site Remix Engine

Transform old, outdated websites into modern, beautiful versions with a single command.

## Overview

Site Remix Engine is part of the Trench project. After the browser MCP downloads a website, this engine:

1. **Analyzes** the structure and content
2. **Extracts** clean, semantic content
3. **Remixes** into a modern design
4. **Optimizes** for performance and accessibility

## Features

- 🎨 **Modern Themes**: Docusaurus/VitePress style docs, modern blogs, landing pages
- 🌙 **Dark Mode**: Automatic dark mode with user preference persistence
- 📱 **Mobile-First**: Responsive design that works on all devices
- 🔍 **Search**: Built-in search with Fuse.js, Lunr, or Algolia
- ⚡ **Performance**: Minified CSS/JS, optimized images, lazy loading
- ♿ **Accessible**: WCAG-compliant markup and ARIA labels
- 🔧 **Auto-Fixes**: Automatically fix common issues

## Installation

```bash
npm install -g @trench/remix
# or
npx @trench/remix
```

## Quick Start

```bash
# Analyze a downloaded website
trench analyze ./old-site --url https://example.com

# Extract content
trench extract ./old-site -o ./content

# Remix with modern theme
trench remix ./old-site -o ./remixed --theme modern-docs

# Deploy
trench deploy ./remixed --platform vercel
```

## Commands

### `trench analyze <path>`

Analyze a downloaded website for structure, issues, and improvements.

```bash
trench analyze ./my-site \
  --url https://example.com \
  --output report.json \
  --format json
```

**Options:**
- `-u, --url <url>` - Original URL
- `-o, --output <file>` - Output file
- `--format <format>` - Output format: `json`, `html`, or `md`

### `trench extract <path>`

Extract clean content from a website.

```bash
trench extract ./my-site \
  --output ./content \
  --format markdown \
  --include "\.html$"
```

### `trench remix <path>`

Transform a website with a modern theme.

```bash
trench remix ./old-site \
  --output ./remixed \
  --theme modern-docs \
  --dark-mode true \
  --primary-color "#3b82f6" \
  --search fuse \
  --pwa \
  --apply-fixes
```

**Themes:**
- `modern-docs` - Documentation site (Docusaurus/VitePress style)
- `blog` - Modern blog with article layout
- `landing` - Product landing page
- `knowledge-base` - Wiki/knowledge base
- `minimal` - Clean minimal design

**Options:**
- `-t, --theme <theme>` - Choose theme
- `--dark-mode <mode>` - `true`, `false`, or `auto`
- `--primary-color <hex>` - Brand primary color
- `--secondary-color <hex>` - Brand secondary color
- `--font <family>` - Font family
- `--search <provider>` - `fuse`, `lunr`, or `algolia`
- `--no-search` - Disable search
- `--pwa` - Enable PWA features
- `--no-minify` - Disable minification
- `--no-optimize` - Disable image optimization
- `--apply-fixes` - Auto-apply fixable improvements

### `trench improve <path>`

Analyze and suggest improvements.

```bash
trench improve ./my-site --apply
```

### `trench deploy <path>`

Generate deployment configuration.

```bash
trench deploy ./remixed --platform vercel
```

**Platforms:** `vercel`, `netlify`, `github-pages`, `cloudflare`

## Programmatic API

```typescript
import { 
  SiteAnalyzer, 
  ContentExtractor, 
  RemixEngine 
} from '@trench/remix';

// Analyze
const analyzer = new SiteAnalyzer();
const report = await analyzer.analyzeSite('./site', 'https://example.com');

// Extract
const extractor = new ContentExtractor();
extractor.loadFromFile('./site/page.html');
const content = extractor.extract();

// Remix
const engine = new RemixEngine({
  theme: 'modern-docs',
  darkMode: true,
  enableSearch: true,
  searchProvider: 'fuse',
  pwa: true
});

const result = await engine.remixSite('./old-site', pages, './remixed');
```

## Analysis Features

The analyzer detects:

- **DOM Structure** - Tag hierarchy, nesting depth
- **Content Type** - Docs, blog, landing, API reference
- **Components** - Navigation, sidebar, code blocks, tables
- **CSS Analysis** - Used/unused selectors, media queries
- **Mobile** - Viewport, touch targets, font sizes
- **SEO** - Titles, descriptions, Open Graph, structured data
- **Issues** - Broken links, missing alt text, skipped headings

## Remix Features

The engine generates:

- **Tailwind CSS** - Modern utility-first CSS
- **Dark Mode** - Automatic with localStorage persistence
- **Search** - Client-side search index
- **Responsive** - Mobile-first breakpoints
- **Typography** - Beautiful readable text
- **Code Blocks** - Syntax highlighting ready
- **Tables** - Styled data tables
- **Images** - Lazy loading, optimization
- **PWA** - Service worker, manifest

## Example Output

```
🎨 Site Remix Engine

✓ Input validated
✓ Analysis complete
✓ Found 42 pages
✓ Extracted 42 pages
✓ Applied 12 fixes
✓ Remix complete!

✨ Success!

Output: /path/to/remixed
Pages: 42
Assets: 156
Search: fuse (42 documents)

Features:
  ✓ Modern CSS (Tailwind)
  ✓ Dark mode support
  ✓ Responsive design
  ✓ Search functionality
  ✓ PWA ready
  ✓ Minified assets

Next steps:
  cd remixed
  npx serve .     # Preview locally
  npx vercel --prod   # Deploy
```

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Browser   │───▶│   Download   │───▶│   Analyzer  │───▶│   Extractor  │
│    MCP      │    │   Archive    │    │             │    │              │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                                                                     │
                              ┌──────────────┐                       │
                              │   Deployer   │◀──────────────────────┘
                              └──────────────┘            ┌──────────────┐
                                                          │  RemixEngine │
                                                          │              │
                                                          │  • Modern    │
                                                          │  • Dark Mode │
                                                          │  • Search    │
                                                          │  • PWA       │
                                                          └──────────────┘
```

## Roadmap

- [ ] AI-powered content improvement
- [ ] More themes (E-commerce, Portfolio, Wiki)
- [ ] Component detection with React/Vue conversion
- [ ] Multi-language support
- [ ] A/B testing different themes
- [ ] Automatic content summarization

## License

MIT

## Contributing

Part of the Trench Project. See main repository for contribution guidelines.
