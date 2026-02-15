/**
 * Kimi IDE - Automatic Code Review Types
 * Типы и интерфейсы для системы автоматического ревью кода
 */

import * as vscode from 'vscode';

/**
 * Severity levels for review issues
 */
export type ReviewSeverity = 'error' | 'warning' | 'info' | 'hint';

/**
 * Categories of review issues
 */
export type ReviewCategory =
    | 'semantic'      // Logic bugs, edge cases
    | 'style'         // Code style, naming
    | 'security'      // Security vulnerabilities
    | 'performance'   // Performance issues
    | 'test'          // Test coverage, quality
    | 'maintainability'; // Code complexity, documentation

/**
 * Status of a review result
 */
export type ReviewStatus = 'pending' | 'running' | 'completed' | 'error' | 'cancelled';

/**
 * A quick fix suggestion for an issue
 */
export interface QuickFix {
    id: string;
    title: string;
    description?: string;
    edit: vscode.WorkspaceEdit;
    isPreferred?: boolean;
}

/**
 * A single review issue found by a reviewer
 */
export interface ReviewIssue {
    id: string;
    category: ReviewCategory;
    severity: ReviewSeverity;
    title: string;
    message: string;
    detail?: string;
    
    // Location in code
    range: vscode.Range;
    fileUri: vscode.Uri;
    
    // Optional related information
    relatedInformation?: {
        message: string;
        range: vscode.Range;
        fileUri: vscode.Uri;
    }[];
    
    // Suggested fixes
    quickFixes?: QuickFix[];
    
    // Metadata
    confidence: number; // 0-1, how confident the reviewer is
    reviewerId: string;
    timestamp: number;
    
    // For deduplication
    hash: string;
}

/**
 * Result from a single reviewer
 */
export interface ReviewerResult {
    reviewerId: string;
    reviewerName: string;
    status: ReviewStatus;
    issues: ReviewIssue[];
    duration: number; // ms
    error?: string;
}

/**
 * Complete review result for a file
 */
export interface ReviewResult {
    fileUri: vscode.Uri;
    fileVersion: number;
    timestamp: number;
    status: ReviewStatus;
    
    // Results from all reviewers
    reviewerResults: ReviewerResult[];
    
    // Aggregated issues
    allIssues: ReviewIssue[];
    
    // Summary
    summary: ReviewSummary;
    
    // Error if review failed
    error?: string;
}

/**
 * Summary of a review
 */
export interface ReviewSummary {
    totalIssues: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    hintCount: number;
    
    // By category
    byCategory: Record<ReviewCategory, number>;
    
    // Has auto-fixable issues
    hasAutoFixes: number;
    
    // Overall score (0-100)
    score: number;
}

/**
 * Configuration for a reviewer
 */
export interface ReviewerConfig {
    enabled: boolean;
    severity: ReviewSeverity;
    includePatterns?: string[];
    excludePatterns?: string[];
    customRules?: Record<string, any>;
}

/**
 * Configuration for code review
 */
export interface ReviewConfig {
    enabled: boolean;
    runOnSave: boolean;
    runOnType: boolean;
    debounceMs: number;
    
    // Per-reviewer configuration
    reviewers: {
        semantic: ReviewerConfig;
        style: ReviewerConfig;
        security: ReviewerConfig;
        performance: ReviewerConfig;
        test: ReviewerConfig;
    };
    
    // Global patterns
    excludePatterns: string[];
    includePatterns: string[];
}

/**
 * Base interface for all reviewers
 */
export interface IReviewer extends vscode.Disposable {
    readonly id: string;
    readonly name: string;
    
    /**
     * Check if this reviewer can review the given file
     */
    canReview(document: vscode.TextDocument): boolean;
    
    /**
     * Review a document and return issues
     */
    review(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<ReviewerResult>;
}

/**
 * Cache entry for review results
 */
export interface ReviewCacheEntry {
    result: ReviewResult;
    contentHash: string;
}

/**
 * Event types for review events
 */
export type ReviewEventType = 'started' | 'completed' | 'cancelled' | 'error';

/**
 * Review event
 */
export interface ReviewEvent {
    type: ReviewEventType;
    fileUri: vscode.Uri;
    result?: ReviewResult;
    error?: string;
}

/**
 * CodeLens data for review acceptance
 */
export interface ReviewCodeLens {
    range: vscode.Range;
    issue: ReviewIssue;
    type: 'accept' | 'fix' | 'show';
}

/**
 * Statistics for review metrics
 */
export interface ReviewStats {
    totalReviews: number;
    totalIssues: number;
    averageDuration: number;
    issuesByCategory: Record<ReviewCategory, number>;
    issuesBySeverity: Record<ReviewSeverity, number>;
    topIssues: Array<{ message: string; count: number }>;
}
