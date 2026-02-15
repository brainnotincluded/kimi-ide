/**
 * Async utility functions
 * Helpers for async operations and promise handling
 */

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
