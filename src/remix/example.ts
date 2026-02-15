/**
 * Site Remix Engine - Usage Examples
 * 
 * This file demonstrates how to use the Remix Engine programmatically.
 * For CLI usage, see the README.md
 */

import { SiteAnalyzer } from './analyzer';
import { ContentExtractor } from './contentExtractor';
import { StructureParser } from './structureParser';
import { RemixEngine } from './remixEngine';
import { ImprovementSuggestions } from './improvementSuggestions';

// Example 1: Basic Analysis
async function analyzeWebsite(sitePath: string, url: string) {
  const analyzer = new SiteAnalyzer();
  
  console.log('Analyzing website...');
  const report = await analyzer.analyzeSite(sitePath, url);
  
  console.log('\n=== Analysis Results ===');
  console.log(`Site: ${report.siteName}`);
  console.log(`Score: ${report.summary.score}/100`);
  console.log(`Pages: ${report.summary.totalPages}`);
  console.log(`Issues: ${report.summary.totalIssues}`);
  
  console.log('\n=== Content Types ===');
  Object.entries(report.contentAnalysis.contentTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  console.log('\n=== Top Issues ===');
  report.issues.slice(0, 5).forEach(issue => {
    console.log(`[${issue.severity.toUpperCase()}] ${issue.title}`);
    console.log(`  ${issue.description}`);
    console.log(`  Auto-fixable: ${issue.autoFixable ? 'Yes' : 'No'}`);
  });
  
  return report;
}

// Example 2: Content Extraction
async function extractContent(sitePath: string) {
  const extractor = new ContentExtractor();
  
  console.log('Extracting content...');
  const report = await extractor.extractSite(sitePath, {
    includePattern: /\.html$/,
    excludePattern: /404|error/
  });
  
  console.log('\n=== Extraction Results ===');
  console.log(`Pages extracted: ${report.pages.length}`);
  console.log(`Total blocks: ${report.totalBlocks}`);
  console.log(`Code blocks: ${report.codeBlocks}`);
  console.log(`Tables: ${report.tables}`);
  console.log(`Images: ${report.images}`);
  console.log(`Output: ${report.outputPath}`);
  
  return report;
}

// Example 3: Structure Parsing
async function parseStructure(sitePath: string, baseUrl: string) {
  const parser = new StructureParser();
  
  console.log('Parsing site structure...');
  const { pages, graph, taxonomy } = await parser.parseSite(sitePath, baseUrl);
  
  console.log('\n=== Structure Results ===');
  console.log(`Total pages: ${pages.length}`);
  
  // Count by type
  const typeCounts = pages.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\nPage types:');
  Object.entries(typeCounts).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  console.log('\nCategories:');
  taxonomy.categories.slice(0, 5).forEach(cat => {
    console.log(`  ${cat.name} (${cat.pageCount} pages)`);
  });
  
  return { pages, graph, taxonomy };
}

// Example 4: Full Remix
async function remixWebsite(
  inputPath: string,
  outputPath: string,
  options: {
    theme?: 'modern-docs' | 'blog' | 'landing' | 'knowledge-base' | 'minimal';
    primaryColor?: string;
    enableSearch?: boolean;
    darkMode?: boolean;
  } = {}
) {
  console.log('🎨 Starting website remix...\n');
  
  // Step 1: Analyze
  console.log('Step 1: Analyzing...');
  const analyzer = new SiteAnalyzer();
  const analysis = await analyzer.analyzeSite(inputPath, 'https://example.com');
  console.log(`  Score: ${analysis.summary.score}/100`);
  
  // Step 2: Parse Structure
  console.log('Step 2: Parsing structure...');
  const parser = new StructureParser();
  const { pages: pageStructures } = await parser.parseSite(inputPath, 'https://example.com');
  console.log(`  Found ${pageStructures.length} pages`);
  
  // Step 3: Extract Content
  console.log('Step 3: Extracting content...');
  const extractor = new ContentExtractor();
  const pages = [];
  
  for (const structure of pageStructures) {
    // In real usage, you'd map the URL to the actual file path
    const htmlPath = `${inputPath}/index.html`;
    extractor.loadFromFile(htmlPath);
    const content = extractor.extract();
    pages.push({ structure, content });
  }
  console.log(`  Extracted ${pages.length} pages`);
  
  // Step 4: Apply Improvements
  console.log('Step 4: Checking for improvements...');
  const improver = new ImprovementSuggestions(inputPath);
  improver.loadReport(analysis);
  const { autoFixable } = await improver.generateSuggestions();
  console.log(`  ${autoFixable.length} auto-fixable issues found`);
  
  if (autoFixable.length > 0) {
    console.log('  Applying fixes...');
    await improver.applyAutoFixes();
  }
  
  // Step 5: Remix
  console.log('Step 5: Remixing with theme...');
  const engine = new RemixEngine({
    theme: options.theme || 'modern-docs',
    darkMode: options.darkMode ?? true,
    primaryColor: options.primaryColor,
    enableSearch: options.enableSearch ?? true,
    searchProvider: 'fuse',
    pwa: true,
    minify: true,
    optimizeImages: true
  });
  
  const result = await engine.remixSite(inputPath, pages, outputPath);
  
  console.log('\n✅ Remix complete!');
  console.log(`Output: ${result.outputPath}`);
  console.log(`Pages: ${result.pages.length}`);
  console.log(`Assets: ${result.assets.length}`);
  
  if (result.searchIndex) {
    console.log(`Search index: ${result.searchIndex.documentCount} documents`);
  }
  
  return result;
}

// Example 5: Theme Comparison
async function compareThemes(sitePath: string, outputDir: string) {
  const themes: Array<'modern-docs' | 'blog' | 'landing' | 'knowledge-base' | 'minimal'> = [
    'modern-docs',
    'blog',
    'landing'
  ];
  
  const extractor = new ContentExtractor();
  extractor.loadFromFile(`${sitePath}/index.html`);
  const content = extractor.extract();
  
  // Mock structure for demo
  const mockStructure = {
    url: 'https://example.com/',
    type: 'docs' as const,
    confidence: 1,
    sections: [],
    navigation: [],
    relatedPages: [],
    breadcrumbs: []
  };
  
  const results = [];
  
  for (const theme of themes) {
    const themeOutput = `${outputDir}/${theme}`;
    const engine = new RemixEngine({ theme });
    
    const result = await engine.remixSite(sitePath, [
      { structure: mockStructure, content }
    ], themeOutput);
    
    results.push({ theme, path: themeOutput });
    console.log(`Generated ${theme} theme at ${themeOutput}`);
  }
  
  return results;
}

// Example 6: Custom Analysis Pipeline
async function customPipeline(sitePath: string) {
  const analyzer = new SiteAnalyzer();
  const extractor = new ContentExtractor();
  
  // Load and analyze
  analyzer.loadFromFile(`${sitePath}/index.html`);
  
  // Get specific analyses
  const domStructure = analyzer.analyzeDOMStructure();
  const headings = analyzer.extractHeadingHierarchy();
  const components = analyzer.detectComponents();
  const cssAnalysis = analyzer.analyzeCSS();
  const mobileScore = analyzer.analyzeMobileFriendliness();
  const seoScore = analyzer.analyzeSEO();
  
  console.log('\n=== Custom Analysis ===');
  console.log(`DOM depth: ${domStructure.depth}`);
  console.log(`Headings: ${headings.length}`);
  console.log(`Components found: ${components.length}`);
  console.log(`CSS selectors: ${cssAnalysis.totalSelectors} (${cssAnalysis.usedSelectors} used)`);
  console.log(`Mobile score: ${mobileScore.score}/100`);
  console.log(`SEO score: ${seoScore.score}/100`);
  
  // Extract specific content types
  extractor.loadFromFile(`${sitePath}/index.html`);
  const codeBlocks = extractor.extractCodeBlocks();
  const tables = extractor.extractTables();
  const images = extractor.extractImages();
  const links = extractor.extractLinks();
  
  console.log('\n=== Content Extraction ===');
  console.log(`Code blocks: ${codeBlocks.length}`);
  console.log(`Tables: ${tables.length}`);
  console.log(`Images: ${images.length}`);
  console.log(`Links: ${links.length}`);
  
  return {
    analysis: {
      dom: domStructure,
      headings,
      components,
      css: cssAnalysis,
      mobile: mobileScore,
      seo: seoScore
    },
    content: {
      codeBlocks,
      tables,
      images,
      links
    }
  };
}

// Run examples (uncomment to execute)
// analyzeWebsite('./test-site', 'https://example.com');
// extractContent('./test-site');
// parseStructure('./test-site', 'https://example.com');
// remixWebsite('./test-site', './output', { theme: 'modern-docs', primaryColor: '#3b82f6' });
// compareThemes('./test-site', './theme-comparison');
// customPipeline('./test-site');

export {
  analyzeWebsite,
  extractContent,
  parseStructure,
  remixWebsite,
  compareThemes,
  customPipeline
};
