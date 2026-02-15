/**
 * MCP Server for Trench Archival Browser
 * 
 * Provides MCP tools for:
 * - archive: Archive a website
 * - extract: Extract and analyze archived content
 * - analyze: Analyze an archive
 * - replay: Start replay server for an archive
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { Archiver } from './archiver.js';
import { ArchiveAnalyzer } from './analyzer.js';
import { ArchiveReplay } from './replay.js';
import { ArchiveStorage } from './storage.js';
import type { ArchiveOptions, ReplayOptions } from './types.js';

// Tool schemas
const ArchiveSchema = z.object({
  url: z.string().url(),
  outputDir: z.string().optional(),
  fullAssets: z.boolean().optional().default(true),
  captureVideo: z.boolean().optional().default(false),
  captureCanvas: z.boolean().optional().default(false),
  maxDepth: z.number().int().min(1).max(10).optional().default(3),
  maxPages: z.number().int().min(1).max(1000).optional().default(100),
  viewportWidth: z.number().int().optional().default(1920),
  viewportHeight: z.number().int().optional().default(1080),
  timeout: z.number().int().optional().default(30000),
  concurrency: z.number().int().min(1).max(20).optional().default(5),
  lazyLoadWait: z.number().int().optional().default(2000),
  triggerLazyLoad: z.boolean().optional().default(true),
  followPagination: z.boolean().optional().default(false),
  format: z.enum(['trench', 'warc']).optional().default('trench'),
  deduplicate: z.boolean().optional().default(true),
  resume: z.boolean().optional().default(false),
  compressionLevel: z.number().int().min(0).max(9).optional().default(6),
});

const ExtractSchema = z.object({
  archivePath: z.string(),
  outputDir: z.string().optional(),
  includeAssets: z.boolean().optional().default(true),
  includeMetadata: z.boolean().optional().default(true),
  includeCanvas: z.boolean().optional().default(true),
  includeVideo: z.boolean().optional().default(true),
  format: z.enum(['html', 'json', 'csv']).optional().default('json'),
});

const AnalyzeSchema = z.object({
  archivePath: z.string(),
  reportFormat: z.enum(['json', 'html', 'markdown']).optional().default('json'),
});

const ReplaySchema = z.object({
  archivePath: z.string(),
  port: z.number().int().optional().default(8080),
  host: z.string().optional().default('localhost'),
  rewriteUrls: z.boolean().optional().default(true),
});

const ListArchivesSchema = z.object({
  directory: z.string().optional(),
});

class TrenchMcpServer {
  private server: Server;
  private activeReplays = new Map<string, ArchiveReplay>();

  constructor() {
    this.server = new Server(
      {
        name: 'trench-browser-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: 'archive',
          description: 'Archive a website with full asset capture including images, videos, JavaScript execution, and optional canvas/WebGL recording',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL of the website to archive',
              },
              outputDir: {
                type: 'string',
                description: 'Output directory for the archive (default: ./archive_<domain>)',
              },
              fullAssets: {
                type: 'boolean',
                description: 'Download all assets including images, CSS, JS, fonts',
              },
              captureVideo: {
                type: 'boolean',
                description: 'Capture video streams and HLS/DASH content',
              },
              captureCanvas: {
                type: 'boolean',
                description: 'Record canvas and WebGL animations',
              },
              maxDepth: {
                type: 'number',
                description: 'Maximum crawl depth (1-10)',
              },
              maxPages: {
                type: 'number',
                description: 'Maximum number of pages to archive (1-1000)',
              },
              viewportWidth: {
                type: 'number',
                description: 'Browser viewport width',
              },
              viewportHeight: {
                type: 'number',
                description: 'Browser viewport height',
              },
              timeout: {
                type: 'number',
                description: 'Request timeout in milliseconds',
              },
              concurrency: {
                type: 'number',
                description: 'Number of concurrent downloads',
              },
              triggerLazyLoad: {
                type: 'boolean',
                description: 'Scroll page to trigger lazy loading',
              },
              followPagination: {
                type: 'boolean',
                description: 'Follow pagination links',
              },
              format: {
                type: 'string',
                enum: ['trench', 'warc'],
                description: 'Archive format',
              },
              deduplicate: {
                type: 'boolean',
                description: 'Enable asset deduplication',
              },
              resume: {
                type: 'boolean',
                description: 'Resume interrupted archive',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'extract',
          description: 'Extract content from an archive',
          inputSchema: {
            type: 'object',
            properties: {
              archivePath: {
                type: 'string',
                description: 'Path to the archive directory or file',
              },
              outputDir: {
                type: 'string',
                description: 'Output directory for extracted content',
              },
              includeAssets: {
                type: 'boolean',
                description: 'Include assets in extraction',
              },
              includeMetadata: {
                type: 'boolean',
                description: 'Include metadata in extraction',
              },
              includeCanvas: {
                type: 'boolean',
                description: 'Include canvas recordings in extraction',
              },
              includeVideo: {
                type: 'boolean',
                description: 'Include video recordings in extraction',
              },
              format: {
                type: 'string',
                enum: ['html', 'json', 'csv'],
                description: 'Output format',
              },
            },
            required: ['archivePath'],
          },
        },
        {
          name: 'analyze',
          description: 'Analyze an archive and generate a detailed report on assets, technologies, SEO, security, and performance',
          inputSchema: {
            type: 'object',
            properties: {
              archivePath: {
                type: 'string',
                description: 'Path to the archive directory',
              },
              reportFormat: {
                type: 'string',
                enum: ['json', 'html', 'markdown'],
                description: 'Report output format',
              },
            },
            required: ['archivePath'],
          },
        },
        {
          name: 'replay',
          description: 'Start a local replay server to browse the archive in a web browser with URL rewriting for offline viewing',
          inputSchema: {
            type: 'object',
            properties: {
              archivePath: {
                type: 'string',
                description: 'Path to the archive directory',
              },
              port: {
                type: 'number',
                description: 'Server port (default: 8080)',
              },
              host: {
                type: 'string',
                description: 'Server host (default: localhost)',
              },
              rewriteUrls: {
                type: 'boolean',
                description: 'Rewrite URLs for offline viewing',
              },
            },
            required: ['archivePath'],
          },
        },
        {
          name: 'stop_replay',
          description: 'Stop a running replay server',
          inputSchema: {
            type: 'object',
            properties: {
              archivePath: {
                type: 'string',
                description: 'Path to the archive that is being replayed',
              },
            },
            required: ['archivePath'],
          },
        },
        {
          name: 'list_archives',
          description: 'List available archives in a directory',
          inputSchema: {
            type: 'object',
            properties: {
              directory: {
                type: 'string',
                description: 'Directory to search for archives (default: current directory)',
              },
            },
          },
        },
        {
          name: 'get_archive_info',
          description: 'Get detailed information about a specific archive',
          inputSchema: {
            type: 'object',
            properties: {
              archivePath: {
                type: 'string',
                description: 'Path to the archive directory',
              },
            },
            required: ['archivePath'],
          },
        },
      ];

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'archive':
            return await this.handleArchive(ArchiveSchema.parse(args));
          
          case 'extract':
            return await this.handleExtract(ExtractSchema.parse(args));
          
          case 'analyze':
            return await this.handleAnalyze(AnalyzeSchema.parse(args));
          
          case 'replay':
            return await this.handleReplay(ReplaySchema.parse(args));
          
          case 'stop_replay':
            return await this.handleStopReplay(args as { archivePath: string });
          
          case 'list_archives':
            return await this.handleListArchives(ListArchivesSchema.parse(args));
          
          case 'get_archive_info':
            return await this.handleGetArchiveInfo(args as { archivePath: string });
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleArchive(args: z.infer<typeof ArchiveSchema>) {
    const { url, outputDir, ...options } = args;

    // Generate output directory if not provided
    const finalOutputDir = outputDir || `./archive_${new URL(url).hostname.replace(/\./g, '_')}`;

    const archiveOptions: ArchiveOptions = {
      url,
      outputDir: finalOutputDir,
      ...options,
    };

    // Progress callback
    const progressMessages: string[] = [];
    const progressCallback = async (event: { type: string; current: number; total: number; url?: string; message?: string }) => {
      const msg = `[${event.type}] ${event.current}/${event.total}: ${event.message || event.url}`;
      progressMessages.push(msg);
    };

    const archiver = new Archiver(archiveOptions, progressCallback);
    await archiver.initialize();
    const result = await archiver.archive();

    if (result.success) {
      return {
        content: [
          {
            type: 'text',
            text: `✅ Archive completed successfully!

**Source:** ${url}
**Output:** ${result.outputPath}

**Statistics:**
- Pages archived: ${result.stats.totalPages}
- Assets downloaded: ${result.stats.totalAssets}
- Unique assets: ${result.stats.uniqueAssets}
- Deduplicated: ${result.stats.deduplicatedAssets}
- Total size: ${this.formatBytes(result.stats.totalSize)}
- Duration: ${this.formatDuration(result.stats.duration)}

${result.errors.length > 0 ? `**Errors:** ${result.errors.length}` : ''}`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: 'text',
            text: `⚠️ Archive completed with errors.

**Output:** ${result.outputPath}
**Errors:** ${result.errors.length}

${result.errors.map(e => `- ${e.message}`).join('\n')}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleExtract(args: z.infer<typeof ExtractSchema>) {
    const { archivePath, outputDir, format } = args;

    // If output directory is specified, extract to there
    if (outputDir) {
      await ArchiveStorage.extractTrenchArchive(archivePath, outputDir);
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ Archive extracted to: ${outputDir}

Use 'analyze' tool to get detailed information about the archive.`,
          },
        ],
      };
    }

    // Otherwise, return manifest info
    const manifest = await ArchiveStorage.loadTrenchArchive(archivePath);
    
    const summary = {
      source: manifest.url,
      created: manifest.created,
      pages: manifest.pages.map(p => ({
        url: p.url,
        title: p.title,
        assets: p.assetCount
      })),
      stats: manifest.stats
    };

    return {
      content: [
        {
          type: 'text',
          text: `📦 Archive Summary

**Source:** ${summary.source}
**Created:** ${summary.created}

**Statistics:**
- Pages: ${summary.stats.totalPages}
- Assets: ${summary.stats.totalAssets}
- Size: ${this.formatBytes(summary.stats.totalSize)}

**Pages:**
${summary.pages.map(p => `- ${p.title} (${p.assets} assets)`).join('\n')}`,
        },
      ],
    };
  }

  private async handleAnalyze(args: z.infer<typeof AnalyzeSchema>) {
    const { archivePath, reportFormat } = args;

    const analyzer = new ArchiveAnalyzer(archivePath);
    await analyzer.initialize();
    const report = await analyzer.exportAnalysis(reportFormat);

    if (reportFormat === 'json') {
      const analysis = JSON.parse(report);
      return {
        content: [
          {
            type: 'text',
            text: `📊 Archive Analysis Report

**Summary:**
- Pages: ${analysis.summary.totalPages}
- Assets: ${analysis.summary.totalAssets}
- Total Size: ${this.formatBytes(analysis.summary.totalSize)}

**Technologies Detected:**
${analysis.technologies.map((t: string) => `- ${t}`).join('\n') || 'None detected'}

**SEO Analysis:**
- Missing Titles: ${analysis.seo.missingTitles}
- Missing Descriptions: ${analysis.seo.missingDescriptions}
- Missing Alt Tags: ${analysis.seo.missingAltTags}

**Security:**
- HTTPS Resources: ${analysis.security.httpsPercentage.toFixed(1)}%
- Insecure Resources: ${analysis.security.insecureResources.length}

**Top Asset Types:**
${Object.entries(analysis.assetBreakdown)
  .filter(([_, data]: [string, { count: number }]) => data.count > 0)
  .sort(([_, a]: [string, { size: number }], [__, b]: [string, { size: number }]) => b.size - a.size)
  .slice(0, 5)
  .map(([type, data]: [string, { count: number; size: number }]) => `- ${type}: ${data.count} (${this.formatBytes(data.size)})`)
  .join('\n')}`,
          },
          {
            type: 'text',
            text: `## Full JSON Report\n\n\`\`\`json\n${JSON.stringify(analysis, null, 2)}\n\`\`\``,            
          }
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `📊 Analysis report generated in ${reportFormat} format:\n\n${report}`,
        },
      ],
    };
  }

  private async handleReplay(args: z.infer<typeof ReplaySchema>) {
    const { archivePath, port, host, rewriteUrls } = args;

    // Check if already running
    if (this.activeReplays.has(archivePath)) {
      const replay = this.activeReplays.get(archivePath)!;
      return {
        content: [
          {
            type: 'text',
            text: `⚠️ Replay server already running for this archive.

Use 'stop_replay' to stop it first if you want to restart on a different port.`,
          },
        ],
      };
    }

    const options: ReplayOptions = {
      archivePath,
      port,
      host,
      rewriteUrls,
    };

    const replay = new ArchiveReplay(options);
    await replay.initialize();
    const url = await replay.start();

    this.activeReplays.set(archivePath, replay);

    return {
      content: [
        {
          type: 'text',
          text: `🌐 Replay server started!

**URL:** ${url}
**Archive:** ${archivePath}

You can now open this URL in your browser to view the archived website.

**Additional endpoints:**
- ${url}/_trench/browse - Browse archive pages
- ${url}/_trench/info - Archive metadata
- ${url}/_trench/search?q=query - Search pages

Use 'stop_replay' tool to stop the server.`,
        },
      ],
    };
  }

  private async handleStopReplay(args: { archivePath: string }) {
    const { archivePath } = args;

    const replay = this.activeReplays.get(archivePath);
    if (!replay) {
      return {
        content: [
          {
            type: 'text',
            text: `⚠️ No replay server found for: ${archivePath}`,
          },
        ],
      };
    }

    await replay.stop();
    this.activeReplays.delete(archivePath);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Replay server stopped for: ${archivePath}`,
        },
      ],
    };
  }

  private async handleListArchives(args: z.infer<typeof ListArchivesSchema>) {
    const { directory } = args;
    const searchDir = directory || '.';

    // Look for manifest.json files to identify archives
    const { promises: fs } = await import('fs');
    const entries = await fs.readdir(searchDir, { withFileTypes: true });
    
    const archives: Array<{ name: string; path: string; url?: string; created?: Date }> = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = `${searchDir}/${entry.name}/manifest.json`;
        try {
          const content = await fs.readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(content);
          archives.push({
            name: entry.name,
            path: `${searchDir}/${entry.name}`,
            url: manifest.url,
            created: new Date(manifest.created),
          });
        } catch {
          // Not a valid archive
        }
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `📦 Found ${archives.length} archive(s):

${archives.map(a => `- **${a.name}**
  Path: ${a.path}
  Source: ${a.url || 'Unknown'}
  Created: ${a.created?.toLocaleString() || 'Unknown'}`).join('\n\n')}`,
        },
      ],
    };
  }

  private async handleGetArchiveInfo(args: { archivePath: string }) {
    const manifest = await ArchiveStorage.loadTrenchArchive(args.archivePath);

    return {
      content: [
        {
          type: 'text',
          text: `📦 Archive Information

**Source URL:** ${manifest.url}
**Created:** ${new Date(manifest.created).toLocaleString()}
**Version:** ${manifest.version}
**Format:** ${manifest.options.format}

**Statistics:**
- Total Pages: ${manifest.stats.totalPages}
- Total Assets: ${manifest.stats.totalAssets}
- Total Size: ${this.formatBytes(manifest.stats.totalSize)}
- Unique Assets: ${manifest.stats.uniqueAssets}
- Deduplicated: ${manifest.stats.deduplicatedAssets}
- Errors: ${manifest.stats.errors}

**Options Used:**
- Max Depth: ${manifest.options.maxDepth}
- Max Pages: ${manifest.options.maxPages}
- Full Assets: ${manifest.options.fullAssets}
- Capture Video: ${manifest.options.captureVideo}
- Capture Canvas: ${manifest.options.captureCanvas}
- Deduplicate: ${manifest.options.deduplicate}

**Pages:**
${manifest.pages.slice(0, 10).map(p => `- ${p.title} (${p.url})`).join('\n')}
${manifest.pages.length > 10 ? `\n... and ${manifest.pages.length - 10} more pages` : ''}`,
        },
      ],
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Trench MCP server running on stdio');
  }
}

// Run server if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new TrenchMcpServer();
  server.run().catch(console.error);
}

export { TrenchMcpServer };
