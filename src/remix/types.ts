/**
 * Site Remix Engine - Types
 * Trench Project
 */

// DOM Analysis Types
export interface DOMStructure {
  tag: string;
  id?: string;
  classes: string[];
  children: DOMStructure[];
  depth: number;
  textContent?: string;
}

export interface HeadingHierarchy {
  level: number;
  text: string;
  id?: string;
  children: HeadingHierarchy[];
}

export interface ComponentInfo {
  type: 'navigation' | 'sidebar' | 'content' | 'footer' | 'header' | 'code-block' | 'table' | 'form' | 'search' | 'breadcrumb';
  selector: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface CSSAnalysis {
  totalSelectors: number;
  usedSelectors: number;
  unusedSelectors: string[];
  mediaQueries: string[];
  colorPalette: string[];
  fontFamilies: string[];
  fileSize: number;
}

export interface MobileAnalysis {
  viewportMeta: boolean;
  responsiveImages: boolean;
  touchTargets: { tooSmall: string[]; adequate: string[] };
  fontSizes: { tooSmall: string[]; adequate: string[] };
  score: number;
}

export interface SEOAnalysis {
  title: string;
  description: string;
  keywords: string[];
  ogTags: Record<string, string>;
  twitterTags: Record<string, string>;
  canonicalUrl?: string;
  structuredData: any[];
  score: number;
  issues: string[];
}

// Content Types
export interface ExtractedContent {
  title: string;
  description?: string;
  author?: string;
  publishedDate?: string;
  modifiedDate?: string;
  text: string;
  wordCount: number;
  readingTime: number;
  blocks: ContentBlock[];
  metadata: PageMetadata;
}

export type ContentBlock = 
  | TextBlock 
  | CodeBlock 
  | TableBlock 
  | ImageBlock 
  | HeadingBlock 
  | ListBlock 
  | QuoteBlock;

export interface TextBlock {
  type: 'text';
  content: string;
  format?: 'paragraph' | 'lead' | 'caption';
}

export interface CodeBlock {
  type: 'code';
  language?: string;
  content: string;
  filename?: string;
  lineNumbers?: boolean;
}

export interface TableBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface ImageBlock {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  format?: string;
}

export interface HeadingBlock {
  type: 'heading';
  level: number;
  content: string;
  id?: string;
}

export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: string[];
}

export interface QuoteBlock {
  type: 'quote';
  content: string;
  author?: string;
  source?: string;
}

export interface PageMetadata {
  url: string;
  title: string;
  description?: string;
  keywords?: string[];
  author?: string;
  language?: string;
  robots?: string;
  favicon?: string;
}

// Structure Types
export type PageType = 'landing' | 'docs' | 'blog' | 'api' | 'ecommerce' | 'wiki' | 'unknown';

export interface PageStructure {
  url: string;
  type: PageType;
  confidence: number;
  sections: SectionInfo[];
  navigation: NavLink[];
  relatedPages: RelatedPage[];
  breadcrumbs: BreadcrumbItem[];
}

export interface SectionInfo {
  id: string;
  title: string;
  type: 'hero' | 'features' | 'content' | 'sidebar' | 'footer' | 'cta' | 'testimonials';
  content: string;
}

export interface NavLink {
  text: string;
  url: string;
  active?: boolean;
  children?: NavLink[];
}

export interface RelatedPage {
  url: string;
  title: string;
  relevance: number;
}

export interface BreadcrumbItem {
  text: string;
  url: string;
}

export interface SiteGraph {
  nodes: PageNode[];
  edges: PageEdge[];
}

export interface PageNode {
  id: string;
  url: string;
  title: string;
  type: PageType;
}

export interface PageEdge {
  from: string;
  to: string;
  type: 'link' | 'nav' | 'related';
}

export interface ContentTaxonomy {
  categories: Category[];
  tags: Tag[];
  hierarchy: CategoryHierarchy;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  pageCount: number;
}

export interface Tag {
  id: string;
  name: string;
  pageCount: number;
}

export interface CategoryHierarchy {
  root: string;
  children: Map<string, string[]>;
}

// Remix Types
export type RemixTheme = 'modern-docs' | 'blog' | 'landing' | 'knowledge-base' | 'minimal';

export interface RemixOptions {
  theme: RemixTheme;
  darkMode: boolean | 'auto';
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  enableSearch: boolean;
  searchProvider: 'algolia' | 'lunr' | 'fuse';
  pwa: boolean;
  minify: boolean;
  optimizeImages: boolean;
  modernCSS: boolean;
}

export interface RemixResult {
  outputPath: string;
  pages: RemixedPage[];
  assets: AssetInfo[];
  searchIndex?: SearchIndexInfo;
  pwaManifest?: PWAManifest;
}

export interface RemixedPage {
  originalUrl: string;
  outputPath: string;
  title: string;
  type: PageType;
}

export interface AssetInfo {
  type: 'css' | 'js' | 'image' | 'font';
  originalPath: string;
  outputPath: string;
  optimized: boolean;
  sizeBefore: number;
  sizeAfter: number;
}

export interface SearchIndexInfo {
  provider: string;
  indexPath: string;
  documentCount: number;
}

export interface PWAManifest {
  name: string;
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  icons: PWAIcon[];
}

export interface PWAIcon {
  src: string;
  sizes: string;
  type: string;
}

// Improvement Types
export interface ImprovementSuggestion {
  type: 'seo' | 'accessibility' | 'performance' | 'ux' | 'security';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  autoFixable: boolean;
  fix?: () => Promise<void>;
}

export interface BrokenLink {
  url: string;
  foundOn: string;
  statusCode?: number;
  error?: string;
}

export interface MissingMeta {
  type: 'title' | 'description' | 'viewport' | 'charset' | 'og:title' | 'og:description' | 'twitter:card';
  page: string;
  suggestion?: string;
}

export interface ImageOptimization {
  original: string;
  optimized: string;
  format: string;
  savings: number;
  percent: number;
}

// CLI Types
export interface CLIConfig {
  inputPath: string;
  outputPath: string;
  verbose: boolean;
  dryRun: boolean;
}

export interface AnalysisReport {
  siteName: string;
  url: string;
  timestamp: string;
  summary: {
    totalPages: number;
    totalIssues: number;
    criticalIssues: number;
    warnings: number;
    score: number;
  };
  domAnalysis: {
    structure: DOMStructure;
    headings: HeadingHierarchy[];
    components: ComponentInfo[];
  };
  contentAnalysis: {
    totalWords: number;
    avgReadingTime: number;
    contentTypes: Record<string, number>;
  };
  cssAnalysis: CSSAnalysis;
  mobileAnalysis: MobileAnalysis;
  seoAnalysis: SEOAnalysis;
  issues: ImprovementSuggestion[];
}

export interface ExtractReport {
  timestamp: string;
  sourcePath: string;
  outputPath: string;
  pages: ExtractedContent[];
  totalBlocks: number;
  codeBlocks: number;
  tables: number;
  images: number;
}
