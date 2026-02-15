/**
 * Main Archiver for Trench Archival Browser
 * 
 * Features:
 * - Playwright browser with full JS execution
 * - Network interception via CDP
 * - Asset discovery and download
 * - Lazy loading trigger (scroll, click pagination)
 * - Video stream capture
 * - Canvas/WebGL recording
 */

import { chromium, type Browser, type Page, type CDPSession, type Response, type Request } from 'playwright';
import { URL } from 'url';
import { promises as fs } from 'fs';
import path from 'path';
import type { 
  ArchiveOptions, 
  PageSnapshot, 
  AssetInfo, 
  PageMetadata,
  CanvasRecording,
  CanvasFrame,
  ProgressCallback,
  ArchiveStats
} from './types.js';
import { AssetDownloader } from './assetDownloader.js';
import { ArchiveStorage } from './storage.js';
import { 
  sha256, 
  generateId, 
  sleep, 
  normalizeUrl,
  getDomain,
  isInternalUrl,
  extractLinks,
  RateLimiter
} from './utils.js';

export interface ArchiveResult {
  success: boolean;
  outputPath: string;
  stats: ArchiveStats;
  errors: Error[];
}

export class Archiver {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private cdp: CDPSession | null = null;
  private options: ArchiveOptions;
  private storage: ArchiveStorage;
  private assetDownloader: AssetDownloader;
  private progressCallback?: ProgressCallback;
  private visitedUrls = new Set<string>();
  private pendingUrls: string[] = [];
  private errors: Error[] = [];
  private startTime: number = 0;
  private canvasRecordings = new Map<string, CanvasRecording>();
  private networkRequests = new Map<string, { request: Request; response?: Response }>();
  private rateLimiter: RateLimiter;

  constructor(options: ArchiveOptions, progressCallback?: ProgressCallback) {
    this.options = {
      maxDepth: 3,
      maxPages: 100,
      viewportWidth: 1920,
      viewportHeight: 1080,
      timeout: 30000,
      concurrency: 5,
      lazyLoadWait: 2000,
      triggerLazyLoad: true,
      followPagination: false,
      blockResources: [],
      format: 'trench',
      deduplicate: true,
      resume: false,
      compressionLevel: 6,
      ...options
    };
    
    this.storage = new ArchiveStorage(this.options);
    this.assetDownloader = new AssetDownloader(this.options, progressCallback);
    this.progressCallback = progressCallback;
    this.rateLimiter = new RateLimiter(100, 3); // 100ms min interval, 3 concurrent
  }

  async initialize(): Promise<void> {
    // Launch browser
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--enable-automation',
        '--disable-blink-features=AutomationControlled',
      ]
    });

    // Create context with specific options
    const context = await this.browser.newContext({
      viewport: {
        width: this.options.viewportWidth!,
        height: this.options.viewportHeight!,
      },
      userAgent: this.options.userAgent || 
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      bypassCSP: true,
      ignoreHTTPSErrors: true,
    });

    // Create page
    this.page = await context.newPage();
    
    // Set timeouts
    this.page.setDefaultTimeout(this.options.timeout!);
    this.page.setDefaultNavigationTimeout(this.options.timeout!);

    // Initialize CDP session
    this.cdp = await context.newCDPSession(this.page);

    // Enable CDP domains
    await this.cdp.send('Network.enable');
    await this.cdp.send('Page.enable');
    await this.cdp.send('Runtime.enable');

    // Set up network interception
    await this.setupNetworkInterception();

    // Initialize storage
    await this.storage.initialize();
    await this.assetDownloader.initialize();

    // Check for resume state
    if (this.options.resume) {
      await this.loadResumeState();
    }

    this.startTime = Date.now();
  }

  async archive(): Promise<ArchiveResult> {
    try {
      // Add initial URL
      this.pendingUrls.push(normalizeUrl(this.options.url));

      let currentDepth = 0;
      
      while (this.pendingUrls.length > 0 && 
             this.visitedUrls.size < (this.options.maxPages || 100) &&
             currentDepth < (this.options.maxDepth || 3)) {
        
        const batch = this.pendingUrls.splice(0, this.options.concurrency!);
        
        await Promise.all(
          batch.map(url => this.archivePage(url, currentDepth))
        );

        // Discover new URLs from the current batch
        if (currentDepth < (this.options.maxDepth || 3) - 1) {
          await this.discoverNewUrls(batch);
        }

        currentDepth++;
        await this.saveResumeState();
      }

      // Finalize storage
      const stats = this.calculateStats();
      const outputPath = await this.storage.finalize(stats);

      // Clean up resume state
      if (this.options.resume) {
        await this.clearResumeState();
      }

      await this.reportProgress('complete');

      return {
        success: this.errors.length === 0,
        outputPath,
        stats,
        errors: this.errors
      };

    } finally {
      await this.cleanup();
    }
  }

  private async archivePage(url: string, depth: number): Promise<void> {
    if (this.visitedUrls.has(url)) return;
    
    await this.rateLimiter.acquire();
    
    try {
      this.visitedUrls.add(url);
      await this.reportProgress('page', url);

      // Navigate to page
      const response = await this.page!.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.options.timeout,
      });

      if (!response || response.status() >= 400) {
        throw new Error(`Failed to load ${url}: HTTP ${response?.status() || 'unknown'}`);
      }

      // Wait for initial render
      await sleep(1000);

      // Trigger lazy loading
      if (this.options.triggerLazyLoad) {
        await this.triggerLazyLoading();
      }

      // Capture canvas recordings
      let canvasRecordings: CanvasRecording[] = [];
      if (this.options.captureCanvas) {
        canvasRecordings = await this.captureCanvasAnimations();
      }

      // Get page content
      const html = await this.page!.content();
      const title = await this.page!.title();

      // Extract metadata
      const metadata = await this.extractMetadata();

      // Discover and download assets
      const discoveredAssets = await this.assetDownloader.discoverAssetsFromPage(this.page!, url);
      const assetResults = await this.assetDownloader.downloadAssets(discoveredAssets);

      // Download WebGL resources
      const webglAssets = await this.assetDownloader.downloadWebGLResources(this.page!);

      // Combine all assets
      const allAssets: AssetInfo[] = [
        ...assetResults.filter(r => !r.error).map(r => r.asset),
        ...webglAssets
      ];

      // Save page
      const pageId = generateId();
      const pageSnapshot: PageSnapshot = {
        url,
        title,
        html: await response.text(),
        renderedHtml: html,
        timestamp: new Date(),
        assets: allAssets,
        metadata,
        canvasRecordings
      };

      await this.storage.savePage(pageSnapshot, pageId);

      // Save assets to manifest
      for (const asset of allAssets) {
        await this.storage.saveAsset(asset, [pageId]);
      }

      // Handle pagination if enabled
      if (this.options.followPagination) {
        await this.handlePagination(url, depth);
      }

    } catch (error) {
      this.errors.push(error as Error);
      await this.reportProgress('error', url, error as Error);
    } finally {
      this.rateLimiter.release();
    }
  }

  private async setupNetworkInterception(): Promise<void> {
    if (!this.cdp) return;

    // Listen for request events
    this.cdp.on('Network.requestWillBeSent', (params) => {
      // Track request
    });

    this.cdp.on('Network.responseReceived', (params) => {
      // Track response
    });

    this.cdp.on('Network.loadingFinished', async (params) => {
      // Capture response body
      try {
        const { body, base64Encoded } = await this.cdp!.send('Network.getResponseBody', {
          requestId: params.requestId
        });
        // Process body if needed
      } catch {
        // Body might not be available
      }
    });
  }

  private async triggerLazyLoading(): Promise<void> {
    if (!this.page) return;

    // Scroll to bottom to trigger lazy loading
    await this.page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Wait for lazy load
    await sleep(this.options.lazyLoadWait || 2000);

    // Scroll back to top
    await this.page.evaluate(() => window.scrollTo(0, 0));
  }

  private async captureCanvasAnimations(): Promise<CanvasRecording[]> {
    if (!this.page) return [];

    const recordings: CanvasRecording[] = [];

    try {
      // Find all canvas elements
      const canvasData = await this.page.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll('canvas'));
        return canvases.map((canvas, index) => ({
          index,
          width: canvas.width,
          height: canvas.height,
          id: canvas.id || `canvas-${index}`
        }));
      });

      for (const canvas of canvasData) {
        const recording = await this.recordCanvas(canvas.id, canvas.width, canvas.height);
        if (recording && recording.frames.length > 0) {
          recordings.push(recording);
        }
      }
    } catch (error) {
      console.warn('Failed to capture canvas:', error);
    }

    return recordings;
  }

  private async recordCanvas(
    elementId: string, 
    width: number, 
    height: number
  ): Promise<CanvasRecording | null> {
    if (!this.page) return null;

    const duration = 5000; // Record for 5 seconds
    const fps = 30;
    const frameCount = Math.floor((duration / 1000) * fps);
    const frameInterval = 1000 / fps;

    const frames: CanvasFrame[] = [];
    const startTime = Date.now();

    for (let i = 0; i < frameCount; i++) {
      try {
        const dataUrl = await this.page.evaluate((id) => {
          const canvas = document.querySelector(`#${id}`) as HTMLCanvasElement || 
                        document.querySelector(`canvas[id="${id}"]`) as HTMLCanvasElement;
          if (canvas) {
            return canvas.toDataURL('image/png');
          }
          return null;
        }, elementId);

        if (dataUrl) {
          frames.push({
            timestamp: Date.now() - startTime,
            dataUrl,
            index: i
          });
        }
      } catch {
        // Canvas might be tainted or inaccessible
      }

      await sleep(frameInterval);
    }

    if (frames.length === 0) return null;

    return {
      id: generateId(),
      element: elementId,
      frames,
      fps,
      width,
      height,
      duration: frames.length * frameInterval,
      format: 'png-sequence'
    };
  }

  private async extractMetadata(): Promise<PageMetadata> {
    if (!this.page) {
      return {
        title: '',
        ogTags: {},
        twitterTags: {},
        links: [],
        scripts: [],
        stylesheets: [],
        images: [],
        videos: []
      };
    }

    return this.page.evaluate(() => {
      const getMeta = (name: string) => {
        const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return meta?.getAttribute('content') || undefined;
      };

      const ogTags: Record<string, string> = {};
      document.querySelectorAll('meta[property^="og:"]').forEach(el => {
        const prop = el.getAttribute('property');
        const content = el.getAttribute('content');
        if (prop && content) ogTags[prop] = content;
      });

      const twitterTags: Record<string, string> = {};
      document.querySelectorAll('meta[name^="twitter:"]').forEach(el => {
        const name = el.getAttribute('name');
        const content = el.getAttribute('content');
        if (name && content) twitterTags[name] = content;
      });

      return {
        title: document.title || '',
        description: getMeta('description'),
        author: getMeta('author'),
        keywords: getMeta('keywords')?.split(',').map(k => k.trim()),
        ogTags,
        twitterTags,
        canonicalUrl: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || undefined,
        language: document.documentElement.lang || undefined,
        charset: document.characterSet || undefined,
        viewport: getMeta('viewport'),
        favicon: document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')?.getAttribute('href') || undefined,
        links: Array.from(document.querySelectorAll('link')).map(l => ({
          rel: l.rel || '',
          href: l.href || '',
          type: l.type || undefined
        })),
        scripts: Array.from(document.querySelectorAll('script')).map(s => ({
          src: s.src || undefined,
          inline: !s.src,
          type: s.type || undefined
        })),
        stylesheets: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => ({
          href: l.href || '',
          media: l.media || undefined
        })),
        images: Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src || '',
          alt: img.alt || undefined,
          width: img.naturalWidth || undefined,
          height: img.naturalHeight || undefined
        })),
        videos: Array.from(document.querySelectorAll('video source')).map(v => ({
          src: v.src || '',
          type: v.type || undefined
        }))
      };
    });
  }

  private async discoverNewUrls(batch: string[]): Promise<void> {
    for (const url of batch) {
      try {
        // Extract links from the page HTML
        const pageDir = path.join(this.options.outputDir, 'pages');
        const entries = await fs.readdir(pageDir);
        
        for (const entry of entries) {
          const htmlPath = path.join(pageDir, entry, 'index.html');
          
          if (await this.fileExists(htmlPath)) {
            const html = await fs.readFile(htmlPath, 'utf-8');
            const links = extractLinks(html, url);
            
            for (const link of links) {
              const normalized = normalizeUrl(link);
              if (!this.visitedUrls.has(normalized) && 
                  isInternalUrl(this.options.url, normalized) &&
                  !this.pendingUrls.includes(normalized)) {
                this.pendingUrls.push(normalized);
              }
            }
          }
        }
      } catch (error) {
        // Ignore errors in discovery
      }
    }
  }

  private async handlePagination(baseUrl: string, currentDepth: number): Promise<void> {
    if (!this.page) return;

    // Look for pagination links
    const paginationLinks = await this.page.evaluate(() => {
      const selectors = [
        'a[rel="next"]',
        '.pagination a',
        '.pager a',
        '.page-numbers a',
        'a:has-text("Next")',
        'a:has-text("→")',
        'a[aria-label*="next"]',
        'a[title*="next"]'
      ];

      for (const selector of selectors) {
        const link = document.querySelector(selector) as HTMLAnchorElement;
        if (link?.href) return link.href;
      }
      return null;
    });

    if (paginationLinks && !this.visitedUrls.has(paginationLinks)) {
      this.pendingUrls.push(paginationLinks);
    }
  }

  private calculateStats(): ArchiveStats {
    const dedupStats = this.assetDownloader.getDeduplicationStats();
    
    return {
      totalPages: this.visitedUrls.size,
      totalAssets: this.storage.getManifest().assets.length,
      totalSize: this.storage.getManifest().assets.reduce((sum, a) => sum + a.size, 0),
      uniqueAssets: dedupStats.unique,
      deduplicatedAssets: (dedupStats as any).saved || dedupStats.deduplicated,
      duration: Date.now() - this.startTime,
      errors: this.errors.length
    };
  }

  private async reportProgress(
    type: 'page' | 'asset' | 'video' | 'canvas' | 'error' | 'complete',
    url?: string,
    error?: Error
  ): Promise<void> {
    if (this.progressCallback) {
      await this.progressCallback({
        type,
        current: this.visitedUrls.size,
        total: this.options.maxPages || 100,
        url,
        error,
        message: type === 'complete' 
          ? 'Archive complete' 
          : type === 'error'
          ? `Error: ${error?.message}`
          : `Processing: ${url}`,
        stats: this.calculateStats()
      });
    }
  }

  private async saveResumeState(): Promise<void> {
    const state = {
      visitedUrls: Array.from(this.visitedUrls),
      pendingUrls: this.pendingUrls,
      timestamp: Date.now()
    };
    
    const statePath = path.join(this.options.outputDir, '.resume.json');
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  private async loadResumeState(): Promise<void> {
    const statePath = path.join(this.options.outputDir, '.resume.json');
    
    try {
      const content = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(content);
      
      this.visitedUrls = new Set(state.visitedUrls || []);
      this.pendingUrls = state.pendingUrls || [];
    } catch {
      // No resume state or invalid, start fresh
    }
  }

  private async clearResumeState(): Promise<void> {
    const statePath = path.join(this.options.outputDir, '.resume.json');
    try {
      await fs.unlink(statePath);
    } catch {
      // Ignore if doesn't exist
    }
  }

  private async cleanup(): Promise<void> {
    await this.assetDownloader.close();
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.cdp = null;
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
