/**
 * Trench CLI - Analyze Command
 * Website analysis (structure, content, tech stack)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { JSDOM } from 'jsdom';
import type { 
  AnalysisOptions, 
  AnalysisResult, 
  SiteStructure, 
  ContentAnalysis, 
  TechStack,
  SiteScores 
} from '../types/index.js';

/**
 * Analyze website or archive
 */
export async function analyze(options: AnalysisOptions): Promise<AnalysisResult> {
  // Determine if target is URL or local archive
  const isLocal = !options.target.startsWith('http');
  
  let html: string;
  let baseUrl: string;
  
  if (isLocal) {
    // Load from archive
    const indexPath = path.join(options.target, 'index.html');
    html = await fs.readFile(indexPath, 'utf-8');
    
    // Get base URL from manifest
    const manifestPath = path.join(options.target, 'manifest.json');
    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
      baseUrl = manifest.rootUrl;
    } catch {
      baseUrl = 'file://' + options.target;
    }
  } else {
    // Fetch from URL
    const response = await fetch(options.target);
    html = await response.text();
    baseUrl = options.target;
  }
  
  const dom = new JSDOM(html, { url: baseUrl });
  const document = dom.window.document;
  
  // Perform analysis based on type
  let structure: SiteStructure | undefined;
  let content: ContentAnalysis | undefined;
  let tech: TechStack | undefined;
  
  if (options.type === 'structure' || options.type === 'full') {
    structure = analyzeStructure(document, baseUrl, options.target);
  }
  
  if (options.type === 'content' || options.type === 'full') {
    content = analyzeContent(document);
  }
  
  if (options.type === 'tech' || options.type === 'full') {
    tech = analyzeTechStack(document, html);
  }
  
  const scores = calculateScores(structure, content, tech);
  const recommendations = generateRecommendations(structure, content, tech);
  
  return {
    target: options.target,
    type: options.type,
    structure,
    content,
    tech,
    scores,
    recommendations,
  };
}

/**
 * Analyze site structure
 */
function analyzeStructure(document: Document, baseUrl: string, target: string): SiteStructure {
  const links = Array.from(document.querySelectorAll('a[href]'));
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  
  for (const link of links) {
    const href = link.getAttribute('href');
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      try {
        const url = new URL(href, baseUrl);
        if (url.hostname === new URL(baseUrl).hostname) {
          internalLinks.push(url.href);
        } else {
          externalLinks.push(url.href);
        }
      } catch {
        // Invalid URL
      }
    }
  }
  
  return {
    pages: 1, // Would need to crawl for actual count
    depth: estimateDepth(internalLinks),
    internalLinks: internalLinks.length,
    externalLinks: externalLinks.length,
    brokenLinks: [], // Would need to validate each link
  };
}

/**
 * Estimate site depth from links
 */
function estimateDepth(links: string[]): number {
  const depths = links.map(link => {
    const url = new URL(link);
    return url.pathname.split('/').filter(Boolean).length;
  });
  
  return depths.length > 0 ? Math.max(...depths) : 1;
}

/**
 * Analyze content
 */
function analyzeContent(document: Document): ContentAnalysis {
  const bodyText = document.body?.textContent || '';
  const words = bodyText.trim().split(/\s+/).filter(w => w.length > 0);
  
  // Extract headings
  const h1s = document.querySelectorAll('h1');
  const h2s = document.querySelectorAll('h2');
  const h3s = document.querySelectorAll('h3');
  const h4s = document.querySelectorAll('h4');
  
  const headings: string[] = [];
  for (const h of [...h1s, ...h2s, ...h3s]) {
    headings.push(h.textContent?.trim() || '');
  }
  
  // Extract images
  const images = Array.from(document.querySelectorAll('img'));
  const imageAnalysis = images.map(img => ({
    url: img.src || '',
    alt: img.alt || '',
    hasAlt: !!img.alt,
  }));
  
  // Calculate keyword frequency
  const wordFreq = calculateWordFrequency(words);
  const topKeywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => ({
      keyword,
      count,
      density: words.length > 0 ? (count / words.length) * 100 : 0,
    }));
  
  return {
    wordCount: words.length,
    readabilityScore: calculateReadability(words),
    topKeywords,
    headings: {
      h1: h1s.length,
      h2: h2s.length,
      h3: h3s.length,
      h4: h4s.length,
      hierarchy: headings.filter(Boolean),
    },
    images: imageAnalysis,
  };
}

/**
 * Calculate word frequency
 */
function calculateWordFrequency(words: string[]): Record<string, number> {
  const freq: Record<string, number> = {};
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'and', 'but', 'or', 'yet', 'so', 'if', 'because', 'although', 'though', 'while', 'where', 'when', 'that', 'which', 'who', 'whom', 'whose', 'what', 'this', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
  
  for (const word of words) {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    if (clean.length > 3 && !stopWords.has(clean)) {
      freq[clean] = (freq[clean] || 0) + 1;
    }
  }
  
  return freq;
}

/**
 * Calculate readability score (simplified Flesch-Kincaid)
 */
function calculateReadability(words: string[]): number {
  if (words.length === 0) return 0;
  
  const sentences = words.join(' ').split(/[.!?]+/).filter(s => s.trim().length > 0);
  const syllables = words.reduce((acc, word) => acc + countSyllables(word), 0);
  
  if (sentences.length === 0) return 0;
  
  const avgSentenceLength = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;
  
  // Flesch Reading Ease score
  const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Count syllables in word
 */
function countSyllables(word: string): number {
  const matches = word.toLowerCase().match(/[aeiouy]+/g);
  return matches ? matches.length : 1;
}

/**
 * Analyze tech stack
 */
function analyzeTechStack(document: Document, html: string): TechStack {
  const frameworks: string[] = [];
  const libraries: string[] = [];
  const analytics: string[] = [];
  
  // Check for frameworks
  if (html.includes('data-reactroot') || html.includes('data-reactid') || html.includes('__REACT__')) {
    frameworks.push('React');
  }
  if (html.includes('ng-') || html.includes('_nghost') || html.includes('_ngcontent')) {
    frameworks.push('Angular');
  }
  if (html.includes('vue') || html.includes('v-') || html.includes('data-v-')) {
    frameworks.push('Vue.js');
  }
  if (html.includes('next') || html.includes('__NEXT_DATA__')) {
    frameworks.push('Next.js');
  }
  if (html.includes('nuxt') || html.includes('__NUXT__')) {
    frameworks.push('Nuxt.js');
  }
  if (document.querySelector('[data-svelte]') || html.includes('svelte')) {
    frameworks.push('Svelte');
  }
  
  // Check for CSS frameworks
  if (html.includes('bootstrap')) {
    libraries.push('Bootstrap');
  }
  if (html.includes('tailwind')) {
    libraries.push('Tailwind CSS');
  }
  if (html.includes('bulma')) {
    libraries.push('Bulma');
  }
  
  // Check for analytics
  if (html.includes('google-analytics') || html.includes('gtag') || html.includes('ga(')) {
    analytics.push('Google Analytics');
  }
  if (html.includes('gtm-') || html.includes('googletagmanager')) {
    analytics.push('Google Tag Manager');
  }
  if (html.includes('mixpanel')) {
    analytics.push('Mixpanel');
  }
  if (html.includes('amplitude')) {
    analytics.push('Amplitude');
  }
  
  // Check for CDN
  const cdns: string[] = [];
  if (html.includes('cdnjs.cloudflare.com')) cdns.push('Cloudflare CDN');
  if (html.includes('unpkg.com')) cdns.push('unpkg');
  if (html.includes('jsdelivr.net')) cdns.push('jsDelivr');
  if (html.includes('cdn.jsdelivr.net')) cdns.push('JSDelivr');
  
  // Check for server
  let server: string | undefined;
  // This would need response headers in real implementation
  
  return {
    frameworks,
    libraries,
    analytics,
    cdn: cdns,
    server,
  };
}

/**
 * Calculate scores
 */
function calculateScores(
  structure?: SiteStructure,
  content?: ContentAnalysis,
  tech?: TechStack
): SiteScores {
  const scores: SiteScores = {
    seo: 50,
    performance: 50,
    accessibility: 50,
    bestPractices: 50,
  };
  
  // SEO scoring
  if (content) {
    if (content.headings.h1 === 1) scores.seo += 10;
    if (content.headings.h2 > 0) scores.seo += 5;
    if (content.wordCount > 300) scores.seo += 10;
    if (content.images.every(img => img.hasAlt)) scores.seo += 10;
  }
  
  // Accessibility scoring
  if (content) {
    if (content.images.every(img => img.hasAlt)) scores.accessibility += 25;
    if (content.headings.h1 > 0) scores.accessibility += 10;
  }
  
  // Best practices scoring
  if (tech) {
    if (tech.analytics.length > 0) scores.bestPractices += 10;
    if (tech.frameworks.length > 0) scores.bestPractices += 10;
  }
  
  // Cap scores
  return {
    seo: Math.min(100, scores.seo),
    performance: Math.min(100, scores.performance),
    accessibility: Math.min(100, scores.accessibility),
    bestPractices: Math.min(100, scores.bestPractices),
  };
}

/**
 * Generate recommendations
 */
function generateRecommendations(
  structure?: SiteStructure,
  content?: ContentAnalysis,
  tech?: TechStack
): string[] {
  const recommendations: string[] = [];
  
  if (content) {
    if (content.headings.h1 === 0) {
      recommendations.push('Add an H1 heading to improve SEO');
    } else if (content.headings.h1 > 1) {
      recommendations.push('Use only one H1 heading per page');
    }
    
    if (content.images.some(img => !img.hasAlt)) {
      recommendations.push('Add alt text to all images for better accessibility');
    }
    
    if (content.wordCount < 300) {
      recommendations.push('Consider adding more content (aim for 300+ words)');
    }
  }
  
  if (structure) {
    if (structure.brokenLinks.length > 0) {
      recommendations.push(`Fix ${structure.brokenLinks.length} broken links`);
    }
  }
  
  if (tech) {
    if (tech.analytics.length === 0) {
      recommendations.push('Consider adding analytics tracking');
    }
  }
  
  return recommendations;
}
