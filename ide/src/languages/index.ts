/**
 * Language Providers Index
 * IDE Kimi IDE - Unified entry point for all language support
 */

// import { PythonLanguageProvider } from './python/PythonProvider';
import { JavaLanguageProvider } from './java/JavaLanguageProvider';
import { CppLanguageProvider } from './cpp/CppLanguageProvider';
import { GoLanguageProvider } from './go/provider/GoLanguageProvider';
// import { TypeScriptProvider } from './web/providers/typescript-provider';
import * as path from 'path';

// Export all language providers
export {
  // PythonLanguageProvider,
  JavaLanguageProvider,
  CppLanguageProvider,
  GoLanguageProvider,
  // TypeScriptProvider,
};

// Language detection result
export interface DetectedLanguage {
  id: string;
  name: string;
  provider: LanguageProvider;
  confidence: number;
}

// Union type for all language providers
export type LanguageProvider =
  // | PythonLanguageProvider
  | JavaLanguageProvider
  | CppLanguageProvider
  | GoLanguageProvider;
  // | TypeScriptProvider;

// Language metadata
interface LanguageMetadata {
  id: string;
  name: string;
  extensions: string[];
  filenames: string[];
  createProvider: (workspaceRoot: string) => LanguageProvider;
}

// Registry of all supported languages
const languageRegistry: LanguageMetadata[] = [
  // Python temporarily disabled
  // {
  //   id: 'python',
  //   name: 'Python',
  //   extensions: ['.py', '.pyw', '.pyi', '.pyx', '.pxd', '.pxi'],
  //   filenames: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
  //   createProvider: () => {
  //     const { PythonConfig } = require('./python/PythonConfig');
  //     const config = new PythonConfig();
  //     return new PythonLanguageProvider(config);
  //   },
  // },
  {
    id: 'java',
    name: 'Java',
    extensions: ['.java', '.class', '.jar', '.kt', '.kts', '.scala', '.sc'],
    filenames: ['pom.xml', 'build.gradle', 'settings.gradle', 'gradlew'],
    createProvider: (workspaceRoot: string) => new JavaLanguageProvider(workspaceRoot),
  },
  {
    id: 'cpp',
    name: 'C/C++',
    extensions: ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx', '.inl', '.cmake'],
    filenames: ['CMakeLists.txt', 'Makefile', 'configure.ac', 'CMakePresets.json'],
    createProvider: () => {
      // C++ provider needs vscode context, simplified for now
      const { EventEmitter } = require('events');
      return new EventEmitter() as CppLanguageProvider;
    },
  },
  {
    id: 'go',
    name: 'Go',
    extensions: ['.go', '.mod', '.sum'],
    filenames: ['go.mod', 'go.sum', 'go.work'],
    createProvider: () => new GoLanguageProvider(),
  },
  // TypeScript temporarily disabled
  // {
  //   id: 'typescript',
  //   name: 'TypeScript/JavaScript',
  //   extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
  //   filenames: ['package.json', 'tsconfig.json', 'jsconfig.json', '.eslintrc'],
  //   createProvider: (workspaceRoot: string) => {
  //     const { WebConfiguration } = require('./web/config/web-config');
  //     const config = new WebConfiguration(workspaceRoot);
  //     return new TypeScriptProvider(config);
  //   },
  // },
  {
    id: 'rust',
    name: 'Rust',
    extensions: ['.rs', '.toml'],
    filenames: ['Cargo.toml', 'Cargo.lock', 'rust-toolchain'],
    createProvider: () => {
      // Rust provider is handled separately via IPC
      const { EventEmitter } = require('events');
      return new EventEmitter() as any;
    },
  },
];

// Active providers per workspace
const activeProviders = new Map<string, Map<string, LanguageProvider>>();

/**
 * Detect language based on file extension
 */
export function detectLanguageByExtension(filePath: string): LanguageMetadata | null {
  const ext = path.extname(filePath).toLowerCase();
  return languageRegistry.find(lang => lang.extensions.includes(ext)) || null;
}

/**
 * Detect language based on filename
 */
export function detectLanguageByFilename(filename: string): LanguageMetadata | null {
  return languageRegistry.find(lang => lang.filenames.includes(filename)) || null;
}

/**
 * Auto-detect language for a file
 */
export function detectLanguage(filePath: string): DetectedLanguage | null {
  const byExtension = detectLanguageByExtension(filePath);
  if (byExtension) {
    return {
      id: byExtension.id,
      name: byExtension.name,
      provider: byExtension.createProvider(path.dirname(filePath)),
      confidence: 1.0,
    };
  }

  const filename = path.basename(filePath);
  const byFilename = detectLanguageByFilename(filename);
  if (byFilename) {
    return {
      id: byFilename.id,
      name: byFilename.name,
      provider: byFilename.createProvider(path.dirname(filePath)),
      confidence: 0.8,
    };
  }

  return null;
}

/**
 * Detect primary language for a workspace
 */
export async function detectWorkspaceLanguage(workspaceRoot: string): Promise<DetectedLanguage | null> {
  const fs = require('fs').promises;
  const path = require('path');

  try {
    const entries = await fs.readdir(workspaceRoot, { withFileTypes: true });

    // Check for language-specific files (higher priority)
    for (const lang of languageRegistry) {
      for (const filename of lang.filenames) {
        if (entries.some(e => e.name === filename)) {
          return {
            id: lang.id,
            name: lang.name,
            provider: lang.createProvider(workspaceRoot),
            confidence: 0.9,
          };
        }
      }
    }

    // Count files by extension
    const extensionCounts = new Map<string, number>();
    
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        extensionCounts.set(ext, (extensionCounts.get(ext) || 0) + 1);
      }
    }

    // Find the language with most files
    let bestMatch: { lang: LanguageMetadata; count: number } | null = null;

    for (const lang of languageRegistry) {
      let count = 0;
      for (const ext of lang.extensions) {
        count += extensionCounts.get(ext) || 0;
      }
      if (!bestMatch || count > bestMatch.count) {
        bestMatch = { lang, count };
      }
    }

    if (bestMatch && bestMatch.count > 0) {
      return {
        id: bestMatch.lang.id,
        name: bestMatch.lang.name,
        provider: bestMatch.lang.createProvider(workspaceRoot),
        confidence: Math.min(0.5 + bestMatch.count * 0.1, 0.8),
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to detect workspace language:', error);
    return null;
  }
}

/**
 * Initialize language provider for a workspace
 */
export async function initializeLanguageProvider(
  workspaceRoot: string,
  languageId?: string
): Promise<LanguageProvider | null> {
  // Check if already initialized
  const workspaceProviders = activeProviders.get(workspaceRoot);
  if (workspaceProviders?.has(languageId || 'auto')) {
    return workspaceProviders.get(languageId || 'auto')!;
  }

  let detected: DetectedLanguage | null = null;

  if (languageId) {
    const lang = languageRegistry.find(l => l.id === languageId);
    if (lang) {
      detected = {
        id: lang.id,
        name: lang.name,
        provider: lang.createProvider(workspaceRoot),
        confidence: 1.0,
      };
    }
  } else {
    detected = await detectWorkspaceLanguage(workspaceRoot);
  }

  if (!detected) {
    return null;
  }

  // Initialize provider
  try {
    if ('initialize' in detected.provider) {
      await (detected.provider as any).initialize();
    }

    // Store active provider
    if (!activeProviders.has(workspaceRoot)) {
      activeProviders.set(workspaceRoot, new Map());
    }
    activeProviders.get(workspaceRoot)!.set(languageId || 'auto', detected.provider);

    return detected.provider;
  } catch (error) {
    console.error(`Failed to initialize ${detected.name} provider:`, error);
    return null;
  }
}

/**
 * Get active language provider for a workspace
 */
export function getActiveProvider(workspaceRoot: string, languageId?: string): LanguageProvider | null {
  const workspaceProviders = activeProviders.get(workspaceRoot);
  if (workspaceProviders) {
    if (languageId) {
      return workspaceProviders.get(languageId) || null;
    }
    // Return first available provider
    const first = workspaceProviders.values().next();
    return first.value || null;
  }
  return null;
}

/**
 * Get all active providers for a workspace
 */
export function getAllActiveProviders(workspaceRoot: string): Map<string, LanguageProvider> {
  return activeProviders.get(workspaceRoot) || new Map();
}

/**
 * Dispose language provider for a workspace
 */
export function disposeLanguageProvider(workspaceRoot: string): void {
  const workspaceProviders = activeProviders.get(workspaceRoot);
  if (workspaceProviders) {
    for (const provider of workspaceProviders.values()) {
      if ('dispose' in provider) {
        (provider as any).dispose();
      }
    }
    workspaceProviders.clear();
    activeProviders.delete(workspaceRoot);
  }
}

/**
 * Get language name by ID
 */
export function getLanguageName(languageId: string): string {
  const lang = languageRegistry.find(l => l.id === languageId);
  return lang?.name || languageId;
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): Array<{ id: string; name: string; extensions: string[] }> {
  return languageRegistry.map(lang => ({
    id: lang.id,
    name: lang.name,
    extensions: lang.extensions,
  }));
}

/**
 * Check if a file is supported
 */
export function isFileSupported(filePath: string): boolean {
  return detectLanguage(filePath) !== null;
}
