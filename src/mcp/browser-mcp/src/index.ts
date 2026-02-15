/**
 * Trench Archival Browser - MCP Server
 * 
 * A comprehensive website archiving solution with Playwright.
 * 
 * @example
 * ```typescript
 * import { Archiver, ArchiveAnalyzer, ArchiveReplay } from '@trench/browser-mcp';
 * 
 * // Archive a website
 * const archiver = new Archiver({
 *   url: 'https://example.com',
 *   outputDir: './archive',
 *   fullAssets: true,
 *   captureVideo: true,
 *   captureCanvas: true
 * });
 * await archiver.initialize();
 * const result = await archiver.archive();
 * 
 * // Analyze the archive
 * const analyzer = new ArchiveAnalyzer('./archive');
 * await analyzer.initialize();
 * const analysis = await analyzer.analyze();
 * 
 * // Replay the archive
 * const replay = new ArchiveReplay({
 *   archivePath: './archive',
 *   port: 8080
 * });
 * await replay.initialize();
 * await replay.start();
 * ```
 */

// Core modules
export { Archiver, type ArchiveResult } from './archiver.js';
export { AssetDownloader, type DownloadResult } from './assetDownloader.js';
export { ArchiveStorage } from './storage.js';
export { ArchiveReplay } from './replay.js';
export { ArchiveAnalyzer } from './analyzer.js';
export { TrenchMcpServer } from './mcpServer.js';

// Types
export type {
  ArchiveOptions,
  AssetInfo,
  AssetType,
  PageSnapshot,
  PageMetadata,
  CanvasRecording,
  CanvasFrame,
  VideoRecording,
  VideoSegment,
  ArchiveManifest,
  PageManifest,
  AssetManifest,
  ArchiveStats,
  ReplayOptions,
  NetworkRequest,
  NetworkResponse,
  WarcRecord,
  ExtractionOptions,
  AnalysisResult,
  ProgressEvent,
  ProgressCallback,
} from './types.js';

// Utilities
export {
  sha256,
  generateId,
  getFileExtension,
  getAssetType,
  isValidUrl,
  resolveUrl,
  getDomain,
  isInternalUrl,
  safeFilename,
  formatBytes,
  formatDuration,
  sleep,
  retry,
  createDeferred,
  parseHeaders,
  isTextContent,
  truncate,
  getContentType,
  normalizeUrl,
  extractLinks,
  RateLimiter,
} from './utils.js';

// Version
export const VERSION = '1.0.0';
