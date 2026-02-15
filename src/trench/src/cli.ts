#!/usr/bin/env node
/**
 * Trench CLI - Main Entry Point
 * Perplexity-like search and research from the terminal
 */

import { Command } from 'commander';
import * as chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

import { initConfig, getConfigManager } from './config';
import { initCache, initDiskCache } from './cache';
import { createFormatter } from './outputFormatter';
import { startMcpServer } from './mcpIntegration';
import type { OutputFormat, OutputOptions } from './types/index.js';

// Import commands
import { search } from './commands/search';
import { research } from './commands/research';
import { archive } from './commands/archive';
import { analyze } from './commands/analyze';
import { remix } from './commands/remix';
import { codeSearch } from './commands/code';
import { paperSearch } from './commands/papers';
import { communitySearch } from './commands/community';

const program = new Command();
const VERSION = '1.0.0';

// Initialize CLI
program
  .name('trench')
  .description('Trench CLI - Perplexity-like research from the terminal')
  .version(VERSION, '-v, --version')
  .option('-c, --config <path>', 'Config file path')
  .option('--no-color', 'Disable colored output')
  .option('-o, --output <file>', 'Output to file')
  .option('-f, --format <format>', 'Output format (markdown|json|html|interactive)', 'interactive');

/**
 * Setup and get formatter
 */
async function setup(options: { format?: string; color?: boolean; output?: string }): Promise<{
  formatter: ReturnType<typeof createFormatter>;
  outputPath?: string;
}> {
  // Load config
  await initConfig(options.config);
  
  // Initialize cache
  const config = getConfigManager().get();
  await initCache({
    dbPath: path.join(config.cache.directory, 'cache.db'),
    defaultTtl: config.cache.defaultTtl,
    maxSize: config.cache.maxSize,
    enabled: config.cache.enabled,
    compression: config.cache.compression,
  });
  
  await initDiskCache(path.join(config.cache.directory, 'files'), config.cache.enabled);
  
  // Setup formatter
  const format = (options.format || config.defaults.outputFormat) as OutputFormat;
  const colors = options.color !== false && config.output.colors;
  
  const formatterOptions: OutputOptions = {
    format,
    colors,
    verbose: false,
    output: options.output,
  };
  
  const formatter = createFormatter(formatterOptions);
  
  return { formatter, outputPath: options.output };
}

/**
 * Output results
 */
async function output(
  data: unknown,
  formatter: ReturnType<typeof createFormatter>,
  outputPath?: string
): Promise<void> {
  const formatted = formatter.formatOutput(data);
  
  if (outputPath) {
    await fs.writeFile(outputPath, formatted, 'utf-8');
    console.log(formatter.formatSuccess(`Results saved to ${outputPath}`));
  } else {
    console.log(formatted);
  }
}

// Search command
program
  .command('search')
  .description('Search across web, GitHub, papers, and community')
  .argument('<query>', 'Search query')
  .option('-s, --sources <sources>', 'Comma-separated sources (web,github,arxiv,hn,reddit)', 'web')
  .option('-l, --limit <n>', 'Maximum results', '10')
  .option('--no-cache', 'Skip cache')
  .action(async (query, options) => {
    try {
      const { formatter, outputPath } = await setup({
        format: program.opts().format,
        color: program.opts().color,
        output: program.opts().output,
      });
      
      console.log(formatter.printHeader(`🔍 Search: ${query}`));
      
      const sources = options.sources.split(',').map((s: string) => s.trim());
      const results = await search({
        query,
        sources,
        limit: parseInt(options.limit),
        cache: options.cache,
      });
      
      await output(results, formatter, outputPath);
    } catch (error) {
      console.error(chalk.red('Search failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Research command
program
  .command('research')
  .description('Deep research with AI synthesis like Perplexity')
  .argument('<query>', 'Research query')
  .option('-d, --depth <depth>', 'Research depth (quick|standard|comprehensive)', 'standard')
  .option('-m, --max-sources <n>', 'Maximum sources to analyze', '20')
  .option('--synthesize', 'Enable AI synthesis', true)
  .action(async (query, options) => {
    try {
      const { formatter, outputPath } = await setup({
        format: program.opts().format,
        color: program.opts().color,
        output: program.opts().output,
      });
      
      console.log(formatter.printHeader(`🔬 Research: ${query}`));
      console.log(formatter.formatInfo(`Depth: ${options.depth}`));
      
      const result = await research({
        query,
        depth: options.depth,
        maxSources: parseInt(options.maxSources),
        synthesize: options.synthesize,
      });
      
      await output(result, formatter, outputPath);
    } catch (error) {
      console.error(chalk.red('Research failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Archive command
program
  .command('archive')
  .description('Archive a website for offline use')
  .argument('<url>', 'URL to archive')
  .option('-o, --output <dir>', 'Output directory', './archive')
  .option('--full-assets', 'Download all assets', true)
  .option('--no-assets', 'Skip asset downloading')
  .option('--js', 'Include JavaScript', false)
  .option('-d, --depth <n>', 'Crawl depth', '3')
  .option('--max-pages <n>', 'Maximum pages to archive', '100')
  .action(async (url, options) => {
    try {
      const { formatter, outputPath } = await setup({
        format: program.opts().format,
        color: program.opts().color,
        output: program.opts().output,
      });
      
      console.log(formatter.printHeader(`📦 Archive: ${url}`));
      
      const result = await archive({
        url,
        outputDir: options.output,
        fullAssets: options.assets !== false && options.fullAssets,
        javascript: options.js,
        depth: parseInt(options.depth),
        maxPages: parseInt(options.maxPages),
      });
      
      await output(result, formatter, outputPath);
    } catch (error) {
      console.error(chalk.red('Archive failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Analyze command
program
  .command('analyze')
  .description('Analyze website structure, content, or tech stack')
  .argument('<target>', 'URL or archive path to analyze')
  .option('-t, --type <type>', 'Analysis type (structure|content|tech|full)', 'full')
  .action(async (target, options) => {
    try {
      const { formatter, outputPath } = await setup({
        format: program.opts().format,
        color: program.opts().color,
        output: program.opts().output,
      });
      
      console.log(formatter.printHeader(`📊 Analyze: ${target}`));
      
      const result = await analyze({
        target,
        type: options.type,
        outputFormat: program.opts().format,
      });
      
      await output(result, formatter, outputPath);
    } catch (error) {
      console.error(chalk.red('Analysis failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Remix command
program
  .command('remix')
  .description('Remix an archived website with a modern theme')
  .argument('<archive>', 'Path to archived website')
  .option('--theme <theme>', 'Theme (modern|minimal|docs|docusaurus|vitepress|mkdocs)', 'modern')
  .option('-o, --output <dir>', 'Output directory', './remixed')
  .option('--deploy', 'Deploy after remixing', false)
  .action(async (archivePath, options) => {
    try {
      const { formatter, outputPath } = await setup({
        format: program.opts().format,
        color: program.opts().color,
        output: program.opts().output,
      });
      
      console.log(formatter.printHeader(`🎨 Remix: ${archivePath}`));
      console.log(formatter.formatInfo(`Theme: ${options.theme}`));
      
      const result = await remix({
        archivePath,
        theme: options.theme,
        outputDir: options.output,
        deploy: options.deploy,
      });
      
      await output(result, formatter, outputPath);
    } catch (error) {
      console.error(chalk.red('Remix failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Code command
program
  .command('code')
  .description('Search code on GitHub')
  .argument('<query>', 'Code search query')
  .option('-l, --language <lang>', 'Programming language')
  .option('--min-stars <n>', 'Minimum stars')
  .option('--max-stars <n>', 'Maximum stars')
  .option('--created-after <date>', 'Created after (YYYY-MM-DD)')
  .option('--updated-after <date>', 'Updated after (YYYY-MM-DD)')
  .option('--sort <sort>', 'Sort by (relevance|stars|updated)', 'relevance')
  .option('--order <order>', 'Sort order (asc|desc)', 'desc')
  .action(async (query, options) => {
    try {
      const { formatter, outputPath } = await setup({
        format: program.opts().format,
        color: program.opts().color,
        output: program.opts().output,
      });
      
      console.log(formatter.printHeader(`💻 Code Search: ${query}`));
      
      const results = await codeSearch({
        query,
        language: options.language,
        minStars: options.minStars ? parseInt(options.minStars) : undefined,
        maxStars: options.maxStars ? parseInt(options.maxStars) : undefined,
        createdAfter: options.createdAfter ? new Date(options.createdAfter) : undefined,
        updatedAfter: options.updatedAfter ? new Date(options.updatedAfter) : undefined,
        sortBy: options.sort,
        order: options.order,
      });
      
      await output(results, formatter, outputPath);
    } catch (error) {
      console.error(chalk.red('Code search failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Papers command
program
  .command('papers')
  .description('Search academic papers')
  .argument('<query>', 'Paper search query')
  .option('--since <date>', 'Start date (YYYY-MM-DD)')
  .option('--until <date>', 'End date (YYYY-MM-DD)')
  .option('--authors <authors>', 'Comma-separated author names')
  .option('--categories <cats>', 'Comma-separated arXiv categories')
  .option('--sort <sort>', 'Sort by (relevance|date|citations)', 'relevance')
  .option('-l, --limit <n>', 'Maximum results', '10')
  .action(async (query, options) => {
    try {
      const { formatter, outputPath } = await setup({
        format: program.opts().format,
        color: program.opts().color,
        output: program.opts().output,
      });
      
      console.log(formatter.printHeader(`📄 Papers: ${query}`));
      
      const results = await paperSearch({
        query,
        since: options.since ? new Date(options.since) : undefined,
        until: options.until ? new Date(options.until) : undefined,
        authors: options.authors?.split(',').map((a: string) => a.trim()),
        categories: options.categories?.split(',').map((c: string) => c.trim()),
        sortBy: options.sort,
        maxResults: parseInt(options.limit),
      });
      
      await output(results, formatter, outputPath);
    } catch (error) {
      console.error(chalk.red('Paper search failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Community command
program
  .command('community')
  .description('Search community discussions (HN, Reddit, etc.)')
  .argument('<query>', 'Search query')
  .option('-s, --sources <sources>', 'Comma-separated sources (hn,reddit,devto)', 'hn,reddit')
  .option('-t, --time <range>', 'Time range (day|week|month|year|all)', 'month')
  .option('--min-score <n>', 'Minimum score')
  .option('--sort <sort>', 'Sort by (relevance|score|date)', 'relevance')
  .action(async (query, options) => {
    try {
      const { formatter, outputPath } = await setup({
        format: program.opts().format,
        color: program.opts().color,
        output: program.opts().output,
      });
      
      console.log(formatter.printHeader(`💬 Community: ${query}`));
      
      const results = await communitySearch({
        query,
        sources: options.sources.split(',').map((s: string) => s.trim()),
        timeRange: options.time,
        minScore: options.minScore ? parseInt(options.minScore) : undefined,
        sortBy: options.sort,
      });
      
      await output(results, formatter, outputPath);
    } catch (error) {
      console.error(chalk.red('Community search failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// MCP server command
program
  .command('mcp')
  .description('Start MCP server for AI integration')
  .option('-p, --port <port>', 'Server port', '3456')
  .option('-h, --host <host>', 'Server host', 'localhost')
  .action(async (options) => {
    try {
      console.log(chalk.cyan('Starting Trench MCP server...'));
      
      await startMcpServer({
        name: 'trench',
        version: VERSION,
        port: parseInt(options.port),
        host: options.host,
      });
    } catch (error) {
      console.error(chalk.red('MCP server failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Config command
const configCmd = program
  .command('config')
  .description('Manage Trench configuration');

configCmd
  .command('show')
  .description('Show current configuration')
  .action(async () => {
    const config = await initConfig();
    console.log(JSON.stringify(config, null, 2));
  });

configCmd
  .command('set-key')
  .description('Set API key')
  .argument('<service>', 'Service name (github, bing, brave, openai, anthropic)')
  .argument('<key>', 'API key')
  .action(async (service, key) => {
    const manager = getConfigManager();
    await manager.load();
    await manager.setApiKey(service as any, key);
    console.log(chalk.green(`✓ API key for ${service} set successfully`));
  });

configCmd
  .command('set-default')
  .description('Set default value')
  .argument('<key>', 'Setting key')
  .argument('<value>', 'Setting value')
  .action(async (key, value) => {
    const manager = getConfigManager();
    await manager.load();
    
    const defaults = manager.getDefaults();
    (defaults as any)[key] = value;
    await manager.updateDefaults(defaults);
    
    console.log(chalk.green(`✓ Default ${key} set to ${value}`));
  });

configCmd
  .command('path')
  .description('Show config file path')
  .action(async () => {
    const manager = getConfigManager();
    await manager.load();
    console.log(manager.getConfigPath());
  });

// Cache command
const cacheCmd = program
  .command('cache')
  .description('Manage Trench cache');

cacheCmd
  .command('stats')
  .description('Show cache statistics')
  .action(async () => {
    const { formatter } = await setup({});
    const { getCacheManager } = await import('./cache');
    const cache = getCacheManager();
    
    if (cache) {
      const stats = cache.getStats();
      console.log(formatter.formatOutput(stats));
    } else {
      console.log('Cache not initialized');
    }
  });

cacheCmd
  .command('clear')
  .description('Clear all cache')
  .action(async () => {
    const { getCacheManager } = await import('./cache');
    const cache = getCacheManager();
    
    if (cache) {
      cache.clear();
      console.log(chalk.green('✓ Cache cleared'));
    }
  });

cacheCmd
  .command('cleanup')
  .description('Remove expired entries')
  .action(async () => {
    const { getCacheManager } = await import('./cache');
    const cache = getCacheManager();
    
    if (cache) {
      const cleaned = cache.cleanup();
      console.log(chalk.green(`✓ Cleaned up ${cleaned} expired entries`));
    }
  });

// Parse arguments
program.parse();

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
