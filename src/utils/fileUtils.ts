/**
 * File utility functions for Kimi IDE extension
 * Handles file operations, encoding, gitignore checking
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

// Common text file encodings
export enum FileEncoding {
    UTF8 = 'utf8',
    UTF8BOM = 'utf8bom',
    UTF16LE = 'utf16le',
    UTF16BE = 'utf16be',
    WINDOWS1251 = 'windows1251',
    ISO88591 = 'iso88591',
}

export interface ReadFileOptions {
    encoding?: FileEncoding | string;
    maxSize?: number; // in bytes
}

export interface FileInfo {
    uri: vscode.Uri;
    relativePath: string;
    size: number;
    isGitIgnored: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB default max size
const TEXT_EXTENSIONS = new Set([
    '.ts', '.js', '.tsx', '.jsx', '.json', '.md', '.txt',
    '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go',
    '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.r',
    '.html', '.css', '.scss', '.sass', '.less', '.xml', '.yaml',
    '.yml', '.toml', '.ini', '.cfg', '.conf', '.sh', '.bash',
    '.zsh', '.fish', '.ps1', '.sql', '.graphql', '.vue', '.svelte'
]);

const BINARY_EXTENSIONS = new Set([
    '.exe', '.dll', '.so', '.dylib', '.bin', '.o', '.obj',
    '.a', '.lib', '.zip', '.tar', '.gz', '.bz2', '.7z',
    '.rar', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico',
    '.svg', '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.db', '.sqlite', '.ttf', '.otf', '.woff', '.woff2', '.eot'
]);

/**
 * Detect file encoding by reading BOM
 */
export function detectEncoding(buffer: Buffer): FileEncoding {
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return FileEncoding.UTF8BOM;
    }
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
        return FileEncoding.UTF16LE;
    }
    if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
        return FileEncoding.UTF16BE;
    }
    return FileEncoding.UTF8;
}

/**
 * Read file with automatic encoding detection
 */
export async function readFile(filePath: string, options: ReadFileOptions = {}): Promise<string> {
    const { encoding, maxSize = MAX_FILE_SIZE } = options;
    
    try {
        const stats = await fs.promises.stat(filePath);
        
        if (stats.size > maxSize) {
            throw new Error(`File too large: ${filePath} (${stats.size} bytes)`);
        }

        const buffer = await fs.promises.readFile(filePath);
        
        if (encoding) {
            // Skip BOM if present with UTF8
            if (encoding === FileEncoding.UTF8 && buffer.length >= 3) {
                return buffer.toString('utf8', 3);
            }
            return buffer.toString(encoding as BufferEncoding);
        }

        // Auto-detect encoding
        const detectedEncoding = detectEncoding(buffer);
        let content: string;
        
        switch (detectedEncoding) {
            case FileEncoding.UTF8BOM:
                content = buffer.toString('utf8', 3);
                break;
            case FileEncoding.UTF16LE:
                content = buffer.toString('utf16le');
                break;
            case FileEncoding.UTF16BE:
                // Need to swap bytes for UTF-16BE
                const swapped = Buffer.alloc(buffer.length);
                for (let i = 0; i < buffer.length; i += 2) {
                    swapped[i] = buffer[i + 1];
                    swapped[i + 1] = buffer[i];
                }
                content = swapped.toString('utf16le');
                break;
            default:
                content = buffer.toString('utf8');
        }
        
        return content;
    } catch (error) {
        logger.error(`Failed to read file: ${filePath}`, error);
        throw error;
    }
}

/**
 * Read file from URI
 */
export async function readFileFromUri(uri: vscode.Uri, options?: ReadFileOptions): Promise<string> {
    return readFile(uri.fsPath, options);
}

/**
 * Check if file is likely binary based on extension
 */
export function isBinaryFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) return true;
    if (TEXT_EXTENSIONS.has(ext)) return false;
    return true; // Unknown = treat as binary
}

/**
 * Check if file is text file
 */
export function isTextFile(filePath: string): boolean {
    return !isBinaryFile(filePath);
}

/**
 * Find .gitignore patterns in a directory
 */
async function parseGitignore(dirPath: string): Promise<string[]> {
    const gitignorePath = path.join(dirPath, '.gitignore');
    
    try {
        const content = await fs.promises.readFile(gitignorePath, 'utf8');
        return content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    } catch {
        return [];
    }
}

/**
 * Check if file matches gitignore pattern
 */
function matchesGitignore(filePath: string, pattern: string, basePath: string): boolean {
    // Simple gitignore matching - can be extended for more complex patterns
    const relativePath = path.relative(basePath, filePath);
    
    // Negation
    if (pattern.startsWith('!')) {
        return false; // We don't handle negation in this simple version
    }
    
    // Directory pattern
    if (pattern.endsWith('/')) {
        return relativePath.startsWith(pattern) || relativePath.includes('/' + pattern);
    }
    
    // Wildcard patterns
    if (pattern.includes('*')) {
        const regexPattern = pattern
            .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
            .replace(/\*/g, '[^/]*')
            .replace(/<<<DOUBLESTAR>>>/g, '.*');
        const regex = new RegExp(regexPattern);
        return regex.test(relativePath) || regex.test(path.basename(filePath));
    }
    
    return relativePath === pattern || 
           relativePath.startsWith(pattern + '/') ||
           path.basename(filePath) === pattern;
}

/**
 * Check if file is gitignored
 */
export async function isGitIgnored(filePath: string): Promise<boolean> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    if (!workspaceFolder) return false;

    const gitignorePatterns = await parseGitignore(workspaceFolder.uri.fsPath);
    if (gitignorePatterns.length === 0) return false;

    return gitignorePatterns.some(pattern => 
        matchesGitignore(filePath, pattern, workspaceFolder.uri.fsPath)
    );
}

/**
 * Find files in workspace
 */
export async function findFiles(
    pattern: string,
    excludeGitIgnored: boolean = true,
    maxResults?: number
): Promise<vscode.Uri[]> {
    const excludePattern = excludeGitIgnored 
        ? '**/.git/**,**/node_modules/**,**/dist/**,**/build/**,**/.vscode/**'
        : undefined;

    const files = await vscode.workspace.findFiles(
        pattern,
        excludePattern,
        maxResults
    );

    if (excludeGitIgnored) {
        const filteredFiles: vscode.Uri[] = [];
        for (const file of files) {
            if (!(await isGitIgnored(file.fsPath))) {
                filteredFiles.push(file);
            }
            if (maxResults && filteredFiles.length >= maxResults) {
                break;
            }
        }
        return filteredFiles;
    }

    return files;
}

/**
 * Get file info
 */
export async function getFileInfo(uri: vscode.Uri): Promise<FileInfo | null> {
    try {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        const relativePath = workspaceFolder 
            ? path.relative(workspaceFolder.uri.fsPath, uri.fsPath)
            : uri.fsPath;
        
        const stats = await fs.promises.stat(uri.fsPath);
        const gitIgnored = await isGitIgnored(uri.fsPath);

        return {
            uri,
            relativePath,
            size: stats.size,
            isGitIgnored: gitIgnored,
        };
    } catch (error) {
        logger.error(`Failed to get file info: ${uri.fsPath}`, error);
        return null;
    }
}

/**
 * Get all files in directory recursively
 */
export async function getAllFiles(
    dirPath: string,
    options: {
        includeBinary?: boolean;
        excludeGitIgnored?: boolean;
        maxDepth?: number;
    } = {}
): Promise<string[]> {
    const { 
        includeBinary = false, 
        excludeGitIgnored = true,
        maxDepth = 10 
    } = options;

    const files: string[] = [];

    async function traverse(currentPath: string, depth: number): Promise<void> {
        if (depth > maxDepth) return;

        try {
            const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);

                if (excludeGitIgnored && await isGitIgnored(fullPath)) {
                    continue;
                }

                if (entry.isDirectory()) {
                    // Skip common non-source directories
                    if (['node_modules', '.git', 'dist', 'build', '.vscode'].includes(entry.name)) {
                        continue;
                    }
                    await traverse(fullPath, depth + 1);
                } else if (entry.isFile()) {
                    if (!includeBinary && isBinaryFile(fullPath)) {
                        continue;
                    }
                    files.push(fullPath);
                }
            }
        } catch (error) {
            logger.debug(`Failed to read directory: ${currentPath}`, error);
        }
    }

    await traverse(dirPath, 0);
    return files;
}

/**
 * Get file extension
 */
export function getFileExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
}

/**
 * Get language ID from file path
 */
export function getLanguageId(filePath: string): string | undefined {
    const ext = getFileExtension(filePath);
    const languageMap: Record<string, string> = {
        '.ts': 'typescript',
        '.tsx': 'typescriptreact',
        '.js': 'javascript',
        '.jsx': 'javascriptreact',
        '.py': 'python',
        '.java': 'java',
        '.c': 'c',
        '.cpp': 'cpp',
        '.h': 'c',
        '.hpp': 'cpp',
        '.cs': 'csharp',
        '.go': 'go',
        '.rs': 'rust',
        '.rb': 'ruby',
        '.php': 'php',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.scala': 'scala',
        '.r': 'r',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.sass': 'sass',
        '.less': 'less',
        '.xml': 'xml',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.json': 'json',
        '.md': 'markdown',
        '.sql': 'sql',
        '.sh': 'shellscript',
        '.bash': 'shellscript',
        '.zsh': 'shellscript',
        '.ps1': 'powershell',
        '.vue': 'vue',
        '.svelte': 'svelte',
        '.graphql': 'graphql',
    };
    return languageMap[ext];
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
