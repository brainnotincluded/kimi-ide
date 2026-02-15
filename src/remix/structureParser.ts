/**
 * Site Remix Engine - Structure Parser
 * Parses site structure, page types, and navigation
 * Trench Project
 */

import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';
import {
  PageType,
  PageStructure,
  SectionInfo,
  NavLink,
  RelatedPage,
  BreadcrumbItem,
  SiteGraph,
  PageNode,
  PageEdge,
  ContentTaxonomy,
  Category,
  Tag
} from './types';

export class StructureParser {
  private sitePath: string = '';
  private pages: Map<string, PageStructure> = new Map();
  private urlMap: Map<string, string> = new Map(); // path -> url

  /**
   * Parse entire site structure
   */
  async parseSite(sitePath: string, baseUrl: string): Promise<{
    pages: PageStructure[];
    graph: SiteGraph;
    taxonomy: ContentTaxonomy;
  }> {
    this.sitePath = sitePath;
    this.pages.clear();
    this.urlMap.clear();

    // Find all HTML files
    const htmlFiles = this.findHTMLFiles(sitePath);

    // First pass: parse all pages
    for (const filePath of htmlFiles) {
      const relativePath = path.relative(sitePath, filePath);
      const url = this.pathToUrl(relativePath, baseUrl);
      this.urlMap.set(relativePath, url);

      try {
        const pageStructure = await this.parsePage(filePath, url);
        this.pages.set(url, pageStructure);
      } catch (e) {
        console.warn(`Failed to parse ${filePath}:`, e);
      }
    }

    // Second pass: build relationships
    const pages = Array.from(this.pages.values());
    const graph = this.buildSiteGraph(pages);
    const taxonomy = this.buildTaxonomy(pages);

    return { pages, graph, taxonomy };
  }

  /**
   * Parse single page
   */
  async parsePage(filePath: string, url: string): Promise<PageStructure> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const dom = new JSDOM(content);
    const document = dom.window.document;

    const type = this.detectPageType(document);
    const sections = this.extractSections(document);
    const navigation = this.extractNavigation(document);
    const breadcrumbs = this.extractBreadcrumbs(document);

    return {
      url,
      type,
      confidence: this.calculateTypeConfidence(document, type),
      sections,
      navigation,
      relatedPages: [], // Will be filled in second pass
      breadcrumbs
    };
  }

  /**
   * Detect page type based on content and structure
   */
  detectPageType(document: Document): PageType {
    const scores: Record<PageType, number> = {
      landing: 0,
      docs: 0,
      blog: 0,
      api: 0,
      ecommerce: 0,
      wiki: 0,
      unknown: 0
    };

    // URL patterns
    const url = document.location?.href || '';
    const path = new URL(url).pathname.toLowerCase();

    // Landing page indicators
    if (path === '/' || path === '/index.html') {
      scores.landing += 2;
    }
    if (document.querySelector('.hero, .banner, #hero, .jumbotron')) {
      scores.landing += 3;
    }
    if (document.querySelector('.features, .feature-grid, .feature-list')) {
      scores.landing += 2;
    }
    if (document.querySelector('.cta, .call-to-action')) {
      scores.landing += 1;
    }

    // Docs indicators
    if (path.includes('/docs/') || path.includes('/documentation/')) {
      scores.docs += 5;
    }
    if (document.querySelector('.sidebar, .toc, .table-of-contents, nav.docs')) {
      scores.docs += 3;
    }
    if (document.querySelector('pre code, .code-block, .highlight')) {
      scores.docs += 1;
    }
    if (document.querySelector('article[role="main"], main article')) {
      scores.docs += 1;
    }

    // Blog indicators
    if (path.includes('/blog/') || path.includes('/posts/') || path.includes('/articles/')) {
      scores.blog += 5;
    }
    if (document.querySelector('.post, article.post, .entry')) {
      scores.blog += 3;
    }
    if (document.querySelector('.published, .date, time[datetime]')) {
      scores.blog += 2;
    }
    if (document.querySelector('.author, .byline')) {
      scores.blog += 1;
    }
    if (document.querySelector('.comments, #comments')) {
      scores.blog += 1;
    }

    // API reference indicators
    if (path.includes('/api/') || path.includes('/reference/')) {
      scores.api += 5;
    }
    if (document.querySelector('.endpoint, .api-method, .http-method')) {
      scores.api += 3;
    }
    const codeBlocks = document.querySelectorAll('pre code').length;
    if (codeBlocks > 5) {
      scores.api += 2;
    }
    if (document.querySelector('.params, .parameters, .request, .response')) {
      scores.api += 2;
    }

    // E-commerce indicators
    if (document.querySelector('.product, .product-card, .item')) {
      scores.ecommerce += 3;
    }
    if (document.querySelector('.price, .add-to-cart, .cart, [data-product]')) {
      scores.ecommerce += 3;
    }
    if (document.querySelector('.category, .shop, .store')) {
      scores.ecommerce += 2;
    }

    // Wiki indicators
    if (path.includes('/wiki/') || path.includes('/knowledge/')) {
      scores.wiki += 5;
    }
    if (document.querySelector('.wiki, .knowledge-base')) {
      scores.wiki += 3;
    }
    const links = document.querySelectorAll('a[href^="/wiki/"], a[href^="./"]').length;
    if (links > 10) {
      scores.wiki += 1;
    }

    // Find highest score
    let bestType: PageType = 'unknown';
    let bestScore = 0;

    for (const [type, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type as PageType;
      }
    }

    return bestType;
  }

  /**
   * Extract page sections
   */
  extractSections(document: Document): SectionInfo[] {
    const sections: SectionInfo[] = [];

    // Common section selectors
    const sectionSelectors = [
      { selector: 'section', type: 'content' },
      { selector: '.hero, #hero, .banner, .jumbotron', type: 'hero' },
      { selector: '.features, .feature-grid, .feature-section', type: 'features' },
      { selector: '.content, main, article', type: 'content' },
      { selector: '.sidebar, aside', type: 'sidebar' },
      { selector: '.cta, .call-to-action', type: 'cta' },
      { selector: '.testimonials, .reviews', type: 'testimonials' },
      { selector: 'footer, .footer', type: 'footer' }
    ];

    for (const { selector, type } of sectionSelectors) {
      const elements = document.querySelectorAll(selector);
      
      elements.forEach((el, index) => {
        const id = el.id || `${type}-${index}`;
        const title = this.extractSectionTitle(el) || type;
        
        sections.push({
          id,
          title,
          type: type as any,
          content: el.textContent?.substring(0, 500) || ''
        });
      });
    }

    return sections;
  }

  /**
   * Extract navigation links
   */
  extractNavigation(document: Document): NavLink[] {
    const navLinks: NavLink[] = [];

    // Try to find main navigation
    const navSelectors = [
      'nav[role="navigation"]',
      'nav',
      '.nav',
      '.navbar',
      '.navigation',
      '.menu',
      'header nav',
      '#nav',
      '#navbar'
    ];

    let navElement: Element | null = null;
    for (const selector of navSelectors) {
      navElement = document.querySelector(selector);
      if (navElement) break;
    }

    if (!navElement) return navLinks;

    // Extract top-level links
    const links = navElement.querySelectorAll('a');
    const processed = new Set<string>();

    for (const link of Array.from(links)) {
      const href = link.getAttribute('href');
      const text = link.textContent?.trim();

      if (!href || !text) continue;
      if (processed.has(href)) continue;
      if (href.startsWith('#')) continue;
      if (href.startsWith('javascript:')) continue;

      processed.add(href);

      // Check for nested navigation
      const parentLi = link.closest('li');
      const nestedUl = parentLi?.querySelector('ul');
      const children: NavLink[] = [];

      if (nestedUl) {
        const nestedLinks = nestedUl.querySelectorAll('a');
        for (const nestedLink of Array.from(nestedLinks)) {
          const nestedHref = nestedLink.getAttribute('href');
          const nestedText = nestedLink.textContent?.trim();
          if (nestedHref && nestedText) {
            children.push({
              text: nestedText,
              url: nestedHref
            });
          }
        }
      }

      navLinks.push({
        text,
        url: href,
        children: children.length > 0 ? children : undefined
      });
    }

    return navLinks;
  }

  /**
   * Extract breadcrumbs
   */
  extractBreadcrumbs(document: Document): BreadcrumbItem[] {
    const breadcrumbs: BreadcrumbItem[] = [];

    const breadcrumbSelectors = [
      '.breadcrumb',
      '.breadcrumbs',
      '[aria-label*="breadcrumb"]',
      'nav[aria-label*="Breadcrumb"]'
    ];

    let breadcrumbEl: Element | null = null;
    for (const selector of breadcrumbSelectors) {
      breadcrumbEl = document.querySelector(selector);
      if (breadcrumbEl) break;
    }

    if (!breadcrumbEl) return breadcrumbs;

    const links = breadcrumbEl.querySelectorAll('a, li');
    
    for (const link of Array.from(links)) {
      if (link.tagName === 'A') {
        const href = link.getAttribute('href') || '';
        const text = link.textContent?.trim() || '';
        breadcrumbs.push({ text, url: href });
      } else if (link.tagName === 'LI') {
        const text = link.textContent?.trim() || '';
        const anchor = link.querySelector('a');
        const url = anchor?.getAttribute('href') || '#';
        breadcrumbs.push({ text, url });
      }
    }

    return breadcrumbs;
  }

  /**
   * Build site navigation graph
   */
  buildSiteGraph(pages: PageStructure[]): SiteGraph {
    const nodes: PageNode[] = pages.map(p => ({
      id: this.urlToId(p.url),
      url: p.url,
      title: this.extractTitleFromUrl(p.url),
      type: p.type
    }));

    const edges: PageEdge[] = [];
    const nodeIds = new Set(nodes.map(n => n.id));

    for (const page of pages) {
      const fromId = this.urlToId(page.url);

      // Navigation links
      for (const nav of page.navigation) {
        const toId = this.urlToId(nav.url);
        if (nodeIds.has(toId) && fromId !== toId) {
          edges.push({
            from: fromId,
            to: toId,
            type: 'nav'
          });
        }
      }

      // Related pages (from same breadcrumbs path)
      if (page.breadcrumbs.length > 1) {
        for (const crumb of page.breadcrumbs) {
          const toId = this.urlToId(crumb.url);
          if (nodeIds.has(toId) && fromId !== toId) {
            edges.push({
              from: fromId,
              to: toId,
              type: 'related'
            });
          }
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Build content taxonomy
   */
  buildTaxonomy(pages: PageStructure[]): ContentTaxonomy {
    const categories: Category[] = [];
    const tags: Tag[] = [];

    // Extract categories from URL paths
    const categoryMap = new Map<string, Set<string>>();

    for (const page of pages) {
      const url = new URL(page.url);
      const parts = url.pathname.split('/').filter(p => p && !p.includes('.'));

      for (let i = 0; i < parts.length; i++) {
        const category = parts[i];
        if (!categoryMap.has(category)) {
          categoryMap.set(category, new Set());
        }
        categoryMap.get(category)!.add(page.url);
      }
    }

    for (const [name, urls] of categoryMap) {
      categories.push({
        id: name,
        name: this.capitalizeWords(name.replace(/-/g, ' ')),
        pageCount: urls.size
      });
    }

    // Extract tags (if available in meta)
    // This is a simplified version

    return {
      categories: categories.sort((a, b) => b.pageCount - a.pageCount),
      tags: tags.sort((a, b) => b.pageCount - a.pageCount),
      hierarchy: this.buildCategoryHierarchy(categories, pages)
    };
  }

  /**
   * Find related pages based on content similarity
   */
  findRelatedPages(page: PageStructure, allPages: PageStructure[], limit: number = 5): RelatedPage[] {
    const related: RelatedPage[] = [];

    for (const otherPage of allPages) {
      if (otherPage.url === page.url) continue;

      let relevance = 0;

      // Same type
      if (otherPage.type === page.type) {
        relevance += 1;
      }

      // Shared breadcrumbs
      const sharedBreadcrumbs = page.breadcrumbs.filter(b =>
        otherPage.breadcrumbs.some(ob => ob.url === b.url)
      ).length;
      relevance += sharedBreadcrumbs * 2;

      // URL similarity
      const pagePath = new URL(page.url).pathname;
      const otherPath = new URL(otherPage.url).pathname;
      const pageParts = pagePath.split('/');
      const otherParts = otherPath.split('/');
      const sharedParts = pageParts.filter(p => otherParts.includes(p)).length;
      relevance += sharedParts;

      if (relevance > 0) {
        related.push({
          url: otherPage.url,
          title: this.extractTitleFromUrl(otherPage.url),
          relevance
        });
      }
    }

    return related
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  // Helper methods

  private findHTMLFiles(dir: string): string[] {
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          files.push(...this.findHTMLFiles(fullPath));
        } else if (entry.endsWith('.html') || entry.endsWith('.htm')) {
          files.push(fullPath);
        }
      }
    } catch (e) {
      // Ignore errors
    }

    return files;
  }

  private pathToUrl(relativePath: string, baseUrl: string): string {
    // Remove index.html
    let cleanPath = relativePath.replace(/index\.html?$/i, '');
    // Ensure leading slash
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }
    
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return base + cleanPath;
  }

  private urlToId(url: string): string {
    return url.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      const parts = pathname.split('/').filter(p => p);
      if (parts.length === 0) return 'Home';
      
      const lastPart = parts[parts.length - 1];
      return this.capitalizeWords(lastPart.replace(/[-_]/g, ' ').replace(/\.html?$/i, ''));
    } catch {
      return 'Unknown';
    }
  }

  private extractSectionTitle(element: Element): string | null {
    // Try heading first
    const heading = element.querySelector('h1, h2, h3, h4');
    if (heading) {
      return heading.textContent?.trim() || null;
    }

    // Try data attribute
    const dataTitle = element.getAttribute('data-title') || element.getAttribute('aria-label');
    if (dataTitle) return dataTitle;

    // Try first meaningful text
    const text = element.textContent?.trim().split('\n')[0];
    if (text && text.length < 100) return text;

    return null;
  }

  private calculateTypeConfidence(document: Document, type: PageType): number {
    // Calculate confidence based on how many indicators matched
    // This is a simplified version
    const indicators: Record<PageType, string[]> = {
      landing: ['hero', 'banner', 'features', 'cta'],
      docs: ['sidebar', 'toc', 'documentation'],
      blog: ['post', 'article', 'published', 'author'],
      api: ['endpoint', 'method', 'request', 'response'],
      ecommerce: ['product', 'price', 'cart'],
      wiki: ['wiki', 'knowledge'],
      unknown: []
    };

    const html = document.documentElement.outerHTML.toLowerCase();
    const typeIndicators = indicators[type];
    let matches = 0;

    for (const indicator of typeIndicators) {
      if (html.includes(indicator)) matches++;
    }

    return Math.min(1, matches / typeIndicators.length);
  }

  private buildCategoryHierarchy(categories: Category[], pages: PageStructure[]): any {
    // Build a simple tree structure based on URL paths
    const tree = new Map<string, string[]>();

    for (const page of pages) {
      const url = new URL(page.url);
      const parts = url.pathname.split('/').filter(p => p && !p.includes('.'));

      for (let i = 0; i < parts.length - 1; i++) {
        const parent = parts[i];
        const child = parts[i + 1];

        if (!tree.has(parent)) {
          tree.set(parent, []);
        }
        if (!tree.get(parent)!.includes(child)) {
          tree.get(parent)!.push(child);
        }
      }
    }

    return {
      root: categories[0]?.id || 'root',
      children: tree
    };
  }

  private capitalizeWords(str: string): string {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

export default StructureParser;
