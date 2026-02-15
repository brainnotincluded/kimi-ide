/**
 * Storage module for Trench Archival Browser
 * 
 * Supports:
 * - WARC format (Web ARChive - standard)
 * - Custom Trench format (HTML + assets + metadata.json)
 * - Compression
 * - Deduplication
 */

import { promises as fs, createWriteStream, createReadStream } from 'fs';
import path from 'path';
import { createGzip, createGunzip, Gzip } from 'zlib';
import { createHash } from 'crypto';
import tar from 'tar';
import type {
  ArchiveManifest,
  ArchiveOptions,
  AssetInfo,
  AssetManifest,
  AssetType,
  PageManifest,
  PageSnapshot,
  WarcRecord,
  ArchiveStats
} from './types.js';
import { sha256, generateId, formatBytes, sleep } from './utils.js';

const TRENCH_VERSION = '1.0.0';

export class ArchiveStorage {
  private options: ArchiveOptions;
  private outputDir: string;
  private manifest: ArchiveManifest;
  private deduplicationMap = new Map<string, string>(); // hash -> asset path

  constructor(options: ArchiveOptions) {
    this.options = {
      format: 'trench',
      deduplicate: true,
      compressionLevel: 6,
      ...options
    };
    this.outputDir = options.outputDir;
    this.manifest = this.createInitialManifest();
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
    
    if (this.options.format === 'trench') {
      // Create directory structure
      await fs.mkdir(path.join(this.outputDir, 'pages'), { recursive: true });
      await fs.mkdir(path.join(this.outputDir, 'assets'), { recursive: true });
      await fs.mkdir(path.join(this.outputDir, 'metadata'), { recursive: true });
    }
  }

  async savePage(page: PageSnapshot, pageId: string): Promise<PageManifest> {
    const pageDir = path.join(this.outputDir, 'pages', pageId);
    await fs.mkdir(pageDir, { recursive: true });

    // Save HTML content
    const htmlPath = path.join(pageDir, 'index.html');
    await fs.writeFile(htmlPath, page.renderedHtml, 'utf-8');

    // Save original HTML if different
    if (page.html !== page.renderedHtml) {
      await fs.writeFile(path.join(pageDir, 'original.html'), page.html, 'utf-8');
    }

    // Save metadata
    const metadataPath = path.join(pageDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(page.metadata, null, 2), 'utf-8');

    // Save canvas recordings if any
    if (page.canvasRecordings && page.canvasRecordings.length > 0) {
      const canvasDir = path.join(pageDir, 'canvas');
      await fs.mkdir(canvasDir, { recursive: true });
      
      for (const recording of page.canvasRecordings) {
        await this.saveCanvasRecording(recording, canvasDir);
      }
    }

    // Save video recordings if any
    if (page.videoRecordings && page.videoRecordings.length > 0) {
      const videoDir = path.join(pageDir, 'videos');
      await fs.mkdir(videoDir, { recursive: true });
      
      for (const recording of page.videoRecordings) {
        await this.saveVideoRecording(recording, videoDir);
      }
    }

    const pageManifest: PageManifest = {
      id: pageId,
      url: page.url,
      title: page.title,
      timestamp: page.timestamp,
      path: path.join('pages', pageId),
      assetCount: page.assets.length,
      size: Buffer.byteLength(page.renderedHtml, 'utf-8')
    };

    this.manifest.pages.push(pageManifest);
    return pageManifest;
  }

  async saveAsset(asset: AssetInfo, pageIds: string[]): Promise<AssetManifest> {
    if (!asset.path) {
      throw new Error('Asset path is required');
    }

    // Check for deduplication
    let deduplicated = false;
    let finalPath = asset.path;

    if (this.options.deduplicate && asset.hash) {
      if (this.deduplicationMap.has(asset.hash)) {
        // Asset already exists, use existing path
        finalPath = this.deduplicationMap.get(asset.hash)!;
        deduplicated = true;
      } else {
        // First time seeing this asset
        this.deduplicationMap.set(asset.hash, asset.path);
      }
    }

    const assetManifest: AssetManifest = {
      id: generateId(),
      url: asset.url,
      type: asset.type,
      mimeType: asset.mimeType,
      path: finalPath,
      size: asset.size,
      hash: asset.hash || sha256(asset.url),
      pages: pageIds,
      deduplicated
    };

    this.manifest.assets.push(assetManifest);
    return assetManifest;
  }

  async finalize(stats: ArchiveStats): Promise<string> {
    this.manifest.stats = stats;
    this.manifest.created = new Date();

    if (this.options.format === 'warc') {
      return this.saveAsWarc();
    } else {
      return this.saveAsTrench();
    }
  }

  private async saveAsTrench(): Promise<string> {
    // Save manifest
    const manifestPath = path.join(this.outputDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(this.manifest, null, 2), 'utf-8');

    // Create index.html for browsing
    const indexHtml = this.generateIndexHtml();
    await fs.writeFile(path.join(this.outputDir, 'index.html'), indexHtml, 'utf-8');

    // Compress if requested
    if (this.options.compressionLevel && this.options.compressionLevel > 0) {
      const tarPath = await this.createTarArchive();
      return tarPath;
    }

    return this.outputDir;
  }

  private async saveAsWarc(): Promise<string> {
    const warcPath = path.join(this.outputDir, 'archive.warc');
    const warcStream = createWriteStream(warcPath);

    try {
      // Write WARC info record
      const warcInfo = this.createWarcInfoRecord();
      await this.writeWarcRecord(warcStream, warcInfo);

      // Write request/response pairs for each page
      for (const page of this.manifest.pages) {
        const pagePath = path.join(this.outputDir, page.path, 'index.html');
        
        if (await this.fileExists(pagePath)) {
          const content = await fs.readFile(pagePath);
          
          // Write request record
          const requestRecord = this.createWarcRequestRecord(page.url);
          await this.writeWarcRecord(warcStream, requestRecord);

          // Write response record
          const responseRecord = this.createWarcResponseRecord(page.url, content, 'text/html');
          await this.writeWarcRecord(warcStream, responseRecord);
        }
      }

      // Write assets as resource records
      for (const asset of this.manifest.assets) {
        if (asset.deduplicated) continue;

        const assetPath = path.join(this.outputDir, asset.path);
        
        if (await this.fileExists(assetPath)) {
          const content = await fs.readFile(assetPath);
          const resourceRecord = this.createWarcResourceRecord(
            asset.url,
            content,
            asset.mimeType
          );
          await this.writeWarcRecord(warcStream, resourceRecord);
        }
      }

      // Compress if requested
      if (this.options.compressionLevel && this.options.compressionLevel > 0) {
        const compressedPath = await this.compressWarc(warcPath);
        return compressedPath;
      }

      return warcPath;
    } finally {
      warcStream.end();
    }
  }

  private createWarcInfoRecord(): WarcRecord {
    const warcInfo = `software: Trench Archival Browser ${TRENCH_VERSION}
format: WARC File Format 1.1
conformsTo: http://iipc.github.io/warc-specifications/specifications/warc-format/warc-1.1/
created: ${new Date().toISOString()}
`;
    
    return {
      version: 'WARC/1.1',
      recordId: this.generateWarcId(),
      type: 'warcinfo',
      date: new Date(),
      contentLength: Buffer.byteLength(warcInfo),
      contentType: 'application/warc-fields',
      payload: Buffer.from(warcInfo),
      filename: 'archive.warc'
    };
  }

  private createWarcRequestRecord(url: string): WarcRecord {
    const request = `GET ${url} HTTP/1.1
Host: ${new URL(url).hostname}
User-Agent: Trench Archival Browser/${TRENCH_VERSION}
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
`;

    return {
      version: 'WARC/1.1',
      recordId: this.generateWarcId(),
      type: 'request',
      date: new Date(),
      contentLength: Buffer.byteLength(request),
      contentType: 'application/http; msgtype=request',
      targetUri: url,
      payload: Buffer.from(request)
    };
  }

  private createWarcResponseRecord(url: string, content: Buffer, contentType: string): WarcRecord {
    const headers = `HTTP/1.1 200 OK
Content-Type: ${contentType}
Content-Length: ${content.length}
Date: ${new Date().toUTCString()}

`;
    const payload = Buffer.concat([Buffer.from(headers), content]);

    return {
      version: 'WARC/1.1',
      recordId: this.generateWarcId(),
      type: 'response',
      date: new Date(),
      contentLength: payload.length,
      contentType: 'application/http; msgtype=response',
      targetUri: url,
      payload,
      payloadDigest: `sha256:${sha256(content)}`
    };
  }

  private createWarcResourceRecord(url: string, content: Buffer, contentType: string): WarcRecord {
    return {
      version: 'WARC/1.1',
      recordId: this.generateWarcId(),
      type: 'resource',
      date: new Date(),
      contentLength: content.length,
      contentType: contentType,
      targetUri: url,
      payload: content,
      payloadDigest: `sha256:${sha256(content)}`
    };
  }

  private async writeWarcRecord(stream: ReturnType<typeof createWriteStream>, record: WarcRecord): Promise<void> {
    const lines = [
      record.version,
      `WARC-Type: ${record.type}`,
      `WARC-Record-ID: <urn:uuid:${record.recordId}>`,
      `WARC-Date: ${record.date.toISOString()}`,
      `Content-Length: ${record.contentLength}`,
      `Content-Type: ${record.contentType}`,
    ];

    if (record.targetUri) {
      lines.push(`WARC-Target-URI: ${record.targetUri}`);
    }

    if (record.filename) {
      lines.push(`WARC-Filename: ${record.filename}`);
    }

    if (record.payloadDigest) {
      lines.push(`WARC-Payload-Digest: ${record.payloadDigest}`);
    }

    if (record.blockDigest) {
      lines.push(`WARC-Block-Digest: ${record.blockDigest}`);
    }

    lines.push('');
    lines.push('');

    const header = lines.join('\r\n');
    stream.write(header);

    if (record.payload) {
      stream.write(record.payload);
    }

    stream.write('\r\n\r\n');
  }

  private async compressWarc(warcPath: string): Promise<string> {
    const compressedPath = `${warcPath}.gz`;
    const source = createReadStream(warcPath);
    const gzip = createGzip({ level: this.options.compressionLevel });
    const destination = createWriteStream(compressedPath);

    return new Promise((resolve, reject) => {
      source
        .pipe(gzip)
        .pipe(destination)
        .on('finish', async () => {
          // Remove uncompressed file
          await fs.unlink(warcPath);
          resolve(compressedPath);
        })
        .on('error', reject);
    });
  }

  private async createTarArchive(): Promise<string> {
    const tarPath = `${this.outputDir}.tar.gz`;
    
    await tar.create(
      {
        gzip: true,
        file: tarPath,
        cwd: path.dirname(this.outputDir)
      },
      [path.basename(this.outputDir)]
    );

    return tarPath;
  }

  private async saveCanvasRecording(recording: import('./types.js').CanvasRecording, dir: string): Promise<void> {
    const recordingDir = path.join(dir, recording.id);
    await fs.mkdir(recordingDir, { recursive: true });

    // Save metadata
    const metadata = {
      id: recording.id,
      element: recording.element,
      fps: recording.fps,
      width: recording.width,
      height: recording.height,
      duration: recording.duration,
      format: recording.format,
      frameCount: recording.frames.length
    };
    
    await fs.writeFile(
      path.join(recordingDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    // Save frames
    const framesDir = path.join(recordingDir, 'frames');
    await fs.mkdir(framesDir, { recursive: true });

    for (const frame of recording.frames) {
      // Extract base64 data
      const base64Data = frame.dataUrl.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      await fs.writeFile(
        path.join(framesDir, `frame_${frame.index.toString().padStart(6, '0')}.png`),
        buffer
      );
    }
  }

  private async saveVideoRecording(recording: import('./types.js').VideoRecording, dir: string): Promise<void> {
    const recordingDir = path.join(dir, recording.id);
    await fs.mkdir(recordingDir, { recursive: true });

    // Save metadata
    const metadata = {
      id: recording.id,
      url: recording.url,
      type: recording.type,
      format: recording.format,
      duration: recording.duration,
      segmentCount: recording.segments.length
    };
    
    await fs.writeFile(
      path.join(recordingDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    // Save segments
    const segmentsDir = path.join(recordingDir, 'segments');
    await fs.mkdir(segmentsDir, { recursive: true });

    for (const segment of recording.segments) {
      if (segment.data) {
        await fs.writeFile(
          path.join(segmentsDir, `segment_${segment.index}.ts`),
          segment.data
        );
      }
    }
  }

  private generateIndexHtml(): string {
    const pages = this.manifest.pages.map(page => `
      <tr>
        <td><a href="${page.path}/index.html">${this.escapeHtml(page.title)}</a></td>
        <td>${page.url}</td>
        <td>${page.timestamp.toLocaleString()}</td>
        <td>${page.assetCount}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trench Archive - ${this.escapeHtml(this.manifest.url)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:hover { background: #f9f9f9; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .stats { background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .stat-item { text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #0066cc; }
    .stat-label { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1>📦 Trench Archive</h1>
  <p><strong>Source:</strong> ${this.escapeHtml(this.manifest.url)}</p>
  <p><strong>Created:</strong> ${this.manifest.created.toLocaleString()}</p>
  
  <div class="stats">
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-value">${this.manifest.stats.totalPages}</div>
        <div class="stat-label">Pages</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${this.manifest.stats.totalAssets}</div>
        <div class="stat-label">Assets</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${formatBytes(this.manifest.stats.totalSize)}</div>
        <div class="stat-label">Total Size</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${this.manifest.stats.deduplicatedAssets}</div>
        <div class="stat-label">Deduplicated</div>
      </div>
    </div>
  </div>

  <h2>Archived Pages</h2>
  <table>
    <thead>
      <tr>
        <th>Title</th>
        <th>URL</th>
        <th>Timestamp</th>
        <th>Assets</th>
      </tr>
    </thead>
    <tbody>
      ${pages}
    </tbody>
  </table>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private createInitialManifest(): ArchiveManifest {
    return {
      version: TRENCH_VERSION,
      created: new Date(),
      url: this.options.url,
      options: this.options,
      pages: [],
      assets: [],
      stats: {
        totalPages: 0,
        totalAssets: 0,
        totalSize: 0,
        uniqueAssets: 0,
        deduplicatedAssets: 0,
        duration: 0,
        errors: 0
      }
    };
  }

  private generateWarcId(): string {
    return generateId();
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getManifest(): ArchiveManifest {
    return this.manifest;
  }

  getDeduplicationStats(): { unique: number; saved: number } {
    return {
      unique: this.deduplicationMap.size,
      saved: this.manifest.assets.filter(a => a.deduplicated).length
    };
  }

  // Static methods for reading archives

  static async loadTrenchArchive(archivePath: string): Promise<ArchiveManifest> {
    const manifestPath = path.join(archivePath, 'manifest.json');
    const content = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content) as ArchiveManifest;
    
    // Convert date strings back to Date objects
    manifest.created = new Date(manifest.created);
    manifest.pages.forEach(p => p.timestamp = new Date(p.timestamp));
    
    return manifest;
  }

  static async extractTrenchArchive(
    archivePath: string, 
    outputDir: string
  ): Promise<void> {
    // Check if it's a tar.gz file
    if (archivePath.endsWith('.tar.gz')) {
      await tar.extract({
        file: archivePath,
        cwd: outputDir
      });
    } else if (archivePath.endsWith('.gz')) {
      // It's a compressed WARC
      const outputWarc = path.join(outputDir, 'archive.warc');
      const source = createReadStream(archivePath);
      const gunzip = createGunzip();
      const destination = createWriteStream(outputWarc);

      await new Promise((resolve, reject) => {
        source
          .pipe(gunzip)
          .pipe(destination)
          .on('finish', resolve)
          .on('error', reject);
      });
    }
  }
}
