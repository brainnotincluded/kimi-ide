/**
 * Type definitions for Trench Archival Browser
 */

export interface ArchiveOptions {
  /** Target URL to archive */
  url: string;
  /** Output directory for the archive */
  outputDir: string;
  /** Include full assets (images, videos, etc.) */
  fullAssets?: boolean;
  /** Capture video streams */
  captureVideo?: boolean;
  /** Capture canvas/WebGL animations */
  captureCanvas?: boolean;
  /** Maximum depth for crawling */
  maxDepth?: number;
  /** Maximum number of pages to archive */
  maxPages?: number;
  /** Browser viewport width */
  viewportWidth?: number;
  /** Browser viewport height */
  viewportHeight?: number;
  /** User agent string */
  userAgent?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Number of concurrent downloads */
  concurrency?: number;
  /** Wait for lazy loading (ms) */
  lazyLoadWait?: number;
  /** Scroll to trigger lazy loading */
  triggerLazyLoad?: boolean;
  /** Click pagination links */
  followPagination?: boolean;
  /** Authentication credentials */
  auth?: {
    username: string;
    password: string;
  };
  /** Headers to add to requests */
  headers?: Record<string, string>;
  /** Cookies to set */
  cookies?: Array<{ name: string; value: string; domain?: string }>;
  /** Block these resource types */
  blockResources?: string[];
  /** Archive format: 'warc' | 'trench' */
  format?: 'warc' | 'trench';
  /** Enable deduplication */
  deduplicate?: boolean;
  /** Resume interrupted downloads */
  resume?: boolean;
  /** Compression level (0-9) */
  compressionLevel?: number;
}

export interface AssetInfo {
  url: string;
  type: AssetType;
  mimeType: string;
  size: number;
  data?: Buffer;
  path?: string;
  hash?: string;
  timestamp: Date;
  statusCode: number;
  headers: Record<string, string>;
  referrer?: string;
}

export type AssetType = 
  | 'document'
  | 'stylesheet'
  | 'script'
  | 'image'
  | 'font'
  | 'video'
  | 'audio'
  | 'webgl'
  | 'wasm'
  | 'worker'
  | 'websocket'
  | 'xhr'
  | 'other';

export interface PageSnapshot {
  url: string;
  title: string;
  html: string;
  renderedHtml: string;
  timestamp: Date;
  assets: AssetInfo[];
  metadata: PageMetadata;
  canvasRecordings?: CanvasRecording[];
  videoRecordings?: VideoRecording[];
}

export interface PageMetadata {
  title: string;
  description?: string;
  author?: string;
  keywords?: string[];
  ogTags: Record<string, string>;
  twitterTags: Record<string, string>;
  canonicalUrl?: string;
  language?: string;
  charset?: string;
  viewport?: string;
  favicon?: string;
  links: Array<{ rel: string; href: string; type?: string }>;
  scripts: Array<{ src?: string; inline?: boolean; type?: string }>;
  stylesheets: Array<{ href: string; media?: string }>;
  images: Array<{ src: string; alt?: string; width?: number; height?: number }>;
  videos: Array<{ src: string; type?: string; width?: number; height?: number }>;
}

export interface CanvasRecording {
  id: string;
  element: string;
  frames: CanvasFrame[];
  fps: number;
  width: number;
  height: number;
  duration: number;
  format: 'png-sequence' | 'webm' | 'gif';
}

export interface CanvasFrame {
  timestamp: number;
  dataUrl: string;
  index: number;
}

export interface VideoRecording {
  id: string;
  url: string;
  type: 'stream' | 'file';
  format: string;
  segments: VideoSegment[];
  duration: number;
}

export interface VideoSegment {
  index: number;
  url: string;
  duration: number;
  data?: Buffer;
}

export interface ArchiveManifest {
  version: string;
  created: Date;
  url: string;
  options: ArchiveOptions;
  pages: PageManifest[];
  assets: AssetManifest[];
  stats: ArchiveStats;
}

export interface PageManifest {
  id: string;
  url: string;
  title: string;
  timestamp: Date;
  path: string;
  assetCount: number;
  size: number;
}

export interface AssetManifest {
  id: string;
  url: string;
  type: AssetType;
  mimeType: string;
  path: string;
  size: number;
  hash: string;
  pages: string[];
  deduplicated: boolean;
  statusCode?: number;
}

export interface ArchiveStats {
  totalPages: number;
  totalAssets: number;
  totalSize: number;
  uniqueAssets: number;
  deduplicatedAssets: number;
  duration: number;
  errors: number;
}

export interface ReplayOptions {
  archivePath: string;
  port?: number;
  host?: string;
  rewriteUrls?: boolean;
  injectScripts?: string[];
  enablePywb?: boolean;
  pywbPort?: number;
}

export interface NetworkRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  timestamp: Date;
  resourceType: string;
}

export interface NetworkResponse {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: Buffer;
  timestamp: Date;
  timing?: {
    start: number;
    end: number;
    dns?: number;
    connect?: number;
    ssl?: number;
    send?: number;
    wait?: number;
    receive?: number;
  };
}

export interface WarcRecord {
  version: string;
  recordId: string;
  type: 'warcinfo' | 'request' | 'response' | 'resource' | 'metadata' | 'revisit' | 'conversion' | 'continuation';
  date: Date;
  contentLength: number;
  contentType: string;
  targetUri?: string;
  payload?: Buffer;
  blockDigest?: string;
  payloadDigest?: string;
  ipAddress?: string;
  refersTo?: string;
  concurrentTo?: string;
  warcinfoId?: string;
  filename?: string;
  profile?: string;
  identifiedPayloadType?: string;
  truncated?: string;
}

export interface ExtractionOptions {
  archivePath: string;
  outputDir?: string;
  includeAssets?: boolean;
  includeMetadata?: boolean;
  includeCanvas?: boolean;
  includeVideo?: boolean;
  format?: 'html' | 'json' | 'csv';
  filter?: {
    assetTypes?: AssetType[];
    dateRange?: { start: Date; end: Date };
    urlPattern?: RegExp;
  };
}

export interface AnalysisResult {
  summary: {
    totalPages: number;
    totalAssets: number;
    totalSize: number;
    duration: number;
  };
  assetBreakdown: Record<AssetType, { count: number; size: number }>;
  technologies: string[];
  externalDomains: string[];
  brokenLinks: Array<{ url: string; status: number; page: string }>;
  performance: {
    averageLoadTime: number;
    largestAssets: Array<{ url: string; size: number; type: AssetType }>;
    slowestPages: Array<{ url: string; loadTime: number }>;
  };
  seo: {
    missingTitles: number;
    missingDescriptions: number;
    missingAltTags: number;
    averageContentLength: number;
  };
  security: {
    httpsPercentage: number;
    insecureResources: string[];
    cookies: Array<{ name: string; secure: boolean; httpOnly: boolean }>;
  };
}

export interface ProgressEvent {
  type: 'page' | 'asset' | 'video' | 'canvas' | 'error' | 'complete';
  current: number;
  total: number;
  url?: string;
  message?: string;
  error?: Error;
  stats?: Partial<ArchiveStats>;
}

export type ProgressCallback = (event: ProgressEvent) => void | Promise<void>;
