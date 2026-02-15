/**
 * Trench CLI - Remix Command
 * Transform archived sites with modern themes
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { JSDOM } from 'jsdom';
import type { RemixOptions, RemixResult, RemixTheme } from '../types/index.js';

/**
 * Remix an archived website
 */
export async function remix(options: RemixOptions): Promise<RemixResult> {
  const startTime = Date.now();
  
  // Load archive manifest
  const manifestPath = path.join(options.archivePath, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
  
  // Create output directory
  await fs.mkdir(options.outputDir, { recursive: true });
  
  // Load theme template
  const theme = loadTheme(options.theme, options.customStyles);
  
  // Process each page
  let pagesGenerated = 0;
  const assetsProcessed: string[] = [];
  
  for (const page of manifest.pages) {
    try {
      const sourcePath = path.join(options.archivePath, page.filePath);
      const html = await fs.readFile(sourcePath, 'utf-8');
      
      // Transform content
      const transformed = await transformPage(html, page, theme, options.theme);
      
      // Write remixed page
      const outputFilePath = path.join(options.outputDir, page.filePath);
      await fs.mkdir(path.dirname(outputFilePath), { recursive: true });
      await fs.writeFile(outputFilePath, transformed);
      
      pagesGenerated++;
    } catch (error) {
      console.warn(`Failed to remix ${page.url}:`, error);
    }
  }
  
  // Copy assets
  const assetsDir = path.join(options.archivePath, 'assets');
  const outputAssetsDir = path.join(options.outputDir, 'assets');
  
  try {
    await fs.mkdir(outputAssetsDir, { recursive: true });
    const assets = await fs.readdir(assetsDir);
    
    for (const asset of assets) {
      const srcPath = path.join(assetsDir, asset);
      const destPath = path.join(outputAssetsDir, asset);
      await fs.copyFile(srcPath, destPath);
      assetsProcessed.push(asset);
    }
  } catch {
    // Assets directory might not exist
  }
  
  // Generate theme assets
  await generateThemeAssets(options.outputDir, options.theme);
  
  // Deploy if requested
  let deployUrl: string | undefined;
  if (options.deploy) {
    deployUrl = await deploySite(options.outputDir);
  }
  
  const buildTime = Date.now() - startTime;
  
  return {
    archivePath: options.archivePath,
    outputDir: options.outputDir,
    theme: options.theme,
    pagesGenerated,
    assetsProcessed: assetsProcessed.length,
    deployUrl,
    buildTime,
  };
}

/**
 * Load theme configuration
 */
function loadTheme(theme: RemixTheme, customStyles?: Record<string, string>): ThemeConfig {
  const themes: Record<RemixTheme, ThemeConfig> = {
    modern: {
      name: 'Modern',
      cssFramework: 'tailwind',
      layout: 'responsive',
      darkMode: true,
      typography: 'system-ui',
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#1e293b',
        textMuted: '#64748b',
      },
      components: ['nav', 'sidebar', 'toc', 'search'],
    },
    minimal: {
      name: 'Minimal',
      cssFramework: 'custom',
      layout: 'single-column',
      darkMode: false,
      typography: 'serif',
      colors: {
        primary: '#000000',
        secondary: '#666666',
        background: '#ffffff',
        surface: '#f5f5f5',
        text: '#333333',
        textMuted: '#666666',
      },
      components: ['nav'],
    },
    docs: {
      name: 'Documentation',
      cssFramework: 'custom',
      layout: 'docs',
      darkMode: true,
      typography: 'system-ui',
      colors: {
        primary: '#10b981',
        secondary: '#6b7280',
        background: '#ffffff',
        surface: '#f9fafb',
        text: '#111827',
        textMuted: '#6b7280',
      },
      components: ['nav', 'sidebar', 'toc', 'search', 'edit-link'],
    },
    docusaurus: {
      name: 'Docusaurus',
      cssFramework: 'infima',
      layout: 'docs',
      darkMode: true,
      typography: 'system-ui',
      colors: {
        primary: '#25c2a0',
        secondary: '#606770',
        background: '#ffffff',
        surface: '#f5f6f7',
        text: '#1c1e21',
        textMuted: '#606770',
      },
      components: ['navbar', 'sidebar', 'toc', 'search', 'footer'],
    },
    vitepress: {
      name: 'VitePress',
      cssFramework: 'custom',
      layout: 'docs',
      darkMode: true,
      typography: 'system-ui',
      colors: {
        primary: '#10b981',
        secondary: '#8b9aaf',
        background: '#ffffff',
        surface: '#f6f6f7',
        text: '#213547',
        textMuted: '#67676c',
      },
      components: ['nav', 'sidebar', 'toc', 'search', 'last-updated'],
    },
    mkdocs: {
      name: 'Material for MkDocs',
      cssFramework: 'custom',
      layout: 'docs',
      darkMode: true,
      typography: 'roboto',
      colors: {
        primary: '#526cfe',
        secondary: '#526cfe',
        background: '#ffffff',
        surface: '#f5f5f5',
        text: '#212529',
        textMuted: '#666666',
      },
      components: ['header', 'nav', 'toc', 'search'],
    },
    custom: {
      name: 'Custom',
      cssFramework: 'custom',
      layout: 'custom',
      darkMode: false,
      typography: 'system-ui',
      colors: {
        primary: customStyles?.primary || '#3b82f6',
        secondary: customStyles?.secondary || '#64748b',
        background: customStyles?.background || '#ffffff',
        surface: customStyles?.surface || '#f8fafc',
        text: customStyles?.text || '#1e293b',
        textMuted: customStyles?.textMuted || '#64748b',
      },
      components: ['nav'],
    },
  };
  
  return themes[theme] || themes.modern;
}

/**
 * Transform page with theme
 */
async function transformPage(
  html: string,
  page: { url: string; title: string },
  theme: ThemeConfig,
  themeName: RemixTheme
): Promise<string> {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  
  // Extract main content
  const mainContent = extractMainContent(document);
  
  // Generate new HTML structure
  const newHtml = generateThemeHtml(page.title, mainContent, theme, themeName);
  
  return newHtml;
}

/**
 * Extract main content from document
 */
function extractMainContent(document: Document): string {
  const selectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.main-content',
    '#content',
    '#main-content',
    '.post',
    '.entry',
    '.post-content',
    'body',
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.innerHTML;
    }
  }
  
  return document.body?.innerHTML || '';
}

/**
 * Generate themed HTML
 */
function generateThemeHtml(title: string, content: string, theme: ThemeConfig, themeName: RemixTheme): string {
  const css = generateThemeCss(theme);
  
  return `<!DOCTYPE html>
<html lang="en" ${theme.darkMode ? 'data-theme="light"' : ''}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="./theme.css">
  <style>${css}</style>
</head>
<body>
  ${generateLayout(content, theme)}
  <script>${generateThemeScript(theme)}</script>
</body>
</html>`;
}

/**
 * Generate theme CSS
 */
function generateThemeCss(theme: ThemeConfig): string {
  return `
:root {
  --color-primary: ${theme.colors.primary};
  --color-secondary: ${theme.colors.secondary};
  --color-bg: ${theme.colors.background};
  --color-surface: ${theme.colors.surface};
  --color-text: ${theme.colors.text};
  --color-text-muted: ${theme.colors.textMuted};
}

${theme.darkMode ? `
[data-theme="dark"] {
  --color-bg: #1a1a2e;
  --color-surface: #16213e;
  --color-text: #eee;
  --color-text-muted: #a0a0a0;
}
` : ''}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: ${getFontStack(theme.typography)};
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.6;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

${generateLayoutCss(theme)}

.content {
  padding: 2rem 0;
}

.content h1, .content h2, .content h3 {
  color: var(--color-primary);
  margin: 1.5rem 0 1rem;
}

.content p {
  margin-bottom: 1rem;
}

.content a {
  color: var(--color-primary);
  text-decoration: none;
}

.content a:hover {
  text-decoration: underline;
}

.content pre {
  background: var(--color-surface);
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
}

.content code {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9em;
}

.content img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}

.content table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.content th, .content td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--color-surface);
  text-align: left;
}

.content th {
  font-weight: 600;
  color: var(--color-primary);
}
`;
}

/**
 * Get font stack
 */
function getFontStack(typography: string): string {
  const fonts: Record<string, string> = {
    'system-ui': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'serif': 'Georgia, "Times New Roman", serif',
    'roboto': '"Roboto", "Helvetica Neue", sans-serif',
  };
  return fonts[typography] || fonts['system-ui'];
}

/**
 * Generate layout CSS
 */
function generateLayoutCss(theme: ThemeConfig): string {
  if (theme.layout === 'docs') {
    return `
.app {
  display: grid;
  grid-template-columns: 280px 1fr;
  min-height: 100vh;
}

.sidebar {
  background: var(--color-surface);
  padding: 1.5rem;
  border-right: 1px solid rgba(0,0,0,0.1);
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.main {
  padding: 2rem;
  max-width: 800px;
}

@media (max-width: 768px) {
  .app {
    grid-template-columns: 1fr;
  }
  .sidebar {
    display: none;
  }
}
`;
  }
  
  return `
.app {
  min-height: 100vh;
}

.header {
  background: var(--color-surface);
  padding: 1rem 0;
  border-bottom: 1px solid rgba(0,0,0,0.1);
}

.main {
  padding: 2rem 0;
}
`;
}

/**
 * Generate layout HTML
 */
function generateLayout(content: string, theme: ThemeConfig): string {
  const nav = theme.components.includes('nav') ? `
    <nav class="nav">
      <div class="container">
        <a href="./" class="nav-brand">Remixed Site</a>
      </div>
    </nav>
  ` : '';
  
  if (theme.layout === 'docs') {
    return `
      <div class="app">
        <aside class="sidebar">
          <div class="sidebar-header">
            <h2>Documentation</h2>
          </div>
          <nav class="sidebar-nav">
            <!-- Sidebar navigation would be generated here -->
          </nav>
        </aside>
        <main class="main">
          ${nav}
          <div class="content">
            ${content}
          </div>
        </main>
      </div>
    `;
  }
  
  return `
    <div class="app">
      <header class="header">
        <div class="container">
          ${nav}
        </div>
      </header>
      <main class="main">
        <div class="container">
          <div class="content">
            ${content}
          </div>
        </div>
      </main>
    </div>
  `;
}

/**
 * Generate theme script
 */
function generateThemeScript(theme: ThemeConfig): string {
  if (!theme.darkMode) return '';
  
  return `
(function() {
  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }
  
  window.toggleTheme = toggleTheme;
})();
`;
}

/**
 * Generate theme assets
 */
async function generateThemeAssets(outputDir: string, theme: RemixTheme): Promise<void> {
  // Generate CSS file
  const cssPath = path.join(outputDir, 'theme.css');
  const themeConfig = loadTheme(theme);
  const css = generateThemeCss(themeConfig);
  await fs.writeFile(cssPath, css);
}

/**
 * Deploy site (placeholder)
 */
async function deploySite(outputDir: string): Promise<string> {
  // In a real implementation, this would deploy to:
  // - GitHub Pages
  // - Vercel
  // - Netlify
  // - Surge.sh
  // etc.
  
  console.log('Deploy functionality would integrate with:');
  console.log('- GitHub Pages');
  console.log('- Vercel');
  console.log('- Netlify');
  console.log('- Surge.sh');
  
  return 'https://example.com/deployed-site';
}

// Theme configuration interface
interface ThemeConfig {
  name: string;
  cssFramework: string;
  layout: 'responsive' | 'single-column' | 'docs' | 'custom';
  darkMode: boolean;
  typography: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
  };
  components: string[];
}
