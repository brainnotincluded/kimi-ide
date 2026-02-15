/**
 * Kimi IDE - Review Engine
 * Движок автоматического code review
 * Запускает reviewers параллельно, кеширует результаты
 */

import * as vscode from 'vscode';
import { IReviewer, ReviewResult, ReviewConfig, ReviewCacheEntry, ReviewEvent } from './types';
import { SemanticReviewer } from './reviewers/semanticReviewer';
import { StyleReviewer } from './reviewers/styleReviewer';
import { SecurityReviewer } from './reviewers/securityReviewer';
import { PerformanceReviewer } from './reviewers/performanceReviewer';
import { TestReviewer } from './reviewers/testReviewer';
import { logger } from '../utils/logger';
import { calculateContentHash, createSummary, debounce } from './utils';

export class ReviewEngine implements vscode.Disposable {
    private reviewers: IReviewer[] = [];
    private cache: Map<string, ReviewCacheEntry> = new Map();
    private disposables: vscode.Disposable[] = [];
    private eventEmitter: vscode.EventEmitter<ReviewEvent> = new vscode.EventEmitter<ReviewEvent>();
    private config: ReviewConfig;
    private isRunning: boolean = false;
    private pendingReviews: Map<string, vscode.CancellationTokenSource> = new Map();
    
    // Debounced review trigger
    private debouncedReview: Map<string, (document: vscode.TextDocument) => void> = new Map();
    
    public readonly onReviewEvent = this.eventEmitter.event;
    
    constructor() {
        this.config = this.loadConfig();
        this.initializeReviewers();
        this.registerEventListeners();
    }
    
    /**
     * Load configuration from VS Code settings
     */
    private loadConfig(): ReviewConfig {
        const config = vscode.workspace.getConfiguration('kimi.review');
        
        return {
            enabled: config.get<boolean>('enabled', true),
            runOnSave: config.get<boolean>('runOnSave', true),
            runOnType: config.get<boolean>('runOnType', false),
            debounceMs: config.get<number>('debounceMs', 500),
            excludePatterns: config.get<string[]>('excludePatterns', [
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
                '**/.git/**',
                '**/coverage/**',
                '**/*.min.js',
                '**/*.d.ts',
            ]),
            includePatterns: config.get<string[]>('includePatterns', []),
            reviewers: {
                semantic: {
                    enabled: config.get<boolean>('reviewers.semantic.enabled', true),
                    severity: config.get<ReviewConfig['reviewers']['semantic']['severity']>('reviewers.semantic.severity', 'warning'),
                },
                style: {
                    enabled: config.get<boolean>('reviewers.style.enabled', true),
                    severity: config.get<ReviewConfig['reviewers']['style']['severity']>('reviewers.style.severity', 'info'),
                },
                security: {
                    enabled: config.get<boolean>('reviewers.security.enabled', true),
                    severity: config.get<ReviewConfig['reviewers']['security']['severity']>('reviewers.security.severity', 'error'),
                },
                performance: {
                    enabled: config.get<boolean>('reviewers.performance.enabled', true),
                    severity: config.get<ReviewConfig['reviewers']['performance']['severity']>('reviewers.performance.severity', 'warning'),
                },
                test: {
                    enabled: config.get<boolean>('reviewers.test.enabled', true),
                    severity: config.get<ReviewConfig['reviewers']['test']['severity']>('reviewers.test.severity', 'info'),
                },
            },
        };
    }
    
    /**
     * Initialize all reviewers
     */
    private initializeReviewers(): void {
        if (!this.config.enabled) {
            return;
        }
        
        const reviewerClasses = [
            { Class: SemanticReviewer, key: 'semantic' as const },
            { Class: StyleReviewer, key: 'style' as const },
            { Class: SecurityReviewer, key: 'security' as const },
            { Class: PerformanceReviewer, key: 'performance' as const },
            { Class: TestReviewer, key: 'test' as const },
        ];
        
        for (const { Class, key } of reviewerClasses) {
            if (this.config.reviewers[key].enabled) {
                try {
                    const reviewer = new Class();
                    this.reviewers.push(reviewer);
                    logger.debug(`Initialized reviewer: ${reviewer.name}`);
                } catch (error) {
                    logger.error(`Failed to initialize reviewer ${key}:`, error);
                }
            }
        }
        
        logger.info(`Review engine initialized with ${this.reviewers.length} reviewers`);
    }
    
    /**
     * Register event listeners
     */
    private registerEventListeners(): void {
        // Watch for configuration changes
        const configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('kimi.review')) {
                this.reloadConfig();
            }
        });
        this.disposables.push(configDisposable);
    }
    
    /**
     * Reload configuration
     */
    private reloadConfig(): void {
        this.config = this.loadConfig();
        
        // Re-initialize reviewers if needed
        this.disposeReviewers();
        this.reviewers = [];
        this.initializeReviewers();
    }
    
    /**
     * Dispose all reviewers
     */
    private disposeReviewers(): void {
        for (const reviewer of this.reviewers) {
            reviewer.dispose();
        }
    }
    
    /**
     * Check if a document should be reviewed
     */
    private shouldReviewDocument(document: vscode.TextDocument): boolean {
        if (!this.config.enabled) {
            return false;
        }
        
        // Skip untitled and binary files
        if (document.uri.scheme !== 'file' || document.isUntitled) {
            return false;
        }
        
        const filePath = document.uri.fsPath;
        
        // Check exclude patterns
        for (const pattern of this.config.excludePatterns) {
            if (this.matchesPattern(filePath, pattern)) {
                return false;
            }
        }
        
        // Check include patterns
        if (this.config.includePatterns.length > 0) {
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
     * Check if file path matches a glob pattern
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
    public async reviewDocument(document: vscode.TextDocument): Promise<ReviewResult> {
        if (!this.shouldReviewDocument(document)) {
            return this.createEmptyResult(document);
        }
        
        const fileUri = document.uri.toString();
        const contentHash = calculateContentHash(document.getText());
        
        // Check cache
        const cached = this.cache.get(fileUri);
        if (cached && cached.contentHash === contentHash) {
            logger.debug(`Using cached review result for ${fileUri}`);
            return cached.result;
        }
        
        // Cancel any pending review for this file
        this.cancelReview(fileUri);
        
        // Create new cancellation token
        const tokenSource = new vscode.CancellationTokenSource();
        this.pendingReviews.set(fileUri, tokenSource);
        
        // Emit started event
        this.eventEmitter.fire({
            type: 'started',
            fileUri: document.uri,
        });
        
        const startTime = Date.now();
        
        try {
            // Run all reviewers in parallel
            const enabledReviewers = this.reviewers.filter(r => r.canReview(document));
            
            if (enabledReviewers.length === 0) {
                return this.createEmptyResult(document);
            }
            
            logger.debug(`Running ${enabledReviewers.length} reviewers for ${fileUri}`);
            
            const reviewerResults = await Promise.all(
                enabledReviewers.map(reviewer => 
                    reviewer.review(document, tokenSource.token)
                )
            );
            
            // Check if cancelled
            if (tokenSource.token.isCancellationRequested) {
                this.eventEmitter.fire({
                    type: 'cancelled',
                    fileUri: document.uri,
                });
                return this.createCancelledResult(document);
            }
            
            // Aggregate all issues
            const allIssues = reviewerResults.flatMap(r => r.issues);
            
            // Create result
            const result: ReviewResult = {
                fileUri: document.uri,
                fileVersion: document.version,
                timestamp: Date.now(),
                status: 'completed',
                reviewerResults,
                allIssues,
                summary: createSummary(allIssues),
            };
            
            // Cache the result
            this.cache.set(fileUri, {
                result,
                contentHash,
            });
            
            // Clean up old cache entries if cache is too large
            if (this.cache.size > 100) {
                const oldestKey = this.cache.keys().next().value;
                this.cache.delete(oldestKey);
            }
            
            logger.debug(`Review completed in ${Date.now() - startTime}ms, found ${allIssues.length} issues`);
            
            // Emit completed event
            this.eventEmitter.fire({
                type: 'completed',
                fileUri: document.uri,
                result,
            });
            
            return result;
            
        } catch (error) {
            logger.error('Review failed:', error);
            
            this.eventEmitter.fire({
                type: 'error',
                fileUri: document.uri,
                error: error instanceof Error ? error.message : String(error),
            });
            
            return this.createErrorResult(document, error);
        } finally {
            this.pendingReviews.delete(fileUri);
            tokenSource.dispose();
        }
    }
    
    /**
     * Review a document with debouncing (for onType events)
     */
    public reviewDocumentDebounced(document: vscode.TextDocument): void {
        if (!this.config.runOnType) {
            return;
        }
        
        const fileUri = document.uri.toString();
        
        // Create debounced function if not exists
        if (!this.debouncedReview.has(fileUri)) {
            const debouncedFn = debounce((doc: vscode.TextDocument) => {
                this.reviewDocument(doc).catch(error => {
                    logger.error('Debounced review failed:', error);
                });
            }, this.config.debounceMs);
            
            this.debouncedReview.set(fileUri, debouncedFn);
        }
        
        // Call debounced function
        const debouncedFn = this.debouncedReview.get(fileUri)!;
        debouncedFn(document);
    }
    
    /**
     * Cancel a pending review
     */
    private cancelReview(fileUri: string): void {
        const tokenSource = this.pendingReviews.get(fileUri);
        if (tokenSource) {
            tokenSource.cancel();
            tokenSource.dispose();
            this.pendingReviews.delete(fileUri);
        }
    }
    
    /**
     * Create an empty result for documents that shouldn't be reviewed
     */
    private createEmptyResult(document: vscode.TextDocument): ReviewResult {
        return {
            fileUri: document.uri,
            fileVersion: document.version,
            timestamp: Date.now(),
            status: 'completed',
            reviewerResults: [],
            allIssues: [],
            summary: {
                totalIssues: 0,
                errorCount: 0,
                warningCount: 0,
                infoCount: 0,
                hintCount: 0,
                byCategory: {
                    semantic: 0,
                    style: 0,
                    security: 0,
                    performance: 0,
                    test: 0,
                    maintainability: 0,
                },
                hasAutoFixes: 0,
                score: 100,
            },
        };
    }
    
    /**
     * Create a cancelled result
     */
    private createCancelledResult(document: vscode.TextDocument): ReviewResult {
        return {
            ...this.createEmptyResult(document),
            status: 'cancelled',
        };
    }
    
    /**
     * Create an error result
     */
    private createErrorResult(document: vscode.TextDocument, error: unknown): ReviewResult {
        return {
            ...this.createEmptyResult(document),
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
        };
    }
    
    /**
     * Get cached result for a document
     */
    public getCachedResult(document: vscode.TextDocument): ReviewResult | undefined {
        const fileUri = document.uri.toString();
        const contentHash = calculateContentHash(document.getText());
        
        const cached = this.cache.get(fileUri);
        if (cached && cached.contentHash === contentHash) {
            return cached.result;
        }
        
        return undefined;
    }
    
    /**
     * Clear the cache
     */
    public clearCache(): void {
        this.cache.clear();
        logger.info('Review cache cleared');
    }
    
    /**
     * Remove a document from cache
     */
    public invalidateCache(document: vscode.TextDocument): void {
        const fileUri = document.uri.toString();
        this.cache.delete(fileUri);
    }
    
    /**
     * Get statistics
     */
    public getStats(): {
        reviewersCount: number;
        cachedResults: number;
        pendingReviews: number;
    } {
        return {
            reviewersCount: this.reviewers.length,
            cachedResults: this.cache.size,
            pendingReviews: this.pendingReviews.size,
        };
    }
    
    /**
     * Dispose all resources
     */
    public dispose(): void {
        // Cancel all pending reviews
        for (const [uri, tokenSource] of this.pendingReviews) {
            tokenSource.cancel();
            tokenSource.dispose();
        }
        this.pendingReviews.clear();
        
        // Dispose reviewers
        this.disposeReviewers();
        this.reviewers = [];
        
        // Clear cache
        this.cache.clear();
        this.debouncedReview.clear();
        
        // Dispose disposables
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        
        this.eventEmitter.dispose();
        
        logger.info('Review engine disposed');
    }
}
