#!/usr/bin/env node

/**
 * Build script for Kimi IDE VS Code Extension
 * 
 * This script handles:
 * - TypeScript compilation
 * - Webpack bundling
 * - Asset copying
 * - Minification for production
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ ${colors.reset}${msg}`),
  success: (msg) => console.log(`${colors.green}✓ ${colors.reset}${msg}`),
  error: (msg) => console.log(`${colors.red}✗ ${colors.reset}${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${colors.reset}${msg}`),
  step: (msg) => console.log(`\n${colors.cyan}${colors.bright}▶ ${msg}${colors.reset}`),
};

// Configuration
const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, 'out');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const USE_WEBPACK = process.argv.includes('--webpack') || fs.existsSync(path.join(ROOT_DIR, 'webpack.config.js'));

/**
 * Execute a command with proper error handling
 */
function exec(command, options = {}) {
  const defaultOptions = {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    encoding: 'utf-8',
  };
  
  try {
    return execSync(command, { ...defaultOptions, ...options });
  } catch (error) {
    log.error(`Command failed: ${command}`);
    throw error;
  }
}

/**
 * Clean output directories
 */
function clean() {
  log.step('Cleaning output directories...');
  
  const dirsToClean = [OUT_DIR];
  if (USE_WEBPACK) {
    dirsToClean.push(DIST_DIR);
  }
  
  for (const dir of dirsToClean) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      log.info(`Cleaned: ${path.relative(ROOT_DIR, dir)}`);
    }
  }
  
  log.success('Clean complete');
}

/**
 * Compile TypeScript
 */
function compileTypeScript() {
  log.step('Compiling TypeScript...');
  
  const tscCmd = 'npx tsc -p ./';
  exec(tscCmd);
  
  log.success('TypeScript compilation complete');
}

/**
 * Bundle with webpack if available
 */
function bundleWithWebpack() {
  if (!USE_WEBPACK) {
    log.info('Webpack not configured, skipping bundling');
    return;
  }
  
  log.step('Bundling with Webpack...');
  
  const webpackConfig = path.join(ROOT_DIR, 'webpack.config.js');
  if (!fs.existsSync(webpackConfig)) {
    log.warn('webpack.config.js not found, skipping bundling');
    return;
  }
  
  const mode = IS_PRODUCTION ? 'production' : 'development';
  const webpackCmd = `npx webpack --mode ${mode} --config webpack.config.js`;
  
  exec(webpackCmd);
  
  log.success('Webpack bundling complete');
}

/**
 * Copy static assets
 */
function copyAssets() {
  log.step('Copying assets...');
  
  const assets = [
    { src: 'README.md', dest: 'README.md' },
    { src: 'LICENSE', dest: 'LICENSE' },
    { src: 'CHANGELOG.md', dest: 'CHANGELOG.md', optional: true },
    { src: 'package.json', dest: 'package.json' },
  ];
  
  // Assets directory
  const assetsDir = path.join(SRC_DIR, 'assets');
  if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);
    for (const file of assetFiles) {
      assets.push({
        src: path.join('src', 'assets', file),
        dest: path.join('assets', file),
      });
    }
  }
  
  // Icons directory
  const iconsDir = path.join(ROOT_DIR, 'icons');
  if (fs.existsSync(iconsDir)) {
    if (!fs.existsSync(path.join(OUT_DIR, 'icons'))) {
      fs.mkdirSync(path.join(OUT_DIR, 'icons'), { recursive: true });
    }
    const iconFiles = fs.readdirSync(iconsDir);
    for (const file of iconFiles) {
      assets.push({
        src: path.join('icons', file),
        dest: path.join('icons', file),
      });
    }
  }
  
  for (const asset of assets) {
    const srcPath = path.join(ROOT_DIR, asset.src);
    const destPath = path.join(OUT_DIR, asset.dest);
    
    if (fs.existsSync(srcPath)) {
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(srcPath, destPath);
      log.info(`Copied: ${asset.src} → ${asset.dest}`);
    } else if (!asset.optional) {
      log.warn(`Asset not found: ${asset.src}`);
    }
  }
  
  log.success('Asset copying complete');
}

/**
 * Update package.json for distribution
 */
function updatePackageJson() {
  log.step('Updating package.json for distribution...');
  
  const packageJsonPath = path.join(OUT_DIR, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    log.error('package.json not found in output directory');
    return;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  
  // Remove devDependencies and scripts for distribution
  delete packageJson.devDependencies;
  delete packageJson.scripts;
  
  // Ensure main points to the correct file
  if (USE_WEBPACK && fs.existsSync(path.join(DIST_DIR, 'extension.js'))) {
    packageJson.main = './dist/extension.js';
  } else {
    packageJson.main = './out/extension.js';
  }
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  log.success('package.json updated');
}

/**
 * Verify the build
 */
function verifyBuild() {
  log.step('Verifying build...');
  
  const mainFile = USE_WEBPACK 
    ? path.join(DIST_DIR, 'extension.js')
    : path.join(OUT_DIR, 'extension.js');
  
  if (!fs.existsSync(mainFile)) {
    throw new Error(`Main extension file not found: ${mainFile}`);
  }
  
  log.info(`Main file: ${path.relative(ROOT_DIR, mainFile)}`);
  log.info(`Size: ${(fs.statSync(mainFile).size / 1024).toFixed(2)} KB`);
  
  // Check for required files
  const requiredFiles = ['package.json'];
  for (const file of requiredFiles) {
    const filePath = path.join(OUT_DIR, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required file missing: ${file}`);
    }
  }
  
  log.success('Build verification complete');
}

/**
 * Main build function
 */
async function build() {
  const startTime = Date.now();
  
  console.log(`\n${colors.bright}${colors.cyan}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║      Kimi IDE Extension Build          ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════╝${colors.reset}`);
  console.log(`${colors.cyan}Mode: ${IS_PRODUCTION ? 'Production' : 'Development'}${colors.reset}\n`);
  
  try {
    // Clean
    clean();
    
    // Ensure output directory exists
    if (!fs.existsSync(OUT_DIR)) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
    }
    
    // Compile TypeScript
    compileTypeScript();
    
    // Bundle with webpack if configured
    if (USE_WEBPACK) {
      bundleWithWebpack();
    }
    
    // Copy assets
    copyAssets();
    
    // Update package.json
    updatePackageJson();
    
    // Verify build
    verifyBuild();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n${colors.green}${colors.bright}✓ Build successful!${colors.reset}`);
    console.log(`${colors.cyan}Duration: ${duration}s${colors.reset}\n`);
    
    process.exit(0);
  } catch (error) {
    log.error(`Build failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run build
build();
