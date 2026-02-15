/**
 * Site Remix Engine - Analyzer
 * Analyzes downloaded websites for structure, content, and issues
 * Trench Project
 */

import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';
import {
  DOMStructure,
  HeadingHierarchy,
  ComponentInfo,
  CSSAnalysis,
  MobileAnalysis,
  SEOAnalysis,
  AnalysisReport,
  ImprovementSuggestion,
  BrokenLink
} from './types';

export class SiteAnalyzer {
  private dom: JSDOM | null = null;
  private document: Document | null = null;
  private cssContent: string = '';
  private htmlContent: string = '';

  /**
   * Load HTML content for analysis
   */
  loadHTML(html: string): void {
    this.htmlContent = html;
    this.dom = new JSDOM(html);
    this.document = this.dom.window.document;
  }

  /**
   * Load HTML from file
   */
  loadFromFile(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    this.loadHTML(content);
  }

  /**
   * Load CSS content
   */
  loadCSS(css: string): void {
    this.cssContent = css;
  }

  /**
   * Analyze full site and generate report
   */
  async analyzeSite(sitePath: string, url: string): Promise<AnalysisReport> {
    const indexPath = path.join(sitePath, 'index.html');
    
    if (!fs.existsSync(indexPath)) {
      throw new Error(`Index file not found: ${indexPath}`);
    }

    this.loadFromFile(indexPath);

    // Load CSS files
    const cssFiles = this.findCSSFiles(sitePath);
    let allCSS = '';
    for (const cssFile of cssFiles) {
      try {
        allCSS += fs.readFileSync(cssFile, 'utf-8') + '\n';
      } catch (e) {
        // Ignore errors
      }
    }
    this.loadCSS(allCSS);

    const domStructure = this.analyzeDOMStructure();
    const headings = this.extractHeadingHierarchy();
    const components = this.detectComponents();
    const cssAnalysis = this.analyzeCSS();
    const mobileAnalysis = this.analyzeMobileFriendliness();
    const seoAnalysis = this.analyzeSEO();

    // Calculate content stats
    const text = this.document?.body?.textContent || '';
    const words = text.trim().split(/\s+/).length;

    // Collect issues
    const issues: ImprovementSuggestion[] = [
      ...this.detectSEOIssues(seoAnalysis),
      ...this.detectMobileIssues(mobileAnalysis),
      ...this.detectAccessibilityIssues(),
      ...this.detectPerformanceIssues(cssAnalysis)
    ];

    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;

    return {
      siteName: this.document?.title || 'Unknown',
      url,
      timestamp: new Date().toISOString(),
      summary: {
        totalPages: this.estimatePageCount(sitePath),
        totalIssues: issues.length,
        criticalIssues,
        warnings,
        score: Math.max(0, 100 - criticalIssues * 10 - warnings * 3)
      },
      domAnalysis: {
        structure: domStructure,
        headings,
        components
      },
      contentAnalysis: {
        totalWords: words,
        avgReadingTime: Math.ceil(words / 200),
        contentTypes: this.detectContentTypes()
      },
      cssAnalysis,
      mobileAnalysis,
      seoAnalysis,
      issues
    };
  }

  /**
   * Analyze DOM structure recursively
   */
  analyzeDOMStructure(): DOMStructure {
    if (!this.document) throw new Error('No document loaded');

    const buildStructure = (element: Element, depth: number = 0): DOMStructure => {
      const children: DOMStructure[] = [];
      
      for (const child of Array.from(element.children)) {
        children.push(buildStructure(child, depth + 1));
      }

      return {
        tag: element.tagName.toLowerCase(),
        id: element.id || undefined,
        classes: Array.from(element.classList),
        children,
        depth,
        textContent: element.textContent?.substring(0, 100) || undefined
      };
    };

    return buildStructure(this.document.documentElement);
  }

  /**
   * Extract heading hierarchy (h1-h6)
   */
  extractHeadingHierarchy(): HeadingHierarchy[] {
    if (!this.document) throw new Error('No document loaded');

    const headings = Array.from(this.document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const root: HeadingHierarchy[] = [];
    const stack: HeadingHierarchy[] = [];

    for (const heading of headings) {
      const level = parseInt(heading.tagName[1]);
      const item: HeadingHierarchy = {
        level,
        text: heading.textContent?.trim() || '',
        id: heading.id || undefined,
        children: []
      };

      // Find parent
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(item);
      } else {
        stack[stack.length - 1].children.push(item);
      }

      stack.push(item);
    }

    return root;
  }

  /**
   * Detect UI components
   */
  detectComponents(): ComponentInfo[] {
    if (!this.document) throw new Error('No document loaded');

    const components: ComponentInfo[] = [];
    const doc = this.document;

    // Navigation detection
    const navSelectors = [
      'nav', 'header nav', '.nav', '.navbar', '.navigation',
      '[role="navigation"]', '#nav', '#navbar', '.menu', '#menu'
    ];
    
    for (const selector of navSelectors) {
      const el = doc.querySelector(selector);
      if (el) {
        components.push({
          type: 'navigation',
          selector,
          confidence: this.calculateComponentConfidence(el, ['nav', 'menu', 'link'])
        });
        break;
      }
    }

    // Sidebar detection
    const sidebarSelectors = [
      'aside', '.sidebar', '#sidebar', '[role="complementary"]',
      '.toc', '#toc', '.table-of-contents'
    ];
    
    for (const selector of sidebarSelectors) {
      const el = doc.querySelector(selector);
      if (el) {
        components.push({
          type: 'sidebar',
          selector,
          confidence: this.calculateComponentConfidence(el, ['sidebar', 'menu', 'nav'])
        });
        break;
      }
    }

    // Code blocks detection
    const codeSelectors = [
      'pre code', '.code-block', '.highlight', 'pre',
      '[class*="language-"]', '[class*="lang-"]', '.prism', '.hljs'
    ];
    
    const codeBlocks = doc.querySelectorAll(codeSelectors.join(', '));
    if (codeBlocks.length > 0) {
      components.push({
        type: 'code-block',
        selector: codeSelectors[0],
        confidence: Math.min(1, codeBlocks.length * 0.1),
        metadata: { count: codeBlocks.length }
      });
    }

    // Tables detection
    const tables = doc.querySelectorAll('table');
    if (tables.length > 0) {
      components.push({
        type: 'table',
        selector: 'table',
        confidence: Math.min(1, tables.length * 0.05),
        metadata: { count: tables.length }
      });
    }

    // Search detection
    const searchSelectors = [
      'input[type="search"]', '.search-input', '#search',
      '[role="search"]', '.search-box', 'input[name*="search"]'
    ];
    
    for (const selector of searchSelectors) {
      const el = doc.querySelector(selector);
      if (el) {
        components.push({
          type: 'search',
          selector,
          confidence: 0.9
        });
        break;
      }
    }

    // Breadcrumb detection
    const breadcrumbSelectors = [
      '.breadcrumb', '.breadcrumbs', '[aria-label*="breadcrumb"]',
      'nav[aria-label*="Breadcrumb"]'
    ];
    
    for (const selector of breadcrumbSelectors) {
      const el = doc.querySelector(selector);
      if (el) {
        components.push({
          type: 'breadcrumb',
          selector,
          confidence: 0.95
        });
        break;
      }
    }

    // Footer detection
    const footerSelectors = ['footer', '#footer', '.footer', '[role="contentinfo"]'];
    
    for (const selector of footerSelectors) {
      const el = doc.querySelector(selector);
      if (el) {
        components.push({
          type: 'footer',
          selector,
          confidence: 0.9
        });
        break;
      }
    }

    return components;
  }

  /**
   * Analyze CSS for usage and issues
   */
  analyzeCSS(): CSSAnalysis {
    if (!this.document || !this.cssContent) {
      return {
        totalSelectors: 0,
        usedSelectors: 0,
        unusedSelectors: [],
        mediaQueries: [],
        colorPalette: [],
        fontFamilies: [],
        fileSize: 0
      };
    }

    // Extract selectors from CSS
    const selectorRegex = /([.#][^{]+)\s*\{/g;
    const selectors: string[] = [];
    let match;

    while ((match = selectorRegex.exec(this.cssContent)) !== null) {
      const selector = match[1].trim().split(',')[0].split(/[\s\[>:+~]/)[0];
      if (selector && !selectors.includes(selector)) {
        selectors.push(selector);
      }
    }

    // Check which selectors are used
    const unusedSelectors: string[] = [];
    let usedCount = 0;

    for (const selector of selectors) {
      try {
        const elements = this.document.querySelectorAll(selector);
        if (elements.length === 0) {
          unusedSelectors.push(selector);
        } else {
          usedCount++;
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }

    // Extract media queries
    const mediaQueryRegex = /@media[^{]+\{/g;
    const mediaQueries: string[] = [];
    while ((match = mediaQueryRegex.exec(this.cssContent)) !== null) {
      mediaQueries.push(match[0].replace('{', '').trim());
    }

    // Extract colors
    const colorRegex = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/g;
    const colors: Set<string> = new Set();
    while ((match = colorRegex.exec(this.cssContent)) !== null) {
      colors.add(match[1]);
    }

    // Extract fonts
    const fontRegex = /font-family\s*:\s*([^;]+)/g;
    const fonts: Set<string> = new Set();
    while ((match = fontRegex.exec(this.cssContent)) !== null) {
      fonts.add(match[1].trim());
    }

    return {
      totalSelectors: selectors.length,
      usedSelectors: usedCount,
      unusedSelectors: unusedSelectors.slice(0, 50),
      mediaQueries: mediaQueries.slice(0, 20),
      colorPalette: Array.from(colors).slice(0, 30),
      fontFamilies: Array.from(fonts),
      fileSize: Buffer.byteLength(this.cssContent, 'utf8')
    };
  }

  /**
   * Analyze mobile-friendliness
   */
  analyzeMobileFriendliness(): MobileAnalysis {
    if (!this.document) throw new Error('No document loaded');

    const viewportMeta = this.document.querySelector('meta[name="viewport"]');
    const hasViewport = viewportMeta !== null;

    // Check for responsive images
    const images = Array.from(this.document.querySelectorAll('img'));
    const responsiveImages = images.every(img => 
      img.hasAttribute('srcset') || 
      img.style.maxWidth === '100%' ||
      getComputedStyle(img).maxWidth === '100%'
    );

    // Check touch target sizes
    const links = Array.from(this.document.querySelectorAll('a, button'));
    const tooSmall: string[] = [];
    const adequate: string[] = [];

    for (const link of links) {
      const rect = link.getBoundingClientRect ? 
        { width: link.clientWidth, height: link.clientHeight } :
        { width: 0, height: 0 };
      
      if (rect.width < 44 || rect.height < 44) {
        tooSmall.push(link.textContent?.substring(0, 30) || 'unnamed');
      } else {
        adequate.push(link.textContent?.substring(0, 30) || 'unnamed');
      }
    }

    // Check font sizes
    const textElements = Array.from(this.document.querySelectorAll('p, span, a, li'));
    const smallFonts: string[] = [];
    const adequateFonts: string[] = [];

    for (const el of textElements.slice(0, 50)) {
      const fontSize = parseFloat(
        this.getComputedStyle(el)?.fontSize || '16'
      );
      
      if (fontSize < 12) {
        smallFonts.push(`${el.tagName}: ${fontSize}px`);
      } else {
        adequateFonts.push(`${el.tagName}: ${fontSize}px`);
      }
    }

    // Calculate score
    let score = 100;
    if (!hasViewport) score -= 30;
    if (!responsiveImages) score -= 20;
    if (tooSmall.length > links.length * 0.5) score -= 20;
    if (smallFonts.length > 10) score -= 15;

    return {
      viewportMeta: hasViewport,
      responsiveImages,
      touchTargets: {
        tooSmall: tooSmall.slice(0, 10),
        adequate: adequate.slice(0, 10)
      },
      fontSizes: {
        tooSmall: smallFonts.slice(0, 10),
        adequate: adequateFonts.slice(0, 10)
      },
      score: Math.max(0, score)
    };
  }

  /**
   * Analyze SEO
   */
  analyzeSEO(): SEOAnalysis {
    if (!this.document) throw new Error('No document loaded');

    const doc = this.document;
    const head = doc.head;

    // Title
    const title = doc.title || '';

    // Meta description
    const descriptionMeta = head?.querySelector('meta[name="description"]');
    const description = descriptionMeta?.getAttribute('content') || '';

    // Keywords
    const keywordsMeta = head?.querySelector('meta[name="keywords"]');
    const keywords = keywordsMeta?.getAttribute('content')?.split(',').map(k => k.trim()) || [];

    // Open Graph tags
    const ogTags: Record<string, string> = {};
    head?.querySelectorAll('meta[property^="og:"]').forEach(tag => {
      const property = tag.getAttribute('property');
      const content = tag.getAttribute('content');
      if (property && content) {
        ogTags[property] = content;
      }
    });

    // Twitter cards
    const twitterTags: Record<string, string> = {};
    head?.querySelectorAll('meta[name^="twitter:"]').forEach(tag => {
      const name = tag.getAttribute('name');
      const content = tag.getAttribute('content');
      if (name && content) {
        twitterTags[name] = content;
      }
    });

    // Canonical URL
    const canonical = head?.querySelector('link[rel="canonical"]');
    const canonicalUrl = canonical?.getAttribute('href') || undefined;

    // Structured data
    const structuredData: any[] = [];
    head?.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        const data = JSON.parse(script.textContent || '{}');
        structuredData.push(data);
      } catch (e) {
        // Invalid JSON
      }
    });

    // Calculate score and issues
    const issues: string[] = [];
    let score = 100;

    if (!title || title.length < 10) {
      issues.push('Missing or too short title');
      score -= 20;
    }
    if (!description || description.length < 50) {
      issues.push('Missing or too short meta description');
      score -= 15;
    }
    if (!canonicalUrl) {
      issues.push('Missing canonical URL');
      score -= 10;
    }
    if (Object.keys(ogTags).length === 0) {
      issues.push('Missing Open Graph tags');
      score -= 10;
    }

    return {
      title,
      description,
      keywords,
      ogTags,
      twitterTags,
      canonicalUrl,
      structuredData,
      score: Math.max(0, score),
      issues
    };
  }

  /**
   * Find broken links
   */
  async findBrokenLinks(sitePath: string, baseUrl: string): Promise<BrokenLink[]> {
    if (!this.document) throw new Error('No document loaded');

    const links = Array.from(this.document.querySelectorAll('a[href]'));
    const brokenLinks: BrokenLink[] = [];

    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('//')) {
        continue; // Skip external links for now
      }

      const resolvedPath = path.resolve(sitePath, href.replace(/^\//, ''));
      if (!fs.existsSync(resolvedPath) && !fs.existsSync(resolvedPath + '.html')) {
        brokenLinks.push({
          url: href,
          foundOn: baseUrl,
          error: 'File not found'
        });
      }
    }

    return brokenLinks;
  }

  // Helper methods

  private calculateComponentConfidence(element: Element, keywords: string[]): number {
    const text = element.outerHTML.toLowerCase();
    const matches = keywords.filter(k => text.includes(k.toLowerCase())).length;
    return Math.min(1, 0.5 + (matches / keywords.length) * 0.5);
  }

  private findCSSFiles(sitePath: string): string[] {
    const cssFiles: string[] = [];
    
    try {
      const files = fs.readdirSync(sitePath);
      for (const file of files) {
        const fullPath = path.join(sitePath, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          cssFiles.push(...this.findCSSFiles(fullPath));
        } else if (file.endsWith('.css')) {
          cssFiles.push(fullPath);
        }
      }
    } catch (e) {
      // Directory doesn't exist
    }

    return cssFiles;
  }

  private estimatePageCount(sitePath: string): number {
    try {
      const files = fs.readdirSync(sitePath);
      return files.filter(f => f.endsWith('.html')).length;
    } catch (e) {
      return 1;
    }
  }

  private detectContentTypes(): Record<string, number> {
    if (!this.document) return {};

    const types: Record<string, number> = {};
    
    // Count different content elements
    types.codeBlocks = this.document.querySelectorAll('pre, code').length;
    types.tables = this.document.querySelectorAll('table').length;
    types.images = this.document.querySelectorAll('img').length;
    types.videos = this.document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;
    types.forms = this.document.querySelectorAll('form').length;
    types.headings = this.document.querySelectorAll('h1, h2, h3').length;
    types.links = this.document.querySelectorAll('a').length;
    types.lists = this.document.querySelectorAll('ul, ol').length;

    return types;
  }

  private getComputedStyle(element: Element): CSSStyleDeclaration | null {
    if (!this.dom) return null;
    return this.dom.window.getComputedStyle(element);
  }

  // Issue detection methods

  private detectSEOIssues(seo: SEOAnalysis): ImprovementSuggestion[] {
    const issues: ImprovementSuggestion[] = [];

    if (!seo.title) {
      issues.push({
        type: 'seo',
        severity: 'critical',
        title: 'Missing page title',
        description: 'The page is missing a <title> tag which is crucial for SEO.',
        autoFixable: true
      });
    }

    if (!seo.description) {
      issues.push({
        type: 'seo',
        severity: 'warning',
        title: 'Missing meta description',
        description: 'Add a meta description to improve search result snippets.',
        autoFixable: true
      });
    }

    if (Object.keys(seo.ogTags).length === 0) {
      issues.push({
        type: 'seo',
        severity: 'info',
        title: 'Missing Open Graph tags',
        description: 'Add Open Graph tags for better social media sharing.',
        autoFixable: true
      });
    }

    return issues;
  }

  private detectMobileIssues(mobile: MobileAnalysis): ImprovementSuggestion[] {
    const issues: ImprovementSuggestion[] = [];

    if (!mobile.viewportMeta) {
      issues.push({
        type: 'ux',
        severity: 'critical',
        title: 'Missing viewport meta tag',
        description: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
        autoFixable: true
      });
    }

    if (mobile.touchTargets.tooSmall.length > 0) {
      issues.push({
        type: 'accessibility',
        severity: 'warning',
        title: 'Touch targets too small',
        description: `${mobile.touchTargets.tooSmall.length} interactive elements are smaller than 44x44px.`,
        autoFixable: false
      });
    }

    return issues;
  }

  private detectAccessibilityIssues(): ImprovementSuggestion[] {
    if (!this.document) return [];

    const issues: ImprovementSuggestion[] = [];
    const images = Array.from(this.document.querySelectorAll('img'));
    const imagesWithoutAlt = images.filter(img => !img.hasAttribute('alt'));

    if (imagesWithoutAlt.length > 0) {
      issues.push({
        type: 'accessibility',
        severity: 'warning',
        title: 'Images without alt text',
        description: `${imagesWithoutAlt.length} images are missing alt attributes.`,
        autoFixable: true
      });
    }

    // Check for proper heading order
    const headings = Array.from(this.document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let prevLevel = 0;
    for (const heading of headings) {
      const level = parseInt(heading.tagName[1]);
      if (level > prevLevel + 1) {
        issues.push({
          type: 'accessibility',
          severity: 'info',
          title: 'Skipped heading level',
          description: `Heading level jumped from h${prevLevel} to h${level}.`,
          autoFixable: false
        });
      }
      prevLevel = level;
    }

    return issues;
  }

  private detectPerformanceIssues(css: CSSAnalysis): ImprovementSuggestion[] {
    const issues: ImprovementSuggestion[] = [];

    const unusedRatio = css.totalSelectors > 0 ? css.unusedSelectors.length / css.totalSelectors : 0;
    if (unusedRatio > 0.5) {
      issues.push({
        type: 'performance',
        severity: 'warning',
        title: 'Unused CSS selectors',
        description: `${Math.round(unusedRatio * 100)}% of CSS selectors are unused.`,
        autoFixable: true
      });
    }

    if (css.fileSize > 100000) {
      issues.push({
        type: 'performance',
        severity: 'info',
        title: 'Large CSS file',
        description: `CSS file is ${(css.fileSize / 1024).toFixed(1)}KB. Consider splitting or minifying.`,
        autoFixable: true
      });
    }

    return issues;
  }
}

export default SiteAnalyzer;
