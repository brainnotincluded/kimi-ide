/**
 * Asset Downloader for Trench Archival Browser
 * 
 * Handles downloading of various asset types:
 * - CSS, images, fonts, SVG
 * - Videos (MP4, WebM, HLS streams)
 * - WebGL textures and shaders
 * - Audio files
 * - Workers and WASM
 */

import { chromium, type Browser, type Page, type CDPSession, type Response } from 'playwright';
import { URL } from 'url';
import { promises as fs } from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import type { 
  AssetInfo, 
  AssetType, 
  ArchiveOptions, 
  VideoSegment,
  ProgressCallback 
} from './types.js';
import { 
  sha256, 
  getFileExtension, 
  getAssetType, 
  retry, 
  sleep,
  normalizeUrl,
  isValidUrl,
  formatBytes
} from './utils.js';

export interface DownloadResult {
  asset: AssetInfo;
  skipped: boolean;
  error?: Error;
}

export class AssetDownloader {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private cdp: CDPSession | null = null;
  private downloadedUrls = new Set<string>();
  private deduplicationMap = new Map<string, string>(); // hash -> url
  private limit: ReturnType<typeof pLimit>;
  private options: ArchiveOptions;
  private assetsDir: string;
  private progressCallback?: ProgressCallback;
  private currentAsset = 0;
  private totalAssets = 0;

  constructor(options: ArchiveOptions, progressCallback?: ProgressCallback) {
    this.options = {
      concurrency: 5,
      timeout: 30000,
      deduplicate: true,
      ...options
    };
    this.limit = pLimit(this.options.concurrency!);
    this.assetsDir = path.join(options.outputDir, 'assets');
    this.progressCallback = progressCallback;
  }

  async initialize(): Promise<void> {
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
      ]
    });

    this.page = await this.browser.newPage({
      viewport: {
        width: this.options.viewportWidth || 1920,
        height: this.options.viewportHeight || 1080,
      },
      userAgent: this.options.userAgent || 
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // Set timeout
    this.page.setDefaultTimeout(this.options.timeout || 30000);
    this.page.setDefaultNavigationTimeout(this.options.timeout || 30000);

    // Initialize CDP session
    this.cdp = await this.page.context().newCDPSession(this.page);

    // Enable network domain
    await this.cdp.send('Network.enable');

    // Set extra HTTP headers
    if (this.options.headers) {
      await this.page.setExtraHTTPHeaders(this.options.headers);
    }

    // Set cookies
    if (this.options.cookies) {
      await this.page.context().addCookies(
        this.options.cookies.map(cookie => ({
          ...cookie,
          domain: cookie.domain || new URL(this.options.url).hostname,
          path: '/',
        }))
      );
    }

    // Authenticate if needed
    if (this.options.auth) {
      await this.page.authenticate(this.options.auth);
    }

    // Create assets directory
    await fs.mkdir(this.assetsDir, { recursive: true });
  }

  async downloadAssets(urls: string[]): Promise<DownloadResult[]> {
    this.totalAssets = urls.length;
    this.currentAsset = 0;

    const results = await Promise.all(
      urls.map(url => this.limit(() => this.downloadAsset(url)))
    );

    return results;
  }

  async downloadAsset(url: string, referrer?: string): Promise<DownloadResult> {
    const normalizedUrl = normalizeUrl(url);
    
    // Skip already downloaded URLs
    if (this.downloadedUrls.has(normalizedUrl)) {
      return {
        asset: this.createAssetInfo(normalizedUrl, 'other', 0, 200, {}),
        skipped: true
      };
    }

    // Check if we should block this resource type
    if (this.shouldBlockResource(url)) {
      return {
        asset: this.createAssetInfo(normalizedUrl, 'other', 0, 0, {}),
        skipped: true
      };
    }

    this.currentAsset++;
    await this.reportProgress('asset', normalizedUrl);

    try {
      return await retry(async () => {
        const result = await this.performDownload(normalizedUrl, referrer);
        this.downloadedUrls.add(normalizedUrl);
        return result;
      }, 3, 1000);
    } catch (error) {
      await this.reportProgress('error', normalizedUrl, error as Error);
      return {
        asset: this.createAssetInfo(normalizedUrl, 'other', 0, 0, {}),
        skipped: false,
        error: error as Error
      };
    }
  }

  private async performDownload(url: string, referrer?: string): Promise<DownloadResult> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    // Determine if this is a media stream
    const isStream = this.isStreamUrl(url);
    
    if (isStream && this.options.captureVideo) {
      return this.downloadStream(url, referrer);
    }

    // Regular HTTP download
    const response = await this.page.evaluate(async (downloadUrl) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      try {
        const resp = await fetch(downloadUrl, {
          signal: controller.signal,
          credentials: 'include',
        });
        
        clearTimeout(timeout);
        
        const blob = await resp.blob();
        const arrayBuffer = await blob.arrayBuffer();
        
        return {
          status: resp.status,
          statusText: resp.statusText,
          headers: Object.fromEntries(resp.headers.entries()),
          data: Array.from(new Uint8Array(arrayBuffer)),
          size: blob.size,
          mimeType: blob.type
        };
      } catch (error) {
        clearTimeout(timeout);
        throw error;
      }
    }, url);

    if (!response || response.status >= 400) {
      throw new Error(`HTTP ${response?.status || 'unknown'}: ${url}`);
    }

    const buffer = Buffer.from(response.data);
    const mimeType = response.mimeType || response.headers['content-type'] || 'application/octet-stream';
    const assetType = getAssetType(mimeType);
    const hash = sha256(buffer);

    // Check for deduplication
    if (this.options.deduplicate && this.deduplicationMap.has(hash)) {
      return {
        asset: {
          ...this.createAssetInfo(url, assetType, buffer.length, response.status, response.headers),
          hash,
          path: this.deduplicationMap.get(hash),
          referrer
        },
        skipped: false
      };
    }

    // Save to disk
    const fileName = this.generateFileName(url, mimeType);
    const filePath = path.join(this.assetsDir, fileName);
    await fs.writeFile(filePath, buffer);

    // Track for deduplication
    if (this.options.deduplicate) {
      const relativePath = path.join('assets', fileName);
      this.deduplicationMap.set(hash, relativePath);
    }

    return {
      asset: {
        ...this.createAssetInfo(url, assetType, buffer.length, response.status, response.headers),
        hash,
        path: path.join('assets', fileName),
        referrer
      },
      skipped: false
    };
  }

  private async downloadStream(url: string, referrer?: string): Promise<DownloadResult> {
    if (!this.cdp) {
      throw new Error('CDP session not initialized');
    }

    // For HLS/DASH streams, we need to capture the segments
    const segments: VideoSegment[] = [];
    let mimeType = 'application/vnd.apple.mpegurl';
    
    // Try to fetch the manifest
    const manifestResponse = await fetch(url);
    if (!manifestResponse.ok) {
      throw new Error(`Failed to fetch stream manifest: ${url}`);
    }
    
    const manifestText = await manifestResponse.text();
    
    // Parse HLS playlist
    if (url.endsWith('.m3u8') || manifestText.includes('#EXTM3U')) {
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      const segmentUrls = this.parseHlsManifest(manifestText, baseUrl);
      
      // Download segments
      for (let i = 0; i < segmentUrls.length; i++) {
        try {
          const segmentResp = await fetch(segmentUrls[i]);
          if (segmentResp.ok) {
            const data = Buffer.from(await segmentResp.arrayBuffer());
            segments.push({
              index: i,
              url: segmentUrls[i],
              duration: 0, // Would need to parse from manifest
              data
            });
          }
        } catch (e) {
          console.warn(`Failed to download segment ${i}:`, e);
        }
      }
    }

    // Save segments
    const streamDir = path.join(this.assetsDir, 'streams', sha256(url));
    await fs.mkdir(streamDir, { recursive: true });

    for (const segment of segments) {
      if (segment.data) {
        const segmentPath = path.join(streamDir, `segment_${segment.index}.ts`);
        await fs.writeFile(segmentPath, segment.data);
      }
    }

    // Save manifest
    const manifestPath = path.join(streamDir, 'playlist.m3u8');
    await fs.writeFile(manifestPath, manifestText);

    return {
      asset: {
        ...this.createAssetInfo(url, 'video', segments.reduce((sum, s) => sum + (s.data?.length || 0), 0), 200, {}),
        path: streamDir,
        referrer
      },
      skipped: false
    };
  }

  private parseHlsManifest(manifest: string, baseUrl: string): string[] {
    const urls: string[] = [];
    const lines = manifest.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        // It's a segment URL
        if (trimmed.startsWith('http')) {
          urls.push(trimmed);
        } else {
          urls.push(new URL(trimmed, baseUrl).href);
        }
      }
    }
    
    return urls;
  }

  async downloadWebGLResources(page: Page): Promise<AssetInfo[]> {
    const assets: AssetInfo[] = [];

    try {
      // Extract WebGL textures and shaders from canvases
      const webglResources = await page.evaluate(() => {
        const resources: Array<{ type: string; data: string; url: string }> = [];
        const canvases = document.querySelectorAll('canvas');
        
        canvases.forEach((canvas, index) => {
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          if (gl) {
            // Try to capture shader sources
            // Note: This is limited due to browser security
            try {
              const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
              if (debugInfo) {
                resources.push({
                  type: 'webgl-info',
                  data: JSON.stringify({
                    vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
                    renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
                  }),
                  url: `webgl://canvas-${index}/info`
                });
              }
            } catch {
              // Ignore errors
            }
          }
        });
        
        return resources;
      });

      // Save WebGL resources
      for (const resource of webglResources) {
        const data = Buffer.from(resource.data);
        const hash = sha256(data);
        const fileName = `webgl_${sha256(resource.url)}.json`;
        const filePath = path.join(this.assetsDir, fileName);
        
        await fs.writeFile(filePath, data);
        
        assets.push({
          url: resource.url,
          type: 'webgl',
          mimeType: 'application/json',
          size: data.length,
          hash,
          path: path.join('assets', fileName),
          timestamp: new Date(),
          statusCode: 200,
          headers: {}
        });
      }
    } catch (error) {
      console.warn('Failed to extract WebGL resources:', error);
    }

    return assets;
  }

  async discoverAssetsFromPage(page: Page, baseUrl: string): Promise<string[]> {
    const discoveredUrls = new Set<string>();

    // Extract URLs from various sources
    const extractedUrls = await page.evaluate(() => {
      const urls: string[] = [];
      
      // Images
      document.querySelectorAll('img').forEach(img => {
        if (img.src) urls.push(img.src);
        if (img.srcset) {
          img.srcset.split(',').forEach(src => {
            const url = src.trim().split(' ')[0];
            if (url) urls.push(url);
          });
        }
      });
      
      // Picture sources
      document.querySelectorAll('picture source').forEach(source => {
        if (source.srcset) {
          source.srcset.split(',').forEach(src => {
            const url = src.trim().split(' ')[0];
            if (url) urls.push(url);
          });
        }
      });
      
      // Stylesheets
      document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        if (link.href) urls.push(link.href);
      });
      
      // Scripts
      document.querySelectorAll('script[src]').forEach(script => {
        if (script.src) urls.push(script.src);
      });
      
      // Links (for prefetch/preload)
      document.querySelectorAll('link[href]').forEach(link => {
        const rel = link.rel;
        if (rel === 'preload' || rel === 'prefetch' || rel === 'icon' || rel === 'shortcut icon') {
          if (link.href) urls.push(link.href);
        }
      });
      
      // Videos
      document.querySelectorAll('video').forEach(video => {
        if (video.src) urls.push(video.src);
        video.querySelectorAll('source').forEach(source => {
          if (source.src) urls.push(source.src);
        });
        if (video.poster) urls.push(video.poster);
      });
      
      // Audio
      document.querySelectorAll('audio').forEach(audio => {
        if (audio.src) urls.push(audio.src);
        audio.querySelectorAll('source').forEach(source => {
          if (source.src) urls.push(source.src);
        });
      });
      
      // Background images in styles
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const bgImage = style.backgroundImage;
        if (bgImage && bgImage !== 'none') {
          const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
          if (match) urls.push(match[1]);
        }
      });
      
      // Data attributes with URLs
      document.querySelectorAll('[data-src], [data-bg]').forEach(el => {
        const dataset = (el as HTMLElement).dataset;
        if (dataset.src) urls.push(dataset.src);
        if (dataset.bg) urls.push(dataset.bg);
      });
      
      // Inline styles with background images
      document.querySelectorAll('[style*="background"]').forEach(el => {
        const style = el.getAttribute('style');
        if (style) {
          const matches = style.matchAll(/url\(["']?([^"')]+)["']?\)/g);
          for (const match of matches) {
            urls.push(match[1]);
          }
        }
      });
      
      return urls;
    });

    // Normalize and filter URLs
    for (const url of extractedUrls) {
      try {
        if (isValidUrl(url)) {
          discoveredUrls.add(url);
        } else {
          // Try to resolve relative URL
          const resolved = new URL(url, baseUrl).href;
          discoveredUrls.add(resolved);
        }
      } catch {
        // Invalid URL, skip
      }
    }

    return Array.from(discoveredUrls);
  }

  private isStreamUrl(url: string): boolean {
    const streamPatterns = [
      /\.m3u8/i,
      /\.mpd/i,
      /manifest\.json/i,
      /master\.m3u8/i,
      /playlist\.m3u8/i,
      /stream/i,
    ];
    return streamPatterns.some(pattern => pattern.test(url));
  }

  private shouldBlockResource(url: string): boolean {
    if (!this.options.blockResources) return false;
    
    const urlLower = url.toLowerCase();
    return this.options.blockResources.some(blocked => 
      urlLower.includes(blocked.toLowerCase())
    );
  }

  private generateFileName(url: string, mimeType: string): string {
    const hash = sha256(url).substring(0, 16);
    const ext = getFileExtension(url, mimeType);
    return `${hash}.${ext}`;
  }

  private createAssetInfo(
    url: string, 
    type: AssetType, 
    size: number, 
    statusCode: number,
    headers: Record<string, string>
  ): AssetInfo {
    return {
      url,
      type,
      mimeType: headers['content-type'] || 'application/octet-stream',
      size,
      timestamp: new Date(),
      statusCode,
      headers
    };
  }

  private async reportProgress(type: 'asset' | 'error', url?: string, error?: Error): Promise<void> {
    if (this.progressCallback) {
      await this.progressCallback({
        type,
        current: this.currentAsset,
        total: this.totalAssets,
        url,
        error,
        message: type === 'error' ? `Failed to download: ${url}` : `Downloading: ${url}`
      });
    }
  }

  getDownloadedUrls(): Set<string> {
    return new Set(this.downloadedUrls);
  }

  getDeduplicationStats(): { unique: number; deduplicated: number } {
    return {
      unique: this.deduplicationMap.size,
      deduplicated: this.downloadedUrls.size - this.deduplicationMap.size
    };
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.cdp = null;
    }
  }
}
