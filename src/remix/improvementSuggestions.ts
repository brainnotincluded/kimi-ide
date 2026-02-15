/**
 * Site Remix Engine - Improvement Suggestions
 * Analyzes and suggests improvements for websites
 * Trench Project
 */

import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';
import sharp from 'sharp';
import {
  ImprovementSuggestion,
  BrokenLink,
  MissingMeta,
  ImageOptimization,
  AnalysisReport
} from './types';

export class ImprovementSuggestions {
  private sitePath: string;
  private report: AnalysisReport | null = null;

  constructor(sitePath: string) {
    this.sitePath = sitePath;
  }

  /**
   * Load analysis report
   */
  loadReport(report: AnalysisReport): void {
    this.report = report;
  }

  /**
   * Generate all improvement suggestions
   */
  async generateSuggestions(): Promise<{
    suggestions: ImprovementSuggestion[];
    autoFixable: ImprovementSuggestion[];
    manualReview: ImprovementSuggestion[];
  }> {
    const suggestions: ImprovementSuggestion[] = [];

    // Add all suggestion types
    suggestions.push(...await this.suggestSEOImprovements());
    suggestions.push(...await this.suggestAccessibilityImprovements());
    suggestions.push(...await this.suggestPerformanceImprovements());
    suggestions.push(...await this.suggestUXImprovements());
    suggestions.push(...await this.suggestSecurityImprovements());

    // Categorize
    const autoFixable = suggestions.filter(s => s.autoFixable);
    const manualReview = suggestions.filter(s => !s.autoFixable);

    return {
      suggestions,
      autoFixable,
      manualReview
    };
  }

  /**
   * SEO improvements
   */
  async suggestSEOImprovements(): Promise<ImprovementSuggestion[]> {
    const suggestions: ImprovementSuggestion[] = [];

    // Check for missing meta tags
    const missingMeta = await this.findMissingMetaTags();
    
    if (missingMeta.some(m => m.type === 'title')) {
      suggestions.push({
        type: 'seo',
        severity: 'critical',
        title: 'Add missing page titles',
        description: 'Pages without titles have poor SEO performance. Add descriptive, keyword-rich titles under 60 characters.',
        autoFixable: true,
        fix: async () => await this.fixMissingTitles()
      });
    }

    if (missingMeta.some(m => m.type === 'description')) {
      suggestions.push({
        type: 'seo',
        severity: 'warning',
        title: 'Add meta descriptions',
        description: 'Add compelling meta descriptions between 150-160 characters for better search result snippets.',
        autoFixable: true,
        fix: async () => await this.fixMissingDescriptions()
      });
    }

    if (missingMeta.some(m => m.type === 'viewport')) {
      suggestions.push({
        type: 'seo',
        severity: 'critical',
        title: 'Add viewport meta tag',
        description: 'Mobile-friendly sites rank better. Add <meta name="viewport" content="width=device-width, initial-scale=1">',
        autoFixable: true,
        fix: async () => await this.fixMissingViewport()
      });
    }

    // Check for Open Graph tags
    const missingOG = missingMeta.filter(m => m.type.startsWith('og:'));
    if (missingOG.length > 0) {
      suggestions.push({
        type: 'seo',
        severity: 'info',
        title: 'Add Open Graph tags',
        description: 'Open Graph tags improve social media sharing appearance and click-through rates.',
        autoFixable: true,
        fix: async () => await this.fixMissingOpenGraph()
      });
    }

    // Check for structured data
    suggestions.push({
      type: 'seo',
      severity: 'info',
      title: 'Add structured data',
      description: 'Implement JSON-LD structured data to help search engines understand your content better.',
      autoFixable: false
    });

    // Check for canonical URLs
    if (missingMeta.some(m => m.type === 'canonical')) {
      suggestions.push({
        type: 'seo',
        severity: 'warning',
        title: 'Add canonical URLs',
        description: 'Canonical URLs prevent duplicate content issues and consolidate link equity.',
        autoFixable: true,
        fix: async () => await this.fixMissingCanonicals()
      });
    }

    // Check for sitemap
    const hasSitemap = fs.existsSync(path.join(this.sitePath, 'sitemap.xml'));
    if (!hasSitemap) {
      suggestions.push({
        type: 'seo',
        severity: 'info',
        title: 'Generate XML sitemap',
        description: 'A sitemap helps search engines discover and index all your pages.',
        autoFixable: true,
        fix: async () => await this.generateSitemap()
      });
    }

    return suggestions;
  }

  /**
   * Accessibility improvements
   */
  async suggestAccessibilityImprovements(): Promise<ImprovementSuggestion[]> {
    const suggestions: ImprovementSuggestion[] = [];

    // Check for missing alt text
    const imagesWithoutAlt = await this.findImagesWithoutAlt();
    if (imagesWithoutAlt.length > 0) {
      suggestions.push({
        type: 'accessibility',
        severity: 'warning',
        title: `Add alt text to ${imagesWithoutAlt.length} images`,
        description: 'Images without alt text are inaccessible to screen readers. Describe the image content meaningfully.',
        autoFixable: false
      });
    }

    // Check for form labels
    const formsWithoutLabels = await this.findFormsWithoutLabels();
    if (formsWithoutLabels.length > 0) {
      suggestions.push({
        type: 'accessibility',
        severity: 'critical',
        title: 'Add labels to form inputs',
        description: 'All form inputs must have associated labels for accessibility.',
        autoFixable: false
      });
    }

    // Check for focus indicators
    suggestions.push({
      type: 'accessibility',
      severity: 'warning',
      title: 'Ensure visible focus indicators',
      description: 'Interactive elements should have visible focus states for keyboard navigation.',
      autoFixable: false
    });

    // Check for color contrast
    suggestions.push({
      type: 'accessibility',
      severity: 'warning',
      title: 'Verify color contrast ratios',
      description: 'Text should have a contrast ratio of at least 4.5:1 against its background.',
      autoFixable: false
    });

    // Check for heading hierarchy
    const headingIssues = await this.findHeadingHierarchyIssues();
    if (headingIssues.length > 0) {
      suggestions.push({
        type: 'accessibility',
        severity: 'info',
        title: 'Fix heading hierarchy',
        description: 'Headings should follow a logical order (h1 → h2 → h3) without skipping levels.',
        autoFixable: false
      });
    }

    return suggestions;
  }

  /**
   * Performance improvements
   */
  async suggestPerformanceImprovements(): Promise<ImprovementSuggestion[]> {
    const suggestions: ImprovementSuggestion[] = [];

    // Check CSS optimization
    if (this.report?.cssAnalysis.unusedSelectors.length) {
      const unusedCount = this.report.cssAnalysis.unusedSelectors.length;
      suggestions.push({
        type: 'performance',
        severity: 'warning',
        title: `Remove ${unusedCount} unused CSS selectors`,
        description: 'Unused CSS increases download size and parsing time. Consider using PurgeCSS.',
        autoFixable: true,
        fix: async () => await this.removeUnusedCSS()
      });
    }

    // Check image optimization
    const unoptimizedImages = await this.findUnoptimizedImages();
    if (unoptimizedImages.length > 0) {
      suggestions.push({
        type: 'performance',
        severity: 'warning',
        title: `Optimize ${unoptimizedImages.length} images`,
        description: 'Compress images and serve modern formats (WebP/AVIF) with fallbacks.',
        autoFixable: true,
        fix: async () => await this.optimizeImages(unoptimizedImages)
      });
    }

    // Check for render-blocking resources
    suggestions.push({
      type: 'performance',
      severity: 'info',
      title: 'Defer non-critical JavaScript',
      description: 'Add defer or async attributes to scripts that don\'t need to run immediately.',
      autoFixable: true,
      fix: async () => await this.deferScripts()
    });

    // Check for lazy loading
    const imagesWithoutLazy = await this.findImagesWithoutLazyLoading();
    if (imagesWithoutLazy.length > 0) {
      suggestions.push({
        type: 'performance',
        severity: 'info',
        title: `Add lazy loading to ${imagesWithoutLazy.length} images`,
        description: 'Images below the fold should use loading="lazy" for better performance.',
        autoFixable: true,
        fix: async () => await this.addLazyLoading(imagesWithoutLazy)
      });
    }

    // Font optimization
    suggestions.push({
      type: 'performance',
      severity: 'info',
      title: 'Optimize web fonts',
      description: 'Use font-display: swap and preload critical fonts to prevent FOIT.',
      autoFixable: true,
      fix: async () => await this.optimizeFonts()
    });

    return suggestions;
  }

  /**
   * UX improvements
   */
  async suggestUXImprovements(): Promise<ImprovementSuggestion[]> {
    const suggestions: ImprovementSuggestion[] = [];

    // Check for broken links
    const brokenLinks = await this.findBrokenLinks();
    if (brokenLinks.length > 0) {
      suggestions.push({
        type: 'ux',
        severity: 'critical',
        title: `Fix ${brokenLinks.length} broken links`,
        description: 'Broken links frustrate users and hurt SEO. Update or remove them.',
        autoFixable: false
      });
    }

    // Check touch target sizes
    if (this.report?.mobileAnalysis.touchTargets.tooSmall.length) {
      suggestions.push({
        type: 'ux',
        severity: 'warning',
        title: 'Increase touch target sizes',
        description: 'Interactive elements should be at least 44x44px for comfortable tapping.',
        autoFixable: false
      });
    }

    // Check for 404 page
    const has404 = fs.existsSync(path.join(this.sitePath, '404.html'));
    if (!has404) {
      suggestions.push({
        type: 'ux',
        severity: 'info',
        title: 'Create custom 404 page',
        description: 'A helpful 404 page with navigation options improves user experience.',
        autoFixable: true,
        fix: async () => await this.create404Page()
      });
    }

    // Check for favicon
    const hasFavicon = fs.existsSync(path.join(this.sitePath, 'favicon.ico')) ||
                      fs.existsSync(path.join(this.sitePath, 'favicon.png'));
    if (!hasFavicon) {
      suggestions.push({
        type: 'ux',
        severity: 'info',
        title: 'Add favicon',
        description: 'A favicon helps users identify your site in browser tabs and bookmarks.',
        autoFixable: false
      });
    }

    return suggestions;
  }

  /**
   * Security improvements
   */
  async suggestSecurityImprovements(): Promise<ImprovementSuggestion[]> {
    const suggestions: ImprovementSuggestion[] = [];

    // Check for HTTPS
    suggestions.push({
      type: 'security',
      severity: 'critical',
      title: 'Enable HTTPS',
      description: 'Serve your site over HTTPS to protect user data and improve SEO.',
      autoFixable: false
    });

    // Check for insecure content
    suggestions.push({
      type: 'security',
      severity: 'warning',
      title: 'Fix mixed content warnings',
      description: 'Ensure all resources (images, scripts, CSS) load over HTTPS.',
      autoFixable: true,
      fix: async () => await this.fixMixedContent()
    });

    // Security headers
    suggestions.push({
      type: 'security',
      severity: 'info',
      title: 'Add security headers',
      description: 'Implement CSP, HSTS, X-Frame-Options, and other security headers.',
      autoFixable: false
    });

    return suggestions;
  }

  /**
   * Apply all auto-fixable improvements
   */
  async applyAutoFixes(): Promise<{
    applied: string[];
    failed: string[];
  }> {
    const { autoFixable } = await this.generateSuggestions();
    const applied: string[] = [];
    const failed: string[] = [];

    for (const suggestion of autoFixable) {
      if (suggestion.fix) {
        try {
          await suggestion.fix();
          applied.push(suggestion.title);
        } catch (e) {
          failed.push(suggestion.title);
        }
      }
    }

    return { applied, failed };
  }

  // Fix implementations

  private async fixMissingTitles(): Promise<void> {
    const htmlFiles = this.findHTMLFiles();
    for (const file of htmlFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (!content.includes('<title>')) {
        const title = this.generateTitleFromContent(content);
        const updated = content.replace(
          '<head>',
          `<head>\n  <title>${title}</title>`
        );
        fs.writeFileSync(file, updated);
      }
    }
  }

  private async fixMissingDescriptions(): Promise<void> {
    const htmlFiles = this.findHTMLFiles();
    for (const file of htmlFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (!content.includes('name="description"')) {
        const description = this.generateDescriptionFromContent(content);
        const updated = content.replace(
          '</title>',
          `</title>\n  <meta name="description" content="${description}">`
        );
        fs.writeFileSync(file, updated);
      }
    }
  }

  private async fixMissingViewport(): Promise<void> {
    const htmlFiles = this.findHTMLFiles();
    for (const file of htmlFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (!content.includes('name="viewport"')) {
        const updated = content.replace(
          '<head>',
          '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1">'
        );
        fs.writeFileSync(file, updated);
      }
    }
  }

  private async fixMissingOpenGraph(): Promise<void> {
    const htmlFiles = this.findHTMLFiles();
    for (const file of htmlFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const dom = new JSDOM(content);
      const doc = dom.window.document;
      
      const title = doc.title;
      const description = doc.querySelector('meta[name="description"]')?.getAttribute('content');
      
      let updated = content;
      if (!content.includes('property="og:title"')) {
        updated = updated.replace(
          '</title>',
          `</title>\n  <meta property="og:title" content="${title}">`
        );
      }
      if (!content.includes('property="og:description"') && description) {
        updated = updated.replace(
          '</title>',
          `</title>\n  <meta property="og:description" content="${description}">`
        );
      }
      
      fs.writeFileSync(file, updated);
    }
  }

  private async fixMissingCanonicals(): Promise<void> {
    const htmlFiles = this.findHTMLFiles();
    for (const file of htmlFiles) {
      const relativePath = path.relative(this.sitePath, file);
      const url = '/' + relativePath.replace(/index\.html$/, '').replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf-8');
      
      if (!content.includes('rel="canonical"')) {
        const updated = content.replace(
          '</title>',
          `</title>\n  <link rel="canonical" href="${url}">`
        );
        fs.writeFileSync(file, updated);
      }
    }
  }

  private async generateSitemap(): Promise<void> {
    const htmlFiles = this.findHTMLFiles();
    const baseUrl = 'https://example.com'; // Should be configurable
    
    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    for (const file of htmlFiles) {
      const relativePath = path.relative(this.sitePath, file);
      const urlPath = relativePath.replace(/index\.html$/, '').replace(/\\/g, '/');
      const fullUrl = baseUrl + '/' + urlPath;
      const lastmod = new Date().toISOString().split('T')[0];
      
      sitemap += `  <url>\n`;
      sitemap += `    <loc>${fullUrl}</loc>\n`;
      sitemap += `    <lastmod>${lastmod}</lastmod>\n`;
      sitemap += `  </url>\n`;
    }
    
    sitemap += '</urlset>';
    
    fs.writeFileSync(path.join(this.sitePath, 'sitemap.xml'), sitemap);
  }

  private async removeUnusedCSS(): Promise<void> {
    // This would require parsing CSS and removing unused selectors
    // Implementation would use PurgeCSS or similar
  }

  private async optimizeImages(images: ImageOptimization[]): Promise<void> {
    for (const img of images) {
      try {
        const inputPath = path.join(this.sitePath, img.original);
        if (!fs.existsSync(inputPath)) continue;

        // Convert to WebP
        const outputPath = inputPath.replace(/\.[^.]+$/, '.webp');
        
        await sharp(inputPath)
          .webp({ quality: 80 })
          .toFile(outputPath);

        // Could also generate AVIF for better compression
      } catch (e) {
        console.warn(`Failed to optimize ${img.original}:`, e);
      }
    }
  }

  private async deferScripts(): Promise<void> {
    const htmlFiles = this.findHTMLFiles();
    for (const file of htmlFiles) {
      let content = fs.readFileSync(file, 'utf-8');
      
      // Add defer to scripts without async or defer
      content = content.replace(
        /<script src="([^"]+)"(?![^>]*(?:async|defer))([^>]*)>/g,
        '<script src="$1" defer$2>'
      );
      
      fs.writeFileSync(file, content);
    }
  }

  private async addLazyLoading(imagePaths: string[]): Promise<void> {
    // Images are identified by their src attribute
    const htmlFiles = this.findHTMLFiles();
    for (const file of htmlFiles) {
      let content = fs.readFileSync(file, 'utf-8');
      
      // Add loading="lazy" to images without it
      content = content.replace(
        /<img(?![^>]*loading=)([^>]*)>/g,
        '<img loading="lazy"$1>'
      );
      
      fs.writeFileSync(file, content);
    }
  }

  private async optimizeFonts(): Promise<void> {
    // Add font-display: swap to @font-face rules
  }

  private async create404Page(): Promise<void> {
    const content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Not Found</title>
  <style>
    body { font-family: system-ui, sans-serif; text-align: center; padding: 50px; }
    h1 { font-size: 4rem; margin: 0; color: #333; }
    p { color: #666; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <h1>404</h1>
  <p>Page not found</p>
  <p><a href="/">Go home</a></p>
</body>
</html>`;
    
    fs.writeFileSync(path.join(this.sitePath, '404.html'), content);
  }

  private async fixMixedContent(): Promise<void> {
    const htmlFiles = this.findHTMLFiles();
    for (const file of htmlFiles) {
      let content = fs.readFileSync(file, 'utf-8');
      
      // Replace http:// with https://
      content = content.replace(/http:\/\//g, 'https://');
      
      fs.writeFileSync(file, content);
    }
  }

  // Helper methods

  private findHTMLFiles(): string[] {
    const files: string[] = [];
    
    const scan = (dir: string) => {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scan(fullPath);
        } else if (entry.endsWith('.html')) {
          files.push(fullPath);
        }
      }
    };
    
    scan(this.sitePath);
    return files;
  }

  private async findMissingMetaTags(): Promise<MissingMeta[]> {
    const missing: MissingMeta[] = [];
    const htmlFiles = this.findHTMLFiles();
    
    for (const file of htmlFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(this.sitePath, file);
      
      if (!content.includes('<title>')) {
        missing.push({ type: 'title', page: relativePath });
      }
      if (!content.includes('name="description"')) {
        missing.push({ type: 'description', page: relativePath });
      }
      if (!content.includes('name="viewport"')) {
        missing.push({ type: 'viewport', page: relativePath });
      }
      if (!content.includes('charset=')) {
        missing.push({ type: 'charset', page: relativePath });
      }
    }
    
    return missing;
  }

  private async findImagesWithoutAlt(): Promise<string[]> {
    const images: string[] = [];
    const htmlFiles = this.findHTMLFiles();
    
    for (const file of htmlFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const dom = new JSDOM(content);
      const imgs = dom.window.document.querySelectorAll('img:not([alt])');
      
      imgs.forEach(img => {
        const src = img.getAttribute('src');
        if (src) images.push(src);
      });
    }
    
    return images;
  }

  private async findFormsWithoutLabels(): Promise<string[]> {
    const forms: string[] = [];
    // Implementation would check for inputs without associated labels
    return forms;
  }

  private async findHeadingHierarchyIssues(): Promise<string[]> {
    const issues: string[] = [];
    // Implementation would check for skipped heading levels
    return issues;
  }

  private async findUnoptimizedImages(): Promise<ImageOptimization[]> {
    const images: ImageOptimization[] = [];
    const imageFiles = this.findImageFiles();
    
    for (const file of imageFiles) {
      try {
        const stats = fs.statSync(file);
        if (stats.size > 100000) { // > 100KB
          images.push({
            original: path.relative(this.sitePath, file),
            optimized: file.replace(/\.[^.]+$/, '.webp'),
            format: 'webp',
            savings: 0,
            percent: 0
          });
        }
      } catch (e) {
        // Skip
      }
    }
    
    return images;
  }

  private async findImagesWithoutLazyLoading(): Promise<string[]> {
    const images: string[] = [];
    const htmlFiles = this.findHTMLFiles();
    
    for (const file of htmlFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const dom = new JSDOM(content);
      const imgs = dom.window.document.querySelectorAll('img:not([loading])');
      
      imgs.forEach(img => {
        const src = img.getAttribute('src');
        if (src) images.push(src);
      });
    }
    
    return images;
  }

  private async findBrokenLinks(): Promise<BrokenLink[]> {
    const broken: BrokenLink[] = [];
    // This would require checking all links against the file system
    return broken;
  }

  private findImageFiles(): string[] {
    const files: string[] = [];
    const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
    
    const scan = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            scan(fullPath);
          } else if (extensions.some(ext => entry.toLowerCase().endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch (e) {
        // Skip
      }
    };
    
    scan(this.sitePath);
    return files;
  }

  private generateTitleFromContent(html: string): string {
    const dom = new JSDOM(html);
    const h1 = dom.window.document.querySelector('h1');
    return h1?.textContent?.trim() || 'Untitled Page';
  }

  private generateDescriptionFromContent(html: string): string {
    const dom = new JSDOM(html);
    const firstP = dom.window.document.querySelector('p');
    return (firstP?.textContent?.trim() || 'No description available').substring(0, 160);
  }
}

export default ImprovementSuggestions;
