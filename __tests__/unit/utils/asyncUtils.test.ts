/**
 * Async Utils Unit Tests
 * Tests for async utility functions
 */

import {
    debounce,
    throttle,
    retry,
    timeout,
    withTimeout,
    sleep,
    parallel,
    sequential,
    batch,
} from '../../../src/utils/asyncUtils';

describe('Async Utils', () => {
    describe('debounce', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should delay function execution', () => {
            const fn = jest.fn();
            const debounced = debounce(fn, 100);

            debounced();
            expect(fn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should reset timer on multiple calls', () => {
            const fn = jest.fn();
            const debounced = debounce(fn, 100);

            debounced();
            jest.advanceTimersByTime(50);
            debounced();
            jest.advanceTimersByTime(50);
            
            expect(fn).not.toHaveBeenCalled();
            
            jest.advanceTimersByTime(50);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should pass arguments to debounced function', () => {
            const fn = jest.fn();
            const debounced = debounce(fn, 100);

            debounced('arg1', 'arg2');
            jest.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
        });

        it('should cancel pending execution', () => {
            const fn = jest.fn();
            const debounced = debounce(fn, 100);

            debounced();
            debounced.cancel();
            jest.advanceTimersByTime(100);

            expect(fn).not.toHaveBeenCalled();
        });
    });

    describe('throttle', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should limit execution rate', () => {
            const fn = jest.fn();
            const throttled = throttle(fn, 100);

            throttled();
            throttled();
            throttled();

            expect(fn).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should execute immediately on first call', () => {
            const fn = jest.fn();
            const throttled = throttle(fn, 100);

            throttled();
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('retry', () => {
        it('should return result on success', async () => {
            const fn = jest.fn().mockResolvedValue('success');
            const result = await retry(fn, { maxAttempts: 3 });

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should retry on failure', async () => {
            const fn = jest.fn()
                .mockRejectedValueOnce(new Error('fail 1'))
                .mockRejectedValueOnce(new Error('fail 2'))
                .mockResolvedValue('success');

            const result = await retry(fn, { maxAttempts: 3 });

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should throw after max attempts', async () => {
            const fn = jest.fn().mockRejectedValue(new Error('always fails'));

            await expect(retry(fn, { maxAttempts: 3 })).rejects.toThrow('always fails');
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should respect delay between retries', async () => {
            jest.useFakeTimers();
            const fn = jest.fn()
                .mockRejectedValueOnce(new Error('fail'))
                .mockResolvedValue('success');

            const promise = retry(fn, { maxAttempts: 2, delay: 100 });
            
            expect(fn).toHaveBeenCalledTimes(1);
            
            jest.advanceTimersByTime(100);
            await promise;
            
            expect(fn).toHaveBeenCalledTimes(2);
            jest.useRealTimers();
        });
    });

    describe('timeout', () => {
        it('should resolve if function completes in time', async () => {
            const fn = async () => {
                await sleep(10);
                return 'success';
            };

            const result = await timeout(fn(), 100);
            expect(result).toBe('success');
        });

        it('should reject if function times out', async () => {
            const fn = async () => {
                await sleep(200);
                return 'success';
            };

            await expect(timeout(fn(), 50)).rejects.toThrow('timeout');
        });
    });

    describe('withTimeout', () => {
        it('should wrap function with timeout', async () => {
            const fn = jest.fn().mockResolvedValue('success');
            const wrapped = withTimeout(fn, 100);

            const result = await wrapped();
            expect(result).toBe('success');
        });
    });

    describe('sleep', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should delay for specified time', async () => {
            const promise = sleep(100);
            
            jest.advanceTimersByTime(100);
            await promise;
            
            // If we get here, sleep completed
            expect(true).toBe(true);
        });
    });

    describe('parallel', () => {
        it('should execute promises in parallel', async () => {
            const fns = [
                jest.fn().mockResolvedValue(1),
                jest.fn().mockResolvedValue(2),
                jest.fn().mockResolvedValue(3),
            ];

            const results = await parallel(fns.map(fn => fn()));

            expect(results).toEqual([1, 2, 3]);
            fns.forEach(fn => expect(fn).toHaveBeenCalledTimes(1));
        });

        it('should handle errors', async () => {
            const fns = [
                jest.fn().mockResolvedValue(1),
                jest.fn().mockRejectedValue(new Error('fail')),
                jest.fn().mockResolvedValue(3),
            ];

            await expect(parallel(fns.map(fn => fn()))).rejects.toThrow('fail');
        });

        it('should limit concurrency', async () => {
            let running = 0;
            let maxRunning = 0;

            const createFn = () => async () => {
                running++;
                maxRunning = Math.max(maxRunning, running);
                await sleep(10);
                running--;
                return running;
            };

            await parallel(Array(5).fill(null).map(createFn), { concurrency: 2 });

            expect(maxRunning).toBeLessThanOrEqual(2);
        });
    });

    describe('sequential', () => {
        it('should execute promises sequentially', async () => {
            const order: number[] = [];
            const fns = [
                async () => { order.push(1); return 1; },
                async () => { order.push(2); return 2; },
                async () => { order.push(3); return 3; },
            ];

            const results = await sequential(fns);

            expect(results).toEqual([1, 2, 3]);
            expect(order).toEqual([1, 2, 3]);
        });

        it('should stop on first error', async () => {
            const fns = [
                jest.fn().mockResolvedValue(1),
                jest.fn().mockRejectedValue(new Error('fail')),
                jest.fn().mockResolvedValue(3),
            ];

            await expect(sequential(fns)).rejects.toThrow('fail');
            expect(fns[2]).not.toHaveBeenCalled();
        });
    });

    describe('batch', () => {
        it('should process items in batches', async () => {
            const processor = jest.fn().mockImplementation(async (item: number) => item * 2);
            const items = [1, 2, 3, 4, 5];

            const results = await batch(items, processor, { batchSize: 2 });

            expect(results).toEqual([2, 4, 6, 8, 10]);
            expect(processor).toHaveBeenCalledTimes(5);
        });

        it('should handle empty array', async () => {
            const processor = jest.fn();
            const results = await batch([], processor, { batchSize: 2 });

            expect(results).toEqual([]);
            expect(processor).not.toHaveBeenCalled();
        });
    });
});
