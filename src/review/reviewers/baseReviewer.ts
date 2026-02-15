/**
 * Kimi IDE - Base Reviewer
 * Базовый класс для всех reviewer'ов
 */

import * as vscode from 'vscode';
import { IReviewer, ReviewerResult, ReviewIssue, ReviewCategory, ReviewConfig, ReviewerConfig } from '../types';
import { logger } from '../../utils/logger';
import { generateId, generateIssueHash } from '../utils';

export abstract class BaseReviewer implements IReviewer {
    protected disposables: vscode.Disposable[] = [];
    protected config!: ReviewerConfig;
    
    abstract readonly id: string;
    abstract readonly name: string;
    abstract readonly category: ReviewCategory;
    
    constructor() {
        this.loadConfig();
        
        // Watch for config changes
        const disposable = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('kimi.review')) {
                this.loadConfig();
            }
        });
        this.disposables.push(disposable);
    }
    
    /**
     * Load configuration for this reviewer
     */
    protected loadConfig(): void {
        const reviewConfig = vscode.workspace.getConfiguration('kimi.review');
        const reviewerConfig = reviewConfig.get<ReviewerConfig>(this.id, {
            enabled: true,
            severity: 'warning',
        });
        this.config = reviewerConfig;
    }
    
    /**
     * Check if this reviewer is enabled
     */
    isEnabled(): boolean {
        return this.config?.enabled !== false;
    }
    
    /**
     * Check if this reviewer can review the document
     */
    canReview(document: vscode.TextDocument): boolean {
        if (!this.isEnabled()) {
            return false;
        }
        
        // Check if language is supported
        const supportedLanguages = this.getSupportedLanguages();
        if (supportedLanguages.length > 0 && !supportedLanguages.includes(document.languageId)) {
            return false;
        }
        
        // Check include/exclude patterns
        const filePath = document.uri.fsPath;
        
        if (this.config.excludePatterns) {
            for (const pattern of this.config.excludePatterns) {
                if (this.matchesPattern(filePath, pattern)) {
                    return false;
                }
            }
        }
        
        if (this.config.includePatterns && this.config.includePatterns.length > 0) {
            let matchesAny = false;
            for (const pattern of this.config.includePatterns) {
                if (this.matchesPattern(filePath, pattern)) {
                    matchesAny = true;
                    break;
                }
            }
            if (!matchesAny) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Get supported languages for this reviewer
     * Override in subclasses
     */
    protected getSupportedLanguages(): string[] {
        return []; // Empty means all languages
    }
    
    /**
     * Check if a file path matches a glob pattern
     */
    private matchesPattern(filePath: string, pattern: string): boolean {
        const regex = new RegExp(
            pattern
                .replace(/\*\*/g, '<<<GLOBSTAR>>>')
                .replace(/\*/g, '[^/]*')
                .replace(/\?/g, '.')
                .replace(/<<<GLOBSTAR>>>/g, '.*')
        );
        return regex.test(filePath);
    }
    
    /**
     * Review a document
     */
    async review(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<ReviewerResult> {
        const startTime = Date.now();
        
        logger.debug(`[${this.name}] Starting review of ${document.uri.fsPath}`);
        
        try {
            const issues = await this.performReview(document, token);
            
            if (token.isCancellationRequested) {
                return {
                    reviewerId: this.id,
                    reviewerName: this.name,
                    status: 'cancelled',
                    issues: [],
                    duration: Date.now() - startTime,
                };
            }
            
            logger.debug(`[${this.name}] Found ${issues.length} issues in ${Date.now() - startTime}ms`);
            
            return {
                reviewerId: this.id,
                reviewerName: this.name,
                status: 'completed',
                issues,
                duration: Date.now() - startTime,
            };
            
        } catch (error) {
            logger.error(`[${this.name}] Review failed:`, error);
            
            return {
                reviewerId: this.id,
                reviewerName: this.name,
                status: 'error',
                issues: [],
                duration: Date.now() - startTime,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    
    /**
     * Perform the actual review
     * Override this method in subclasses
     */
    protected abstract performReview(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<ReviewIssue[]>;
    
    /**
     * Create a review issue
     */
    protected createIssue(
        document: vscode.TextDocument,
        range: vscode.Range,
        severity: ReviewIssue['severity'],
        title: string,
        message: string,
        options: Partial<Omit<ReviewIssue, 'id' | 'category' | 'fileUri' | 'range' | 'severity' | 'title' | 'message' | 'hash' | 'timestamp' | 'reviewerId'>> = {}
    ): ReviewIssue {
        const id = generateId();
        const hash = generateIssueHash(this.category, document.uri, range, message);
        
        return {
            id,
            category: this.category,
            fileUri: document.uri,
            range,
            severity,
            title,
            message,
            confidence: options.confidence ?? 0.8,
            reviewerId: this.id,
            timestamp: Date.now(),
            hash,
            ...options,
        };
    }
    
    /**
     * Get the severity level from config or use default
     */
    protected getSeverity(defaultSeverity: ReviewIssue['severity'] = 'warning'): ReviewIssue['severity'] {
        return this.config?.severity ?? defaultSeverity;
    }
    
    /**
     * Dispose all resources
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
