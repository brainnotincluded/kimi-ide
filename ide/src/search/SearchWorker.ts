/**
 * Search Worker - Worker thread for non-blocking search
 * Uses Node.js worker_threads for parallel search execution
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as path from 'path';
import { SearchProvider } from './SearchProvider';
import {
  SearchOptions,
  ReplaceOptions,
  SearchResult,
  SearchStats,
  SearchEvent,
} from './types';

interface WorkerMessage {
  id: string;
  type: 'search' | 'searchFile' | 'replace' | 'cancel';
  payload: any;
}

interface WorkerResponse {
  id: string;
  type: 'result' | 'error' | 'event';
  data?: any;
  error?: string;
}

// Worker thread execution
if (!isMainThread && workerData?.isWorker) {
  const { projectRoot } = workerData;
  const provider = new SearchProvider(projectRoot);

  // Forward events to main thread
  provider.on('search-event', (event: SearchEvent) => {
    parentPort?.postMessage({
      type: 'event',
      data: event,
    });
  });

  parentPort?.on('message', async (message: WorkerMessage) => {
    const { id, type, payload } = message;

    try {
      let result: any;

      switch (type) {
        case 'search':
          result = await provider.search(payload.options);
          break;
        case 'searchFile':
          result = await provider.searchInFile(
            payload.filePath,
            payload.query,
            payload.options
          );
          break;
        case 'replace':
          result = await provider.replace(payload.options);
          break;
        case 'cancel':
          provider.cancel();
          result = { cancelled: true };
          break;
        default:
          throw new Error(`Unknown message type: ${type}`);
      }

      const response: WorkerResponse = {
        id,
        type: 'result',
        data: result,
      };

      parentPort?.postMessage(response);
    } catch (error) {
      const response: WorkerResponse = {
        id,
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      };

      parentPort?.postMessage(response);
    }
  });
}

/**
 * Search Worker Manager - Manages worker thread for search operations
 */
export class SearchWorker {
  private worker: Worker | null = null;
  private pendingJobs = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    eventHandler?: (event: SearchEvent) => void;
  }>();
  private jobId = 0;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Initialize worker thread
   */
  private async initWorker(): Promise<Worker> {
    if (this.worker) return this.worker;

    const workerPath = __filename;
    
    this.worker = new Worker(workerPath, {
      workerData: {
        isWorker: true,
        projectRoot: this.projectRoot,
      },
    });

    this.worker.on('message', (response: WorkerResponse) => {
      if (response.type === 'event') {
        // Forward events to all pending jobs
        for (const [, job] of this.pendingJobs) {
          job.eventHandler?.(response.data as SearchEvent);
        }
      } else {
        const job = this.pendingJobs.get(response.id);
        if (job) {
          this.pendingJobs.delete(response.id);
          if (response.type === 'error') {
            job.reject(new Error(response.error || 'Unknown error'));
          } else {
            job.resolve(response.data);
          }
        }
      }
    });

    this.worker.on('error', (error) => {
      console.error('Search worker error:', error);
      // Reject all pending jobs
      for (const [, job] of this.pendingJobs) {
        job.reject(error);
      }
      this.pendingJobs.clear();
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Search worker stopped with exit code ${code}`);
      }
      this.worker = null;
    });

    return this.worker;
  }

  /**
   * Execute a job on the worker
   */
  private async executeJob<T>(
    type: WorkerMessage['type'],
    payload: any,
    eventHandler?: (event: SearchEvent) => void
  ): Promise<T> {
    const worker = await this.initWorker();
    const id = `job-${++this.jobId}`;

    return new Promise((resolve, reject) => {
      this.pendingJobs.set(id, { resolve, reject, eventHandler });
      worker.postMessage({ id, type, payload });
    });
  }

  /**
   * Search project-wide
   */
  async search(
    options: SearchOptions,
    onEvent?: (event: SearchEvent) => void
  ): Promise<SearchStats> {
    return this.executeJob('search', { options }, onEvent);
  }

  /**
   * Search in a single file
   */
  async searchInFile(
    filePath: string,
    query: string,
    options?: Partial<SearchOptions>
  ): Promise<SearchMatch[]> {
    return this.executeJob('searchFile', { filePath, query, options });
  }

  /**
   * Replace all matches
   */
  async replace(options: ReplaceOptions): Promise<{ replacedFiles: number; replacedMatches: number }> {
    return this.executeJob('replace', { options });
  }

  /**
   * Cancel current operation
   */
  async cancel(): Promise<void> {
    if (this.worker) {
      await this.executeJob('cancel', {});
    }
  }

  /**
   * Terminate worker
   */
  terminate(): Promise<number> {
    if (this.worker) {
      const worker = this.worker;
      this.worker = null;
      
      // Reject all pending jobs
      for (const [, job] of this.pendingJobs) {
        job.reject(new Error('Worker terminated'));
      }
      this.pendingJobs.clear();
      
      return worker.terminate();
    }
    return Promise.resolve(0);
  }
}

// Re-export SearchMatch for type consistency
import { SearchMatch } from './types';
export { SearchMatch };
