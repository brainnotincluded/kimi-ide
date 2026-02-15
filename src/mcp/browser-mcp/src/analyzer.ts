/**
 * Analyzer module for Trench Archival Browser
 * 
 * Provides analysis of archived content:
 * - Asset breakdown
 * - Technology detection
 * - SEO analysis
 * - Security audit
 * - Performance metrics
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { 
  ArchiveManifest, 
  AnalysisResult, 
  AssetType, 
  PageManifest 
} from './types.js';
import { ArchiveStorage } from './storage.js';

export class ArchiveAnalyzer {
  private archivePath: string;
  private manifest: ArchiveManifest | null = null;

  constructor(archivePath: string) {
    this.archivePath = archivePath;
  }

  async initialize(): Promise<void> {
    this.manifest = await ArchiveStorage.loadTrenchArchive(this.archivePath);
  }

  async analyze(): Promise<AnalysisResult> {
    if (!this.manifest) {
      throw new Error('Analyzer not initialized');
    }

    const [assetBreakdown, technologies, externalDomains, brokenLinks, performance, seo, security] = await Promise.all([
      this.analyzeAssetBreakdown(),
      this.detectTechnologies(),
      this.extractExternalDomains(),
      this.findBrokenLinks(),
      this.analyzePerformance(),
      this.analyzeSEO(),
      this.analyzeSecurity()
    ]);

    return {
      summary: {
        totalPages: this.manifest.stats.totalPages,
        totalAssets: this.manifest.stats.totalAssets,
        totalSize: this.manifest.stats.totalSize,
        duration: this.manifest.stats.duration
      },
      assetBreakdown,
      technologies,
      externalDomains,
      brokenLinks,
      performance,
      seo,
      security
    };
  }

  private async analyzeAssetBreakdown(): Promise<Record<AssetType, { count: number; size: number }>> {
    const breakdown: Record<string, { count: number; size: number }> = {
      document: { count: 0, size: 0 },
      stylesheet: { count: 0, size: 0 },
      script: { count: 0, size: 0 },
      image: { count: 0, size: 0 },
      font: { count: 0, size: 0 },
      video: { count: 0, size: 0 },
      audio: { count: 0, size: 0 },
      webgl: { count: 0, size: 0 },
      wasm: { count: 0, size: 0 },
      worker: { count: 0, size: 0 },
      websocket: { count: 0, size: 0 },
      xhr: { count: 0, size: 0 },
      other: { count: 0, size: 0 }
    };

    for (const asset of this.manifest!.assets) {
      if (breakdown[asset.type]) {
        breakdown[asset.type].count++;
        breakdown[asset.type].size += asset.size;
      }
    }

    return breakdown as Record<AssetType, { count: number; size: number }>;
  }

  private async detectTechnologies(): Promise<string[]> {
    const technologies = new Set<string>();

    for (const asset of this.manifest!.assets) {
      const tech = this.identifyTechnology(asset.url, asset.mimeType);
      if (tech) technologies.add(tech);
    }

    // Check page metadata for frameworks
    for (const page of this.manifest!.pages) {
      try {
        const metadataPath = path.join(this.archivePath, page.path, 'metadata.json');
        if (await this.fileExists(metadataPath)) {
          const content = await fs.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(content);
          
          // Check for React
          if (metadata.scripts?.some((s: { src?: string }) => 
            s.src?.includes('react') || s.src?.includes('next'))) {
            technologies.add('React');
          }
          
          // Check for Vue
          if (metadata.scripts?.some((s: { src?: string }) => 
            s.src?.includes('vue'))) {
            technologies.add('Vue.js');
          }
          
          // Check for Angular
          if (metadata.scripts?.some((s: { src?: string }) => 
            s.src?.includes('angular'))) {
            technologies.add('Angular');
          }
          
          // Check for jQuery
          if (metadata.scripts?.some((s: { src?: string }) => 
            s.src?.includes('jquery'))) {
            technologies.add('jQuery');
          }
          
          // Check for Bootstrap
          if (metadata.stylesheets?.some((s: { href?: string }) => 
            s.href?.includes('bootstrap'))) {
            technologies.add('Bootstrap');
          }
          
          // Check for Tailwind
          if (metadata.stylesheets?.some((s: { href?: string }) => 
            s.href?.includes('tailwind'))) {
            technologies.add('Tailwind CSS');
          }
        }
      } catch {
        // Ignore errors
      }
    }

    return Array.from(technologies).sort();
  }

  private identifyTechnology(url: string, mimeType: string): string | null {
    const urlLower = url.toLowerCase();
    
    // Frameworks
    if (urlLower.includes('react')) return 'React';
    if (urlLower.includes('vue')) return 'Vue.js';
    if (urlLower.includes('angular')) return 'Angular';
    if (urlLower.includes('svelte')) return 'Svelte';
    if (urlLower.includes('jquery')) return 'jQuery';
    
    // CSS Frameworks
    if (urlLower.includes('bootstrap')) return 'Bootstrap';
    if (urlLower.includes('tailwind')) return 'Tailwind CSS';
    if (urlLower.includes('bulma')) return 'Bulma';
    if (urlLower.includes('foundation')) return 'Foundation';
    
    // Analytics
    if (urlLower.includes('google-analytics') || urlLower.includes('gtag')) return 'Google Analytics';
    if (urlLower.includes('googletagmanager')) return 'Google Tag Manager';
    if (urlLower.includes('mixpanel')) return 'Mixpanel';
    if (urlLower.includes('segment')) return 'Segment';
    
    // Fonts
    if (urlLower.includes('fonts.google')) return 'Google Fonts';
    if (urlLower.includes('fontawesome')) return 'Font Awesome';
    if (urlLower.includes('typekit')) return 'Adobe Typekit';
    
    // CDNs
    if (urlLower.includes('cdnjs')) return 'cdnjs';
    if (urlLower.includes('unpkg')) return 'unpkg';
    if (urlLower.includes('jsdelivr')) return 'jsDelivr';
    if (urlLower.includes('cloudflare')) return 'Cloudflare CDN';
    
    // Build tools
    if (urlLower.includes('webpack')) return 'Webpack';
    if (urlLower.includes('rollup')) return 'Rollup';
    if (urlLower.includes('parcel')) return 'Parcel';
    if (urlLower.includes('vite')) return 'Vite';
    
    // CMS
    if (urlLower.includes('wordpress')) return 'WordPress';
    if (urlLower.includes('drupal')) return 'Drupal';
    if (urlLower.includes('joomla')) return 'Joomla';
    
    // E-commerce
    if (urlLower.includes('shopify')) return 'Shopify';
    if (urlLower.includes('woocommerce')) return 'WooCommerce';
    if (urlLower.includes('magento')) return 'Magento';
    
    // Video players
    if (urlLower.includes('video.js') || urlLower.includes('videojs')) return 'Video.js';
    if (urlLower.includes('hls.js')) return 'HLS.js';
    if (urlLower.includes('dash.js')) return 'DASH.js';
    if (urlLower.includes('plyr')) return 'Plyr';
    
    // WebGL/3D
    if (urlLower.includes('three.js') || urlLower.includes('threejs')) return 'Three.js';
    if (urlLower.includes('babylon')) return 'Babylon.js';
    if (urlLower.includes('webgl')) return 'WebGL';
    
    // WASM
    if (mimeType === 'application/wasm') return 'WebAssembly';
    
    return null;
  }

  private async extractExternalDomains(): Promise<string[]> {
    const domains = new Set<string>();
    const baseDomain = new URL(this.manifest!.url).hostname;

    for (const asset of this.manifest!.assets) {
      try {
        const assetDomain = new URL(asset.url).hostname;
        if (assetDomain !== baseDomain) {
          domains.add(assetDomain);
        }
      } catch {
        // Invalid URL
      }
    }

    return Array.from(domains).sort();
  }

  private async findBrokenLinks(): Promise<Array<{ url: string; status: number; page: string }>> {
    const brokenLinks: Array<{ url: string; status: number; page: string }> = [];

    for (const asset of this.manifest!.assets) {
      if (asset.statusCode && asset.statusCode >= 400) {
        // Find which pages reference this asset
        for (const page of this.manifest!.pages) {
          const pagePath = path.join(this.archivePath, page.path, 'index.html');
          try {
            const html = await fs.readFile(pagePath, 'utf-8');
            if (html.includes(asset.url)) {
              brokenLinks.push({
                url: asset.url,
                status: asset.statusCode || 0,
                page: page.url
              });
              break;
            }
          } catch {
            // Ignore errors
          }
        }
      }
    }

    return brokenLinks;
  }

  private async analyzePerformance(): Promise<{
    averageLoadTime: number;
    largestAssets: Array<{ url: string; size: number; type: AssetType }>;
    slowestPages: Array<{ url: string; loadTime: number }>;
  }> {
    // Get largest assets
    const largestAssets = this.manifest!.assets
      .filter(a => !a.deduplicated)
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
      .map(a => ({ url: a.url, size: a.size, type: a.type }));

    // Calculate average load time (estimated from archive duration)
    const avgLoadTime = this.manifest!.stats.duration / this.manifest!.stats.totalPages;

    return {
      averageLoadTime: avgLoadTime,
      largestAssets,
      slowestPages: [] // Would require more detailed timing data
    };
  }

  private async analyzeSEO(): Promise<{
    missingTitles: number;
    missingDescriptions: number;
    missingAltTags: number;
    averageContentLength: number;
  }> {
    let missingTitles = 0;
    let missingDescriptions = 0;
    let totalImages = 0;
    let missingAltTags = 0;
    let totalContentLength = 0;

    for (const page of this.manifest!.pages) {
      try {
        const metadataPath = path.join(this.archivePath, page.path, 'metadata.json');
        if (await this.fileExists(metadataPath)) {
          const content = await fs.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(content);
          
          if (!metadata.title) missingTitles++;
          if (!metadata.description) missingDescriptions++;
          
          // Count images without alt
          if (metadata.images) {
            totalImages += metadata.images.length;
            missingAltTags += metadata.images.filter((img: { alt?: string }) => !img.alt).length;
          }
        }

        // Get content length
        const htmlPath = path.join(this.archivePath, page.path, 'index.html');
        if (await this.fileExists(htmlPath)) {
          const html = await fs.readFile(htmlPath, 'utf-8');
          totalContentLength += html.length;
        }
      } catch {
        // Ignore errors
      }
    }

    return {
      missingTitles,
      missingDescriptions,
      missingAltTags,
      averageContentLength: this.manifest!.stats.totalPages > 0 
        ? totalContentLength / this.manifest!.stats.totalPages 
        : 0
    };
  }

  private async analyzeSecurity(): Promise<{
    httpsPercentage: number;
    insecureResources: string[];
    cookies: Array<{ name: string; secure: boolean; httpOnly: boolean }>;
  }> {
    let httpsCount = 0;
    const insecureResources: string[] = [];

    for (const asset of this.manifest!.assets) {
      try {
        const url = new URL(asset.url);
        if (url.protocol === 'https:') {
          httpsCount++;
        } else if (url.protocol === 'http:') {
          insecureResources.push(asset.url);
        }
      } catch {
        // Invalid URL
      }
    }

    const httpsPercentage = this.manifest!.assets.length > 0 
      ? (httpsCount / this.manifest!.assets.length) * 100 
      : 0;

    return {
      httpsPercentage,
      insecureResources,
      cookies: [] // Would require cookie data from original crawl
    };
  }

  async exportAnalysis(format: 'json' | 'html' | 'markdown' = 'json'): Promise<string> {
    const analysis = await this.analyze();

    switch (format) {
      case 'json':
        return JSON.stringify(analysis, null, 2);
      case 'html':
        return this.generateHtmlReport(analysis);
      case 'markdown':
        return this.generateMarkdownReport(analysis);
      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }

  private generateHtmlReport(analysis: AnalysisResult): string {
    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Trench Archive Analysis Report</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; color: #333; }
    h1, h2 { color: #0066cc; }
    .section { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .stat-card { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat-value { font-size: 28px; font-weight: bold; color: #0066cc; }
    .stat-label { color: #666; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: 600; }
    .tag { display: inline-block; background: #e3f2fd; color: #0066cc; padding: 4px 10px; border-radius: 12px; font-size: 12px; margin: 2px; }
    .warning { color: #f57c00; }
    .error { color: #d32f2f; }
    .success { color: #388e3c; }
  </style>
</head>
<body>
  <h1>📊 Trench Archive Analysis Report</h1>
  
  <div class="section">
    <h2>Summary</h2>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-value">${analysis.summary.totalPages}</div>
        <div class="stat-label">Pages Archived</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${analysis.summary.totalAssets}</div>
        <div class="stat-label">Total Assets</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formatBytes(analysis.summary.totalSize)}</div>
        <div class="stat-label">Total Size</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${Math.round(analysis.summary.duration / 1000)}s</div>
        <div class="stat-label">Archive Duration</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Asset Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Count</th>
          <th>Size</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(analysis.assetBreakdown)
          .filter(([_, data]) => data.count > 0)
          .sort(([_, a], [__, b]) => b.size - a.size)
          .map(([type, data]) => `
            <tr>
              <td>${type}</td>
              <td>${data.count}</td>
              <td>${formatBytes(data.size)}</td>
            </tr>
          `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Technologies Detected</h2>
    <div>
      ${analysis.technologies.map(tech => `<span class="tag">${tech}</span>`).join('')}
    </div>
  </div>

  <div class="section">
    <h2>SEO Analysis</h2>
    <table>
      <tr>
        <td>Missing Titles</td>
        <td class="${analysis.seo.missingTitles > 0 ? 'warning' : 'success'}">${analysis.seo.missingTitles}</td>
      </tr>
      <tr>
        <td>Missing Descriptions</td>
        <td class="${analysis.seo.missingDescriptions > 0 ? 'warning' : 'success'}">${analysis.seo.missingDescriptions}</td>
      </tr>
      <tr>
        <td>Missing Alt Tags</td>
        <td class="${analysis.seo.missingAltTags > 0 ? 'warning' : 'success'}">${analysis.seo.missingAltTags}</td>
      </tr>
      <tr>
        <td>Average Content Length</td>
        <td>${Math.round(analysis.seo.averageContentLength)} bytes</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>Security Analysis</h2>
    <table>
      <tr>
        <td>HTTPS Resources</td>
        <td class="${analysis.security.httpsPercentage >= 90 ? 'success' : 'warning'}">
          ${analysis.security.httpsPercentage.toFixed(1)}%
        </td>
      </tr>
      <tr>
        <td>Insecure Resources</td>
        <td class="${analysis.security.insecureResources.length === 0 ? 'success' : 'error'}">
          ${analysis.security.insecureResources.length}
        </td>
      </tr>
    </table>
  </div>

  ${analysis.performance.largestAssets.length > 0 ? `
  <div class="section">
    <h2>Largest Assets</h2>
    <table>
      <thead>
        <tr>
          <th>URL</th>
          <th>Type</th>
          <th>Size</th>
        </tr>
      </thead>
      <tbody>
        ${analysis.performance.largestAssets.map(asset => `
          <tr>
            <td style="max-width: 500px; overflow: hidden; text-overflow: ellipsis;">${asset.url}</td>
            <td>${asset.type}</td>
            <td>${formatBytes(asset.size)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  ${analysis.brokenLinks.length > 0 ? `
  <div class="section">
    <h2>Broken Links (${analysis.brokenLinks.length})</h2>
    <table>
      <thead>
        <tr>
          <th>URL</th>
          <th>Status</th>
          <th>Found On</th>
        </tr>
      </thead>
      <tbody>
        ${analysis.brokenLinks.map(link => `
          <tr>
            <td>${link.url}</td>
            <td class="error">${link.status}</td>
            <td>${link.page}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}
</body>
</html>`;
  }

  private generateMarkdownReport(analysis: AnalysisResult): string {
    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return `# Trench Archive Analysis Report

## Summary

| Metric | Value |
|--------|-------|
| Pages Archived | ${analysis.summary.totalPages} |
| Total Assets | ${analysis.summary.totalAssets} |
| Total Size | ${formatBytes(analysis.summary.totalSize)} |
| Archive Duration | ${Math.round(analysis.summary.duration / 1000)}s |

## Asset Breakdown

| Type | Count | Size |
|------|-------|------|
${Object.entries(analysis.assetBreakdown)
  .filter(([_, data]) => data.count > 0)
  .sort(([_, a], [__, b]) => b.size - a.size)
  .map(([type, data]) => `| ${type} | ${data.count} | ${formatBytes(data.size)} |`)
  .join('\n')}

## Technologies Detected

${analysis.technologies.map(t => `- ${t}`).join('\n')}

## SEO Analysis

- Missing Titles: ${analysis.seo.missingTitles}
- Missing Descriptions: ${analysis.seo.missingDescriptions}
- Missing Alt Tags: ${analysis.seo.missingAltTags}
- Average Content Length: ${Math.round(analysis.seo.averageContentLength)} bytes

## Security Analysis

- HTTPS Resources: ${analysis.security.httpsPercentage.toFixed(1)}%
- Insecure Resources: ${analysis.security.insecureResources.length}

${analysis.brokenLinks.length > 0 ? `
## Broken Links (${analysis.brokenLinks.length})

| URL | Status | Found On |
|-----|--------|----------|
${analysis.brokenLinks.map(l => `| ${l.url} | ${l.status} | ${l.page} |`).join('\n')}
` : ''}

---
*Generated by Trench Archival Browser*
`;
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
