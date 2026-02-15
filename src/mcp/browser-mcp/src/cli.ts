#!/usr/bin/env node
/**
 * CLI for Trench Archival Browser
 * 
 * Commands:
 * - trench archive <url> [options]
 * - trench extract <path> [options]
 * - trench replay <path> [options]
 * - trench analyze <path> [options]
 * - trench list [directory]
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { URL } from 'url';
import { Archiver, type ArchiveResult } from './archiver.js';
import { ArchiveAnalyzer } from './analyzer.js';
import { ArchiveReplay } from './replay.js';
import { ArchiveStorage } from './storage.js';
import type { ArchiveOptions, ReplayOptions } from './types.js';

const program = new Command();

program
  .name('trench')
  .description('Trench Archival Browser - Full website archiving with Playwright')
  .version('1.0.0');

// Archive command
program
  .command('archive')
  .description('Archive a website with full asset capture')
  .argument('<url>', 'URL to archive')
  .option('-o, --output <dir>', 'Output directory')
  .option('--full-assets', 'Download all assets (images, videos, CSS, JS)', true)
  .option('--video', 'Capture video streams', false)
  .option('--canvas', 'Record canvas/WebGL animations', false)
  .option('-d, --max-depth <n>', 'Maximum crawl depth', '3')
  .option('-p, --max-pages <n>', 'Maximum number of pages', '100')
  .option('-w, --width <n>', 'Viewport width', '1920')
  .option('-h, --height <n>', 'Viewport height', '1080')
  .option('-t, --timeout <ms>', 'Request timeout', '30000')
  .option('-c, --concurrency <n>', 'Concurrent downloads', '5')
  .option('--no-lazy-load', 'Disable lazy loading trigger')
  .option('--follow-pagination', 'Follow pagination links', false)
  .option('-f, --format <format>', 'Archive format (trench|warc)', 'trench')
  .option('--no-dedup', 'Disable asset deduplication')
  .option('--resume', 'Resume interrupted archive', false)
  .option('--compress <level>', 'Compression level (0-9)', '6')
  .action(async (url: string, options) => {
    const spinner = ora('Initializing archiver...').start();

    try {
      // Generate output directory if not provided
      const outputDir = options.output || `./archive_${new URL(url).hostname.replace(/\./g, '_')}`;

      const archiveOptions: ArchiveOptions = {
        url,
        outputDir,
        fullAssets: options.fullAssets,
        captureVideo: options.video,
        captureCanvas: options.canvas,
        maxDepth: parseInt(options.maxDepth),
        maxPages: parseInt(options.maxPages),
        viewportWidth: parseInt(options.width),
        viewportHeight: parseInt(options.height),
        timeout: parseInt(options.timeout),
        concurrency: parseInt(options.concurrency),
        triggerLazyLoad: options.lazyLoad,
        followPagination: options.followPagination,
        format: options.format as 'trench' | 'warc',
        deduplicate: options.dedup,
        resume: options.resume,
        compressionLevel: parseInt(options.compress),
      };

      // Progress callback
      const progressCallback = async (event: { type: string; current: number; total: number; url?: string; message?: string }) => {
        const percent = Math.round((event.current / event.total) * 100);
        spinner.text = `${event.message || event.url} (${percent}%)`;
      };

      const archiver = new Archiver(archiveOptions, progressCallback);
      await archiver.initialize();
      
      spinner.text = 'Archiving in progress...';
      const result = await archiver.archive();

      if (result.success) {
        spinner.succeed(chalk.green('Archive completed successfully!'));
        
        console.log('\n' + chalk.bold('📦 Archive Summary:'));
        console.log(`  Source: ${chalk.cyan(url)}`);
        console.log(`  Output: ${chalk.cyan(result.outputPath)}`);
        console.log(`\n  Pages: ${chalk.yellow(result.stats.totalPages)}`);
        console.log(`  Assets: ${chalk.yellow(result.stats.totalAssets)}`);
        console.log(`  Unique: ${chalk.yellow(result.stats.uniqueAssets)}`);
        console.log(`  Deduplicated: ${chalk.yellow(result.stats.deduplicatedAssets)}`);
        console.log(`  Size: ${chalk.yellow(formatBytes(result.stats.totalSize))}`);
        console.log(`  Duration: ${chalk.yellow(formatDuration(result.stats.duration))}`);

        if (result.errors.length > 0) {
          console.log(chalk.yellow(`\n  ⚠️  ${result.errors.length} errors occurred`));
        }

        console.log(`\n${chalk.bold('Next steps:')}`);
        console.log(`  View:   ${chalk.cyan(`trench replay ${result.outputPath}`)}`);
        console.log(`  Analyze: ${chalk.cyan(`trench analyze ${result.outputPath}`)}`);
      } else {
        spinner.fail(chalk.red('Archive completed with errors'));
        
        console.log('\n' + chalk.bold('📦 Archive Summary:'));
        console.log(`  Output: ${chalk.cyan(result.outputPath)}`);
        console.log(`  Errors: ${chalk.red(result.errors.length)}`);
        
        result.errors.forEach((error, i) => {
          console.log(chalk.red(`  ${i + 1}. ${error.message}`));
        });
        
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red('Archive failed'));
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

// Extract command
program
  .command('extract')
  .description('Extract content from an archive')
  .argument('<path>', 'Path to archive directory or file')
  .option('-o, --output <dir>', 'Output directory for extracted content')
  .option('--no-assets', 'Skip asset extraction')
  .option('--no-metadata', 'Skip metadata extraction')
  .option('--no-canvas', 'Skip canvas recording extraction')
  .option('--no-video', 'Skip video recording extraction')
  .option('-f, --format <format>', 'Output format (html|json|csv)', 'json')
  .option('--analyze', 'Run analysis after extraction', false)
  .action(async (archivePath: string, options) => {
    const spinner = ora('Loading archive...').start();

    try {
      // Load manifest
      const manifest = await ArchiveStorage.loadTrenchArchive(archivePath);
      spinner.succeed(chalk.green('Archive loaded'));

      console.log('\n' + chalk.bold('📦 Archive Information:'));
      console.log(`  Source: ${chalk.cyan(manifest.url)}`);
      console.log(`  Created: ${chalk.cyan(new Date(manifest.created).toLocaleString())}`);
      console.log(`  Pages: ${chalk.yellow(manifest.stats.totalPages)}`);
      console.log(`  Assets: ${chalk.yellow(manifest.stats.totalAssets)}`);
      console.log(`  Size: ${chalk.yellow(formatBytes(manifest.stats.totalSize))}`);

      // Extract if output directory specified
      if (options.output) {
        spinner.start('Extracting archive...');
        await ArchiveStorage.extractTrenchArchive(archivePath, options.output);
        spinner.succeed(chalk.green(`Extracted to: ${options.output}`));
      }

      // Run analysis if requested
      if (options.analyze) {
        spinner.start('Analyzing archive...');
        const analyzer = new ArchiveAnalyzer(archivePath);
        await analyzer.initialize();
        const analysis = await analyzer.analyze();
        spinner.succeed(chalk.green('Analysis complete'));

        console.log('\n' + chalk.bold('📊 Analysis Results:'));
        console.log(`  Technologies: ${analysis.technologies.join(', ') || 'None detected'}`);
        console.log(`  SEO Issues: ${analysis.seo.missingTitles + analysis.seo.missingDescriptions} missing meta tags`);
        console.log(`  Security: ${analysis.security.httpsPercentage.toFixed(1)}% HTTPS`);

        // Save report
        const report = await analyzer.exportAnalysis('html');
        const reportPath = path.join(archivePath, 'analysis_report.html');
        const { promises: fs } = await import('fs');
        await fs.writeFile(reportPath, report, 'utf-8');
        console.log(`  Report saved: ${chalk.cyan(reportPath)}`);
      }

      // List pages
      console.log('\n' + chalk.bold('📄 Archived Pages:'));
      manifest.pages.slice(0, 20).forEach((page, i) => {
        console.log(`  ${i + 1}. ${chalk.cyan(page.title || 'Untitled')}`);
        console.log(`     ${chalk.gray(page.url)}`);
      });

      if (manifest.pages.length > 20) {
        console.log(chalk.gray(`  ... and ${manifest.pages.length - 20} more pages`));
      }
    } catch (error) {
      spinner.fail(chalk.red('Extraction failed'));
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

// Replay command
program
  .command('replay')
  .description('Start a local server to browse the archive')
  .argument('<path>', 'Path to archive directory')
  .option('-p, --port <n>', 'Server port', '8080')
  .option('-h, --host <host>', 'Server host', 'localhost')
  .option('--no-rewrite', 'Disable URL rewriting')
  .option('--pywb', 'Enable pywb integration', false)
  .option('--pywb-port <n>', 'pywb port', '8081')
  .action(async (archivePath: string, options) => {
    console.log(chalk.bold('🌐 Starting replay server...\n'));

    try {
      const replayOptions: ReplayOptions = {
        archivePath,
        port: parseInt(options.port),
        host: options.host,
        rewriteUrls: options.rewrite,
        enablePywb: options.pywb,
        pywbPort: parseInt(options.pywbPort),
      };

      const replay = new ArchiveReplay(replayOptions);
      await replay.initialize();
      const url = await replay.start();

      console.log(chalk.green('✅ Replay server started!\n'));
      console.log(chalk.bold('Archive URL:'), chalk.cyan(url));
      console.log(chalk.bold('Browse:'), chalk.cyan(`${url}/_trench/browse`));
      console.log(chalk.bold('Info:'), chalk.cyan(`${url}/_trench/info`));
      console.log('\n' + chalk.yellow('Press Ctrl+C to stop the server'));

      // Keep process alive
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n\nShutting down...'));
        await replay.stop();
        process.exit(0);
      });

      // Prevent process from exiting
      await new Promise(() => {});
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

// Analyze command
program
  .command('analyze')
  .description('Analyze an archive and generate a report')
  .argument('<path>', 'Path to archive directory')
  .option('-f, --format <format>', 'Report format (json|html|markdown)', 'html')
  .option('-o, --output <file>', 'Output file for the report')
  .action(async (archivePath: string, options) => {
    const spinner = ora('Analyzing archive...').start();

    try {
      const analyzer = new ArchiveAnalyzer(archivePath);
      await analyzer.initialize();
      const report = await analyzer.exportAnalysis(options.format);

      // Save report
      const { promises: fs } = await import('fs');
      const outputFile = options.output || `analysis_report.${options.format === 'markdown' ? 'md' : options.format}`;
      await fs.writeFile(outputFile, report, 'utf-8');

      spinner.succeed(chalk.green(`Report saved: ${outputFile}`));

      // Print summary
      const analysis = await analyzer.analyze();
      console.log('\n' + chalk.bold('📊 Analysis Summary:'));
      console.log(`  Pages: ${chalk.yellow(analysis.summary.totalPages)}`);
      console.log(`  Assets: ${chalk.yellow(analysis.summary.totalAssets)}`);
      console.log(`  Size: ${chalk.yellow(formatBytes(analysis.summary.totalSize))}`);
      console.log(`  Technologies: ${chalk.cyan(analysis.technologies.join(', ') || 'None')}`);
    } catch (error) {
      spinner.fail(chalk.red('Analysis failed'));
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List available archives in a directory')
  .argument('[directory]', 'Directory to search', '.')
  .action(async (directory: string) => {
    const spinner = ora('Scanning for archives...').start();

    try {
      const { promises: fs } = await import('fs');
      const entries = await fs.readdir(directory, { withFileTypes: true });
      
      const archives: Array<{ name: string; url?: string; created?: Date; size?: number }> = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const manifestPath = path.join(directory, entry.name, 'manifest.json');
          try {
            const content = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(content);
            archives.push({
              name: entry.name,
              url: manifest.url,
              created: new Date(manifest.created),
              size: manifest.stats?.totalSize,
            });
          } catch {
            // Not a valid archive
          }
        }
      }

      spinner.succeed(chalk.green(`Found ${archives.length} archive(s)`));

      if (archives.length > 0) {
        console.log('\n' + chalk.bold('📦 Archives:'));
        archives.forEach((archive, i) => {
          console.log(`\n  ${i + 1}. ${chalk.cyan(archive.name)}`);
          console.log(`     Source: ${chalk.gray(archive.url || 'Unknown')}`);
          console.log(`     Created: ${chalk.gray(archive.created?.toLocaleString() || 'Unknown')}`);
          if (archive.size) {
            console.log(`     Size: ${chalk.gray(formatBytes(archive.size))}`);
          }
        });
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to list archives'));
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

// Utility functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

// Run CLI
program.parse();

// Handle no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
