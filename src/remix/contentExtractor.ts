/**
 * Site Remix Engine - Content Extractor
 * Extracts clean content from downloaded websites
 * Trench Project
 */

import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import {
  ExtractedContent,
  ContentBlock,
  TextBlock,
  CodeBlock,
  TableBlock,
  ImageBlock,
  HeadingBlock,
  ListBlock,
  QuoteBlock,
  PageMetadata,
  ExtractReport
} from './types';

export class ContentExtractor {
  private turndown: TurndownService;
  private dom: JSDOM | null = null;
  private document: Document | null = null;

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
      strongDelimiter: '**'
    });

    // Custom rules for better extraction
    this.setupTurndownRules();
  }

  /**
   * Setup custom Turndown rules
   */
  private setupTurndownRules(): void {
    // Code blocks
    this.turndown.addRule('codeBlock', {
      filter: (node) => {
        return node.nodeName === 'PRE' && 
               node.querySelector('code') !== null;
      },
      replacement: (content, node) => {
        const codeEl = (node as Element).querySelector('code');
        const language = this.detectCodeLanguage(codeEl);
        const code = codeEl?.textContent || content;
        return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
      }
    });

    // Tables
    this.turndown.addRule('tables', {
      filter: 'table',
      replacement: (content, node) => {
        return this.convertTableToMarkdown(node as HTMLTableElement);
      }
    });

    // Images with captions
    this.turndown.addRule('figures', {
      filter: (node) => {
        return node.nodeName === 'FIGURE' ||
               (node.nodeName === 'DIV' && 
                node.querySelector('img') !== null &&
                node.querySelector('figcaption, .caption') !== null);
      },
      replacement: (content, node) => {
        const img = (node as Element).querySelector('img');
        const caption = (node as Element).querySelector('figcaption, .caption');
        if (img) {
          const alt = img.getAttribute('alt') || '';
          const src = img.getAttribute('src') || '';
          return `\n\n![${alt}](${src})\n*${caption?.textContent || ''}*\n\n`;
        }
        return content;
      }
    });
  }

  /**
   * Load HTML content
   */
  loadHTML(html: string): void {
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
   * Extract all content from the page
   */
  extract(): ExtractedContent {
    if (!this.document) throw new Error('No document loaded');

    const metadata = this.extractMetadata();
    const blocks = this.extractBlocks();
    const text = this.extractCleanText();
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

    return {
      title: metadata.title,
      description: metadata.description,
      author: metadata.author,
      publishedDate: this.extractDate('published'),
      modifiedDate: this.extractDate('modified'),
      text,
      wordCount,
      readingTime: Math.ceil(wordCount / 200),
      blocks,
      metadata
    };
  }

  /**
   * Extract clean text content
   */
  extractCleanText(): string {
    if (!this.document) throw new Error('No document loaded');

    // Remove script and style elements
    const clone = this.document.body.cloneNode(true) as HTMLElement;
    
    // Remove non-content elements
    const removeSelectors = [
      'script', 'style', 'nav', 'header', 'footer', 
      'aside', '.sidebar', '.navigation', '.menu',
      '#cookie-banner', '.advertisement', '.ad'
    ];

    for (const selector of removeSelectors) {
      const elements = clone.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    }

    // Get main content area if it exists
    const mainContent = 
      clone.querySelector('main') ||
      clone.querySelector('article') ||
      clone.querySelector('.content') ||
      clone.querySelector('#content') ||
      clone.querySelector('[role="main"]');

    const contentElement = mainContent || clone;
    
    // Clean up whitespace
    let text = contentElement.textContent || '';
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }

  /**
   * Extract structured blocks
   */
  extractBlocks(): ContentBlock[] {
    if (!this.document) throw new Error('No document loaded');

    const blocks: ContentBlock[] = [];
    const mainContent = this.getMainContentElement();

    if (!mainContent) return blocks;

    const walker = this.document.createTreeWalker(
      mainContent,
      this.dom!.window.NodeFilter.SHOW_ELEMENT,
      null
    );

    const processedElements = new Set<Element>();

    while (walker.nextNode()) {
      const node = walker.currentNode as Element;
      
      if (processedElements.has(node)) continue;
      
      // Mark children as processed to avoid duplication
      const markChildren = (el: Element) => {
        processedElements.add(el);
        Array.from(el.children).forEach(markChildren);
      };

      const block = this.convertElementToBlock(node);
      if (block) {
        blocks.push(block);
        markChildren(node);
      }
    }

    return blocks;
  }

  /**
   * Extract code blocks with syntax highlighting
   */
  extractCodeBlocks(): CodeBlock[] {
    if (!this.document) throw new Error('No document loaded');

    const codeBlocks: CodeBlock[] = [];
    const selectors = [
      'pre code',
      '[class*="language-"]',
      '[class*="lang-"]',
      '.code-block',
      '.highlight',
      '.prism'
    ];

    const elements = this.document.querySelectorAll(selectors.join(', '));

    for (const el of Array.from(elements)) {
      const language = this.detectCodeLanguage(el);
      const content = el.textContent || '';
      
      // Try to find filename
      const pre = el.closest('pre');
      const filename = pre?.getAttribute('data-filename') ||
                      pre?.querySelector('.filename, .file-name')?.textContent ||
                      undefined;

      codeBlocks.push({
        type: 'code',
        language,
        content: content.trim(),
        filename,
        lineNumbers: pre?.querySelector('.line-numbers, .lineno') !== null
      });
    }

    return codeBlocks;
  }

  /**
   * Extract tables as markdown
   */
  extractTables(): TableBlock[] {
    if (!this.document) throw new Error('No document loaded');

    const tables: TableBlock[] = [];
    const tableElements = this.document.querySelectorAll('table');

    for (const table of Array.from(tableElements)) {
      const headers: string[] = [];
      const rows: string[][] = [];

      // Extract headers
      const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
      if (headerRow) {
        const ths = headerRow.querySelectorAll('th, td');
        ths.forEach(th => headers.push(th.textContent?.trim() || ''));
      }

      // Extract rows
      const dataRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
      for (const row of Array.from(dataRows)) {
        const cells = row.querySelectorAll('td, th');
        const rowData: string[] = [];
        cells.forEach(cell => rowData.push(cell.textContent?.trim() || ''));
        if (rowData.length > 0) {
          rows.push(rowData);
        }
      }

      // Extract caption
      const caption = table.querySelector('caption')?.textContent?.trim() ||
                     table.closest('figure')?.querySelector('figcaption')?.textContent?.trim();

      if (headers.length > 0 || rows.length > 0) {
        tables.push({
          type: 'table',
          headers,
          rows,
          caption
        });
      }
    }

    return tables;
  }

  /**
   * Extract images with metadata
   */
  extractImages(): ImageBlock[] {
    if (!this.document) throw new Error('No document loaded');

    const images: ImageBlock[] = [];
    const imgElements = this.document.querySelectorAll('img');

    for (const img of Array.from(imgElements)) {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      
      // Find caption
      const figure = img.closest('figure');
      const caption = figure?.querySelector('figcaption')?.textContent?.trim() ||
                     img.getAttribute('title') ||
                     undefined;

      const width = img.naturalWidth || parseInt(img.getAttribute('width') || '0') || undefined;
      const height = img.naturalHeight || parseInt(img.getAttribute('height') || '0') || undefined;

      images.push({
        type: 'image',
        src,
        alt,
        caption,
        width,
        height,
        format: this.getImageFormat(src)
      });
    }

    return images;
  }

  /**
   * Extract links with context
   */
  extractLinks(): Array<{ text: string; url: string; context: string }> {
    if (!this.document) throw new Error('No document loaded');

    const links: Array<{ text: string; url: string; context: string }> = [];
    const linkElements = this.document.querySelectorAll('a[href]');

    for (const link of Array.from(linkElements)) {
      const url = link.getAttribute('href') || '';
      const text = link.textContent?.trim() || '';
      
      // Get surrounding context
      const parent = link.parentElement;
      const context = parent?.textContent?.trim() || '';

      if (url && !url.startsWith('#') && !url.startsWith('javascript:')) {
        links.push({
          text,
          url,
          context: context.substring(0, 200)
        });
      }
    }

    return links;
  }

  /**
   * Extract page metadata
   */
  extractMetadata(): PageMetadata {
    if (!this.document) throw new Error('No document loaded');

    const head = this.document.head;
    const url = this.document.location?.href || '';

    const getMeta = (name: string): string | undefined => {
      const meta = head?.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
      return meta?.getAttribute('content') || undefined;
    };

    return {
      url,
      title: this.document.title,
      description: getMeta('description') || getMeta('og:description'),
      keywords: getMeta('keywords')?.split(',').map(k => k.trim()),
      author: getMeta('author') || getMeta('article:author'),
      language: this.document.documentElement.lang || undefined,
      robots: getMeta('robots'),
      favicon: this.document.querySelector('link[rel*="icon"]')?.getAttribute('href') || undefined
    };
  }

  /**
   * Convert entire page to Markdown
   */
  toMarkdown(): string {
    if (!this.document) throw new Error('No document loaded');

    const mainContent = this.getMainContentElement();
    if (!mainContent) return '';

    return this.turndown.turndown(mainContent.innerHTML);
  }

  /**
   * Extract content from entire site directory
   */
  async extractSite(sitePath: string, options: {
    includePattern?: RegExp;
    excludePattern?: RegExp;
  } = {}): Promise<ExtractReport> {
    const pages: ExtractedContent[] = [];
    let totalBlocks = 0;
    let codeBlocks = 0;
    let tables = 0;
    let images = 0;

    const htmlFiles = this.findHTMLFiles(sitePath);
    const outputDir = path.join(sitePath, '..', 'extracted');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const filePath of htmlFiles) {
      const relativePath = path.relative(sitePath, filePath);
      
      // Apply filters
      if (options.includePattern && !options.includePattern.test(relativePath)) continue;
      if (options.excludePattern && options.excludePattern.test(relativePath)) continue;

      try {
        this.loadFromFile(filePath);
        const content = this.extract();
        pages.push(content);

        // Update stats
        totalBlocks += content.blocks.length;
        codeBlocks += content.blocks.filter(b => b.type === 'code').length;
        tables += content.blocks.filter(b => b.type === 'table').length;
        images += content.blocks.filter(b => b.type === 'image').length;

        // Save markdown version
        const mdPath = path.join(outputDir, relativePath.replace('.html', '.md'));
        const mdDir = path.dirname(mdPath);
        if (!fs.existsSync(mdDir)) {
          fs.mkdirSync(mdDir, { recursive: true });
        }
        fs.writeFileSync(mdPath, this.toMarkdown());

      } catch (e) {
        console.warn(`Failed to extract ${filePath}:`, e);
      }
    }

    return {
      timestamp: new Date().toISOString(),
      sourcePath: sitePath,
      outputPath: outputDir,
      pages,
      totalBlocks,
      codeBlocks,
      tables,
      images
    };
  }

  // Helper methods

  private getMainContentElement(): Element | null {
    if (!this.document) return null;

    // Try common content selectors
    const selectors = [
      'main',
      'article',
      '.content',
      '#content',
      '.main-content',
      '#main-content',
      '[role="main"]',
      '.post',
      '.entry-content',
      '.documentation',
      '.docs-content'
    ];

    for (const selector of selectors) {
      const el = this.document.querySelector(selector);
      if (el) return el;
    }

    return this.document.body;
  }

  private convertElementToBlock(element: Element): ContentBlock | null {
    const tagName = element.tagName.toLowerCase();

    // Headings
    if (/^h[1-6]$/.test(tagName)) {
      return {
        type: 'heading',
        level: parseInt(tagName[1]),
        content: element.textContent?.trim() || '',
        id: element.id || undefined
      } as HeadingBlock;
    }

    // Code blocks
    if (tagName === 'pre' && element.querySelector('code')) {
      const codeEl = element.querySelector('code');
      return {
        type: 'code',
        language: this.detectCodeLanguage(codeEl),
        content: codeEl?.textContent?.trim() || '',
        filename: element.getAttribute('data-filename') || undefined
      } as CodeBlock;
    }

    // Tables
    if (tagName === 'table') {
      return this.convertTableToBlock(element as HTMLTableElement);
    }

    // Images
    if (tagName === 'img') {
      return {
        type: 'image',
        src: element.getAttribute('src') || '',
        alt: element.getAttribute('alt') || '',
        width: parseInt(element.getAttribute('width') || '0') || undefined,
        height: parseInt(element.getAttribute('height') || '0') || undefined
      } as ImageBlock;
    }

    // Lists
    if (tagName === 'ul' || tagName === 'ol') {
      const items = Array.from(element.querySelectorAll('li'))
        .map(li => li.textContent?.trim() || '');
      return {
        type: 'list',
        ordered: tagName === 'ol',
        items
      } as ListBlock;
    }

    // Blockquotes
    if (tagName === 'blockquote') {
      const content = element.textContent?.trim() || '';
      const cite = element.querySelector('cite')?.textContent?.trim();
      return {
        type: 'quote',
        content,
        author: cite
      } as QuoteBlock;
    }

    // Paragraphs with substantial content
    if (tagName === 'p' && (element.textContent?.length || 0) > 20) {
      return {
        type: 'text',
        content: element.textContent?.trim() || '',
        format: element.classList.contains('lead') ? 'lead' : 'paragraph'
      } as TextBlock;
    }

    return null;
  }

  private convertTableToBlock(table: HTMLTableElement): TableBlock {
    const headers: string[] = [];
    const rows: string[][] = [];

    const headerCells = table.querySelectorAll('th');
    headerCells.forEach(th => headers.push(th.textContent?.trim() || ''));

    const dataRows = table.querySelectorAll('tr');
    for (const row of Array.from(dataRows)) {
      const cells = row.querySelectorAll('td');
      if (cells.length > 0) {
        const rowData: string[] = [];
        cells.forEach(td => rowData.push(td.textContent?.trim() || ''));
        rows.push(rowData);
      }
    }

    return {
      type: 'table',
      headers,
      rows,
      caption: table.querySelector('caption')?.textContent?.trim()
    };
  }

  private convertTableToMarkdown(table: HTMLTableElement): string {
    const block = this.convertTableToBlock(table);
    
    let md = '\n\n';
    
    // Header
    if (block.headers.length > 0) {
      md += '| ' + block.headers.join(' | ') + ' |\n';
      md += '| ' + block.headers.map(() => '---').join(' | ') + ' |\n';
    }
    
    // Rows
    for (const row of block.rows) {
      md += '| ' + row.join(' | ') + ' |\n';
    }
    
    // Caption
    if (block.caption) {
      md += `\n*${block.caption}*\n`;
    }
    
    return md + '\n';
  }

  private detectCodeLanguage(element: Element | null): string | undefined {
    if (!element) return undefined;

    const classNames = Array.from(element.classList);
    
    for (const className of classNames) {
      // Common patterns: language-js, lang-python, prism-python, etc.
      const match = className.match(/(?:language|lang|prism|hljs)-([a-z0-9]+)/i);
      if (match) return match[1];
    }

    // Check data attributes
    return element.getAttribute('data-language') ||
           element.getAttribute('data-lang') ||
           undefined;
  }

  private extractDate(type: 'published' | 'modified'): string | undefined {
    if (!this.document) return undefined;

    const selectors = type === 'published' 
      ? ['time[datetime]', '.published', '.date', '[property="datePublished"]']
      : ['.modified', '.updated', '[property="dateModified"]'];

    for (const selector of selectors) {
      const el = this.document.querySelector(selector);
      if (el) {
        return el.getAttribute('datetime') || 
               el.getAttribute('content') || 
               el.textContent?.trim();
      }
    }

    return undefined;
  }

  private getImageFormat(src: string): string | undefined {
    const match = src.match(/\.([a-zA-Z]+)(?:\?|$)/);
    return match ? match[1].toLowerCase() : undefined;
  }

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
}

export default ContentExtractor;
