/**
 * Trench CLI - Archive Command
 * Website archival with asset downloading
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { JSDOM } from 'jsdom';
import type { ArchiveOptions, ArchiveResult, ArchiveManifest, ArchivedPage, ArchivedAsset } from '../types/index.js';

/**
 * Archive a website
 */
export async function archive(options: ArchiveOptions): Promise<ArchiveResult> {
  const startTime = Date.now();
  const pagesArchived: ArchivedPage[] = [];
  const assetsDownloaded: ArchivedAsset[] = [];
  const errors: string[] = [];
  const visitedUrls = new Set<string>();
  const urlQueue: string[] = [options.url];
  
  // Ensure output directory exists
  await fs.mkdir(options.outputDir, { recursive: true });
  await fs.mkdir(path.join(options.outputDir, 'assets'), { recursive: true });
  
  const baseUrl = new URL(options.url);
  const maxPages = options.maxPages || 100;
  const maxDepth = options.depth || 3;
  
  // Process pages
  while (urlQueue.length > 0 && pagesArchived.length < maxPages) {
    const url = urlQueue.shift()!;
    
    if (visitedUrls.has(url)) continue;
    visitedUrls.add(url);
    
    try {
      const result = await archivePage(url, options, pagesArchived.length);
      
      if (result.success) {
        pagesArchived.push(result.page);
        assetsDownloaded.push(...result.assets);
        
        // Queue internal links
        if (pagesArchived.length < maxPages) {
          for (const link of result.internalLinks) {
            if (!visitedUrls.has(link) && isSameDomain(link, baseUrl)) {
              urlQueue.push(link);
            }
          }
        }
      }
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Create manifest
  const manifest: ArchiveManifest = {
    version: '1.0.0',
    rootUrl: options.url,
    pages: pagesArchived,
    assets: assetsDownloaded,
  };
  
  await fs.writeFile(
    path.join(options.outputDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  return {
    url: options.url,
    outputDir: options.outputDir,
    pagesArchived: pagesArchived.length,
    assetsDownloaded: assetsDownloaded.length,
    errors,
    manifest,
    completedAt: new Date(),
  };
}

/**
 * Archive single page
 */
async function archivePage(
  url: string,
  options: ArchiveOptions,
  pageIndex: number
): Promise<{
  success: boolean;
  page: ArchivedPage;
  assets: ArchivedAsset[];
  internalLinks: string[];
}> {
  // Fetch page
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;
  
  // Extract title
  const title = document.title || 'Untitled';
  
  // Get page filename
  const fileName = pageIndex === 0 ? 'index.html' : `page_${pageIndex}.html`;
  const filePath = path.join(options.outputDir, fileName);
  
  // Extract and download assets if requested
  const assets: ArchivedAsset[] = [];
  
  if (options.fullAssets !== false) {
    // Images
    const images = Array.from(document.querySelectorAll('img[src]'));
    for (const img of images) {
      const assetResult = await downloadAsset(
        img.getAttribute('src')!,
        url,
        options.outputDir,
        'image'
      );
      if (assetResult) {
        assets.push(assetResult);
        img.setAttribute('src', getRelativeAssetPath(assetResult.filePath, filePath));
      }
    }
    
    // CSS
    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'));
    for (const css of stylesheets) {
      const assetResult = await downloadAsset(
        css.getAttribute('href')!,
        url,
        options.outputDir,
        'css'
      );
      if (assetResult) {
        assets.push(assetResult);
        css.setAttribute('href', getRelativeAssetPath(assetResult.filePath, filePath));
      }
    }
    
    // JavaScript if enabled
    if (options.javascript) {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      for (const script of scripts) {
        const assetResult = await downloadAsset(
          script.getAttribute('src')!,
          url,
          options.outputDir,
          'js'
        );
        if (assetResult) {
          assets.push(assetResult);
          script.setAttribute('src', getRelativeAssetPath(assetResult.filePath, filePath));
        }
      }
    }
    
    // Fonts
    const fonts = Array.from(document.querySelectorAll('link[rel="preload"][as="font"][href]'));
    for (const font of fonts) {
      const assetResult = await downloadAsset(
        font.getAttribute('href')!,
        url,
        options.outputDir,
        'font'
      );
      if (assetResult) {
        assets.push(assetResult);
        font.setAttribute('href', getRelativeAssetPath(assetResult.filePath, filePath));
      }
    }
  }
  
  // Extract links
  const links = Array.from(document.querySelectorAll('a[href]'));
  const internalLinks: string[] = [];
  
  for (const link of links) {
    const href = link.getAttribute('href');
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      try {
        const absoluteUrl = new URL(href, url).href;
        internalLinks.push(absoluteUrl);
        
        // Update link to point to local file
        if (isSameDomain(absoluteUrl, new URL(url))) {
          link.setAttribute('href', getLocalLinkPath(absoluteUrl, url, pageIndex));
        }
      } catch {
        // Invalid URL
      }
    }
  }
  
  // Save modified HTML
  const modifiedHtml = dom.serialize();
  await fs.writeFile(filePath, modifiedHtml);
  
  return {
    success: true,
    page: {
      url,
      filePath: fileName,
      title,
      archivedAt: new Date(),
      links: internalLinks,
    },
    assets,
    internalLinks,
  };
}

/**
 * Download asset
 */
async function downloadAsset(
  assetUrl: string,
  baseUrl: string,
  outputDir: string,
  type: ArchivedAsset['type']
): Promise<ArchivedAsset | null> {
  try {
    const absoluteUrl = new URL(assetUrl, baseUrl).href;
    
    // Skip data URLs
    if (absoluteUrl.startsWith('data:')) return null;
    
    // Skip external URLs
    if (!isSameDomain(absoluteUrl, new URL(baseUrl))) {
      return {
        url: absoluteUrl,
        filePath: absoluteUrl,
        type,
        size: 0,
      };
    }
    
    const response = await fetch(absoluteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return null;
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Generate filename
    const urlPath = new URL(absoluteUrl).pathname;
    const ext = path.extname(urlPath) || getExtensionForType(type);
    const fileName = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
    const filePath = path.join(outputDir, 'assets', fileName);
    
    await fs.writeFile(filePath, buffer);
    
    return {
      url: absoluteUrl,
      filePath,
      type,
      size: buffer.length,
    };
  } catch {
    return null;
  }
}

/**
 * Check if URLs are same domain
 */
function isSameDomain(url1: string, url2: URL): boolean {
  try {
    const u1 = new URL(url1);
    return u1.hostname === url2.hostname;
  } catch {
    return false;
  }
}

/**
 * Get relative asset path
 */
function getRelativeAssetPath(assetPath: string, pagePath: string): string {
  const relative = path.relative(path.dirname(pagePath), assetPath);
  return relative.replace(/\\/g, '/');
}

/**
 * Get local link path
 */
function getLocalLinkPath(targetUrl: string, baseUrl: string, currentIndex: number): string {
  // Simple mapping - in production, use URL-to-filename mapping
  return targetUrl === baseUrl ? 'index.html' : targetUrl;
}

/**
 * Get file extension for asset type
 */
function getExtensionForType(type: ArchivedAsset['type']): string {
  switch (type) {
    case 'image': return '.png';
    case 'css': return '.css';
    case 'js': return '.js';
    case 'font': return '.woff2';
    default: return '.bin';
  }
}
