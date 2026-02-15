/**
 * Async utility functions for Kimi IDE extension
 * Provides debounce, throttle, cancelable promises, and retry logic
 */

import { logger } from './logger';

// Declare requestAnimationFrame for Node.js environment (VS Code extension)
declare function requestAnimationFrame(callback: (time: number) => void): number;
declare function cancelAnimationFrame(handle: number): void;

// Debounce and Throttle types
export type DebouncedFunction<T extends (...args: unknown[]) => unknown> = {
    (...args: Parameters<T>): ReturnType<T>;
    cancel(): void;
    flush(): ReturnType<T> | undefined;
};

export type ThrottledFunction<T extends (...args: unknown[]) => unknown> = {
    (...args: Parameters<T>): ReturnType<T>;
    cancel(): void;
};

// Cancelable promise types
export interface CancelToken {
    isCancelled: boolean;
    cancel(): void;
    onCancel(callback: () => void): void;
}

export interface CancelablePromise<T> extends Promise<T> {
    cancel(): void;
}

// Retry options
export interface RetryOptions {
    maxAttempts?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    maxDelayMs?: number;
    retryCondition?: (error: unknown) => boolean;
    onRetry?: (error: unknown, attempt: number) => void;
}

// Timeout options
export interface TimeoutOptions {
    timeoutMs: number;
    errorMessage?: string;
}

/**
 * Create a cancel token
 */
export function createCancelToken(): CancelToken {
    let cancelled = false;
    let cancelCallback: (() => void) | null = null;

    return {
        get isCancelled() {
            return cancelled;
        },
        cancel() {
            if (!cancelled) {
                cancelled = true;
                cancelCallback?.();
            }
        },
        onCancel(callback: () => void) {
            cancelCallback = callback;
            if (cancelled) {
                callback();
            }
        },
    };
}

/**
 * Make a promise cancelable
 */
export function makeCancelable<T>(
    promise: Promise<T>,
    token?: CancelToken
): CancelablePromise<T> {
    let rejectFn: (reason?: unknown) => void;

    const cancelablePromise = new Promise<T>((resolve, reject) => {
        rejectFn = reject;

        promise
            .then(resolve)
            .catch(reject);

        if (token) {
            token.onCancel(() => {
                reject(new Error('Operation cancelled'));
            });
        }
    }) as CancelablePromise<T>;

    cancelablePromise.cancel = () => {
        rejectFn?.(new Error('Operation cancelled'));
    };

    return cancelablePromise;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    waitMs: number,
    immediate: boolean = false
): DebouncedFunction<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastArgs: Parameters<T> | null = null;
    let lastResult: ReturnType<T>;

    const debounced = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
        lastArgs = args;

        const callNow = immediate && !timeoutId;

        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            timeoutId = null;
            if (!immediate && lastArgs) {
                lastResult = func.apply(this, lastArgs) as ReturnType<T>;
                lastArgs = null;
            }
        }, waitMs);

        if (callNow) {
            lastResult = func.apply(this, args) as ReturnType<T>;
        }

        return lastResult;
    } as DebouncedFunction<T>;

    debounced.cancel = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        lastArgs = null;
    };

    debounced.flush = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
            if (lastArgs) {
                lastResult = func.apply(undefined, lastArgs) as ReturnType<T>;
                lastArgs = null;
            }
        }
        return lastResult;
    };

    return debounced;
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
    func: T,
    limitMs: number
): ThrottledFunction<T> {
    let inThrottle = false;
    let lastArgs: Parameters<T> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const throttled = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
        lastArgs = args;

        if (!inThrottle) {
            inThrottle = true;
            const result = func.apply(this, args) as ReturnType<T>;
            
            timeoutId = setTimeout(() => {
                inThrottle = false;
                if (lastArgs && lastArgs !== args) {
                    throttled.apply(this, lastArgs);
                }
            }, limitMs);

            return result;
        }

        return undefined as ReturnType<T>;
    } as ThrottledFunction<T>;

    throttled.cancel = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        inThrottle = false;
        lastArgs = null;
    };

    return throttled;
}

/**
 * Throttle function with trailing call
 */
export function throttleWithTrailing<T extends (...args: unknown[]) => unknown>(
    func: T,
    limitMs: number
): ThrottledFunction<T> {
    let lastExec = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastArgs: Parameters<T> | null = null;

    const throttled = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
        const now = Date.now();
        const remaining = limitMs - (now - lastExec);
        lastArgs = args;

        const execute = () => {
            lastExec = Date.now();
            timeoutId = null;
            if (lastArgs) {
                func.apply(this, lastArgs);
                lastArgs = null;
            }
        };

        if (remaining <= 0 || remaining > limitMs) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            lastExec = now;
            return func.apply(this, args) as ReturnType<T>;
        } else if (!timeoutId) {
            timeoutId = setTimeout(execute, remaining);
        }

        return undefined as ReturnType<T>;
    } as ThrottledFunction<T>;

    throttled.cancel = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        lastArgs = null;
    };

    return throttled;
}

/**
 * Retry an async operation
 */
export async function retry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        delayMs = 1000,
        backoffMultiplier = 2,
        maxDelayMs = 30000,
        retryCondition = () => true,
        onRetry,
    } = options;

    let lastError: unknown;
    let currentDelay = delayMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            if (attempt === maxAttempts || !retryCondition(error)) {
                throw error;
            }

            logger.warn(`Attempt ${attempt} failed, retrying in ${currentDelay}ms...`, error);
            onRetry?.(error, attempt);

            await sleep(currentDelay);

            // Calculate next delay with exponential backoff
            currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
        }
    }

    throw lastError;
}

/**
 * Execute promise with timeout
 */
export function withTimeout<T>(
    promise: Promise<T>,
    options: TimeoutOptions
): Promise<T> {
    const { timeoutMs, errorMessage = `Operation timed out after ${timeoutMs}ms` } = options;

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(errorMessage));
        }, timeoutMs);

        promise
            .then(resolve)
            .catch(reject)
            .finally(() => {
                clearTimeout(timeoutId);
            });
    });
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run promises sequentially
 */
export async function runSequentially<T, R>(
    items: T[],
    fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i++) {
        results.push(await fn(items[i], i));
    }
    return results;
}

/**
 * Run promises with concurrency limit
 */
export async function runWithConcurrency<T, R>(
    items: T[],
    fn: (item: T, index: number) => Promise<R>,
    concurrency: number
): Promise<R[]> {
    const results: (R | undefined)[] = new Array(items.length);
    let index = 0;

    async function worker(): Promise<void> {
        while (index < items.length) {
            const currentIndex = index++;
            results[currentIndex] = await fn(items[currentIndex], currentIndex);
        }
    }

    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(concurrency, items.length); i++) {
        workers.push(worker());
    }

    await Promise.all(workers);
    return results as R[];
}

/**
 * Create a promise that resolves after next animation frame
 */
export function nextAnimationFrame(): Promise<number> {
    return new Promise(resolve => {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(resolve);
        } else {
            // Fallback for Node.js environment - use setImmediate for similar effect
            setImmediate(() => resolve(Date.now()));
        }
    });
}

/**
 * Create a deferred promise
 */
export function createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
} {
    let resolveFn!: (value: T) => void;
    let rejectFn!: (reason?: unknown) => void;

    const promise = new Promise<T>((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
    });

    return { promise, resolve: resolveFn, reject: rejectFn };
}

/**
 * Rate limiter
 */
export class RateLimiter {
    private queue: Array<() => void> = [];
    private activeCount = 0;

    constructor(private maxConcurrent: number) {}

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.activeCount < this.maxConcurrent) {
            return this.run(fn);
        }

        return new Promise((resolve, reject) => {
            this.queue.push(() => {
                this.run(fn).then(resolve).catch(reject);
            });
        });
    }

    private async run<T>(fn: () => Promise<T>): Promise<T> {
        this.activeCount++;
        try {
            return await fn();
        } finally {
            this.activeCount--;
            this.processQueue();
        }
    }

    private processQueue(): void {
        if (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
            const next = this.queue.shift();
            next?.();
        }
    }
}

/**
 * Async mutex for critical sections
 */
export class AsyncMutex {
    private promise: Promise<void> = Promise.resolve();

    async acquire(): Promise<() => void> {
        const release = createDeferred<void>();
        const currentPromise = this.promise;
        
        this.promise = this.promise.then(() => release.promise);
        
        await currentPromise;
        
        return () => release.resolve();
    }

    async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
        const release = await this.acquire();
        try {
            return await fn();
        } finally {
            release();
        }
    }
}

/**
 * Pause execution - useful for yielding control in long operations
 */
export async function yieldControl(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
}

/**
 * Check if error is a cancellation error
 */
export function isCancellationError(error: unknown): boolean {
    return error instanceof Error && 
        (error.message === 'Operation cancelled' || 
         error.name === 'CancellationError' ||
         error.message.includes('cancelled'));
}

/**
 * Wrap async function to catch errors
 */
export function safeAsync<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    errorHandler?: (error: unknown) => void
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
    return async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
        try {
            return await fn(...args) as ReturnType<T>;
        } catch (error) {
            errorHandler?.(error);
            logger.error('Async operation failed:', error);
            return undefined;
        }
    };
}
