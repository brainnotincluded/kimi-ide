/**
 * Async utility functions
 * Helpers for async operations and promise handling
 */

// ============================================================================
// Types
// ============================================================================

export interface CancelToken {
    isCancelled: boolean;
    cancel: () => void;
}

export interface CancelablePromise<T> extends Promise<T> {
    cancel: () => void;
}

export interface DebouncedFunction<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): void;
    cancel: () => void;
}

export interface ThrottledFunction<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): void;
}

export interface RetryOptions {
    maxAttempts?: number;
    delay?: number;
    backoff?: number;
}

export interface TimeoutOptions {
    timeout?: number;
    interval?: number;
}

// ============================================================================
// Cancel Token
// ============================================================================

export function createCancelToken(): CancelToken {
    const token: CancelToken = {
        isCancelled: false,
        cancel: () => { token.isCancelled = true; }
    };
    return token;
}

export function makeCancelable<T>(promise: Promise<T>): CancelablePromise<T> {
    let rejectFn: (reason?: any) => void;
    
    const cancelablePromise = new Promise<T>((resolve, reject) => {
        rejectFn = reject;
        promise.then(resolve).catch(reject);
    }) as CancelablePromise<T>;
    
    cancelablePromise.cancel = () => {
        rejectFn(new Error('Cancelled'));
    };
    
    return cancelablePromise;
}

// ============================================================================
// Throttle with trailing
// ============================================================================

export function throttleWithTrailing<T extends (...args: any[]) => any>(
    fn: T,
    limit: number
): ThrottledFunction<T> {
    return throttle(fn, limit);
}

// ============================================================================
// Sequential execution
// ============================================================================

export async function runSequentially<T>(fns: (() => Promise<T>)[]): Promise<T[]> {
    return sequential(fns);
}

// ============================================================================
// Concurrency
// ============================================================================

export async function runWithConcurrency<T>(
    promises: Promise<T>[],
    concurrency: number
): Promise<T[]> {
    return parallel(promises, { concurrency });
}

// ============================================================================
// Animation frame
// ============================================================================

export function nextAnimationFrame(): Promise<number> {
    // Use setTimeout as fallback for Node.js environment where requestAnimationFrame is not available
    return new Promise(resolve => setTimeout(() => resolve(0), 0));
}

// ============================================================================
// Deferred
// ============================================================================

export interface Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: any) => void;
}

export function createDeferred<T>(): Deferred<T> {
    let resolveFn: (value: T) => void;
    let rejectFn: (reason?: any) => void;
    
    const promise = new Promise<T>((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
    });
    
    return {
        promise,
        resolve: resolveFn!,
        reject: rejectFn!
    };
}

// ============================================================================
// Rate Limiter
// ============================================================================

export class RateLimiter {
    private tokens: number;
    private lastRefill: number;
    private readonly maxTokens: number;
    private readonly refillRate: number;

    constructor(maxTokens: number, refillRate: number) {
        this.maxTokens = maxTokens;
        this.tokens = maxTokens;
        this.refillRate = refillRate;
        this.lastRefill = Date.now();
    }

    async acquire(): Promise<void> {
        this.refill();
        if (this.tokens > 0) {
            this.tokens--;
            return;
        }
        await sleep(1000 / this.refillRate);
        return this.acquire();
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const tokensToAdd = Math.floor(elapsed * (this.refillRate / 1000));
        this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }
}

// ============================================================================
// Async Mutex
// ============================================================================

export class AsyncMutex {
    private promise: Promise<void> = Promise.resolve();

    async acquire(): Promise<() => void> {
        const release = this.promise;
        let resolveRelease: () => void;
        this.promise = new Promise(resolve => {
            resolveRelease = resolve;
        });
        await release;
        return () => resolveRelease!();
    }
}

// ============================================================================
// Yield control
// ============================================================================

export async function yieldControl(): Promise<void> {
    await sleep(0);
}

// ============================================================================
// Cancellation error
// ============================================================================

export function isCancellationError(error: unknown): boolean {
    return error instanceof Error && 
        (error.message === 'Cancelled' || error.message === 'Aborted');
}

// ============================================================================
// Safe async
// ============================================================================

export async function safeAsync<T>(
    fn: () => Promise<T>,
    defaultValue: T
): Promise<T> {
    try {
        return await fn();
    } catch {
        return defaultValue;
    }
}

// ============================================================================
// Existing functions
// ============================================================================

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): T & { cancel(): void } {
    let timeoutId: NodeJS.Timeout | null = null;

    const debounced = function (this: any, ...args: Parameters<T>) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
            timeoutId = null;
        }, delay);
    } as T & { cancel(): void };

    debounced.cancel = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    return debounced;
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    limit: number
): T {
    let inThrottle = false;
    let lastArgs: Parameters<T> | null = null;

    return function (this: any, ...args: Parameters<T>) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
                if (lastArgs) {
                    fn.apply(this, lastArgs);
                    lastArgs = null;
                }
            }, limit);
        } else {
            lastArgs = args;
        }
    } as T;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: { maxAttempts?: number; delay?: number; backoff?: number } = {}
): Promise<T> {
    const { maxAttempts = 3, delay = 1000, backoff = 2 } = options;

    let lastError: Error | undefined;
    let currentDelay = delay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            
            if (attempt === maxAttempts) {
                throw lastError;
            }

            await sleep(currentDelay);
            currentDelay *= backoff;
        }
    }

    throw lastError;
}

/**
 * Wrap a promise with a timeout
 */
export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`Operation timed out after ${ms}ms`));
        }, ms);

        promise
            .then(resolve)
            .catch(reject)
            .finally(() => clearTimeout(timeoutId));
    });
}

/**
 * Create a wrapped version of a function with timeout
 */
export function withTimeout<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    ms: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    return (...args: Parameters<T>) => timeout(fn(...args), ms);
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run promises in parallel with optional concurrency limit
 */
export async function parallel<T>(
    promises: Promise<T>[],
    options: { concurrency?: number } = {}
): Promise<T[]> {
    const { concurrency } = options;

    if (!concurrency || promises.length <= concurrency) {
        return Promise.all(promises);
    }

    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < promises.length; i++) {
        const promise = promises[i].then(result => {
            results[i] = result;
        });

        executing.push(promise);

        if (executing.length >= concurrency) {
            await Promise.race(executing);
            executing.splice(
                executing.findIndex(p => p === promise),
                1
            );
        }
    }

    await Promise.all(executing);
    return results;
}

/**
 * Run promises sequentially
 */
export async function sequential<T>(fns: (() => Promise<T>)[]): Promise<T[]> {
    const results: T[] = [];
    for (const fn of fns) {
        results.push(await fn());
    }
    return results;
}

/**
 * Process items in batches
 */
export async function batch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: { batchSize?: number } = {}
): Promise<R[]> {
    const { batchSize = 10 } = options;
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(processor));
        results.push(...batchResults);
    }

    return results;
}

/**
 * Create a promise that resolves after a condition is met
 */
export async function waitFor(
    condition: () => boolean,
    options: { timeout?: number; interval?: number } = {}
): Promise<void> {
    const { timeout: timeoutMs = 5000, interval = 100 } = options;
    const startTime = Date.now();

    while (!condition()) {
        if (Date.now() - startTime > timeoutMs) {
            throw new Error('Timeout waiting for condition');
        }
        await sleep(interval);
    }
}

/**
 * Run a function with exponential backoff
 */
export async function withBackoff<T>(
    fn: () => Promise<T>,
    options: { maxDelay?: number; initialDelay?: number; maxAttempts?: number } = {}
): Promise<T> {
    const { maxDelay = 30000, initialDelay = 1000, maxAttempts = 5 } = options;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxAttempts) {
                throw error;
            }
            await sleep(delay);
            delay = Math.min(delay * 2, maxDelay);
        }
    }

    throw new Error('Max attempts reached');
}

/**
 * Memoize an async function
 */
export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: { ttl?: number; keyFn?: (...args: Parameters<T>) => string } = {}
): T {
    const { ttl = 60000, keyFn = (...args) => JSON.stringify(args) } = options;
    const cache = new Map<string, { value: any; timestamp: number }>();

    return async function (this: any, ...args: Parameters<T>): Promise<ReturnType<T>> {
        const key = keyFn(...args);
        const cached = cache.get(key);

        if (cached && Date.now() - cached.timestamp < ttl) {
            return cached.value;
        }

        const value = await fn.apply(this, args);
        cache.set(key, { value, timestamp: Date.now() });
        return value;
    } as T;
}

/**
 * Create an abortable promise
 */
export function abortable<T>(
    promise: Promise<T>,
    signal?: AbortSignal
): Promise<T> {
    if (!signal) return promise;

    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new Error('Aborted'));
            return;
        }

        const abortHandler = () => {
            reject(new Error('Aborted'));
        };

        signal.addEventListener('abort', abortHandler);

        promise
            .then(resolve)
            .catch(reject)
            .finally(() => signal.removeEventListener('abort', abortHandler));
    });
}
