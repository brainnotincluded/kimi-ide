# Trench Archival Browser MCP Server

A comprehensive website archiving solution built on Playwright that captures complete website snapshots including JavaScript execution, assets, videos, and even Canvas/WebGL animations.

## Features

- 🔍 **Full JS Execution** - Archives SPAs with complete JavaScript rendering
- 📦 **Asset Download** - Downloads all CSS, images, fonts, videos, and more
- 🎬 **Video Capture** - Records HLS/DASH streams and video files
- 🎨 **Canvas Recording** - Captures WebGL/Canvas animations as frame sequences
- 🌐 **Network Interception** - Captures all network requests via CDP
- 📊 **WARC Format** - Standard web archive format support
- 🚀 **Deduplication** - Automatic asset deduplication to save space
- 🔄 **Resume Support** - Resume interrupted archives
- 📈 **Analysis Tools** - SEO, security, and performance analysis
- 🖥️ **Replay Server** - Browse archives locally with URL rewriting

## Installation

```bash
# Clone or copy the project
cd /Users/mac/kimi-vscode/src/mcp/browser-mcp

# Install dependencies
npm install

# Build
npm run build

# Link for global CLI usage
npm link
```

## CLI Usage

### Archive a Website

```bash
# Basic archive
trench archive https://example.com

# Full archive with all features
trench archive https://example.com \
  --full-assets \
  --video \
  --canvas \
  --max-depth 5 \
  --max-pages 200 \
  -o ./my-archive

# Resume interrupted archive
trench archive https://example.com --resume
```

### Extract and Analyze

```bash
# Extract archive information
trench extract ./example.com --analyze

# Generate analysis report
trench analyze ./example.com -f html -o report.html
```

### Replay Archive

```bash
# Start replay server
trench replay ./example.com

# Custom port
trench replay ./example.com -p 3000
```

### List Archives

```bash
# List archives in current directory
trench list

# List archives in specific directory
trench list /path/to/archives
```

## MCP Server Usage

The Trench MCP server can be integrated with Kimi Code CLI or other MCP clients.

### Available Tools

#### `archive`
Archive a website with full asset capture.

```json
{
  "url": "https://example.com",
  "fullAssets": true,
  "captureVideo": true,
  "captureCanvas": false,
  "maxDepth": 3,
  "maxPages": 100
}
```

#### `extract`
Extract content from an archive.

```json
{
  "archivePath": "./example.com",
  "format": "json"
}
```

#### `analyze`
Analyze an archive and generate a report.

```json
{
  "archivePath": "./example.com",
  "reportFormat": "html"
}
```

#### `replay`
Start a replay server for browsing the archive.

```json
{
  "archivePath": "./example.com",
  "port": 8080
}
```

#### `stop_replay`
Stop a running replay server.

```json
{
  "archivePath": "./example.com"
}
```

#### `list_archives`
List available archives.

```json
{
  "directory": "./"
}
```

#### `get_archive_info`
Get detailed information about an archive.

```json
{
  "archivePath": "./example.com"
}
```

### Starting the MCP Server

```bash
# Via stdio (for MCP clients)
npm start

# Or directly
node dist/mcpServer.js
```

## Programmatic API

```typescript
import { 
  Archiver, 
  ArchiveAnalyzer, 
  ArchiveReplay,
  type ArchiveOptions 
} from '@trench/browser-mcp';

// Archive a website
const options: ArchiveOptions = {
  url: 'https://example.com',
  outputDir: './archive',
  fullAssets: true,
  captureVideo: true,
  captureCanvas: true,
  maxDepth: 3,
  maxPages: 100
};

const archiver = new Archiver(options);
await archiver.initialize();
const result = await archiver.archive();

console.log(`Archived ${result.stats.totalPages} pages`);

// Analyze the archive
const analyzer = new ArchiveAnalyzer('./archive');
await analyzer.initialize();
const analysis = await analyzer.analyze();

console.log('Technologies:', analysis.technologies);
console.log('SEO Issues:', analysis.seo);

// Replay the archive
const replay = new ArchiveReplay({
  archivePath: './archive',
  port: 8080
});
await replay.initialize();
const url = await replay.start();

console.log(`Archive available at: ${url}`);
```

## Archive Format

### Trench Format (Default)

```
archive/
├── manifest.json      # Archive metadata
├── index.html         # Browse archive
├── pages/
│   └── <page-id>/
│       ├── index.html        # Rendered HTML
│       ├── original.html     # Original HTML (if different)
│       ├── metadata.json     # Page metadata
│       ├── canvas/           # Canvas recordings
│       └── videos/           # Video recordings
└── assets/
    └── <hash>.<ext>   # Deduplicated assets
```

### WARC Format

Standard Web ARChive format for compatibility with other tools like:
- [Wayback Machine](https://web.archive.org/)
- [pywb](https://github.com/webrecorder/pywb)
- [Webrecorder](https://webrecorder.net/)

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | string | required | URL to archive |
| `outputDir` | string | auto | Output directory |
| `fullAssets` | boolean | true | Download all assets |
| `captureVideo` | boolean | false | Capture video streams |
| `captureCanvas` | boolean | false | Record canvas animations |
| `maxDepth` | number | 3 | Maximum crawl depth |
| `maxPages` | number | 100 | Maximum pages to archive |
| `viewportWidth` | number | 1920 | Browser viewport width |
| `viewportHeight` | number | 1080 | Browser viewport height |
| `timeout` | number | 30000 | Request timeout (ms) |
| `concurrency` | number | 5 | Concurrent downloads |
| `triggerLazyLoad` | boolean | true | Trigger lazy loading |
| `followPagination` | boolean | false | Follow pagination links |
| `format` | 'trench' \| 'warc' | 'trench' | Archive format |
| `deduplicate` | boolean | true | Enable deduplication |
| `resume` | boolean | false | Resume interrupted archive |
| `compressionLevel` | number | 6 | Compression level (0-9) |

## Analysis Features

The analyzer provides:

- **Asset Breakdown** - Count and size by type
- **Technology Detection** - Frameworks, libraries, CDNs
- **External Domains** - Third-party resources
- **Broken Links** - Failed requests
- **Performance Metrics** - Largest assets, load times
- **SEO Analysis** - Missing titles, descriptions, alt tags
- **Security Audit** - HTTPS usage, insecure resources

## Replay Features

The replay server provides:

- Local HTTP server for browsing
- URL rewriting for offline viewing
- Archive browsing interface
- Search functionality
- Archive information endpoint

## License

MIT

## Contributing

Contributions are welcome! Please ensure your code follows the existing style and includes appropriate tests.
