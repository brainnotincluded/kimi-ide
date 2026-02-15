/**
 * Site Remix Engine
 * Trench Project
 * 
 * Transform old websites into modern versions
 * 
 * @example
 * ```typescript
 * import { RemixEngine, SiteAnalyzer } from '@trench/remix';
 * 
 * // Analyze a site
 * const analyzer = new SiteAnalyzer();
 * const report = await analyzer.analyzeSite('./old-site', 'https://example.com');
 * 
 * // Remix with modern theme
 * const engine = new RemixEngine({
 *   theme: 'modern-docs',
 *   darkMode: true,
 *   enableSearch: true
 * });
 * 
 * const result = await engine.remixSite('./old-site', pages, './remixed');
 * ```
 */

// Core exports
export { SiteAnalyzer } from './analyzer';
export { ContentExtractor } from './contentExtractor';
export { StructureParser } from './structureParser';
export { RemixEngine } from './remixEngine';
export { ImprovementSuggestions } from './improvementSuggestions';

// Type exports
export type {
  // Analysis types
  DOMStructure,
  HeadingHierarchy,
  ComponentInfo,
  CSSAnalysis,
  MobileAnalysis,
  SEOAnalysis,
  AnalysisReport,
  
  // Content types
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
  ExtractReport,
  
  // Structure types
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
  Tag,
  
  // Remix types
  RemixTheme,
  RemixOptions,
  RemixResult,
  RemixedPage,
  AssetInfo,
  SearchIndexInfo,
  PWAManifest,
  
  // Improvement types
  ImprovementSuggestion,
  BrokenLink,
  MissingMeta,
  ImageOptimization,
  
  // CLI types
  CLIConfig
} from './types';

// Version
export const VERSION = '1.0.0';
