/**
 * Replay module for Trench Archival Browser
 * 
 * Features:
 * - Local server for viewing archives
 * - URL rewriting for offline work
 * - Integration with pywb (Web Archive replay tool)
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { URL } from 'url';
import { createReadStream } from 'fs';
import type { ReplayOptions, ArchiveManifest, PageManifest, AssetManifest } from './types.js';
import { ArchiveStorage } from './storage.js';
import { getContentType, normalizeUrl } from './utils.js';

export class ArchiveReplay {
  private options: ReplayOptions;
  private manifest: ArchiveManifest | null = null;
  private app = express();
  private server: ReturnType<typeof this.app.listen> | null = null;
  private urlMap = new Map<string, string>(); // original URL -> local path
  private assetMap = new Map<string, AssetManifest>(); // original URL -> asset manifest

  constructor(options: ReplayOptions) {
    this.options = {
      port: 8080,
      host: 'localhost',
      rewriteUrls: true,
      ...options
    };
  }

  async initialize(): Promise<void> {
    // Load archive manifest
    this.manifest = await ArchiveStorage.loadTrenchArchive(this.options.archivePath);

    // Build URL mapping
    this.buildUrlMap();

    // Setup express middleware
    this.setupMiddleware();
    this.setupRoutes();
  }

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.options.port, this.options.host, () => {
        const url = `http://${this.options.host}:${this.options.port}`;
        console.log(`Archive replay server started at ${url}`);
        resolve(url);
      });

      this.server.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.server!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  private buildUrlMap(): void {
    if (!this.manifest) return;

    // Map pages
    for (const page of this.manifest.pages) {
      const normalizedUrl = normalizeUrl(page.url);
      this.urlMap.set(normalizedUrl, path.join(this.options.archivePath, page.path, 'index.html'));
    }

    // Map assets
    for (const asset of this.manifest.assets) {
      const normalizedUrl = normalizeUrl(asset.url);
      this.assetMap.set(normalizedUrl, asset);
    }
  }

  private setupMiddleware(): void {
    // CORS headers for archive access
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    // Logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
      next();
    });

    // Parse request body
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    // Archive info endpoint
    this.app.get('/_trench/info', (req, res) => {
      res.json({
        version: this.manifest?.version,
        created: this.manifest?.created,
        source: this.manifest?.url,
        stats: this.manifest?.stats,
        pages: this.manifest?.pages.map(p => ({
          url: p.url,
          title: p.title,
          timestamp: p.timestamp
        }))
      });
    });

    // Search endpoint
    this.app.get('/_trench/search', async (req, res) => {
      const query = (req.query.q as string)?.toLowerCase();
      if (!query) {
        res.json({ results: [] });
        return;
      }

      const results = this.manifest?.pages.filter(page => 
        page.title.toLowerCase().includes(query) ||
        page.url.toLowerCase().includes(query)
      ) || [];

      res.json({ results });
    });

    // Browse archive structure
    this.app.get('/_trench/browse', (req, res) => {
      res.send(this.generateBrowsePage());
    });

    // Assets list
    this.app.get('/_trench/assets', (req, res) => {
      const type = req.query.type as string;
      let assets = this.manifest?.assets || [];
      
      if (type) {
        assets = assets.filter(a => a.type === type);
      }

      res.json({
        total: assets.length,
        assets: assets.map(a => ({
          url: a.url,
          type: a.type,
          mimeType: a.mimeType,
          size: a.size,
          deduplicated: a.deduplicated
        }))
      });
    });

    // Main archive handler - rewrite and serve content
    this.app.get('*', async (req, res, next) => {
      try {
        await this.handleRequest(req, res, next);
      } catch (error) {
        next(error);
      }
    });
  }

  private async handleRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestPath = req.path;
    const requestUrl = this.reconstructOriginalUrl(req);

    // Skip internal trench paths
    if (requestPath.startsWith('/_trench/')) {
      next();
      return;
    }

    // Try to find the resource
    const localPath = this.findResource(requestUrl, requestPath);

    if (!localPath) {
      res.status(404).send(`Resource not found: ${requestUrl}`);
      return;
    }

    // Check if file exists
    if (!await this.fileExists(localPath)) {
      res.status(404).send(`File not found: ${localPath}`);
      return;
    }

    // Get content type
    const contentType = getContentType(localPath);

    // For HTML files, rewrite URLs
    if (contentType === 'text/html' && this.options.rewriteUrls) {
      const content = await fs.readFile(localPath, 'utf-8');
      const rewritten = this.rewriteHtml(content, req);
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(rewritten);
      return;
    }

    // For CSS files, rewrite URLs
    if (contentType === 'text/css' && this.options.rewriteUrls) {
      const content = await fs.readFile(localPath, 'utf-8');
      const rewritten = this.rewriteCss(content, req);
      
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.send(rewritten);
      return;
    }

    // Stream the file
    res.setHeader('Content-Type', contentType);
    const stream = createReadStream(localPath);
    stream.pipe(res);
  }

  private reconstructOriginalUrl(req: Request): string {
    // Try to reconstruct the original URL from the request
    // This is a simplified version - in practice, you might need more complex logic
    
    const host = req.headers.host || this.options.host;
    const protocol = 'http'; // Archives are typically replayed over HTTP locally
    
    // Check if there's a X-Archive-Url header (for pywb compatibility)
    const archiveUrl = req.headers['x-archive-url'] as string;
    if (archiveUrl) {
      return archiveUrl;
    }

    // Otherwise, try to find matching page
    const path = req.path;
    for (const [url, localPath] of this.urlMap.entries()) {
      const urlObj = new URL(url);
      if (urlObj.pathname === path) {
        return url;
      }
    }

    // Fallback: construct from manifest source
    const baseUrl = this.manifest?.url || `${protocol}://${host}`;
    return new URL(path, baseUrl).href;
  }

  private findResource(originalUrl: string, requestPath: string): string | null {
    // Normalize URL
    const normalizedUrl = normalizeUrl(originalUrl);

    // Check URL map for pages
    if (this.urlMap.has(normalizedUrl)) {
      return this.urlMap.get(normalizedUrl)!;
    }

    // Check asset map
    if (this.assetMap.has(normalizedUrl)) {
      const asset = this.assetMap.get(normalizedUrl)!;
      return path.join(this.options.archivePath, asset.path);
    }

    // Try to find by path
    for (const [url, localPath] of this.urlMap.entries()) {
      const urlObj = new URL(url);
      if (urlObj.pathname === requestPath) {
        return localPath;
      }
    }

    // Try assets by path
    for (const [url, asset] of this.assetMap.entries()) {
      const urlObj = new URL(url);
      if (urlObj.pathname === requestPath) {
        return path.join(this.options.archivePath, asset.path);
      }
    }

    // Check if it's a direct file path
    const directPath = path.join(this.options.archivePath, requestPath);
    if (this.fileExistsSync(directPath)) {
      return directPath;
    }

    return null;
  }

  private rewriteHtml(html: string, req: Request): string {
    const baseUrl = this.manifest?.url || '';
    const replayBase = `http://${req.headers.host}`;

    // Rewrite various URL patterns
    let rewritten = html;

    // Rewrite href attributes
    rewritten = rewritten.replace(
      /href=["']([^"']+)["']/gi,
      (match, url) => {
        const rewritten = this.rewriteUrl(url, baseUrl, replayBase);
        return `href="${rewritten}"`;
      }
    );

    // Rewrite src attributes
    rewritten = rewritten.replace(
      /src=["']([^"']+)["']/gi,
      (match, url) => {
        const rewritten = this.rewriteUrl(url, baseUrl, replayBase);
        return `src="${rewritten}"`;
      }
    );

    // Rewrite srcset attributes
    rewritten = rewritten.replace(
      /srcset=["']([^"']+)["']/gi,
      (match, srcset) => {
        const urls = srcset.split(',').map((part: string) => {
          const [url, descriptor] = part.trim().split(/\s+/);
          const rewritten = this.rewriteUrl(url, baseUrl, replayBase);
          return descriptor ? `${rewritten} ${descriptor}` : rewritten;
        });
        return `srcset="${urls.join(', ')}"`;
      }
    );

    // Rewrite URL() in inline styles
    rewritten = rewritten.replace(
      /style=["']([^"']*)["']/gi,
      (match, style) => {
        const rewritten = style.replace(
          /url\(["']?([^"')]+)["']?\)/gi,
          (m: string, url: string) => {
            const newUrl = this.rewriteUrl(url, baseUrl, replayBase);
            return `url("${newUrl}")`;
          }
        );
        return `style="${rewritten}"`;
      }
    );

    // Add base tag if not present
    if (!/<base\s/i.test(rewritten)) {
      rewritten = rewritten.replace(
        /<head[^>]*>/i,
        match => `${match}\n<base href="${replayBase}/">`
      );
    }

    // Inject replay banner
    const banner = this.generateReplayBanner();
    rewritten = rewritten.replace(
      /<body[^>]*>/i,
      match => `${match}\n${banner}`
    );

    return rewritten;
  }

  private rewriteCss(css: string, req: Request): string {
    const baseUrl = this.manifest?.url || '';
    const replayBase = `http://${req.headers.host}`;

    return css.replace(
      /url\(["']?([^"')]+)["']?\)/gi,
      (match, url) => {
        const rewritten = this.rewriteUrl(url, baseUrl, replayBase);
        return `url("${rewritten}")`;
      }
    );
  }

  private rewriteUrl(url: string, baseUrl: string, replayBase: string): string {
    // Skip data URIs and javascript:
    if (url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('#')) {
      return url;
    }

    // Skip external URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Check if it's in our archive
      const normalized = normalizeUrl(url);
      if (this.urlMap.has(normalized) || this.assetMap.has(normalized)) {
        return `${replayBase}${new URL(url).pathname}`;
      }
      return url; // External URL, leave as is
    }

    // Relative URL - resolve and check
    try {
      const resolved = new URL(url, baseUrl).href;
      const normalized = normalizeUrl(resolved);
      
      if (this.urlMap.has(normalized) || this.assetMap.has(normalized)) {
        return `${replayBase}${new URL(resolved).pathname}`;
      }
      
      // Not in archive, return relative
      return url;
    } catch {
      return url;
    }
  }

  private generateReplayBanner(): string {
    const archiveUrl = this.manifest?.url || 'Unknown';
    const archiveDate = this.manifest?.created 
      ? new Date(this.manifest.created).toLocaleString() 
      : 'Unknown';

    return `
<div id="trench-replay-banner" style="
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #0066cc;
  color: white;
  padding: 8px 16px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
  z-index: 2147483647;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
">
  <div style="display: flex; align-items: center; gap: 12px;">
    <span style="font-weight: 600;">📦 Trench Archive</span>
    <span style="opacity: 0.9;">${archiveUrl}</span>
  </div>
  <div style="display: flex; align-items: center; gap: 12px;">
    <span style="opacity: 0.9;">Archived: ${archiveDate}</span>
    <a href="/_trench/browse" style="
      color: white;
      text-decoration: none;
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
    ">Browse Archive</a>
    <button onclick="document.getElementById('trench-replay-banner').style.display='none'" style="
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 18px;
      padding: 0 4px;
    ">×</button>
  </div>
</div>
<div style="height: 40px;"></div>
<script>
  (function() {
    // Adjust body padding for banner
    var banner = document.getElementById('trench-replay-banner');
    if (banner) {
      document.body.style.marginTop = '40px';
    }
  })();
</script>`;
  }

  private generateBrowsePage(): string {
    if (!this.manifest) return '<html><body>No archive loaded</body></html>';

    const pages = this.manifest.pages.map(page => `
      <tr>
        <td><a href="${new URL(page.url).pathname}">${this.escapeHtml(page.title)}</a></td>
        <td>${page.url}</td>
        <td>${new Date(page.timestamp).toLocaleString()}</td>
        <td>${page.assetCount}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Browse Archive - ${this.escapeHtml(this.manifest.url)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:hover { background: #f9f9f9; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .stats { background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .search { margin: 20px 0; }
    .search input { padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; width: 300px; }
  </style>
</head>
<body>
  <h1>📦 Browse Archive</h1>
  <p><strong>Source:</strong> ${this.escapeHtml(this.manifest.url)}</p>
  
  <div class="stats">
    <strong>Statistics:</strong> 
    ${this.manifest.stats.totalPages} pages, 
    ${this.manifest.stats.totalAssets} assets, 
    ${this.formatBytes(this.manifest.stats.totalSize)}
  </div>

  <div class="search">
    <input type="text" id="search" placeholder="Search pages..." onkeyup="searchPages()">
  </div>

  <table id="pages-table">
    <thead>
      <tr>
        <th>Title</th>
        <th>URL</th>
        <th>Archived</th>
        <th>Assets</th>
      </tr>
    </thead>
    <tbody>
      ${pages}
    </tbody>
  </table>

  <script>
    function searchPages() {
      const input = document.getElementById('search');
      const filter = input.value.toLowerCase();
      const table = document.getElementById('pages-table');
      const tr = table.getElementsByTagName('tr');

      for (let i = 1; i < tr.length; i++) {
        const td = tr[i].getElementsByTagName('td');
        let visible = false;
        for (let j = 0; j < td.length; j++) {
          if (td[j] && td[j].textContent.toLowerCase().includes(filter)) {
            visible = true;
            break;
          }
        }
        tr[i].style.display = visible ? '' : 'none';
      }
    }
  </script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private fileExistsSync(filePath: string): boolean {
    try {
      fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
