/**
 * Web Language Configuration
 * Manages configuration for TypeScript, ESLint, Prettier, and other web tools
 */

import { WebLanguageConfig, JSONSchemaMapping } from '../types';
import * as path from 'path';
import * as fs from 'fs';

export class WebConfiguration {
  private config: WebLanguageConfig;
  private configPath: string;
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.configPath = path.join(workspaceRoot, '.traitor', 'web-config.json');
    this.config = this.loadDefaultConfig();
    this.loadConfig();
  }

  private loadDefaultConfig(): WebLanguageConfig {
    return {
      typescript: {
        tsdk: this.findTSSDK(),
        enableTSDiagnostics: true,
        tsconfigPath: undefined,
      },
      prettier: {
        configPath: undefined,
        useTabs: false,
        tabWidth: 2,
        singleQuote: true,
        semi: true,
        trailingComma: 'es5',
      },
      eslint: {
        enabled: true,
        autoFix: true,
        nodePath: undefined,
        configPath: undefined,
      },
      editor: {
        formatOnSave: true,
        organizeImportsOnSave: true,
        defaultFormatter: 'prettier',
      },
      json: {
        schemaStore: true,
        schemas: this.getDefaultJSONSchemas(),
      },
      yaml: {
        schemaStore: true,
        schemas: this.getDefaultYAMLSchemas(),
      },
    };
  }

  private findTSSDK(): string {
    // Try to find TypeScript SDK
    const possiblePaths = [
      path.join(this.workspaceRoot, 'node_modules', 'typescript', 'lib'),
      path.join(this.workspaceRoot, '..', 'node_modules', 'typescript', 'lib'),
    ];

    for (const tsdk of possiblePaths) {
      if (fs.existsSync(path.join(tsdk, 'typescript.js'))) {
        return tsdk;
      }
    }

    // Fall back to global TypeScript
    return 'typescript';
  }

  private getDefaultJSONSchemas(): JSONSchemaMapping[] {
    return [
      {
        fileMatch: ['package.json'],
        url: 'https://json.schemastore.org/package.json',
      },
      {
        fileMatch: ['tsconfig.json', 'tsconfig.*.json'],
        url: 'https://json.schemastore.org/tsconfig.json',
      },
      {
        fileMatch: ['.eslintrc.json', '.eslintrc'],
        url: 'https://json.schemastore.org/eslintrc.json',
      },
      {
        fileMatch: ['.prettierrc', '.prettierrc.json'],
        url: 'https://json.schemastore.org/prettierrc.json',
      },
      {
        fileMatch: ['jsconfig.json'],
        url: 'https://json.schemastore.org/jsconfig.json',
      },
      {
        fileMatch: ['manifest.json'],
        url: 'https://json.schemastore.org/web-manifest-combined.json',
      },
    ];
  }

  private getDefaultYAMLSchemas(): JSONSchemaMapping[] {
    return [
      {
        fileMatch: ['*.yaml', '*.yml'],
        url: 'https://json.schemastore.org/yamllint.json',
      },
      {
        fileMatch: ['.github/workflows/*.yml', '.github/workflows/*.yaml'],
        url: 'https://json.schemastore.org/github-workflow.json',
      },
      {
        fileMatch: ['docker-compose.yml', 'docker-compose.yaml'],
        url: 'https://raw.githubusercontent.com/compose-spec/compose-spec/master/schema/compose-spec.json',
      },
      {
        fileMatch: ['.prettierrc.yaml', '.prettierrc.yml'],
        url: 'https://json.schemastore.org/prettierrc.json',
      },
    ];
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(content);
        this.config = { ...this.config, ...loaded };
      }

      // Look for Prettier config
      this.config.prettier.configPath = this.findPrettierConfig();
      
      // Look for ESLint config
      this.config.eslint.configPath = this.findESLintConfig();

      // Look for tsconfig
      this.config.typescript.tsconfigPath = this.findTSConfig();
    } catch (error) {
      console.error('Failed to load web configuration:', error);
    }
  }

  private findPrettierConfig(): string | undefined {
    const possibleConfigs = [
      '.prettierrc',
      '.prettierrc.json',
      '.prettierrc.yaml',
      '.prettierrc.yml',
      '.prettierrc.js',
      '.prettierrc.cjs',
      'prettier.config.js',
      'prettier.config.cjs',
    ];

    for (const config of possibleConfigs) {
      const configPath = path.join(this.workspaceRoot, config);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }

    return undefined;
  }

  private findESLintConfig(): string | undefined {
    const possibleConfigs = [
      '.eslintrc.js',
      '.eslintrc.cjs',
      '.eslintrc.yaml',
      '.eslintrc.yml',
      '.eslintrc.json',
      '.eslintrc',
      'eslint.config.js',
    ];

    for (const config of possibleConfigs) {
      const configPath = path.join(this.workspaceRoot, config);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }

    return undefined;
  }

  private findTSConfig(): string | undefined {
    const possibleConfigs = [
      'tsconfig.json',
      'jsconfig.json',
    ];

    for (const config of possibleConfigs) {
      const configPath = path.join(this.workspaceRoot, config);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }

    return undefined;
  }

  public saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save web configuration:', error);
    }
  }

  public getConfig(): WebLanguageConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<WebLanguageConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  public getTSSDK(): string {
    return this.config.typescript.tsdk;
  }

  public getPrettierConfig(): string | undefined {
    return this.config.prettier.configPath;
  }

  public getESLintNodePath(): string | undefined {
    return this.config.eslint.nodePath;
  }

  public isESLintEnabled(): boolean {
    return this.config.eslint.enabled;
  }

  public isFormatOnSave(): boolean {
    return this.config.editor.formatOnSave;
  }

  public isOrganizeImportsOnSave(): boolean {
    return this.config.editor.organizeImportsOnSave;
  }

  public getPrettierOptions() {
    return {
      useTabs: this.config.prettier.useTabs,
      tabWidth: this.config.prettier.tabWidth,
      singleQuote: this.config.prettier.singleQuote,
      semi: this.config.prettier.semi,
      trailingComma: this.config.prettier.trailingComma,
      ...(this.config.prettier.configPath && {
        config: this.config.prettier.configPath,
      }),
    };
  }

  public getJSONSchemas(filePath: string): JSONSchemaMapping[] {
    return this.config.json.schemas.filter(schema =>
      schema.fileMatch.some(pattern => this.matchGlob(filePath, pattern))
    );
  }

  public getYAMLSchemas(filePath: string): JSONSchemaMapping[] {
    return this.config.yaml.schemas.filter(schema =>
      schema.fileMatch.some(pattern => this.matchGlob(filePath, pattern))
    );
  }

  private matchGlob(filePath: string, pattern: string): boolean {
    // Simple glob matching
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(path.basename(filePath));
  }

  public detectPackageManager(): 'npm' | 'yarn' | 'pnpm' | 'bun' | 'none' {
    if (fs.existsSync(path.join(this.workspaceRoot, 'bun.lockb'))) {
      return 'bun';
    }
    if (fs.existsSync(path.join(this.workspaceRoot, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    if (fs.existsSync(path.join(this.workspaceRoot, 'yarn.lock'))) {
      return 'yarn';
    }
    if (fs.existsSync(path.join(this.workspaceRoot, 'package-lock.json')) ||
        fs.existsSync(path.join(this.workspaceRoot, 'package.json'))) {
      return 'npm';
    }
    return 'none';
  }

  public getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }
}

// Singleton instance
let configInstance: WebConfiguration | null = null;

export function getWebConfiguration(workspaceRoot: string): WebConfiguration {
  if (!configInstance || configInstance.getWorkspaceRoot() !== workspaceRoot) {
    configInstance = new WebConfiguration(workspaceRoot);
  }
  return configInstance;
}

export function resetConfiguration(): void {
  configInstance = null;
}
