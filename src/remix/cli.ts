#!/usr/bin/env node
/**
 * Site Remix Engine - CLI
 * Command line interface for the Trench Remix Engine
 * 
 * Commands:
 *   trench analyze <url>       - Analyze a website
 *   trench extract <archive>   - Extract content from downloaded archive
 *   trench remix <archive>     - Remix a website with modern design
 *   trench deploy <remixed>    - Deploy remixed site
 * 
 * Trench Project
 */

import * as fs from 'fs';
import * as path from 'path';
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

import { SiteAnalyzer } from './analyzer';
import { ContentExtractor } from './contentExtractor';
import { StructureParser } from './structureParser';
import { RemixEngine } from './remixEngine';
import { ImprovementSuggestions } from './improvementSuggestions';
import {
  RemixOptions,
  RemixTheme,
  AnalysisReport,
  ExtractReport
} from './types';

// Package info would come from package.json
const VERSION = '1.0.0';

program
  .name('trench')
  .description('Site Remix Engine - Transform old websites into modern versions')
  .version(VERSION);

/**
 * ANALYZE COMMAND
 * Analyzes a downloaded website for structure, content, and issues
 */
program
  .command('analyze')
  .description('Analyze a downloaded website')
  .argument('<path>', 'Path to downloaded website')
  .option('-u, --url <url>', 'Original URL of the website', 'https://example.com')
  .option('-o, --output <file>', 'Output report file', 'analysis-report.json')
  .option('--format <format>', 'Output format (json|html|md)', 'json')
  .action(async (sitePath, options) => {
    const spinner = ora('Analyzing website...').start();
    
    try {
      // Validate path
      if (!fs.existsSync(sitePath)) {
        spinner.fail(chalk.red(`Path not found: ${sitePath}`));
        process.exit(1);
      }

      const analyzer = new SiteAnalyzer();
      const report = await analyzer.analyzeSite(sitePath, options.url);
      
      spinner.succeed('Analysis complete!');

      // Output report
      switch (options.format) {
        case 'json':
          fs.writeFileSync(options.output, JSON.stringify(report, null, 2));
          break;
        case 'html':
          fs.writeFileSync(options.output, generateHTMLReport(report));
          break;
        case 'md':
          fs.writeFileSync(options.output, generateMarkdownReport(report));
          break;
      }

      console.log(chalk.green(`✓ Report saved to ${options.output}`));
      
      // Print summary
      console.log('\n' + chalk.bold('Summary:'));
      console.log(`  Pages: ${chalk.cyan(report.summary.totalPages)}`);
      console.log(`  Issues: ${chalk.yellow(report.summary.totalIssues)}`);
      console.log(`    Critical: ${chalk.red(report.summary.criticalIssues)}`);
      console.log(`    Warnings: ${chalk.yellow(report.summary.warnings)}`);
      console.log(`  Score: ${getScoreColor(report.summary.score)(report.summary.score + '/100')}`);
      
      // Print top issues
      if (report.issues.length > 0) {
        console.log('\n' + chalk.bold('Top Issues:'));
        report.issues.slice(0, 5).forEach(issue => {
          const icon = issue.severity === 'critical' ? '🔴' : 
                      issue.severity === 'warning' ? '🟡' : '🔵';
          console.log(`  ${icon} ${issue.title}`);
        });
      }

    } catch (error) {
      spinner.fail(chalk.red(`Analysis failed: ${error}`));
      process.exit(1);
    }
  });

/**
 * EXTRACT COMMAND
 * Extracts content from downloaded website
 */
program
  .command('extract')
  .description('Extract content from downloaded website')
  .argument('<path>', 'Path to downloaded website')
  .option('-o, --output <dir>', 'Output directory', 'extracted')
  .option('-f, --format <format>', 'Output format (markdown|json|html)', 'markdown')
  .option('--include <pattern>', 'Include files matching pattern')
  .option('--exclude <pattern>', 'Exclude files matching pattern')
  .action(async (sitePath, options) => {
    const spinner = ora('Extracting content...').start();
    
    try {
      if (!fs.existsSync(sitePath)) {
        spinner.fail(chalk.red(`Path not found: ${sitePath}`));
        process.exit(1);
      }

      const extractor = new ContentExtractor();
      const filterOptions: any = {};
      
      if (options.include) {
        filterOptions.includePattern = new RegExp(options.include);
      }
      if (options.exclude) {
        filterOptions.excludePattern = new RegExp(options.exclude);
      }

      const report = await extractor.extractSite(sitePath, filterOptions);
      
      spinner.succeed('Extraction complete!');

      console.log(chalk.green(`✓ Extracted to ${report.outputPath}`));
      console.log('\n' + chalk.bold('Statistics:'));
      console.log(`  Pages: ${chalk.cyan(report.pages.length)}`);
      console.log(`  Total blocks: ${chalk.cyan(report.totalBlocks)}`);
      console.log(`  Code blocks: ${chalk.cyan(report.codeBlocks)}`);
      console.log(`  Tables: ${chalk.cyan(report.tables)}`);
      console.log(`  Images: ${chalk.cyan(report.images)}`);
      
      // Save report
      fs.writeFileSync(
        path.join(report.outputPath, 'extract-report.json'),
        JSON.stringify(report, null, 2)
      );

    } catch (error) {
      spinner.fail(chalk.red(`Extraction failed: ${error}`));
      process.exit(1);
    }
  });

/**
 * REMIX COMMAND
 * Main command - transforms old website into modern version
 */
program
  .command('remix')
  .description('Remix a website with modern design')
  .argument('<path>', 'Path to downloaded website')
  .option('-o, --output <dir>', 'Output directory', 'remixed')
  .option('-t, --theme <theme>', 'Theme (modern-docs|blog|landing|knowledge-base|minimal)', 'modern-docs')
  .option('--dark-mode <mode>', 'Dark mode (true|false|auto)', 'true')
  .option('--primary-color <color>', 'Primary color (hex)')
  .option('--secondary-color <color>', 'Secondary color (hex)')
  .option('--font <font>', 'Font family')
  .option('--search <provider>', 'Search provider (fuse|lunr|algolia)', 'fuse')
  .option('--no-search', 'Disable search functionality')
  .option('--pwa', 'Enable PWA features')
  .option('--no-minify', 'Disable minification')
  .option('--no-optimize', 'Disable image optimization')
  .option('--apply-fixes', 'Auto-apply fixable improvements')
  .action(async (sitePath, options) => {
    console.log(chalk.bold.blue('\n🎨 Site Remix Engine\n'));
    
    let spinner = ora('Validating input...').start();
    
    try {
      if (!fs.existsSync(sitePath)) {
        spinner.fail(chalk.red(`Path not found: ${sitePath}`));
        process.exit(1);
      }

      const indexPath = path.join(sitePath, 'index.html');
      if (!fs.existsSync(indexPath)) {
        spinner.fail(chalk.red('No index.html found. Is this a valid website download?'));
        process.exit(1);
      }

      spinner.succeed('Input validated');

      // Step 1: Analyze
      spinner = ora('Analyzing site structure...').start();
      const analyzer = new SiteAnalyzer();
      const analysisReport = await analyzer.analyzeSite(sitePath, 'https://example.com');
      spinner.succeed('Analysis complete');

      // Step 2: Parse structure
      spinner = ora('Parsing site structure...').start();
      const parser = new StructureParser();
      const { pages: pageStructures, graph, taxonomy } = await parser.parseSite(sitePath, 'https://example.com');
      spinner.succeed(`Found ${pageStructures.length} pages`);

      // Step 3: Extract content
      spinner = ora('Extracting content...').start();
      const extractor = new ContentExtractor();
      
      const pages = [];
      for (const structure of pageStructures) {
        const htmlPath = path.join(sitePath, structure.url.replace('https://example.com/', ''));
        if (fs.existsSync(htmlPath) || fs.existsSync(htmlPath + '.html')) {
          const filePath = fs.existsSync(htmlPath) ? htmlPath : htmlPath + '.html';
          extractor.loadFromFile(filePath);
          const content = extractor.extract();
          pages.push({ structure, content });
        }
      }
      spinner.succeed(`Extracted ${pages.length} pages`);

      // Step 4: Apply improvements if requested
      if (options.applyFixes) {
        spinner = ora('Applying auto-fixes...').start();
        const improver = new ImprovementSuggestions(sitePath);
        improver.loadReport(analysisReport);
        const { applied, failed } = await improver.applyAutoFixes();
        spinner.succeed(`Applied ${applied.length} fixes${failed.length > 0 ? `, ${failed.length} failed` : ''}`);
      }

      // Step 5: Remix
      spinner = ora(`Remixing with ${options.theme} theme...`).start();
      
      const remixOptions: RemixOptions = {
        theme: options.theme as RemixTheme,
        darkMode: options.darkMode === 'true' ? true : 
                  options.darkMode === 'false' ? false : 'auto',
        primaryColor: options.primaryColor,
        secondaryColor: options.secondaryColor,
        fontFamily: options.font,
        enableSearch: options.search !== false,
        searchProvider: options.search as any,
        pwa: options.pwa || false,
        minify: options.minify !== false,
        optimizeImages: options.optimize !== false,
        modernCSS: true
      };

      const engine = new RemixEngine(remixOptions);
      const outputPath = path.resolve(options.output);
      const result = await engine.remixSite(sitePath, pages, outputPath);
      
      spinner.succeed('Remix complete!');

      // Print results
      console.log('\n' + chalk.bold.green('✨ Success!') + '\n');
      console.log(chalk.bold('Output:'), outputPath);
      console.log(chalk.bold('Pages:'), result.pages.length);
      console.log(chalk.bold('Assets:'), result.assets.length);
      
      if (result.searchIndex) {
        console.log(chalk.bold('Search:'), `${result.searchIndex.provider} (${result.searchIndex.documentCount} documents)`);
      }
      
      if (result.pwaManifest) {
        console.log(chalk.bold('PWA:'), 'Enabled');
      }

      // Print features
      console.log('\n' + chalk.bold('Features:'));
      console.log(`  ${chalk.green('✓')} Modern CSS (Tailwind)`);
      console.log(`  ${chalk.green('✓')} Dark mode support`);
      console.log(`  ${chalk.green('✓')} Responsive design`);
      if (remixOptions.enableSearch) console.log(`  ${chalk.green('✓')} Search functionality`);
      if (remixOptions.pwa) console.log(`  ${chalk.green('✓')} PWA ready`);
      if (remixOptions.minify) console.log(`  ${chalk.green('✓')} Minified assets`);

      console.log('\n' + chalk.cyan('Next steps:'));
      console.log(`  cd ${options.output}`);
      console.log('  npx serve .     # Preview locally');
      console.log('  # Or deploy to Vercel, Netlify, GitHub Pages...\n');

    } catch (error) {
      spinner.fail(chalk.red(`Remix failed: ${error}`));
      console.error(error);
      process.exit(1);
    }
  });

/**
 * IMPROVE COMMAND
 * Suggests and applies improvements
 */
program
  .command('improve')
  .description('Analyze and suggest improvements')
  .argument('<path>', 'Path to website')
  .option('-a, --apply', 'Apply auto-fixable improvements')
  .option('-o, --output <file>', 'Output report file', 'improvements.md')
  .action(async (sitePath, options) => {
    const spinner = ora('Analyzing for improvements...').start();
    
    try {
      if (!fs.existsSync(sitePath)) {
        spinner.fail(chalk.red(`Path not found: ${sitePath}`));
        process.exit(1);
      }

      const analyzer = new SiteAnalyzer();
      const report = await analyzer.analyzeSite(sitePath, 'https://example.com');
      
      const improver = new ImprovementSuggestions(sitePath);
      improver.loadReport(report);
      
      const { suggestions, autoFixable, manualReview } = await improver.generateSuggestions();
      
      spinner.succeed('Analysis complete');

      console.log('\n' + chalk.bold('Improvements Found:'));
      console.log(`  Auto-fixable: ${chalk.green(autoFixable.length)}`);
      console.log(`  Manual review: ${chalk.yellow(manualReview.length)}`);

      // Group by type
      const byType: Record<string, ImprovementSuggestion[]> = {};
      suggestions.forEach(s => {
        if (!byType[s.type]) byType[s.type] = [];
        byType[s.type].push(s);
      });

      console.log('\n' + chalk.bold('By Category:'));
      Object.entries(byType).forEach(([type, items]) => {
        console.log(`  ${type}: ${items.length}`);
      });

      // Apply fixes if requested
      if (options.apply && autoFixable.length > 0) {
        const applySpinner = ora('Applying fixes...').start();
        const { applied, failed } = await improver.applyAutoFixes();
        applySpinner.succeed(`Applied ${applied.length} fixes`);
        
        if (failed.length > 0) {
          console.log(chalk.yellow(`  ${failed.length} fixes failed`));
        }
      }

      // Generate report
      let reportContent = '# Improvement Suggestions\n\n';
      
      reportContent += '## Auto-fixable\n\n';
      autoFixable.forEach(s => {
        reportContent += `- [ ] **${s.title}** (${s.severity})\n`;
        reportContent += `  - ${s.description}\n`;
      });

      reportContent += '\n## Manual Review Required\n\n';
      manualReview.forEach(s => {
        reportContent += `- [ ] **${s.title}** (${s.severity})\n`;
        reportContent += `  - ${s.description}\n`;
      });

      fs.writeFileSync(options.output, reportContent);
      console.log(chalk.green(`\n✓ Report saved to ${options.output}`));

    } catch (error) {
      spinner.fail(chalk.red(`Analysis failed: ${error}`));
      process.exit(1);
    }
  });

/**
 * DEPLOY COMMAND
 * Deployment helpers
 */
program
  .command('deploy')
  .description('Generate deployment configuration')
  .argument('<path>', 'Path to remixed website')
  .option('-p, --platform <platform>', 'Platform (vercel|netlify|github-pages|cloudflare)', 'vercel')
  .option('--dry-run', 'Show configuration without writing files')
  .action(async (sitePath, options) => {
    const spinner = ora('Generating deployment config...').start();
    
    try {
      if (!fs.existsSync(sitePath)) {
        spinner.fail(chalk.red(`Path not found: ${sitePath}`));
        process.exit(1);
      }

      let config: string = '';
      let configFile: string = '';

      switch (options.platform) {
        case 'vercel':
          configFile = 'vercel.json';
          config = JSON.stringify({
            version: 2,
            public: true,
            github: {
              enabled: false
            }
          }, null, 2);
          break;

        case 'netlify':
          configFile = 'netlify.toml';
          config = `[build]
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
`;
          break;

        case 'github-pages':
          configFile = '.github/workflows/deploy.yml';
          config = `name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
`;
          break;

        case 'cloudflare':
          configFile = 'wrangler.toml';
          config = `name = "remixed-site"
main = ""
compatibility_date = "2024-01-01"

[site]
bucket = "."
`;
          break;
      }

      spinner.succeed('Configuration generated');

      if (options.dryRun) {
        console.log('\n' + chalk.bold(configFile + ':'));
        console.log(config);
      } else {
        const configPath = path.join(sitePath, configFile);
        const configDir = path.dirname(configPath);
        
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }
        
        fs.writeFileSync(configPath, config);
        console.log(chalk.green(`✓ Config saved to ${configPath}`));
      }

      console.log('\n' + chalk.cyan('Deployment commands:'));
      switch (options.platform) {
        case 'vercel':
          console.log('  cd ' + sitePath);
          console.log('  npx vercel --prod');
          break;
        case 'netlify':
          console.log('  cd ' + sitePath);
          console.log('  npx netlify deploy --prod');
          break;
        case 'cloudflare':
          console.log('  cd ' + sitePath);
          console.log('  npx wrangler pages deploy .');
          break;
      }

    } catch (error) {
      spinner.fail(chalk.red(`Deployment setup failed: ${error}`));
      process.exit(1);
    }
  });

// Helper functions

function getScoreColor(score: number): any {
  if (score >= 80) return chalk.green;
  if (score >= 60) return chalk.yellow;
  return chalk.red;
}

function generateHTMLReport(report: AnalysisReport): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Analysis Report - ${report.siteName}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    .score { font-size: 48px; font-weight: bold; }
    .score.good { color: #22c55e; }
    .score.warning { color: #eab308; }
    .score.bad { color: #ef4444; }
    .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .issue { padding: 10px; margin: 5px 0; border-radius: 4px; }
    .issue.critical { background: #fee2e2; }
    .issue.warning { background: #fef3c7; }
    .issue.info { background: #dbeafe; }
  </style>
</head>
<body>
  <h1>Analysis Report</h1>
  <h2>${report.siteName}</h2>
  <p>URL: ${report.url}</p>
  <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
  
  <div class="score ${report.summary.score >= 80 ? 'good' : report.summary.score >= 60 ? 'warning' : 'bad'}">
    ${report.summary.score}/100
  </div>
  
  <h3>Summary</h3>
  <div class="metric"><span>Pages</span><span>${report.summary.totalPages}</span></div>
  <div class="metric"><span>Total Issues</span><span>${report.summary.totalIssues}</span></div>
  <div class="metric"><span>Critical</span><span>${report.summary.criticalIssues}</span></div>
  <div class="metric"><span>Warnings</span><span>${report.summary.warnings}</span></div>
  
  <h3>Issues</h3>
  ${report.issues.map(i => `
    <div class="issue ${i.severity}">
      <strong>${i.title}</strong>
      <p>${i.description}</p>
      <small>${i.autoFixable ? '✓ Auto-fixable' : 'Manual fix required'}</small>
    </div>
  `).join('')}
</body>
</html>`;
}

function generateMarkdownReport(report: AnalysisReport): string {
  return `# Analysis Report: ${report.siteName}

**URL:** ${report.url}  
**Generated:** ${new Date(report.timestamp).toLocaleString()}

## Score: ${report.summary.score}/100

## Summary

| Metric | Value |
|--------|-------|
| Pages | ${report.summary.totalPages} |
| Total Issues | ${report.summary.totalIssues} |
| Critical | ${report.summary.criticalIssues} |
| Warnings | ${report.summary.warnings} |

## Issues

${report.issues.map(i => `
### ${i.severity === 'critical' ? '🔴' : i.severity === 'warning' ? '🟡' : '🔵'} ${i.title}

${i.description}

${i.autoFixable ? '- ✓ Auto-fixable' : '- Manual fix required'}
`).join('\n')}

## Recommendations

1. ${report.summary.criticalIssues > 0 ? 'Fix critical issues immediately' : 'No critical issues found'}
2. ${report.summary.warnings > 0 ? 'Address warnings to improve score' : 'Good job on minimizing warnings'}
3. Consider implementing PWA features
4. Optimize images and assets
`;
}

// Run CLI
program.parse();

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
