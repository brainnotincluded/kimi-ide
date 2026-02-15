/**
 * Code Utils Unit Tests
 * Tests for code utility functions
 */

import {
    extractImports,
    getIndentation,
    detectIndentation,
    normalizeIndentation,
    extractFunctions,
    isComment,
    isEmptyOrWhitespace,
    countLines,
    truncateCode,
    escapeRegExp,
    camelToSnake,
    snakeToCamel,
    kebabToCamel,
} from '../../../src/utils/codeUtils';

describe('Code Utils', () => {
    describe('getIndentation', () => {
        it('should return leading whitespace', () => {
            expect(getIndentation('    const x = 1;')).toBe('    ');
            expect(getIndentation('\tconst x = 1;')).toBe('\t');
            expect(getIndentation('  \t  const x = 1;')).toBe('  \t  ');
        });

        it('should return empty string for no indentation', () => {
            expect(getIndentation('const x = 1;')).toBe('');
        });

        it('should return empty string for empty lines', () => {
            expect(getIndentation('')).toBe('');
        });
    });

    describe('detectIndentation', () => {
        it('should detect spaces', () => {
            const code = '    const x = 1;\n    const y = 2;';
            const result = detectIndentation(code);
            expect(result.type).toBe('spaces');
            expect(result.indent).toBe('    ');
        });

        it('should detect tabs', () => {
            const code = '\tconst x = 1;\n\tconst y = 2;';
            const result = detectIndentation(code);
            expect(result.type).toBe('tabs');
            expect(result.indent).toBe('\t');
        });

        it('should default to 4 spaces for empty code', () => {
            const result = detectIndentation('');
            expect(result.type).toBe('spaces');
            expect(result.indent).toBe('    ');
        });

        it('should handle mixed indentation', () => {
            const code = '    const x = 1;\n\tconst y = 2;';
            const result = detectIndentation(code);
            // Should pick the most common
            expect(['spaces', 'tabs']).toContain(result.type);
        });
    });

    describe('normalizeIndentation', () => {
        it('should convert tabs to spaces', () => {
            const code = '\tconst x = 1;';
            expect(normalizeIndentation(code, 'spaces', 4)).toBe('    const x = 1;');
            expect(normalizeIndentation(code, 'spaces', 2)).toBe('  const x = 1;');
        });

        it('should convert spaces to tabs', () => {
            const code = '        const x = 1;';
            expect(normalizeIndentation(code, 'tabs', 4)).toBe('\t\tconst x = 1;');
        });

        it('should preserve existing indentation when already correct', () => {
            const code = '    const x = 1;';
            expect(normalizeIndentation(code, 'spaces', 4)).toBe('    const x = 1;');
        });
    });

    describe('isComment', () => {
        it('should detect line comments', () => {
            expect(isComment('// This is a comment')).toBe(true);
            expect(isComment('  // Indented comment')).toBe(true);
            expect(isComment('const x = 1; // not a pure comment')).toBe(false);
        });

        it('should detect block comments', () => {
            expect(isComment('/* block comment */')).toBe(true);
            expect(isComment('  /* indented block */')).toBe(true);
            expect(isComment('const x = /* inline */ 1;')).toBe(false);
        });

        it('should return false for non-comments', () => {
            expect(isComment('const x = 1;')).toBe(false);
            expect(isComment('')).toBe(false);
        });
    });

    describe('isEmptyOrWhitespace', () => {
        it('should detect empty strings', () => {
            expect(isEmptyOrWhitespace('')).toBe(true);
        });

        it('should detect whitespace-only strings', () => {
            expect(isEmptyOrWhitespace('   ')).toBe(true);
            expect(isEmptyOrWhitespace('\t')).toBe(true);
            expect(isEmptyOrWhitespace('\n\r')).toBe(true);
            expect(isEmptyOrWhitespace('  \t\n  ')).toBe(true);
        });

        it('should return false for non-empty strings', () => {
            expect(isEmptyOrWhitespace('a')).toBe(false);
            expect(isEmptyOrWhitespace('  a  ')).toBe(false);
        });
    });

    describe('countLines', () => {
        it('should count lines correctly', () => {
            expect(countLines('line1\nline2\nline3')).toBe(3);
            expect(countLines('single line')).toBe(1);
        });

        it('should handle trailing newline', () => {
            expect(countLines('line1\nline2\n')).toBe(2);
        });

        it('should handle empty string', () => {
            expect(countLines('')).toBe(1);
        });
    });

    describe('escapeRegExp', () => {
        it('should escape special regex characters', () => {
            expect(escapeRegExp('.*+?^${}()|[]\\')).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
        });

        it('should not escape regular characters', () => {
            expect(escapeRegExp('hello')).toBe('hello');
            expect(escapeRegExp('Hello World')).toBe('Hello World');
        });
    });

    describe('camelToSnake', () => {
        it('should convert camelCase to snake_case', () => {
            expect(camelToSnake('camelCase')).toBe('camel_case');
            expect(camelToSnake('someVariableName')).toBe('some_variable_name');
            expect(camelToSnake('HTTPRequest')).toBe('h_t_t_p_request');
        });

        it('should handle already snake_case strings', () => {
            expect(camelToSnake('already_snake')).toBe('already_snake');
        });
    });

    describe('snakeToCamel', () => {
        it('should convert snake_case to camelCase', () => {
            expect(snakeToCamel('snake_case')).toBe('snakeCase');
            expect(snakeToCamel('some_variable_name')).toBe('someVariableName');
        });

        it('should handle already camelCase strings', () => {
            expect(snakeToCamel('alreadyCamel')).toBe('alreadyCamel');
        });
    });

    describe('kebabToCamel', () => {
        it('should convert kebab-case to camelCase', () => {
            expect(kebabToCamel('kebab-case')).toBe('kebabCase');
            expect(kebabToCamel('some-variable-name')).toBe('someVariableName');
        });

        it('should handle already camelCase strings', () => {
            expect(kebabToCamel('alreadyCamel')).toBe('alreadyCamel');
        });
    });
});
