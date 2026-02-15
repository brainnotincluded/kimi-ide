/**
 * Kimi IDE - Security Reviewer
 * Проверяет security vulnerabilities, hardcoded secrets, unsafe patterns
 */

import * as vscode from 'vscode';
import { BaseReviewer } from './baseReviewer';
import { ReviewIssue, ReviewCategory, QuickFix } from '../types';
import { logger } from '../../utils/logger';

interface SecurityPattern {
    name: string;
    regex: RegExp;
    languages: string[];
    severity: ReviewIssue['severity'];
    message: string;
    description?: string;
    cwe?: string; // Common Weakness Enumeration ID
    generateFix?: (match: string, document: vscode.TextDocument, range: vscode.Range) => QuickFix | undefined;
}

export class SecurityReviewer extends BaseReviewer {
    readonly id = 'security';
    readonly name = 'Security Analyzer';
    readonly category: ReviewCategory = 'security';
    
    private securityPatterns: SecurityPattern[] = [
        // Hardcoded secrets
        {
            name: 'hardcoded-api-key',
            regex: /['"\`]([a-zA-Z_]*(?:api[_-]?key|apikey|api[_-]?secret|secret[_-]?key|auth[_-]?token|access[_-]?token)[\s]*['"\`]\s*[:=]\s*['"\`][a-zA-Z0-9_\-]{16,}['"\`]/i,
            languages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
            severity: 'error',
            message: 'Potential hardcoded API key or secret detected',
            description: 'Hardcoded credentials can be exposed in version control. Use environment variables or a secrets manager.',
            cwe: 'CWE-798',
        },
        {
            name: 'hardcoded-password',
            regex: /['"\`](?:password|passwd|pwd)['"\`]\s*[:=]\s*['"\`][^'"\`]+['"\`]/i,
            languages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
            severity: 'error',
            message: 'Potential hardcoded password detected',
            description: 'Never hardcode passwords in source code. Use environment variables or a secure vault.',
            cwe: 'CWE-259',
        },
        {
            name: 'private-key',
            regex: /-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/,
            languages: [],
            severity: 'error',
            message: 'Private key detected in source code',
            description: 'Private keys should never be committed to version control.',
            cwe: 'CWE-798',
        },
        {
            name: 'aws-access-key',
            regex: /AKIA[0-9A-Z]{16}/,
            languages: [],
            severity: 'error',
            message: 'AWS Access Key ID detected',
            description: 'AWS credentials should be stored securely, not in source code.',
            cwe: 'CWE-798',
        },
        {
            name: 'aws-secret-key',
            regex: /['"`]?[a-zA-Z0-9/+=]{40}['"`]/,
            languages: [],
            severity: 'warning',
            message: 'Possible AWS Secret Access Key detected',
            description: 'Verify this is not an actual AWS secret key.',
        },
        {
            name: 'github-token',
            regex: /gh[pousr]_[A-Za-z0-9_]{36,}/,
            languages: [],
            severity: 'error',
            message: 'GitHub token detected',
            description: 'GitHub tokens should be stored securely.',
        },
        {
            name: 'slack-token',
            regex: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}(-[a-zA-Z0-9]{24})?/,
            languages: [],
            severity: 'error',
            message: 'Slack token detected',
            description: 'Slack tokens should be stored in environment variables.',
        },
        
        // SQL Injection
        {
            name: 'sql-injection-string-concat',
            regex: /(?:query|execute|exec)\s*\(\s*['"`][^'"`]*\$\{[^}]+\}/i,
            languages: ['javascript', 'typescript'],
            severity: 'error',
            message: 'Possible SQL injection vulnerability',
            description: 'String interpolation in SQL queries can lead to SQL injection. Use parameterized queries.',
            cwe: 'CWE-89',
        },
        {
            name: 'sql-injection-plus-concat',
            regex: /(?:query|execute|exec)\s*\(\s*["']SELECT\s+.*\+\s*[^+]+\+/i,
            languages: ['javascript', 'typescript', 'java', 'c', 'cpp'],
            severity: 'error',
            message: 'Possible SQL injection vulnerability',
            description: 'String concatenation in SQL queries is dangerous. Use parameterized queries.',
            cwe: 'CWE-89',
        },
        {
            name: 'raw-sql-format',
            regex: /\.format\s*\(\s*[^)]+\).*\b(?:SELECT|INSERT|UPDATE|DELETE|DROP)\b/i,
            languages: ['python'],
            severity: 'error',
            message: 'Possible SQL injection via string formatting',
            description: 'Never use format() or % formatting for SQL queries. Use parameterized queries with %s placeholders.',
            cwe: 'CWE-89',
        },
        
        // XSS vulnerabilities
        {
            name: 'dangerous-innerHTML',
            regex: /\.innerHTML\s*=\s*[^;]+/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'Potential XSS vulnerability with innerHTML',
            description: 'Setting innerHTML with untrusted data can lead to XSS. Consider using textContent or sanitization.',
            cwe: 'CWE-79',
        },
        {
            name: 'dangerous-document-write',
            regex: /document\.write\s*\(\s*[^)]+\)/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'document.write can be dangerous',
            description: 'document.write with untrusted content can lead to XSS.',
            cwe: 'CWE-79',
        },
        {
            name: 'dangerous-eval',
            regex: /\beval\s*\(\s*[^)]+\)/,
            languages: ['javascript', 'typescript'],
            severity: 'error',
            message: 'eval() is dangerous and should be avoided',
            description: 'eval() can execute arbitrary code and is a major security risk.',
            cwe: 'CWE-95',
        },
        {
            name: 'dangerous-function-constructor',
            regex: /new\s+Function\s*\(\s*[^)]+\)/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'Function constructor is similar to eval()',
            description: 'The Function constructor can execute arbitrary code.',
            cwe: 'CWE-95',
        },
        {
            name: 'react-dangerously-set-innerHTML',
            regex: /dangerouslySetInnerHTML\s*:\s*\{\s*__html\s*:/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'dangerouslySetInnerHTML can cause XSS',
            description: 'Ensure the HTML content is properly sanitized before using dangerouslySetInnerHTML.',
            cwe: 'CWE-79',
        },
        
        // Path traversal
        {
            name: 'path-traversal',
            regex: /(?:readFile|readFileSync|writeFile|writeFileSync|createReadStream|createWriteStream)\s*\(\s*[^)]+\+\s*[^)]+\)/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'Possible path traversal vulnerability',
            description: 'User input in file paths can lead to path traversal. Validate and sanitize paths.',
            cwe: 'CWE-22',
        },
        {
            name: 'python-path-traversal',
            regex: /open\s*\(\s*[^)]+\+\s*[^)]+\)/,
            languages: ['python'],
            severity: 'warning',
            message: 'Possible path traversal vulnerability',
            description: 'User input in file paths can lead to path traversal.',
            cwe: 'CWE-22',
        },
        
        // Command injection
        {
            name: 'command-injection-exec',
            regex: /(?:exec|execSync|spawn)\s*\(\s*['"`][^'"`]*\$\{[^}]+\}/,
            languages: ['javascript', 'typescript'],
            severity: 'error',
            message: 'Possible command injection',
            description: 'User input in shell commands can lead to command injection. Use parameterized commands.',
            cwe: 'CWE-78',
        },
        {
            name: 'python-os-system',
            regex: /os\.system\s*\(\s*[^)]+\+\s*[^)]+\)/,
            languages: ['python'],
            severity: 'error',
            message: 'Possible command injection via os.system',
            description: 'Never pass user input to os.system(). Use subprocess with a list of arguments.',
            cwe: 'CWE-78',
        },
        {
            name: 'python-subprocess-shell',
            regex: /subprocess\.(?:run|call|Popen)\s*\([^)]*shell\s*=\s*True/,
            languages: ['python'],
            severity: 'warning',
            message: 'subprocess with shell=True is dangerous',
            description: 'Using shell=True with user input can lead to command injection.',
            cwe: 'CWE-78',
        },
        
        // Insecure protocols
        {
            name: 'insecure-http',
            regex: /['"]http:\/\/[^'"]+['"]/,
            languages: [],
            severity: 'info',
            message: 'Using insecure HTTP protocol',
            description: 'Consider using HTTPS for secure communication.',
        },
        {
            name: 'insecure-ftp',
            regex: /['"]ftp:\/\/[^'"]+['"]/,
            languages: [],
            severity: 'warning',
            message: 'Using insecure FTP protocol',
            description: 'FTP transmits credentials in plaintext. Use SFTP or FTPS instead.',
        },
        
        // Crypto issues
        {
            name: 'weak-md5-hash',
            regex: /(?:md5|MD5)\s*\(/,
            languages: ['javascript', 'typescript', 'python', 'java', 'go'],
            severity: 'warning',
            message: 'MD5 is cryptographically broken',
            description: 'MD5 is vulnerable to collision attacks. Use SHA-256 or better.',
            cwe: 'CWE-328',
        },
        {
            name: 'weak-sha1-hash',
            regex: /(?:sha1|SHA1|sha-1|SHA-1)\s*\(/,
            languages: ['javascript', 'typescript', 'python', 'java', 'go'],
            severity: 'info',
            message: 'SHA-1 is considered weak',
            description: 'SHA-1 has known weaknesses. Consider using SHA-256 for security-sensitive operations.',
            cwe: 'CWE-328',
        },
        {
            name: 'insecure-random',
            regex: /Math\.random\s*\(\)/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'Math.random() is not cryptographically secure',
            description: 'Use crypto.getRandomValues() or crypto.randomBytes() for security-sensitive operations.',
            cwe: 'CWE-338',
        },
        {
            name: 'python-insecure-random',
            regex: /random\.(?:random|randint|choice|shuffle)/,
            languages: ['python'],
            severity: 'warning',
            message: 'Python random module is not cryptographically secure',
            description: 'Use secrets module for security-sensitive random number generation.',
            cwe: 'CWE-338',
        },
        
        // Regex DoS
        {
            name: 'regex-dos',
            regex: /\([\w\W]*\+\+|\([\w\W]*\+\+|\([\w\W]*\*\+|\([\w\W]*\+\*/,
            languages: ['javascript', 'typescript', 'python', 'java'],
            severity: 'info',
            message: 'Potential ReDoS (Regex Denial of Service) pattern',
            description: 'Complex regex patterns with nested quantifiers can be exploited for ReDoS attacks.',
            cwe: 'CWE-400',
        },
        
        // Disabled security features
        {
            name: 'disabled-tls-verification',
            regex: /NODE_TLS_REJECT_UNAUTHORIZED.*0|rejectUnauthorized\s*:\s*false/,
            languages: ['javascript', 'typescript'],
            severity: 'error',
            message: 'TLS certificate verification is disabled',
            description: 'Never disable TLS verification in production. This makes you vulnerable to MITM attacks.',
            cwe: 'CWE-295',
        },
        {
            name: 'disabled-cert-validation',
            regex: /verify\s*=\s*False|CERT_NONE|CERT_OPTIONAL/,
            languages: ['python'],
            severity: 'error',
            message: 'SSL certificate validation is disabled',
            description: 'Disabling SSL verification is dangerous and should never be done in production.',
            cwe: 'CWE-295',
        },
        
        // SSRF
        {
            name: 'ssrf-fetch',
            regex: /fetch\s*\(\s*[^)]*(?:req\.|request\.|params\.|query\.)/i,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'Possible SSRF vulnerability',
            description: 'User-controlled URLs in fetch requests can lead to Server-Side Request Forgery.',
            cwe: 'CWE-918',
        },
    ];
    
    protected getSupportedLanguages(): string[] {
        return []; // Empty means all languages (patterns specify their own)
    }
    
    protected async performReview(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<ReviewIssue[]> {
        const issues: ReviewIssue[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        
        // Get applicable patterns
        const applicablePatterns = this.securityPatterns.filter(
            p => p.languages.length === 0 || p.languages.includes(document.languageId)
        );
        
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            if (token.isCancellationRequested) {
                break;
            }
            
            const line = lines[lineIndex];
            
            for (const pattern of applicablePatterns) {
                pattern.regex.lastIndex = 0;
                
                let match: RegExpExecArray | null;
                while ((match = pattern.regex.exec(line)) !== null) {
                    const startChar = match.index;
                    const endChar = startChar + match[0].length;
                    
                    const range = new vscode.Range(
                        lineIndex,
                        startChar,
                        lineIndex,
                        endChar
                    );
                    
                    const issue = this.createIssue(
                        document,
                        range,
                        pattern.severity,
                        pattern.name,
                        pattern.message,
                        {
                            detail: pattern.description,
                            confidence: pattern.severity === 'error' ? 0.9 : 0.75,
                            relatedInformation: pattern.cwe ? [
                                {
                                    message: `Reference: ${pattern.cwe}`,
                                    range,
                                    fileUri: document.uri,
                                }
                            ] : undefined,
                        }
                    );
                    
                    // Generate quick fix if available
                    if (pattern.generateFix) {
                        const fix = pattern.generateFix(match[0], document, range);
                        if (fix) {
                            issue.quickFixes = [fix];
                        }
                    }
                    
                    issues.push(issue);
                }
            }
        }
        
        // Check for dependency vulnerabilities (package.json, requirements.txt, etc.)
        await this.checkDependencies(document, issues, token);
        
        return issues;
    }
    
    private async checkDependencies(
        document: vscode.TextDocument,
        issues: ReviewIssue[],
        token: vscode.CancellationToken
    ): Promise<void> {
        const fileName = document.fileName;
        
        // Check for known vulnerable dependency patterns
        if (fileName.endsWith('package.json')) {
            const text = document.getText();
            
            // Check for exact versions (best practice)
            const versionPatterns = [
                /"dependencies":\s*\{[\s\S]*?\}/,
                /"devDependencies":\s*\{[\s\S]*?\}/,
            ];
            
            for (const pattern of versionPatterns) {
                const match = text.match(pattern);
                if (match) {
                    // Check for wildcard versions
                    if (match[0].includes('"*"') || match[0].includes('"latest"')) {
                        const index = text.indexOf(match[0]);
                        const lines = text.substring(0, index).split('\n');
                        const line = lines.length - 1;
                        
                        const range = new vscode.Range(line, 0, line, 50);
                        
                        issues.push(this.createIssue(
                            document,
                            range,
                            'warning',
                            'wildcard-dependency-version',
                            'Wildcard (*) or "latest" dependency versions detected',
                            {
                                detail: 'Using wildcard versions can introduce breaking changes or vulnerabilities. Use exact versions or lock files.',
                                confidence: 0.8,
                            }
                        ));
                    }
                }
            }
        }
        
        // Check for http protocol in URLs
        const text = document.getText();
        const httpUrls = text.match(/['"]http:\/\/[^'"]+['"]/g);
        if (httpUrls && httpUrls.length > 0) {
            // Already caught by the pattern above, but we can add more context here
            logger.debug(`Found ${httpUrls.length} HTTP URLs in ${fileName}`);
        }
    }
}
