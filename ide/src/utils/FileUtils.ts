import * as fs from 'fs';
import * as path from 'path';

/**
 * File utility functions for Kimi IDE IDE
 */
export class FileUtils {
  /**
   * Check if file exists
   */
  public static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if path is a directory
   */
  public static async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.promises.stat(filePath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Check if path is a file
   */
  public static async isFile(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.promises.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Read file content
   */
  public static async readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    return fs.promises.readFile(filePath, encoding);
  }

  /**
   * Write file content
   */
  public static async writeFile(filePath: string, content: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content);
  }

  /**
   * Find files matching pattern
   */
  public static async findFiles(
    rootDir: string,
    pattern: RegExp,
    options: { recursive?: boolean; exclude?: string[] } = {}
  ): Promise<string[]> {
    const { recursive = true, exclude = [] } = options;
    const results: string[] = [];

    async function search(dir: string): Promise<void> {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (exclude.some(e => fullPath.includes(e))) {
          continue;
        }

        if (entry.isDirectory() && recursive) {
          await search(fullPath);
        } else if (entry.isFile() && pattern.test(entry.name)) {
          results.push(fullPath);
        }
      }
    }

    await search(rootDir);
    return results;
  }

  /**
   * Find file up the directory tree
   */
  public static async findUp(fileName: string, startDir: string): Promise<string | null> {
    let currentDir = startDir;

    while (true) {
      const filePath = path.join(currentDir, fileName);
      if (await this.exists(filePath)) {
        return filePath;
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }

    return null;
  }

  /**
   * Get file extension
   */
  public static getExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
  }

  /**
   * Get file name without extension
   */
  public static getBaseName(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
  }

  /**
   * Normalize path separators
   */
  public static normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/\\/g, '/');
  }

  /**
   * Get relative path
   */
  public static getRelativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  /**
   * Ensure directory exists
   */
  public static async ensureDir(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }

  /**
   * Copy file
   */
  public static async copyFile(src: string, dest: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(src, dest);
  }

  /**
   * Delete file or directory
   */
  public static async delete(filePath: string): Promise<void> {
    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.isDirectory()) {
        await fs.promises.rmdir(filePath, { recursive: true });
      } else {
        await fs.promises.unlink(filePath);
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Read JSON file
   */
  public static async readJson<T>(filePath: string): Promise<T | null> {
    try {
      const content = await this.readFile(filePath);
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  /**
   * Write JSON file
   */
  public static async writeJson(filePath: string, data: any, indent = 2): Promise<void> {
    const content = JSON.stringify(data, null, indent);
    await this.writeFile(filePath, content);
  }
}
