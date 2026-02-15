/**
 * Site Remix Engine - Remix Engine
 * Transforms old websites into modern versions
 * Trench Project
 */

import * as fs from 'fs';
import * as path from 'path';
import { minify } from 'terser';
import * as CleanCSS from 'clean-css';
import {
  RemixOptions,
  RemixTheme,
  RemixResult,
  RemixedPage,
  AssetInfo,
  SearchIndexInfo,
  PWAManifest,
  PageType,
  ExtractedContent,
  PageStructure
} from './types';

// Template configurations for different themes
interface ThemeConfig {
  name: string;
  cssFramework: 'tailwind' | 'bootstrap' | 'custom';
  includes: {
    darkMode: boolean;
    search: boolean;
    toc: boolean;
    prevNext: boolean;
    sidebar: boolean;
  };
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
  };
}

const THEME_CONFIGS: Record<RemixTheme, ThemeConfig> = {
  'modern-docs': {
    name: 'Modern Documentation',
    cssFramework: 'tailwind',
    includes: {
      darkMode: true,
      search: true,
      toc: true,
      prevNext: true,
      sidebar: true
    },
    colors: {
      primary: '#3b82f6',
      secondary: '#64748b',
      background: '#ffffff',
      text: '#1e293b'
    }
  },
  'blog': {
    name: 'Modern Blog',
    cssFramework: 'tailwind',
    includes: {
      darkMode: true,
      search: true,
      toc: false,
      prevNext: true,
      sidebar: true
    },
    colors: {
      primary: '#0f172a',
      secondary: '#64748b',
      background: '#ffffff',
      text: '#334155'
    }
  },
  'landing': {
    name: 'Landing Page',
    cssFramework: 'tailwind',
    includes: {
      darkMode: true,
      search: false,
      toc: false,
      prevNext: false,
      sidebar: false
    },
    colors: {
      primary: '#6366f1',
      secondary: '#8b5cf6',
      background: '#ffffff',
      text: '#1e293b'
    }
  },
  'knowledge-base': {
    name: 'Knowledge Base',
    cssFramework: 'tailwind',
    includes: {
      darkMode: true,
      search: true,
      toc: true,
      prevNext: false,
      sidebar: true
    },
    colors: {
      primary: '#10b981',
      secondary: '#6b7280',
      background: '#ffffff',
      text: '#374151'
    }
  },
  'minimal': {
    name: 'Minimal',
    cssFramework: 'custom',
    includes: {
      darkMode: false,
      search: false,
      toc: false,
      prevNext: false,
      sidebar: false
    },
    colors: {
      primary: '#000000',
      secondary: '#666666',
      background: '#ffffff',
      text: '#333333'
    }
  }
};

export class RemixEngine {
  private options: RemixOptions;
  private themeConfig: ThemeConfig;
  private searchDocuments: Array<{ id: string; title: string; content: string; url: string }> = [];

  constructor(options: Partial<RemixOptions> = {}) {
    this.options = {
      theme: options.theme || 'modern-docs',
      darkMode: options.darkMode ?? true,
      primaryColor: options.primaryColor,
      secondaryColor: options.secondaryColor,
      fontFamily: options.fontFamily,
      enableSearch: options.enableSearch ?? true,
      searchProvider: options.searchProvider || 'fuse',
      pwa: options.pwa ?? false,
      minify: options.minify ?? true,
      optimizeImages: options.optimizeImages ?? true,
      modernCSS: options.modernCSS ?? true
    };

    this.themeConfig = THEME_CONFIGS[this.options.theme];

    // Override colors if provided
    if (this.options.primaryColor) {
      this.themeConfig.colors.primary = this.options.primaryColor;
    }
    if (this.options.secondaryColor) {
      this.themeConfig.colors.secondary = this.options.secondaryColor;
    }
  }

  /**
   * Remix entire site
   */
  async remixSite(
    inputPath: string,
    pages: Array<{ structure: PageStructure; content: ExtractedContent }>,
    outputPath: string
  ): Promise<RemixResult> {
    const remixedPages: RemixedPage[] = [];
    const assets: AssetInfo[] = [];

    // Create output directory
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // Copy and optimize assets
    const assetsPath = path.join(inputPath, 'assets');
    if (fs.existsSync(assetsPath)) {
      const copiedAssets = await this.copyAssets(assetsPath, path.join(outputPath, 'assets'));
      assets.push(...copiedAssets);
    }

    // Generate shared CSS
    const cssContent = this.generateCSS();
    const cssPath = path.join(outputPath, 'styles.css');
    fs.writeFileSync(cssPath, cssContent);
    assets.push({
      type: 'css',
      originalPath: 'inline',
      outputPath: 'styles.css',
      optimized: true,
      sizeBefore: cssContent.length,
      sizeAfter: cssContent.length
    });

    // Generate shared JavaScript
    const jsContent = this.generateJavaScript();
    const jsPath = path.join(outputPath, 'app.js');
    fs.writeFileSync(jsPath, jsContent);
    assets.push({
      type: 'js',
      originalPath: 'inline',
      outputPath: 'app.js',
      optimized: true,
      sizeBefore: jsContent.length,
      sizeAfter: jsContent.length
    });

    // Process each page
    for (const { structure, content } of pages) {
      try {
        const html = this.generatePageHTML(structure, content, pages.length > 1);
        const outputFileName = this.getOutputFileName(structure.url);
        const pagePath = path.join(outputPath, outputFileName);

        // Ensure directory exists
        const pageDir = path.dirname(pagePath);
        if (!fs.existsSync(pageDir)) {
          fs.mkdirSync(pageDir, { recursive: true });
        }

        fs.writeFileSync(pagePath, html);

        remixedPages.push({
          originalUrl: structure.url,
          outputPath: outputFileName,
          title: content.title,
          type: structure.type
        });

        // Add to search index
        if (this.options.enableSearch) {
          this.searchDocuments.push({
            id: structure.url,
            title: content.title,
            content: content.text.substring(0, 5000),
            url: outputFileName
          });
        }
      } catch (e) {
        console.warn(`Failed to remix page ${structure.url}:`, e);
      }
    }

    // Generate search index
    let searchIndex: SearchIndexInfo | undefined;
    if (this.options.enableSearch && this.searchDocuments.length > 0) {
      searchIndex = await this.generateSearchIndex(outputPath);
    }

    // Generate PWA manifest
    let pwaManifest: PWAManifest | undefined;
    if (this.options.pwa) {
      pwaManifest = await this.generatePWAManifest(outputPath, remixedPages[0]?.title || 'Site');
    }

    return {
      outputPath,
      pages: remixedPages,
      assets,
      searchIndex,
      pwaManifest
    };
  }

  /**
   * Generate HTML for a single page
   */
  private generatePageHTML(
    structure: PageStructure,
    content: ExtractedContent,
    hasMultiplePages: boolean
  ): string {
    const theme = this.themeConfig;
    const hasSidebar = theme.includes.sidebar && hasMultiplePages;
    const hasToc = theme.includes.toc && content.blocks.some(b => b.type === 'heading');

    return `<!DOCTYPE html>
<html lang="${content.metadata.language || 'en'}" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.title}${hasMultiplePages ? ` | ${content.metadata.title || 'Docs'}` : ''}</title>
  <meta name="description" content="${content.description || content.text.substring(0, 160)}">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${content.title}">
  <meta property="og:description" content="${content.description || ''}">
  <meta property="og:type" content="${structure.type === 'blog' ? 'article' : 'website'}">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${content.title}">
  <meta name="twitter:description" content="${content.description || ''}">
  
  <!-- Preconnect -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- Custom Styles -->
  <link rel="stylesheet" href="${this.getRelativePath('styles.css')}">
  
  <!-- Theme Config -->
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            primary: '${theme.colors.primary}',
            secondary: '${theme.colors.secondary}',
          }
        }
      }
    }
  </script>
  
  ${this.options.pwa ? this.generatePWALinks() : ''}
  
  ${this.generateSchemaOrg(structure, content)}
</head>
<body class="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 antialiased">
  
  ${this.generateHeader(structure, content)}
  
  <div class="flex min-h-screen">
    ${hasSidebar ? this.generateSidebar(structure) : ''}
    
    <main class="flex-1 ${hasSidebar ? 'lg:ml-64' : ''} ${hasToc ? 'xl:mr-64' : ''}">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        ${this.generateBreadcrumbs(structure.breadcrumbs)}
        
        <article class="prose dark:prose-invert max-w-none lg:prose-lg">
          <h1 class="text-4xl font-bold mb-4 text-gray-900 dark:text-white">${content.title}</h1>
          
          ${this.generateMetaLine(content)}
          
          ${content.description ? `<p class="text-xl text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">${content.description}</p>` : ''}
          
          <div class="content-blocks">
            ${this.renderContentBlocks(content.blocks)}
          </div>
        </article>
        
        ${this.generatePrevNext(structure)}
      </div>
    </main>
    
    ${hasToc ? this.generateTableOfContents(content) : ''}
  </div>
  
  ${this.generateFooter()}
  
  <!-- Back to top button -->
  <button id="back-to-top" 
          class="fixed bottom-8 right-8 p-3 rounded-full bg-primary text-white shadow-lg 
                 opacity-0 transition-opacity duration-300 hover:bg-primary/90"
          aria-label="Back to top">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
    </svg>
  </button>
  
  <script src="${this.getRelativePath('app.js')}"></script>
  ${this.options.enableSearch ? this.generateSearchScript() : ''}
</body>
</html>`;
  }

  /**
   * Generate CSS
   */
  private generateCSS(): string {
    const theme = this.themeConfig;
    
    let css = `
/* Modern Remix Styles */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

:root {
  --color-primary: ${theme.colors.primary};
  --color-secondary: ${theme.colors.secondary};
  --font-sans: ${this.options.fontFamily || 'Inter, system-ui, sans-serif'};
}

* {
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
  line-height: 1.6;
}

/* Typography */
.prose h1, .prose h2, .prose h3, .prose h4 {
  scroll-margin-top: 5rem;
  font-weight: 600;
  letter-spacing: -0.025em;
}

.prose h1 { font-size: 2.25rem; margin-top: 0; }
.prose h2 { font-size: 1.75rem; margin-top: 2rem; }
.prose h3 { font-size: 1.375rem; margin-top: 1.5rem; }

.prose p {
  margin-bottom: 1.25rem;
}

.prose a {
  color: var(--color-primary);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}

.prose a:hover {
  border-bottom-color: var(--color-primary);
}

/* Code blocks */
.code-block {
  background: #1e293b;
  border-radius: 0.5rem;
  overflow: hidden;
  margin: 1.5rem 0;
}

.code-block pre {
  margin: 0;
  padding: 1rem;
  overflow-x: auto;
  font-size: 0.875rem;
  line-height: 1.7;
}

.code-block code {
  font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  color: #e2e8f0;
}

.code-block .filename {
  background: #0f172a;
  color: #94a3b8;
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  border-bottom: 1px solid #334155;
}

/* Inline code */
:not(pre) > code {
  background: #f1f5f9;
  color: #0f172a;
  padding: 0.2em 0.4em;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-family: 'Fira Code', monospace;
}

.dark :not(pre) > code {
  background: #1e293b;
  color: #e2e8f0;
}

/* Tables */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5rem 0;
  font-size: 0.875rem;
}

th, td {
  border: 1px solid #e2e8f0;
  padding: 0.75rem;
  text-align: left;
}

.dark th, .dark td {
  border-color: #334155;
}

th {
  background: #f8fafc;
  font-weight: 600;
}

.dark th {
  background: #1e293b;
}

/* Blockquotes */
blockquote {
  border-left: 4px solid var(--color-primary);
  padding-left: 1rem;
  margin: 1.5rem 0;
  color: #64748b;
  font-style: italic;
}

.dark blockquote {
  color: #94a3b8;
}

/* Images */
img {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
}

figure {
  margin: 1.5rem 0;
}

figcaption {
  text-align: center;
  font-size: 0.875rem;
  color: #64748b;
  margin-top: 0.5rem;
}

/* Lists */
ul, ol {
  margin: 1rem 0;
  padding-left: 1.5rem;
}

li {
  margin: 0.25rem 0;
}

/* Search */
.search-container {
  position: relative;
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  max-height: 400px;
  overflow-y: auto;
  z-index: 50;
}

.dark .search-results {
  background: #1e293b;
  border-color: #334155;
}

.search-result {
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid #e2e8f0;
}

.search-result:hover {
  background: #f8fafc;
}

.dark .search-result:hover {
  background: #334155;
}

.search-result:last-child {
  border-bottom: none;
}

/* Sidebar */
.sidebar-link {
  display: block;
  padding: 0.5rem 1rem;
  color: #475569;
  text-decoration: none;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.dark .sidebar-link {
  color: #94a3b8;
}

.sidebar-link:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.dark .sidebar-link:hover {
  background: #334155;
  color: #f1f5f9;
}

.sidebar-link.active {
  background: ${theme.colors.primary}15;
  color: var(--color-primary);
  font-weight: 500;
}

/* Table of Contents */
.toc-link {
  display: block;
  padding: 0.375rem 0;
  color: #64748b;
  font-size: 0.875rem;
  text-decoration: none;
  transition: color 0.2s;
}

.toc-link:hover {
  color: var(--color-primary);
}

.toc-link.active {
  color: var(--color-primary);
  font-weight: 500;
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Selection */
::selection {
  background: ${theme.colors.primary}30;
}

/* Focus visible */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Print styles */
@media print {
  .no-print {
    display: none !important;
  }
  
  body {
    font-size: 12pt;
  }
}
`;

    // Minify if requested
    if (this.options.minify) {
      const cleanCSS = new CleanCSS({
        level: 2
      });
      const result = cleanCSS.minify(css);
      css = result.styles;
    }

    return css;
  }

  /**
   * Generate JavaScript
   */
  private generateJavaScript(): string {
    let js = `
// Modern Remix App
(function() {
  'use strict';

  // Dark mode toggle
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const html = document.documentElement;

  // Initialize dark mode
  function initDarkMode() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (saved === 'dark' || (!saved && prefersDark)) {
      html.classList.add('dark');
    }
  }

  function toggleDarkMode() {
    html.classList.toggle('dark');
    localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
  }

  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', toggleDarkMode);
  }

  // Mobile menu toggle
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.getElementById('sidebar');

  if (mobileMenuToggle && sidebar) {
    mobileMenuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
    });
  }

  // Back to top button
  const backToTop = document.getElementById('back-to-top');

  if (backToTop) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 500) {
        backToTop.classList.remove('opacity-0');
      } else {
        backToTop.classList.add('opacity-0');
      }
    });

    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Table of contents active state
  const tocLinks = document.querySelectorAll('.toc-link');
  const headings = document.querySelectorAll('h2, h3');

  if (tocLinks.length && headings.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          tocLinks.forEach(link => link.classList.remove('active'));
          const activeLink = document.querySelector(\`.toc-link[href="#\${entry.target.id}"]\`);
          if (activeLink) activeLink.classList.add('active');
        }
      });
    }, { rootMargin: '-20% 0px -80% 0px' });

    headings.forEach(heading => observer.observe(heading));
  }

  // Copy code button
  document.querySelectorAll('.code-block').forEach(block => {
    const button = document.createElement('button');
    button.className = 'absolute top-2 right-2 p-2 rounded bg-gray-700 text-gray-300 opacity-0 transition-opacity';
    button.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>';
    button.setAttribute('aria-label', 'Copy code');
    
    block.style.position = 'relative';
    block.appendChild(button);

    block.addEventListener('mouseenter', () => button.classList.remove('opacity-0'));
    block.addEventListener('mouseleave', () => button.classList.add('opacity-0'));

    button.addEventListener('click', async () => {
      const code = block.querySelector('code');
      if (code) {
        await navigator.clipboard.writeText(code.textContent || '');
        button.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
        setTimeout(() => {
          button.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>';
        }, 2000);
      }
    });
  });

  initDarkMode();
})();
`;

    // Minify if requested
    if (this.options.minify) {
      try {
        const result = minify(js);
        js = result.code || js;
      } catch (e) {
        console.warn('JS minification failed:', e);
      }
    }

    return js;
  }

  /**
   * Generate search index
   */
  private async generateSearchIndex(outputPath: string): Promise<SearchIndexInfo> {
    const indexPath = path.join(outputPath, 'search-index.json');
    
    switch (this.options.searchProvider) {
      case 'lunr':
        // For Lunr.js, we need to include the library and build index client-side
        fs.writeFileSync(indexPath, JSON.stringify({
          documents: this.searchDocuments,
          index: null // Will be built client-side
        }));
        break;
        
      case 'fuse':
      default:
        // Fuse.js can work directly with documents
        fs.writeFileSync(indexPath, JSON.stringify(this.searchDocuments));
        break;
    }

    return {
      provider: this.options.searchProvider,
      indexPath: 'search-index.json',
      documentCount: this.searchDocuments.length
    };
  }

  // Helper methods for HTML generation

  private generateHeader(structure: PageStructure, content: ExtractedContent): string {
    const theme = this.themeConfig;
    
    return `
<header class="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 no-print">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <!-- Logo -->
      <a href="/" class="flex items-center space-x-2 text-xl font-bold text-gray-900 dark:text-white">
        ${content.metadata.title || 'Site'}
      </a>
      
      <!-- Search -->
      ${theme.includes.search ? `
      <div class="hidden md:block flex-1 max-w-md mx-8 search-container">
        <input type="search" 
               id="search-input"
               placeholder="Search..." 
               class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
               autocomplete="off">
        <div id="search-results" class="search-results hidden"></div>
      </div>
      ` : ''}
      
      <!-- Controls -->
      <div class="flex items-center space-x-4">
        ${theme.includes.darkMode ? `
        <button id="dark-mode-toggle" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Toggle dark mode">
          <svg class="w-5 h-5 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"/>
          </svg>
          <svg class="w-5 h-5 block dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
          </svg>
        </button>
        ` : ''}
        
        ${theme.includes.sidebar ? `
        <button id="mobile-menu-toggle" class="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Toggle menu">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        ` : ''}
      </div>
    </div>
  </div>
</header>
<div class="h-16"></div>
`;
  }

  private generateSidebar(structure: PageStructure): string {
    const links = structure.navigation.map(nav => {
      const isActive = nav.url === structure.url;
      return `
        <a href="${nav.url}" class="sidebar-link ${isActive ? 'active' : ''}">
          ${nav.text}
        </a>
        ${nav.children ? `
          <div class="ml-4 border-l border-gray-200 dark:border-gray-700">
            ${nav.children.map(child => `
              <a href="${child.url}" class="sidebar-link text-sm ${child.url === structure.url ? 'active' : ''}">
                ${child.text}
              </a>
            `).join('')}
          </div>
        ` : ''}
      `;
    }).join('');

    return `
<aside id="sidebar" class="fixed left-0 top-16 bottom-0 w-64 bg-gray-50 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-800 overflow-y-auto -translate-x-full lg:translate-x-0 transition-transform duration-300 z-40 no-print">
  <nav class="p-4">
    ${links}
  </nav>
</aside>
`;
  }

  private generateTableOfContents(content: ExtractedContent): string {
    const headings = content.blocks.filter(b => b.type === 'heading') as any[];
    
    if (headings.length === 0) return '';

    const tocLinks = headings.map(h => {
      const id = h.id || this.slugify(h.content);
      const indent = h.level > 2 ? 'ml-4' : '';
      return `
        <a href="#${id}" class="toc-link ${indent}">${h.content}</a>
      `;
    }).join('');

    return `
<aside class="hidden xl:block fixed right-0 top-16 bottom-0 w-64 p-6 overflow-y-auto no-print">
  <div class="sticky top-0">
    <h5 class="font-semibold text-sm text-gray-500 dark:text-gray-400 mb-4">On this page</h5>
    <nav class="space-y-1">
      ${tocLinks}
    </nav>
  </div>
</aside>
`;
  }

  private generateBreadcrumbs(breadcrumbs: any[]): string {
    if (breadcrumbs.length === 0) return '';

    const items = breadcrumbs.map((crumb, index) => {
      const isLast = index === breadcrumbs.length - 1;
      return `
        <li class="flex items-center">
          ${index > 0 ? '<span class="mx-2 text-gray-400">/</span>' : ''}
          ${isLast 
            ? `<span class="text-gray-600 dark:text-gray-400">${crumb.text}</span>`
            : `<a href="${crumb.url}" class="text-primary hover:underline">${crumb.text}</a>`
          }
        </li>
      `;
    }).join('');

    return `
<nav aria-label="Breadcrumb" class="mb-6">
  <ol class="flex flex-wrap items-center text-sm">
    ${items}
  </ol>
</nav>
`;
  }

  private generateMetaLine(content: ExtractedContent): string {
    const items: string[] = [];
    
    if (content.author) {
      items.push(`By ${content.author}`);
    }
    if (content.publishedDate) {
      items.push(this.formatDate(content.publishedDate));
    }
    if (content.readingTime > 0) {
      items.push(`${content.readingTime} min read`);
    }

    if (items.length === 0) return '';

    return `
<div class="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
  ${items.join('<span class="mx-2">•</span>')}
</div>
`;
  }

  private generatePrevNext(structure: PageStructure): string {
    if (!this.themeConfig.includes.prevNext) return '';

    // This would need the full site structure to work properly
    // For now, return empty
    return '';
  }

  private generateFooter(): string {
    return `
<footer class="border-t border-gray-200 dark:border-gray-800 mt-16 py-8 no-print">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <p class="text-center text-sm text-gray-500 dark:text-gray-400">
      Remixed with <a href="https://github.com/trench/remix" class="text-primary">Trench Remix</a>
    </p>
  </div>
</footer>
`;
  }

  private generatePWALinks(): string {
    return `
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="${this.themeConfig.colors.primary}">
  <link rel="apple-touch-icon" href="/icon-192x192.png">
`;
  }

  private generatePWAManifest(outputPath: string, name: string): PWAManifest {
    const manifest: PWAManifest = {
      name,
      shortName: name.substring(0, 12),
      description: `Remixed version of ${name}`,
      themeColor: this.themeConfig.colors.primary,
      backgroundColor: this.themeConfig.colors.background,
      icons: [
        { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' }
      ]
    };

    fs.writeFileSync(
      path.join(outputPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    return manifest;
  }

  private generateSchemaOrg(structure: PageStructure, content: ExtractedContent): string {
    const schema: any = {
      '@context': 'https://schema.org',
      '@type': structure.type === 'blog' ? 'BlogPosting' : 'WebPage',
      headline: content.title,
      description: content.description,
      url: structure.url
    };

    if (content.author) {
      schema.author = {
        '@type': 'Person',
        name: content.author
      };
    }

    if (content.publishedDate) {
      schema.datePublished = content.publishedDate;
    }

    if (content.modifiedDate) {
      schema.dateModified = content.modifiedDate;
    }

    return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  }

  private generateSearchScript(): string {
    const fuseScript = `<script src="https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.min.js"></script>`;
    const searchLogic = `
<script>
(function() {
  let fuse;
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  
  fetch('${this.getRelativePath('search-index.json')}')
    .then(r => r.json())
    .then(docs => {
      fuse = new Fuse(docs, {
        keys: ['title', 'content'],
        threshold: 0.3
      });
    });
  
  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value;
    if (!query || !fuse) {
      searchResults?.classList.add('hidden');
      return;
    }
    
    const results = fuse.search(query).slice(0, 5);
    
    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-result text-gray-500">No results found</div>';
    } else {
      searchResults.innerHTML = results.map(r => \`
        <a href="\${r.item.url}" class="search-result block">
          <div class="font-medium">\${r.item.title}</div>
          <div class="text-sm text-gray-500 truncate">\${r.item.content.substring(0, 100)}...</div>
        </a>
      \`).join('');
    }
    
    searchResults.classList.remove('hidden');
  });
  
  document.addEventListener('click', (e) => {
    if (!searchInput?.contains(e.target) && !searchResults?.contains(e.target)) {
      searchResults?.classList.add('hidden');
    }
  });
})();
</script>`;

    return fuseScript + '\n' + searchLogic;
  }

  private renderContentBlocks(blocks: any[]): string {
    return blocks.map(block => {
      switch (block.type) {
        case 'heading':
          const id = block.id || this.slugify(block.content);
          return `<h${block.level} id="${id}">${block.content}</h${block.level}>`;
        
        case 'text':
          return `<p>${block.content}</p>`;
        
        case 'code':
          return `
<div class="code-block">
  ${block.filename ? `<div class="filename">${block.filename}</div>` : ''}
  <pre><code class="language-${block.language || 'text'}">${this.escapeHtml(block.content)}</code></pre>
</div>`;
        
        case 'table':
          const headerRow = block.headers.length > 0 
            ? `<thead><tr>${block.headers.map((h: string) => `<th>${h}</th>`).join('')}</tr></thead>`
            : '';
          const bodyRows = block.rows.map((row: string[]) => 
            `<tr>${row.map((cell: string) => `<td>${cell}</td>`).join('')}</tr>`
          ).join('');
          return `
<table>
  ${headerRow}
  <tbody>${bodyRows}</tbody>
</table>
${block.caption ? `<p class="text-center text-sm text-gray-500">${block.caption}</p>` : ''}`;
        
        case 'image':
          return `
<figure>
  <img src="${block.src}" alt="${block.alt}" loading="lazy">
  ${block.caption ? `<figcaption>${block.caption}</figcaption>` : ''}
</figure>`;
        
        case 'list':
          const tag = block.ordered ? 'ol' : 'ul';
          return `<${tag}>${block.items.map((item: string) => `<li>${item}</li>`).join('')}</${tag}>`;
        
        case 'quote':
          return `<blockquote>${block.content}${block.author ? `<cite>— ${block.author}</cite>` : ''}</blockquote>`;
        
        default:
          return '';
      }
    }).join('\n');
  }

  private async copyAssets(src: string, dest: string): Promise<AssetInfo[]> {
    const assets: AssetInfo[] = [];

    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      const stat = fs.statSync(srcPath);

      if (stat.isDirectory()) {
        const nestedAssets = await this.copyAssets(srcPath, destPath);
        assets.push(...nestedAssets);
      } else {
        const content = fs.readFileSync(srcPath);
        const sizeBefore = content.length;
        
        // Could add image optimization here
        fs.writeFileSync(destPath, content);

        assets.push({
          type: entry.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i) ? 'image' : 
                entry.endsWith('.css') ? 'css' : 
                entry.endsWith('.js') ? 'js' : 'font',
          originalPath: srcPath,
          outputPath: destPath,
          optimized: false,
          sizeBefore,
          sizeAfter: sizeBefore
        });
      }
    }

    return assets;
  }

  private getOutputFileName(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      if (pathname === '/' || pathname === '') {
        return 'index.html';
      }
      return pathname.replace(/^\//, '').replace(/\/$/, '') + '/index.html';
    } catch {
      return 'index.html';
    }
  }

  private getRelativePath(target: string): string {
    // This is simplified - should calculate based on current page depth
    return target;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  private escapeHtml(text: string): string {
    const div = { replace: (s: string) => s }; // Placeholder
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export default RemixEngine;
