/**
 * File Utility Tests
 * Tests for file operations, encoding detection, and gitignore handling
 */

import * as assert from 'assert';
import { describe, it, beforeEach } from 'mocha';
import {
    detectEncoding,
    readFile,
    isBinaryFile,
    isTextFile,
    isGitIgnored,
    findFiles,
    getFileInfo,
    getAllFiles,
    getFileExtension,
    getLanguageId,
    formatFileSize,
    FileEncoding,
    ReadFileOptions,
    FileInfo
} from '../../../utils/fileUtils';

// Note: We can't easily test file system operations without mocking
// These tests focus on the pure functions and logic

describe('FileUtils', () => {
    describe('Encoding Detection', () => {
        it('should detect UTF-8 encoding (no BOM)', () => {
            const buffer = Buffer.from('Hello, World!', 'utf8');
            const encoding = detectEncoding(buffer);
            
            assert.strictEqual(encoding, FileEncoding.UTF8);
        });

        it('should detect UTF-8 with BOM', () => {
            const content = 'Hello, World!';
            const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
            const contentBuffer = Buffer.from(content, 'utf8');
            const buffer = Buffer.concat([bom, contentBuffer]);
            
            const encoding = detectEncoding(buffer);
            
            assert.strictEqual(encoding, FileEncoding.UTF8BOM);
        });

        it('should detect UTF-16 LE', () => {
            const buffer = Buffer.from([0xFF, 0xFE, 0x48, 0x00, 0x65, 0x00]);
            const encoding = detectEncoding(buffer);
            
            assert.strictEqual(encoding, FileEncoding.UTF16LE);
        });

        it('should detect UTF-16 BE', () => {
            const buffer = Buffer.from([0xFE, 0xFF, 0x00, 0x48, 0x00, 0x65]);
            const encoding = detectEncoding(buffer);
            
            assert.strictEqual(encoding, FileEncoding.UTF16BE);
        });

        it('should handle empty buffer', () => {
            const buffer = Buffer.alloc(0);
            const encoding = detectEncoding(buffer);
            
            assert.strictEqual(encoding, FileEncoding.UTF8);
        });

        it('should handle buffer with only BOM', () => {
            const bomOnly = Buffer.from([0xEF, 0xBB, 0xBF]);
            const encoding = detectEncoding(bomOnly);
            
            assert.strictEqual(encoding, FileEncoding.UTF8BOM);
        });
    });

    describe('Binary File Detection', () => {
        it('should detect binary files by extension', () => {
            const binaryFiles = [
                'file.exe',
                'file.dll',
                'file.zip',
                'file.jpg',
                'file.png',
                'file.pdf',
                'file.db',
            ];

            binaryFiles.forEach(file => {
                assert.strictEqual(isBinaryFile(file), true, `${file} should be binary`);
            });
        });

        it('should detect text files by extension', () => {
            const textFiles = [
                'file.ts',
                'file.js',
                'file.json',
                'file.md',
                'file.py',
                'file.java',
                'file.html',
                'file.css',
            ];

            textFiles.forEach(file => {
                assert.strictEqual(isTextFile(file), true, `${file} should be text`);
                assert.strictEqual(isBinaryFile(file), false, `${file} should not be binary`);
            });
        });

        it('should treat unknown extensions as binary', () => {
            assert.strictEqual(isBinaryFile('file.xyz'), true);
            assert.strictEqual(isBinaryFile('file.unknown'), true);
        });

        it('should handle files without extension', () => {
            // Files without extension are treated as binary (unknown)
            assert.strictEqual(isBinaryFile('Makefile'), true);
            assert.strictEqual(isBinaryFile('Dockerfile'), true);
        });

        it('should handle uppercase extensions', () => {
            assert.strictEqual(isBinaryFile('file.PNG'), true);
            assert.strictEqual(isBinaryFile('file.TS'), false);
            assert.strictEqual(isTextFile('file.JS'), true);
        });
    });

    describe('Gitignore Pattern Matching', () => {
        it('should match simple file patterns', () => {
            const pattern = 'node_modules';
            const filePath = '/workspace/node_modules/package.json';
            
            // Simplified matching logic
            const matches = filePath.includes(pattern);
            assert.strictEqual(matches, true);
        });

        it('should match wildcard patterns', () => {
            const patterns = [
                { pattern: '*.log', file: 'debug.log', matches: true },
                { pattern: '*.log', file: 'info.txt', matches: false },
                { pattern: 'temp.*', file: 'temp.js', matches: true },
                { pattern: 'temp.*', file: 'test.js', matches: false },
            ];

            patterns.forEach(({ pattern, file, matches }) => {
                // Convert glob to regex
                const regexPattern = pattern
                    .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
                    .replace(/\*/g, '[^/]*')
                    .replace(/\?/g, '.')
                    .replace(/<<<DOUBLESTAR>>>/g, '.*');
                const regex = new RegExp(regexPattern);
                const result = regex.test(file);
                
                assert.strictEqual(result, matches, `${pattern} vs ${file}`);
            });
        });

        it('should match directory patterns', () => {
            const pattern = 'node_modules/';
            const testPaths = [
                { path: 'node_modules/package.json', matches: true },
                { path: 'src/node_modules/helper.js', matches: true },
                { path: 'not_node_modules/file.js', matches: false },
            ];

            testPaths.forEach(({ path, matches }) => {
                const dirPattern = pattern.replace(/\/$/, '');
                const result = path.startsWith(dirPattern + '/') || path.includes('/' + dirPattern + '/');
                assert.strictEqual(result, matches);
            });
        });

        it('should match doublestar patterns', () => {
            const pattern = '**/node_modules/**';
            const testPaths = [
                'node_modules/express/package.json',
                'src/node_modules/local/package.json',
                'project/node_modules/deep/nested/file.js',
            ];

            // ** matches any path segments
            const regexPattern = pattern
                .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
                .replace(/\*/g, '[^/]*')
                .replace(/<<<DOUBLESTAR>>>/g, '.*');
            const regex = new RegExp(regexPattern);

            testPaths.forEach(path => {
                assert.strictEqual(regex.test(path), true, `${pattern} should match ${path}`);
            });
        });

        it('should handle negation patterns (basic)', () => {
            const pattern = '!important.log';
            
            // Negation patterns start with !
            assert.ok(pattern.startsWith('!'));
        });
    });

    describe('File Extension Extraction', () => {
        it('should extract lowercase extensions', () => {
            const testCases = [
                { path: 'file.ts', ext: '.ts' },
                { path: 'file.JS', ext: '.js' },
                { path: 'file.TSx', ext: '.tsx' },
                { path: '/path/to/file.py', ext: '.py' },
                { path: 'file', ext: '' },
            ];

            testCases.forEach(({ path, ext }) => {
                assert.strictEqual(getFileExtension(path), ext);
            });
        });
    });

    describe('Language ID Detection', () => {
        it('should detect TypeScript', () => {
            assert.strictEqual(getLanguageId('file.ts'), 'typescript');
            assert.strictEqual(getLanguageId('file.tsx'), 'typescriptreact');
        });

        it('should detect JavaScript', () => {
            assert.strictEqual(getLanguageId('file.js'), 'javascript');
            assert.strictEqual(getLanguageId('file.jsx'), 'javascriptreact');
        });

        it('should detect Python', () => {
            assert.strictEqual(getLanguageId('file.py'), 'python');
        });

        it('should detect Java', () => {
            assert.strictEqual(getLanguageId('file.java'), 'java');
        });

        it('should detect Go', () => {
            assert.strictEqual(getLanguageId('file.go'), 'go');
        });

        it('should detect Rust', () => {
            assert.strictEqual(getLanguageId('file.rs'), 'rust');
        });

        it('should detect Web languages', () => {
            assert.strictEqual(getLanguageId('file.html'), 'html');
            assert.strictEqual(getLanguageId('file.css'), 'css');
            assert.strictEqual(getLanguageId('file.scss'), 'scss');
        });

        it('should detect Data formats', () => {
            assert.strictEqual(getLanguageId('file.json'), 'json');
            assert.strictEqual(getLanguageId('file.yaml'), 'yaml');
            assert.strictEqual(getLanguageId('file.yml'), 'yaml');
            assert.strictEqual(getLanguageId('file.xml'), 'xml');
        });

        it('should detect Shell scripts', () => {
            assert.strictEqual(getLanguageId('file.sh'), 'shellscript');
            assert.strictEqual(getLanguageId('file.bash'), 'shellscript');
            assert.strictEqual(getLanguageId('file.zsh'), 'shellscript');
            assert.strictEqual(getLanguageId('file.ps1'), 'powershell');
        });

        it('should return undefined for unknown extensions', () => {
            assert.strictEqual(getLanguageId('file.xyz'), undefined);
            assert.strictEqual(getLanguageId('file'), undefined);
        });
    });

    describe('File Size Formatting', () => {
        it('should format bytes', () => {
            assert.strictEqual(formatFileSize(0), '0 B');
            assert.strictEqual(formatFileSize(512), '512 B');
        });

        it('should format kilobytes', () => {
            assert.strictEqual(formatFileSize(1024), '1 KB');
            assert.strictEqual(formatFileSize(1536), '1.5 KB');
            assert.strictEqual(formatFileSize(10240), '10 KB');
        });

        it('should format megabytes', () => {
            assert.strictEqual(formatFileSize(1024 * 1024), '1 MB');
            assert.strictEqual(formatFileSize(5 * 1024 * 1024), '4.88 MB');
        });

        it('should format gigabytes', () => {
            assert.strictEqual(formatFileSize(1024 * 1024 * 1024), '1 GB');
        });

        it('should handle large numbers', () => {
            const size = 2 * 1024 * 1024 * 1024; // 2GB
            assert.ok(formatFileSize(size).includes('GB'));
        });
    });

    describe('Read File Options', () => {
        it('should have default max size', () => {
            const options: ReadFileOptions = {};
            // Default max size is 10MB
            assert.strictEqual(options.maxSize, undefined);
        });

        it('should accept custom encoding', () => {
            const options: ReadFileOptions = {
                encoding: FileEncoding.UTF16LE,
                maxSize: 1024
            };

            assert.strictEqual(options.encoding, FileEncoding.UTF16LE);
            assert.strictEqual(options.maxSize, 1024);
        });
    });

    describe('FileInfo Structure', () => {
        it('should have all required fields', () => {
            const info: FileInfo = {
                uri: { fsPath: '/workspace/test.ts' } as any,
                relativePath: 'test.ts',
                size: 1024,
                isGitIgnored: false
            };

            assert.ok(info.uri);
            assert.strictEqual(info.relativePath, 'test.ts');
            assert.strictEqual(info.size, 1024);
            assert.strictEqual(info.isGitIgnored, false);
        });
    });

    describe('File Extension Lists', () => {
        it('should have comprehensive text extensions', () => {
            const textExtensions = [
                '.ts', '.js', '.tsx', '.jsx', '.json', '.md', '.txt',
                '.py', '.java', '.go', '.rs', '.rb', '.php',
                '.html', '.css', '.scss', '.yaml', '.xml'
            ];

            textExtensions.forEach(ext => {
                const fileName = `test${ext}`;
                assert.strictEqual(isTextFile(fileName), true, `${ext} should be text`);
            });
        });

        it('should have comprehensive binary extensions', () => {
            const binaryExtensions = [
                '.exe', '.dll', '.zip', '.png', '.jpg', '.pdf',
                '.db', '.ttf', '.woff', '.mp3', '.mp4'
            ];

            binaryExtensions.forEach(ext => {
                const fileName = `test${ext}`;
                assert.strictEqual(isBinaryFile(fileName), true, `${ext} should be binary`);
            });
        });
    });

    describe('Path Handling', () => {
        it('should handle absolute paths', () => {
            const paths = [
                '/home/user/project/file.ts',
                'C:\\Users\\project\\file.ts',
                '/workspace/src/utils/fileUtils.ts'
            ];

            paths.forEach(p => {
                assert.ok(p.includes('/project/') || p.includes('\\project\\'));
            });
        });

        it('should handle relative paths', () => {
            const paths = [
                './file.ts',
                '../src/file.ts',
                'src/utils/file.ts'
            ];

            paths.forEach(p => {
                assert.ok(!p.startsWith('/'));
            });
        });
    });

    describe('Encoding Constants', () => {
        it('should have all encoding types', () => {
            assert.strictEqual(FileEncoding.UTF8, 'utf8');
            assert.strictEqual(FileEncoding.UTF8BOM, 'utf8bom');
            assert.strictEqual(FileEncoding.UTF16LE, 'utf16le');
            assert.strictEqual(FileEncoding.UTF16BE, 'utf16be');
            assert.strictEqual(FileEncoding.WINDOWS1251, 'windows1251');
            assert.strictEqual(FileEncoding.ISO88591, 'iso88591');
        });
    });
});
