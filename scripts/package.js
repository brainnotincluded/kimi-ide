#!/usr/bin/env node

/**
 * Package script for Kimi IDE VS Code Extension
 * 
 * This script handles:
 * - Building the extension
 * - Creating .vsix package
 * - Validating package.json
 * - Version management
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
  magenta: '\x1b[35m',
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
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages');

// Parse command line arguments
const args = process.argv.slice(2);
const SKIP_BUILD = args.includes('--skip-build');
const SKIP_VALIDATE = args.includes('--skip-validate');
const BUMP_VERSION = args.find(arg => arg.startsWith('--bump='))?.split('=')[1];
const PRE_RELEASE = args.includes('--pre-release');
const TARGET = args.find(arg => arg.startsWith('--target='))?.split('=')[1];

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
 * Execute a command and return output
 */
function execOutput(command, options = {}) {
  const defaultOptions = {
    cwd: ROOT_DIR,
    encoding: 'utf-8',
  };
  
  try {
    return execSync(command, { ...defaultOptions, ...options, stdio: 'pipe' }).trim();
  } catch (error) {
    return '';
  }
}

/**
 * Read and parse package.json
 */
function readPackageJson() {
  const packagePath = path.join(ROOT_DIR, 'package.json');
  if (!fs.existsSync(packagePath)) {
    throw new Error('package.json not found');
  }
  return JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
}

/**
 * Validate package.json contents
 */
function validatePackageJson(packageJson) {
  log.step('Validating package.json...');
  
  const requiredFields = [
    'name',
    'version',
    'publisher',
    'engines',
    'main',
  ];
  
  const errors = [];
  
  for (const field of requiredFields) {
    if (!packageJson[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Validate name format
  if (packageJson.name && !/^[a-z0-9-._]+$/.test(packageJson.name)) {
    errors.push('Package name should only contain lowercase letters, numbers, hyphens, dots, and underscores');
  }
  
  // Validate version format
  if (packageJson.version && !/^\d+\.\d+\.\d+(-\w+\.?\d*)?$/.test(packageJson.version)) {
    errors.push('Invalid version format (should be semver)');
  }
  
  // Validate engines.vscode
  if (!packageJson.engines?.vscode) {
    errors.push('Missing engines.vscode field');
  }
  
  // Validate main entry point
  const mainPath = path.join(ROOT_DIR, packageJson.main || '');
  if (!fs.existsSync(mainPath)) {
    errors.push(`Main entry point not found: ${packageJson.main}`);
  }
  
  // Check for icon
  if (packageJson.icon && !fs.existsSync(path.join(ROOT_DIR, packageJson.icon))) {
    log.warn(`Icon not found: ${packageJson.icon}`);
  }
  
  if (errors.length > 0) {
    for (const error of errors) {
      log.error(error);
    }
    throw new Error('package.json validation failed');
  }
  
  log.success('package.json is valid');
}

/**
 * Bump version
 */
function bumpVersion(packageJson) {
  if (!BUMP_VERSION) return packageJson;
  
  log.step(`Bumping version (${BUMP_VERSION})...`);
  
  const currentVersion = packageJson.version;
  const parts = currentVersion.split('.').map(Number);
  
  switch (BUMP_VERSION) {
    case 'major':
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case 'minor':
      parts[1]++;
      parts[2] = 0;
      break;
    case 'patch':
      parts[2]++;
      break;
    default:
      // Custom version
      if (/^\d+\.\d+\.\d+/.test(BUMP_VERSION)) {
        packageJson.version = BUMP_VERSION;
        log.success(`Version updated: ${currentVersion} → ${BUMP_VERSION}`);
        return packageJson;
      }
      throw new Error(`Invalid bump type: ${BUMP_VERSION}`);
  }
  
  const newVersion = parts.join('.');
  packageJson.version = newVersion;
  
  log.success(`Version updated: ${currentVersion} → ${newVersion}`);
  return packageJson;
}

/**
 * Save package.json
 */
function savePackageJson(packageJson) {
  const packagePath = path.join(ROOT_DIR, 'package.json');
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  log.info('Saved package.json');
}

/**
 * Build the extension
 */
function buildExtension() {
  if (SKIP_BUILD) {
    log.info('Skipping build (--skip-build)');
    return;
  }
  
  log.step('Building extension...');
  
  const buildScript = path.join(__dirname, 'build.js');
  const buildCmd = `node "${buildScript}" --production`;
  
  exec(buildCmd);
  
  log.success('Build complete');
}

/**
 * Create .vsix package
 */
function createPackage(packageJson) {
  log.step('Creating .vsix package...');
  
  // Ensure packages directory exists
  if (!fs.existsSync(PACKAGES_DIR)) {
    fs.mkdirSync(PACKAGES_DIR, { recursive: true });
  }
  
  // Build vsce command
  let vsceCmd = 'npx vsce package';
  
  if (PRE_RELEASE) {
    vsceCmd += ' --pre-release';
    log.info('Creating pre-release package');
  }
  
  if (TARGET) {
    vsceCmd += ` --target ${TARGET}`;
    log.info(`Targeting platform: ${TARGET}`);
  }
  
  // Output to packages directory
  const packageName = `${packageJson.name}-${packageJson.version}${PRE_RELEASE ? '-pre' : ''}${TARGET ? `-${TARGET}` : ''}.vsix`;
  const outputPath = path.join(PACKAGES_DIR, packageName);
  
  vsceCmd += ` --out "${outputPath}"`;
  
  // Execute vsce
  exec(vsceCmd);
  
  log.success(`Package created: ${packageName}`);
  
  // Get file size
  const stats = fs.statSync(outputPath);
  log.info(`Package size: ${(stats.size / 1024).toFixed(2)} KB`);
  
  return outputPath;
}

/**
 * Generate checksum
 */
function generateChecksum(packagePath) {
  log.step('Generating checksum...');
  
  const checksum = execOutput(`shasum -a 256 "${packagePath}" || sha256sum "${packagePath}"`);
  if (checksum) {
    const checksumFile = `${packagePath}.sha256`;
    fs.writeFileSync(checksumFile, checksum);
    log.success(`Checksum saved: ${path.basename(checksumFile)}`);
  }
}

/**
 * Show package info
 */
function showPackageInfo(packageJson, packagePath) {
  console.log(`\n${colors.magenta}${colors.bright}Package Information:${colors.reset}`);
  console.log(`  Name:        ${packageJson.name}`);
  console.log(`  Version:     ${packageJson.version}`);
  console.log(`  Publisher:   ${packageJson.publisher}`);
  console.log(`  VS Code:     ${packageJson.engines?.vscode || 'N/A'}`);
  console.log(`  Main:        ${packageJson.main}`);
  console.log(`  Output:      ${path.relative(ROOT_DIR, packagePath)}`);
  
  if (PRE_RELEASE) {
    console.log(`  ${colors.yellow}Pre-release: yes${colors.reset}`);
  }
  
  console.log('');
}

/**
 * Main package function
 */
async function package() {
  const startTime = Date.now();
  
  console.log(`\n${colors.bright}${colors.cyan}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║      Kimi IDE Extension Package        ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════╝${colors.reset}\n`);
  
  try {
    // Read package.json
    const packageJson = readPackageJson();
    
    // Validate package.json
    if (!SKIP_VALIDATE) {
      validatePackageJson(packageJson);
    }
    
    // Bump version if requested
    bumpVersion(packageJson);
    savePackageJson(packageJson);
    
    // Build extension
    buildExtension();
    
    // Create package
    const packagePath = createPackage(packageJson);
    
    // Generate checksum
    generateChecksum(packagePath);
    
    // Show info
    showPackageInfo(packageJson, packagePath);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`${colors.green}${colors.bright}✓ Packaging successful!${colors.reset}`);
    console.log(`${colors.cyan}Duration: ${duration}s${colors.reset}\n`);
    
    // Print install command
    console.log(`${colors.bright}To install locally:${colors.reset}`);
    console.log(`  make install-local`);
    console.log(`  # or`);
    console.log(`  node scripts/install-local.js\n`);
    
    process.exit(0);
  } catch (error) {
    log.error(`Packaging failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run package
package();
