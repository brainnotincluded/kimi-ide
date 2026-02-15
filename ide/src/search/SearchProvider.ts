/**
 * Search Provider - Core search functionality for Kimi IDE IDE
 * Supports both ripgrep (fast) and Node.js fallback
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Readable } from 'stream';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { minimatch } from 'minimatch';
import {
  SearchOptions,
  ReplaceOptions,
  SearchResult,
  SearchMatch,
  SearchProgress,
  SearchStats,
  SearchEvent,
  SearchEventListener,
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_MAX_RESULTS,
} from './types';

const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

export class SearchProvider extends EventEmitter {
  private projectRoot: string;
  private currentSearch: ChildProcess | null = null;
  private isCancelled = false;
  private ripgrepAvailable: boolean | null = null;
  private ripgrepPath: string = 'rg';

  constructor(projectRoot: string) {
    super();
    this.projectRoot = projectRoot;
    this.checkRipgrep();
  }

  /**
   * Check if ripgrep is available
   */
  private async checkRipgrep(): Promise<boolean> {
    if (this.ripgrepAvailable !== null) {
      return this.ripgrepAvailable;
    }

    return new Promise((resolve) => {
      const rg = spawn('rg', ['--version'], { shell: true });
      rg.on('error', () => {
        this.ripgrepAvailable = false;
        resolve(false);
      });
      rg.on('close', (code) => {
        this.ripgrepAvailable = code === 0;
        resolve(this.ripgrepAvailable!);
      });
    });
  }

  /**
   * Main search method - searches entire project
   */
  async search(options: SearchOptions, listener?: SearchEventListener): Promise<SearchStats> {
    const startTime = Date.now();
    this.isCancelled = false;

    if (listener) {
      this.on('search-event', listener);
    }

    const hasRipgrep = await this.checkRipgrep();
    let results: SearchResult[] = [];

    try {
      if (hasRipgrep) {
        results = await this.searchWithRipgrep(options);
      } else {
        results = await this.searchWithNode(options);
      }

      const stats: SearchStats = {
        duration: Date.now() - startTime,
        filesSearched: results.length,
        filesWithMatches: results.filter(r => r.matchCount > 0).length,
        totalMatches: results.reduce((sum, r) => sum + r.matchCount, 0),
        usedRipgrep: hasRipgrep,
      };

      this.emit('search-event', { type: 'complete', data: stats });
      return stats;
    } catch (error) {
      this.emit('search-event', { type: 'error', data: error as Error });
      throw error;
    } finally {
      if (listener) {
        this.off('search-event', listener);
      }
    }
  }

  /**
   * Search in a single file
   */
  async searchInFile(filePath: string, query: string, options: Partial<SearchOptions> = {}): Promise<SearchMatch[]> {
    const fullOptions: SearchOptions = {
      query,
      caseSensitive: options.caseSensitive ?? false,
      wholeWord: options.wholeWord ?? false,
      regex: options.regex ?? false,
    };

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return this.findMatches(content, fullOptions, filePath);
    } catch (error) {
      return [];
    }
  }

  /**
   * Replace all matches
   */
  async replace(options: ReplaceOptions): Promise<{ replacedFiles: number; replacedMatches: number }> {
    const searchOptions: SearchOptions = { ...options };
    const results = await this.searchWithNode(searchOptions);
    
    let replacedFiles = 0;
    let replacedMatches = 0;

    for (const result of results) {
      if (result.matches.length === 0) continue;

      try {
        const content = await fs.promises.readFile(result.file, 'utf-8');
        const lines = content.split('\n');
        let fileModified = false;

        // Sort matches by line and column in reverse order to replace from bottom to top
        const sortedMatches = [...result.matches].sort((a, b) => {
          if (a.line !== b.line) return b.line - a.line;
          return b.column - a.column;
        });

        for (const match of sortedMatches) {
          const lineIndex = match.line - 1;
          if (lineIndex < 0 || lineIndex >= lines.length) continue;

          const line = lines[lineIndex];
          const replacement = this.computeReplacement(match, options.replacement, options.preserveCase);
          
          lines[lineIndex] = 
            line.substring(0, match.column) + 
            replacement + 
            line.substring(match.column + match.length);
          
          fileModified = true;
          replacedMatches++;
        }

        if (fileModified) {
          await fs.promises.writeFile(result.file, lines.join('\n'), 'utf-8');
          replacedFiles++;
        }
      } catch (error) {
        console.error(`Failed to replace in ${result.file}:`, error);
      }
    }

    return { replacedFiles, replacedMatches };
  }

  /**
   * Cancel current search
   */
  cancel(): void {
    this.isCancelled = true;
    if (this.currentSearch) {
      this.currentSearch.kill();
      this.currentSearch = null;
    }
    this.emit('search-event', { type: 'cancelled' });
  }

  /**
   * Search using ripgrep (fast)
   */
  private async searchWithRipgrep(options: SearchOptions): Promise<SearchResult[]> {
    const args = this.buildRipgrepArgs(options);
    const results = new Map<string, SearchResult>();
    let totalMatches = 0;
    const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;

    return new Promise((resolve, reject) => {
      this.currentSearch = spawn(this.ripgrepPath, args, {
        cwd: this.projectRoot,
        shell: true,
      });

      let buffer = '';

      this.currentSearch.stdout?.on('data', (data: Buffer) => {
        if (this.isCancelled) return;

        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          const match = this.parseRipgrepLine(line, options);
          if (match) {
            const existing = results.get(match.file);
            if (existing) {
              existing.matches.push(...match.matches);
              existing.matchCount += match.matchCount;
            } else {
              results.set(match.file, match);
            }
            totalMatches++;

            if (totalMatches >= maxResults) {
              this.cancel();
              break;
            }

            this.emit('search-event', { type: 'result', data: match });
          }
        }
      });

      this.currentSearch.stderr?.on('data', (data: Buffer) => {
        // ripgrep outputs non-critical errors to stderr
        console.warn('ripgrep:', data.toString());
      });

      this.currentSearch.on('close', (code) => {
        this.currentSearch = null;
        if (this.isCancelled) {
          resolve(Array.from(results.values()));
        } else if (code === 0 || code === 1) { // 1 means no matches found
          resolve(Array.from(results.values()));
        } else {
          reject(new Error(`ripgrep exited with code ${code}`));
        }
      });

      this.currentSearch.on('error', (error) => {
        this.currentSearch = null;
        reject(error);
      });
    });
  }

  /**
   * Build ripgrep command arguments
   */
  private buildRipgrepArgs(options: SearchOptions): string[] {
    const args: string[] = [
      '--json',           // Output in JSON format
      '--line-number',    // Show line numbers
      '--column',         // Show column numbers
      '--with-filename',  // Show filenames
      '--context', '2',   // Show 2 lines of context
    ];

    if (!options.caseSensitive) {
      args.push('--ignore-case');
    }

    if (options.wholeWord) {
      args.push('--word-regexp');
    }

    if (!options.regex) {
      args.push('--fixed-strings');
    }

    // Add exclude patterns
    const excludePatterns = [
      ...DEFAULT_EXCLUDE_PATTERNS,
      ...(options.exclude || []),
    ];
    for (const pattern of excludePatterns) {
      args.push('--glob', `!${pattern}`);
    }

    // Add include patterns
    if (options.include && options.include.length > 0) {
      for (const pattern of options.include) {
        args.push('--glob', pattern);
      }
    }

    // Max file size
    const maxSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    args.push('--max-filesize', `${maxSize}B`);

    // Follow symlinks
    if (options.followSymlinks) {
      args.push('--follow');
    }

    // Binary files
    if (!options.includeBinary) {
      args.push('--binary-files', 'without-match');
    }

    // Query
    args.push(options.query);

    return args;
  }

  /**
   * Parse ripgrep JSON output line
   */
  private parseRipgrepLine(line: string, options: SearchOptions): SearchResult | null {
    try {
      const data = JSON.parse(line);
      
      if (data.type === 'match') {
        const filePath = path.resolve(this.projectRoot, data.data.path.text);
        const relativePath = path.relative(this.projectRoot, filePath);
        
        const matches: SearchMatch[] = data.data.submatches.map((sub: any) => ({
          line: data.data.line_number,
          column: sub.start,
          length: sub.end - sub.start,
          text: data.data.lines.text.replace(/\n$/, ''),
          preview: {
            before: data.data.lines.text.substring(0, sub.start),
            match: sub.match.text,
            after: data.data.lines.text.substring(sub.end).replace(/\n$/, ''),
          },
        }));

        return {
          file: filePath,
          relativePath,
          matches,
          matchCount: matches.length,
        };
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Search using Node.js (fallback)
   */
  private async searchWithNode(options: SearchOptions): Promise<SearchResult[]> {
    const results = new Map<string, SearchResult>();
    const filesSearched = { count: 0 };
    const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
    let totalMatches = 0;

    const shouldIncludeFile = (filePath: string): boolean => {
      const relativePath = path.relative(this.projectRoot, filePath);
      
      // Check exclude patterns
      const excludePatterns = [
        ...DEFAULT_EXCLUDE_PATTERNS,
        ...(options.exclude || []),
      ];
      for (const pattern of excludePatterns) {
        if (minimatch(relativePath, pattern, { dot: true })) {
          return false;
        }
      }

      // Check include patterns
      if (options.include && options.include.length > 0) {
        let included = false;
        for (const pattern of options.include) {
          if (minimatch(relativePath, pattern, { dot: true })) {
            included = true;
            break;
          }
        }
        if (!included) return false;
      }

      return true;
    };

    const searchFile = async (filePath: string): Promise<void> => {
      if (this.isCancelled) return;
      if (!shouldIncludeFile(filePath)) return;

      try {
        const stats = await stat(filePath);
        if (!stats.isFile()) return;
        if (stats.size > (options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE)) return;

        filesSearched.count++;
        
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const matches = this.findMatches(content, options, filePath);

        if (matches.length > 0) {
          const result: SearchResult = {
            file: filePath,
            relativePath: path.relative(this.projectRoot, filePath),
            matches,
            matchCount: matches.length,
          };

          results.set(filePath, result);
          totalMatches += matches.length;

          this.emit('search-event', { type: 'result', data: result });
          this.emit('search-event', {
            type: 'progress',
            data: {
              filesSearched: filesSearched.count,
              filesWithMatches: results.size,
              totalMatches,
              completed: false,
              currentFile: filePath,
            } as SearchProgress,
          });

          if (totalMatches >= maxResults) {
            this.isCancelled = true;
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    };

    const traverseDirectory = async (dir: string): Promise<void> => {
      if (this.isCancelled) return;

      try {
        const entries = await readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (this.isCancelled) break;

          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            // Check if directory should be excluded
            const relativePath = path.relative(this.projectRoot, fullPath);
            const excludePatterns = [
              ...DEFAULT_EXCLUDE_PATTERNS,
              ...(options.exclude || []),
            ];
            let shouldSkip = false;
            for (const pattern of excludePatterns) {
              if (minimatch(relativePath + '/', pattern, { dot: true })) {
                shouldSkip = true;
                break;
              }
            }
            
            if (!shouldSkip) {
              await traverseDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            await searchFile(fullPath);
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    };

    await traverseDirectory(this.projectRoot);

    this.emit('search-event', {
      type: 'progress',
      data: {
        filesSearched: filesSearched.count,
        filesWithMatches: results.size,
        totalMatches,
        completed: true,
      } as SearchProgress,
    });

    return Array.from(results.values());
  }

  /**
   * Find matches in file content
   */
  private findMatches(content: string, options: SearchOptions, filePath: string): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const lines = content.split('\n');

    const regex = this.buildSearchRegex(options);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match: RegExpExecArray | null;

      // Reset regex for each line
      regex.lastIndex = 0;

      while ((match = regex.exec(line)) !== null) {
        const matchText = match[0];
        const column = match.index;

        matches.push({
          line: i + 1,
          column,
          length: matchText.length,
          text: line,
          preview: {
            before: line.substring(0, column),
            match: matchText,
            after: line.substring(column + matchText.length),
          },
        });

        // Prevent infinite loop on zero-length matches
        if (matchText.length === 0) {
          regex.lastIndex++;
        }
      }
    }

    return matches;
  }

  /**
   * Build search regex from options
   */
  private buildSearchRegex(options: SearchOptions): RegExp {
    let pattern = options.query;

    if (!options.regex) {
      // Escape special regex characters
      pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    if (options.wholeWord) {
      pattern = `\\b${pattern}\\b`;
    }

    const flags = options.caseSensitive ? 'g' : 'gi';

    return new RegExp(pattern, flags);
  }

  /**
   * Compute replacement text with optional case preservation
   */
  private computeReplacement(match: SearchMatch, replacement: string, preserveCase?: boolean): string {
    if (!preserveCase) return replacement;

    const originalText = match.preview.match;
    
    // Check case patterns
    if (originalText === originalText.toUpperCase()) {
      return replacement.toUpperCase();
    } else if (originalText === originalText.toLowerCase()) {
      return replacement.toLowerCase();
    } else if (originalText[0] === originalText[0]?.toUpperCase()) {
      // PascalCase
      return replacement[0]?.toUpperCase() + replacement.slice(1);
    }

    return replacement;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.cancel();
    this.removeAllListeners();
  }
}
