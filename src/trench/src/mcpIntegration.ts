/**
 * Trench CLI - MCP (Model Context Protocol) Integration
 * Exposes Trench capabilities as MCP server for AI systems
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import type { 
  SearchOptions, 
  ResearchOptions, 
  ArchiveOptions, 
  AnalysisOptions,
  RemixOptions,
  CodeSearchOptions,
  PaperSearchOptions,
  CommunitySearchOptions 
} from './types/index.js';

/**
 * MCP Server configuration
 */
interface McpIntegrationConfig {
  name: string;
  version: string;
  port?: number;
  host?: string;
}

/**
 * Tool handlers type
 */
type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

/**
 * MCP Integration class
 */
export class McpIntegration {
  private server: Server;
  private tools: Map<string, { tool: Tool; handler: ToolHandler }> = new Map();
  private config: McpIntegrationConfig;

  constructor(config: McpIntegrationConfig) {
    this.config = config;
    
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.registerDefaultTools();
  }

  /**
   * Setup request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Array.from(this.tools.values()).map(t => t.tool),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const toolEntry = this.tools.get(name);
      if (!toolEntry) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        const result = await toolEntry.handler(args || {});
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
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

  /**
   * Register default Trench tools
   */
  private registerDefaultTools(): void {
    // Search tool
    this.registerTool({
      name: 'trench_search',
      description: 'Search across multiple sources (web, GitHub, papers, community)',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          sources: {
            type: 'array',
            items: { type: 'string' },
            description: 'Sources to search (web, github, arxiv, hn, reddit)',
          },
          limit: {
            type: 'number',
            description: 'Maximum results to return',
          },
        },
        required: ['query'],
      },
    }, async (args) => {
      const { search } = await import('./commands/search');
      const options: SearchOptions = {
        query: String(args.query),
        sources: (args.sources as string[]) || ['web'],
        limit: Number(args.limit) || 10,
      };
      return search(options);
    });

    // Research tool
    this.registerTool({
      name: 'trench_research',
      description: 'Deep research with synthesis like Perplexity',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Research query',
          },
          depth: {
            type: 'string',
            enum: ['quick', 'standard', 'comprehensive'],
            description: 'Research depth',
          },
          max_sources: {
            type: 'number',
            description: 'Maximum sources to analyze',
          },
        },
        required: ['query'],
      },
    }, async (args) => {
      const { research } = await import('./commands/research');
      const options: ResearchOptions = {
        query: String(args.query),
        depth: (args.depth as ResearchOptions['depth']) || 'standard',
        maxSources: Number(args.max_sources) || 20,
      };
      return research(options);
    });

    // Archive tool
    this.registerTool({
      name: 'trench_archive',
      description: 'Archive a website for offline use',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to archive',
          },
          output_dir: {
            type: 'string',
            description: 'Output directory',
          },
          full_assets: {
            type: 'boolean',
            description: 'Download all assets',
          },
          max_pages: {
            type: 'number',
            description: 'Maximum pages to archive',
          },
        },
        required: ['url'],
      },
    }, async (args) => {
      const { archive } = await import('./commands/archive');
      const options: ArchiveOptions = {
        url: String(args.url),
        outputDir: String(args.output_dir || './archive'),
        fullAssets: Boolean(args.full_assets),
        maxPages: Number(args.max_pages) || 100,
      };
      return archive(options);
    });

    // Analyze tool
    this.registerTool({
      name: 'trench_analyze',
      description: 'Analyze a website structure, content, or tech stack',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'URL or archive path to analyze',
          },
          type: {
            type: 'string',
            enum: ['structure', 'content', 'tech', 'full'],
            description: 'Analysis type',
          },
        },
        required: ['target'],
      },
    }, async (args) => {
      const { analyze } = await import('./commands/analyze');
      const options: AnalysisOptions = {
        target: String(args.target),
        type: (args.type as AnalysisOptions['type']) || 'full',
        outputFormat: 'json',
      };
      return analyze(options);
    });

    // Remix tool
    this.registerTool({
      name: 'trench_remix',
      description: 'Remix an archived website with a new theme',
      inputSchema: {
        type: 'object',
        properties: {
          archive_path: {
            type: 'string',
            description: 'Path to archived website',
          },
          theme: {
            type: 'string',
            enum: ['modern', 'minimal', 'docs', 'docusaurus', 'vitepress'],
            description: 'Theme to apply',
          },
          output_dir: {
            type: 'string',
            description: 'Output directory',
          },
        },
        required: ['archive_path'],
      },
    }, async (args) => {
      const { remix } = await import('./commands/remix');
      const options: RemixOptions = {
        archivePath: String(args.archive_path),
        theme: (args.theme as RemixOptions['theme']) || 'modern',
        outputDir: String(args.output_dir || './remixed'),
      };
      return remix(options);
    });

    // Code search tool
    this.registerTool({
      name: 'trench_code',
      description: 'Search code on GitHub',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Code search query',
          },
          language: {
            type: 'string',
            description: 'Programming language filter',
          },
          min_stars: {
            type: 'number',
            description: 'Minimum stars',
          },
        },
        required: ['query'],
      },
    }, async (args) => {
      const { codeSearch } = await import('./commands/code');
      const options: CodeSearchOptions = {
        query: String(args.query),
        language: args.language as string,
        minStars: Number(args.min_stars),
        sortBy: 'relevance',
        order: 'desc',
      };
      return codeSearch(options);
    });

    // Papers search tool
    this.registerTool({
      name: 'trench_papers',
      description: 'Search academic papers',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Paper search query',
          },
          since: {
            type: 'string',
            description: 'Start date (YYYY-MM-DD)',
          },
          max_results: {
            type: 'number',
            description: 'Maximum results',
          },
        },
        required: ['query'],
      },
    }, async (args) => {
      const { paperSearch } = await import('./commands/papers');
      const options: PaperSearchOptions = {
        query: String(args.query),
        since: args.since ? new Date(String(args.since)) : undefined,
        maxResults: Number(args.max_results) || 10,
        sortBy: 'relevance',
      };
      return paperSearch(options);
    });

    // Community search tool
    this.registerTool({
      name: 'trench_community',
      description: 'Search community discussions (HN, Reddit, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          sources: {
            type: 'array',
            items: { type: 'string' },
            description: 'Sources (hn, reddit, lobsters, devto)',
          },
          time_range: {
            type: 'string',
            enum: ['day', 'week', 'month', 'year', 'all'],
            description: 'Time range filter',
          },
        },
        required: ['query'],
      },
    }, async (args) => {
      const { communitySearch } = await import('./commands/community');
      const options: CommunitySearchOptions = {
        query: String(args.query),
        sources: (args.sources as CommunitySearchOptions['sources']) || ['hn', 'reddit'],
        timeRange: (args.time_range as CommunitySearchOptions['timeRange']) || 'month',
        sortBy: 'relevance',
      };
      return communitySearch(options);
    });

    // Cache management tool
    this.registerTool({
      name: 'trench_cache',
      description: 'Manage Trench cache',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['stats', 'clear', 'cleanup'],
            description: 'Cache action',
          },
        },
        required: ['action'],
      },
    }, async (args) => {
      const { cacheManager } = await import('./utils/cache');
      const action = String(args.action);
      
      switch (action) {
        case 'stats':
          return cacheManager?.getStats() || { error: 'Cache not initialized' };
        case 'clear':
          cacheManager?.clear();
          return { message: 'Cache cleared' };
        case 'cleanup':
          const cleaned = cacheManager?.cleanup() || 0;
          return { message: `Cleaned up ${cleaned} expired entries` };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    });
  }

  /**
   * Register a custom tool
   */
  registerTool(tool: Tool, handler: ToolHandler): void {
    this.tools.set(tool.name, { tool, handler });
  }

  /**
   * Start MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`Trench MCP server running on stdio`);
  }

  /**
   * Stop MCP server
   */
  async stop(): Promise<void> {
    await this.server.close();
  }

  /**
   * Get registered tools
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values()).map(t => t.tool);
  }
}

/**
 * Create and start MCP server
 */
export async function startMcpServer(config?: Partial<McpIntegrationConfig>): Promise<McpIntegration> {
  const server = new McpIntegration({
    name: config?.name || 'trench',
    version: config?.version || '1.0.0',
    port: config?.port || 3456,
    host: config?.host || 'localhost',
  });

  await server.start();
  return server;
}

/**
 * MCP Server tool definitions for Kimi Code CLI integration
 */
export const trenchMcpTools: Tool[] = [
  {
    name: 'trench_search',
    description: 'Search across web, GitHub, papers, and community sources',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        sources: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'trench_research',
    description: 'Deep research with AI synthesis like Perplexity',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        depth: { type: 'string', enum: ['quick', 'standard', 'comprehensive'] },
        max_sources: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'trench_archive',
    description: 'Archive a website for offline use and analysis',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        output_dir: { type: 'string' },
        full_assets: { type: 'boolean' },
        max_pages: { type: 'number' },
      },
      required: ['url'],
    },
  },
  {
    name: 'trench_analyze',
    description: 'Analyze website structure, content, or technology',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        type: { type: 'string', enum: ['structure', 'content', 'tech', 'full'] },
      },
      required: ['target'],
    },
  },
  {
    name: 'trench_code',
    description: 'Search code repositories on GitHub',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        language: { type: 'string' },
        min_stars: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'trench_papers',
    description: 'Search academic papers from arXiv and other sources',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        since: { type: 'string' },
        max_results: { type: 'number' },
      },
      required: ['query'],
    },
  },
];

/**
 * Generate MCP config for Kimi Code CLI
 */
export function generateKimiMcpConfig(): Record<string, unknown> {
  return {
    mcpServers: {
      trench: {
        command: 'npx',
        args: ['-y', 'trench-cli', 'mcp'],
        description: 'Trench CLI - Search, research, archive, and analyze',
        tools: trenchMcpTools.map(t => t.name),
      },
    },
  };
}
