#!/usr/bin/env node

/**
 * Local installation script for Kimi IDE VS Code Extension
 * 
 * This script installs the extension from .vsix file into VS Code
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
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages');

// Parse command line arguments
const args = process.argv.slice(2);
const FORCE = args.includes('--force') || args.includes('-f');
const VSCODE_INSIDERS = args.includes('--insiders');
const CUSTOM_PACKAGE = args.find(arg => arg.endsWith('.vsix') && !arg.startsWith('--'));

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
 * Detect VS Code CLI
 */
function detectVSCodeCLI() {
  // Check for custom path
  if (process.env.VSCODE_CLI) {
    return process.env.VSCODE_CLI;
  }
  
  // Check for insiders
  if (VSCODE_INSIDERS) {
    const insiders = execOutput('which code-insiders || where code-insiders 2>/dev/null || echo ""');
    if (insiders) return 'code-insiders';
  }
  
  // Check for regular VS Code
  const code = execOutput('which code || where code 2>/dev/null || echo ""');
  if (code) return 'code';
  
  // macOS specific
  if (process.platform === 'darwin') {
    const macCode = '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code';
    if (fs.existsSync(macCode)) return macCode;
    
    const macInsiders = '/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code';
    if (VSCODE_INSIDERS && fs.existsSync(macInsiders)) return macInsiders;
  }
  
  // Windows specific
  if (process.platform === 'win32') {
    const winPaths = [
      process.env.LOCALAPPDATA + '\\Programs\\Microsoft VS Code\\bin\\code.cmd',
      process.env.PROGRAMFILES + '\\Microsoft VS Code\\bin\\code.cmd',
      process.env['PROGRAMFILES(X86)'] + '\\Microsoft VS Code\\bin\\code.cmd',
    ];
    
    for (const winPath of winPaths) {
      if (winPath && fs.existsSync(winPath)) {
        return winPath;
      }
    }
  }
  
  return null;
}

/**
 * Find the latest .vsix package
 */
function findLatestPackage() {
  // If custom package specified
  if (CUSTOM_PACKAGE) {
    const customPath = path.isAbsolute(CUSTOM_PACKAGE) 
      ? CUSTOM_PACKAGE 
      : path.join(ROOT_DIR, CUSTOM_PACKAGE);
    
    if (fs.existsSync(customPath)) {
      return customPath;
    }
    throw new Error(`Package not found: ${CUSTOM_PACKAGE}`);
  }
  
  // Look in packages directory
  if (!fs.existsSync(PACKAGES_DIR)) {
    throw new Error('Packages directory not found. Run `make package` first.');
  }
  
  const files = fs.readdirSync(PACKAGES_DIR);
  const vsixFiles = files.filter(f => f.endsWith('.vsix'));
  
  if (vsixFiles.length === 0) {
    throw new Error('No .vsix files found. Run `make package` first.');
  }
  
  // Sort by modification time (newest first)
  vsixFiles.sort((a, b) => {
    const aStat = fs.statSync(path.join(PACKAGES_DIR, a));
    const bStat = fs.statSync(path.join(PACKAGES_DIR, b));
    return bStat.mtimeMs - aStat.mtimeMs;
  });
  
  return path.join(PACKAGES_DIR, vsixFiles[0]);
}

/**
 * Check if extension is already installed
 */
function isExtensionInstalled(vscodeCmd, extensionId) {
  try {
    const output = execOutput(`"${vscodeCmd}" --list-extensions`);
    return output.split('\n').some(line => line.trim() === extensionId);
  } catch (error) {
    return false;
  }
}

/**
 * Uninstall existing extension
 */
function uninstallExtension(vscodeCmd, extensionId) {
  log.step(`Uninstalling existing extension: ${extensionId}...`);
  
  try {
    exec(`"${vscodeCmd}" --uninstall-extension ${extensionId}`);
    log.success('Extension uninstalled');
  } catch (error) {
    log.warn('Failed to uninstall (may not be installed)');
  }
}

/**
 * Install extension
 */
function installExtension(vscodeCmd, packagePath) {
  log.step('Installing extension...');
  
  const forceFlag = FORCE ? ' --force' : '';
  exec(`"${vscodeCmd}" --install-extension "${packagePath}"${forceFlag}`);
  
  log.success('Extension installed successfully');
}

/**
 * Get extension ID from package
 */
function getExtensionId(packagePath) {
  const packageJsonPath = path.join(ROOT_DIR, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return `${packageJson.publisher}.${packageJson.name}`;
  }
  return null;
}

/**
 * Show installation summary
 */
function showSummary(packagePath, vscodeCmd, extensionId) {
  const stats = fs.statSync(packagePath);
  
  console.log(`\n${colors.green}${colors.bright}Installation Complete!${colors.reset}\n`);
  console.log(`${colors.cyan}Package:${colors.reset}     ${path.basename(packagePath)}`);
  console.log(`${colors.cyan}Size:${colors.reset}        ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`${colors.cyan}VS Code:${colors.reset}     ${vscodeCmd}`);
  console.log(`${colors.cyan}Extension:${colors.reset}   ${extensionId}\n`);
  
  console.log(`${colors.bright}Next steps:${colors.reset}`);
  console.log('  1. Reload VS Code window (Cmd/Ctrl+Shift+P → "Developer: Reload Window")');
  console.log('  2. Run "Kimi: Configure API Key" command to set up your API key');
  console.log('  3. Start using Kimi IDE features!\n');
}

/**
 * Main install function
 */
async function install() {
  console.log(`\n${colors.bright}${colors.cyan}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║    Kimi IDE Extension Installation     ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════╝${colors.reset}\n`);
  
  try {
    // Detect VS Code CLI
    const vscodeCmd = detectVSCodeCLI();
    if (!vscodeCmd) {
      throw new Error('VS Code CLI not found. Please install VS Code and ensure "code" command is in PATH.');
    }
    log.info(`VS Code CLI: ${vscodeCmd}`);
    
    // Find package
    const packagePath = findLatestPackage();
    log.info(`Package: ${path.basename(packagePath)}`);
    
    // Get extension ID
    const extensionId = getExtensionId(packagePath);
    if (!extensionId) {
      throw new Error('Could not determine extension ID');
    }
    log.info(`Extension ID: ${extensionId}`);
    
    // Check if already installed
    if (isExtensionInstalled(vscodeCmd, extensionId)) {
      log.warn('Extension is already installed');
      if (!FORCE) {
        log.info('Use --force to reinstall');
      }
      uninstallExtension(vscodeCmd, extensionId);
    }
    
    // Install
    installExtension(vscodeCmd, packagePath);
    
    // Show summary
    showSummary(packagePath, vscodeCmd, extensionId);
    
    process.exit(0);
  } catch (error) {
    log.error(`Installation failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run install
install();
