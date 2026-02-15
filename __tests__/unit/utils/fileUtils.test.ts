/**
 * File Utils Unit Tests
 * Tests for file utility functions
 */

import {
    FileEncoding,
    detectEncoding,
    isBinaryFile,
    isTextFile,
    getFileExtension,
    getLanguageId,
    formatFileSize,
    matchesGitignore,
} from '../../../src/utils/fileUtils';

describe('File Utils', () => {
    describe('detectEncoding', () => {
        it('should detect UTF-8 BOM', () => {
            const buffer = Buffer.from([0xEF, 0xBB, 0xBF, 0x48, 0x65, 0x6C, 0x6C, 0x6F]);
            expect(detectEncoding(buffer)).toBe(FileEncoding.UTF8BOM);
        });

        it('should detect UTF-16 LE', () => {
            const buffer = Buffer.from([0xFF, 0xFE, 0x48, 0x00, 0x65, 0x00]);
            expect(detectEncoding(buffer)).toBe(FileEncoding.UTF16LE);
        });

        it('should detect UTF-16 BE', () => {
            const buffer = Buffer.from([0xFE, 0xFF, 0x00, 0x48, 0x00, 0x65]);
            expect(detectEncoding(buffer)).toBe(FileEncoding.UTF16BE);
        });

        it('should default to UTF-8 for files without BOM', () => {
            const buffer = Buffer.from('Hello World', 'utf8');
            expect(detectEncoding(buffer)).toBe(FileEncoding.UTF8);
        });

        it('should handle empty buffer', () => {
            const buffer = Buffer.from([]);
            expect(detectEncoding(buffer)).toBe(FileEncoding.UTF8);
        });
    });

    describe('isBinaryFile', () => {
        it('should identify binary extensions', () => {
            expect(isBinaryFile('/path/to/file.exe')).toBe(true);
            expect(isBinaryFile('/path/to/file.png')).toBe(true);
            expect(isBinaryFile('/path/to/file.zip')).toBe(true);
            expect(isBinaryFile('/path/to/file.pdf')).toBe(true);
        });

        it('should identify text extensions', () => {
            expect(isBinaryFile('/path/to/file.ts')).toBe(false);
            expect(isBinaryFile('/path/to/file.js')).toBe(false);
            expect(isBinaryFile('/path/to/file.json')).toBe(false);
            expect(isBinaryFile('/path/to/file.md')).toBe(false);
        });

        it('should treat unknown extensions as binary', () => {
            expect(isBinaryFile('/path/to/file.unknown')).toBe(true);
            expect(isBinaryFile('/path/to/file.xyz')).toBe(true);
        });

        it('should be case insensitive', () => {
            expect(isBinaryFile('/path/to/file.PNG')).toBe(true);
            expect(isBinaryFile('/path/to/file.TS')).toBe(false);
        });
    });

    describe('isTextFile', () => {
        it('should return opposite of isBinaryFile', () => {
            expect(isTextFile('/path/to/file.ts')).toBe(true);
            expect(isTextFile('/path/to/file.exe')).toBe(false);
        });
    });

    describe('getFileExtension', () => {
        it('should extract lowercase extension', () => {
            expect(getFileExtension('/path/to/file.ts')).toBe('.ts');
            expect(getFileExtension('/path/to/file.JS')).toBe('.js');
            expect(getFileExtension('file.tsx')).toBe('.tsx');
        });

        it('should return empty string for files without extension', () => {
            expect(getFileExtension('/path/to/file')).toBe('');
            expect(getFileExtension('Makefile')).toBe('');
        });

        it('should handle files with multiple dots', () => {
            expect(getFileExtension('/path/to/file.spec.ts')).toBe('.ts');
            expect(getFileExtension('/path/to/file.min.js')).toBe('.js');
        });
    });

    describe('getLanguageId', () => {
        it('should map TypeScript files', () => {
            expect(getLanguageId('/path/to/file.ts')).toBe('typescript');
            expect(getLanguageId('/path/to/file.tsx')).toBe('typescriptreact');
        });

        it('should map JavaScript files', () => {
            expect(getLanguageId('/path/to/file.js')).toBe('javascript');
            expect(getLanguageId('/path/to/file.jsx')).toBe('javascriptreact');
        });

        it('should map Python files', () => {
            expect(getLanguageId('/path/to/file.py')).toBe('python');
        });

        it('should map Java files', () => {
            expect(getLanguageId('/path/to/file.java')).toBe('java');
        });

        it('should return undefined for unknown extensions', () => {
            expect(getLanguageId('/path/to/file.xyz')).toBeUndefined();
            expect(getLanguageId('/path/to/file')).toBeUndefined();
        });
    });

    describe('formatFileSize', () => {
        it('should format bytes', () => {
            expect(formatFileSize(0)).toBe('0 B');
            expect(formatFileSize(100)).toBe('100 B');
            expect(formatFileSize(1023)).toBe('1023 B');
        });

        it('should format kilobytes', () => {
            expect(formatFileSize(1024)).toBe('1 KB');
            expect(formatFileSize(1536)).toBe('1.5 KB');
            expect(formatFileSize(10240)).toBe('10 KB');
        });

        it('should format megabytes', () => {
            expect(formatFileSize(1024 * 1024)).toBe('1 MB');
            expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
        });

        it('should format gigabytes', () => {
            expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
            expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
        });
    });

    describe('matchesGitignore', () => {
        it('should match exact file names', () => {
            expect(matchesGitignore('/workspace/test.txt', 'test.txt', '/workspace')).toBe(true);
            expect(matchesGitignore('/workspace/src/test.txt', 'test.txt', '/workspace')).toBe(true);
        });

        it('should match directory patterns', () => {
            expect(matchesGitignore('/workspace/node_modules/package.json', 'node_modules/', '/workspace')).toBe(true);
            expect(matchesGitignore('/workspace/src/node_modules/file.js', 'node_modules/', '/workspace')).toBe(true);
        });

        it('should match wildcard patterns', () => {
            expect(matchesGitignore('/workspace/file.log', '*.log', '/workspace')).toBe(true);
            expect(matchesGitignore('/workspace/logs/app.log', '*.log', '/workspace')).toBe(true);
            expect(matchesGitignore('/workspace/file.txt', '*.log', '/workspace')).toBe(false);
        });

        it('should match double-star patterns', () => {
            expect(matchesGitignore('/workspace/build/output.js', '**/build', '/workspace')).toBe(true);
            expect(matchesGitignore('/workspace/src/build/output.js', '**/build', '/workspace')).toBe(true);
        });

        it('should not match negation patterns (simple implementation)', () => {
            expect(matchesGitignore('/workspace/keep.txt', '!keep.txt', '/workspace')).toBe(false);
        });
    });
});
