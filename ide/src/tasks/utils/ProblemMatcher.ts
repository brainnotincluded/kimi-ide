/**
 * Problem Matcher
 * Parses task output for errors and warnings
 */

import * as path from 'path';
import { ProblemPattern, TaskProblem, ProblemMatcher } from '../types';



export class ProblemMatcherService {
  private builtInMatchers: Map<string, ProblemMatcher> = new Map([
    ['$tsc', {
      name: '$tsc',
      pattern: {
        regexp: '^(.*\\.ts\\.\\d+)?\\s*\\(?\\d+,\\d+\\)?:?\\s*(error|warning|info)\\s*(TS\\d+)?:?\\s*(.*)$',
        file: 1,
        severity: 2,
        code: 3,
        message: 4,
      },
      fileLocation: 'relative',
    }],
    ['$eslint-stylish', {
      name: '$eslint-stylish',
      pattern: {
        regexp: '^(.+):(\\d+):(\\d+):\\s*(error|warning)\\s*(.+)$',
        file: 1,
        line: 2,
        column: 3,
        severity: 4,
        message: 5,
      },
      fileLocation: 'absolute',
    }],
    ['$rustc', {
      name: '$rustc',
      pattern: {
        regexp: '^(error|warning)(\\[E\\d+\\])?:\\s*(.+)$',
        severity: 1,
        code: 2,
        message: 3,
      },
      fileLocation: 'relative',
    }],
  ]);

  public getBuiltInMatcher(name: string): ProblemMatcher | undefined {
    return this.builtInMatchers.get(name);
  }

  public getAllBuiltInMatchers(): ProblemMatcher[] {
    return Array.from(this.builtInMatchers.values());
  }

  public match(line: string, matcher: ProblemMatcher, workspacePath: string): TaskProblem | null {
    const patterns = Array.isArray(matcher.pattern) ? matcher.pattern : [matcher.pattern];

    for (const pattern of patterns) {
      const regex = new RegExp(pattern.regexp);
      const match = regex.exec(line);

      if (match) {
        const problem = this.createProblem(match, pattern, matcher, workspacePath);
        if (problem) {
          return problem;
        }
      }
    }

    return null;
  }

  private createProblem(
    match: RegExpExecArray,
    pattern: ProblemPattern,
    matcher: ProblemMatcher,
    workspacePath: string
  ): TaskProblem | null {
    const file = pattern.file ? match[pattern.file] : undefined;
    const line = pattern.line ? parseInt(match[pattern.line], 10) : 0;
    const column = pattern.column ? parseInt(match[pattern.column], 10) : 0;
    const severity = (pattern.severity ? match[pattern.severity] : 'error') as 'error' | 'warning' | 'info';
    const message = pattern.message ? match[pattern.message] : 'Unknown error';
    const code = pattern.code ? match[pattern.code] : undefined;

    let resolvedFile = file;
    if (file && matcher.fileLocation === 'relative') {
      resolvedFile = `${workspacePath}/${file}`;
    }

    return {
      file: resolvedFile || '',
      line,
      column,
      severity,
      message,
      code,
      raw: match[0],
    };
  }

  public processOutput(output: string, matcherName: string, workspacePath: string): TaskProblem[] {
    const matcher = this.getBuiltInMatcher(matcherName);
    if (!matcher) {
      return [];
    }

    const problems: TaskProblem[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const problem = this.match(line, matcher, workspacePath);
      if (problem) {
        problems.push(problem);
      }
    }

    return problems;
  }
}

export const problemMatcherService = new ProblemMatcherService();
