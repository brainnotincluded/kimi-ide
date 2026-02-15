/**
 * Auto-Detectors for build tools
 * Detects tasks from npm, cargo, make, gradle, etc.
 */

import * as path from 'path';
import * as fs from 'fs';
import { DetectedTask, AutoDetectConfig, TaskGroup } from '../types';

export class AutoDetectors {
  private detectors: AutoDetectConfig[] = [
    {
      name: 'npm',
      configFiles: ['package.json'],
      detect: this.detectNpmTasks.bind(this),
    },
    {
      name: 'cargo',
      configFiles: ['Cargo.toml'],
      detect: this.detectCargoTasks.bind(this),
    },
    {
      name: 'make',
      configFiles: ['Makefile', 'makefile', 'GNUmakefile'],
      detect: this.detectMakeTasks.bind(this),
    },
    {
      name: 'gradle',
      configFiles: ['build.gradle', 'build.gradle.kts'],
      detect: this.detectGradleTasks.bind(this),
    },
    {
      name: 'maven',
      configFiles: ['pom.xml'],
      detect: this.detectMavenTasks.bind(this),
    },
    {
      name: 'python',
      configFiles: ['requirements.txt', 'setup.py', 'pyproject.toml'],
      detect: this.detectPythonTasks.bind(this),
    },
    {
      name: 'dotnet',
      configFiles: ['*.csproj', '*.sln'],
      detect: this.detectDotNetTasks.bind(this),
    },
    {
      name: 'go',
      configFiles: ['go.mod'],
      detect: this.detectGoTasks.bind(this),
    },
  ];

  public getDetectors(): AutoDetectConfig[] {
    return this.detectors;
  }

  /**
   * Detect NPM tasks from package.json
   */
  private detectNpmTasks(projectPath: string): DetectedTask[] {
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) return [];

    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    const scripts = packageJson.scripts || {};
    const tasks: DetectedTask[] = [];

    // Detect package manager
    let packageManager = 'npm';
    if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) {
      packageManager = 'yarn';
    } else if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) {
      packageManager = 'pnpm';
    } else if (fs.existsSync(path.join(projectPath, 'bun.lockb'))) {
      packageManager = 'bun';
    }

    for (const [name, command] of Object.entries(scripts)) {
      const cmdStr = command as string;
      let group: TaskGroup = 'none';

      // Categorize based on script name
      if (/^(build|compile|bundle|dist)$/.test(name)) {
        group = 'build';
      } else if (/^(test|spec|e2e|coverage)/.test(name)) {
        group = 'test';
      } else if (/^(start|dev|serve|run)/.test(name)) {
        group = 'run';
      }

      tasks.push({
        label: `npm: ${name}`,
        type: 'shell',
        command: packageManager,
        args: packageManager === 'npm' ? ['run', name] : [name],
        group,
        source: 'npm',
        description: cmdStr.substring(0, 60),
      });
    }

    // Add install task
    tasks.unshift({
      label: 'npm: install',
      type: 'shell',
      command: packageManager,
      args: ['install'],
      group: 'build',
      source: 'npm',
      description: 'Install dependencies',
    });

    return tasks;
  }

  /**
   * Detect Cargo tasks from Cargo.toml
   */
  private detectCargoTasks(projectPath: string): DetectedTask[] {
    const cargoTomlPath = path.join(projectPath, 'Cargo.toml');
    if (!fs.existsSync(cargoTomlPath)) return [];

    const tasks: DetectedTask[] = [
      {
        label: 'cargo: build',
        type: 'shell',
        command: 'cargo',
        args: ['build'],
        group: 'build',
        source: 'cargo',
        description: 'Build the project',
      },
      {
        label: 'cargo: build (release)',
        type: 'shell',
        command: 'cargo',
        args: ['build', '--release'],
        group: 'build',
        source: 'cargo',
        description: 'Build optimized release',
      },
      {
        label: 'cargo: test',
        type: 'shell',
        command: 'cargo',
        args: ['test'],
        group: 'test',
        source: 'cargo',
        description: 'Run tests',
      },
      {
        label: 'cargo: run',
        type: 'shell',
        command: 'cargo',
        args: ['run'],
        group: 'run',
        source: 'cargo',
        description: 'Run the project',
      },
      {
        label: 'cargo: check',
        type: 'shell',
        command: 'cargo',
        args: ['check'],
        group: 'build',
        source: 'cargo',
        description: 'Check for errors',
      },
      {
        label: 'cargo: clippy',
        type: 'shell',
        command: 'cargo',
        args: ['clippy'],
        group: 'build',
        source: 'cargo',
        description: 'Run Clippy lints',
      },
      {
        label: 'cargo: fmt',
        type: 'shell',
        command: 'cargo',
        args: ['fmt'],
        group: 'build',
        source: 'cargo',
        description: 'Format code',
      },
      {
        label: 'cargo: clean',
        type: 'shell',
        command: 'cargo',
        args: ['clean'],
        group: 'build',
        source: 'cargo',
        description: 'Clean build artifacts',
      },
    ];

    return tasks;
  }

  /**
   * Detect Make tasks from Makefile
   */
  private detectMakeTasks(projectPath: string): DetectedTask[] {
    const makefileNames = ['Makefile', 'makefile', 'GNUmakefile'];
    let makefilePath: string | null = null;

    for (const name of makefileNames) {
      const p = path.join(projectPath, name);
      if (fs.existsSync(p)) {
        makefilePath = p;
        break;
      }
    }

    if (!makefilePath) return [];

    const content = fs.readFileSync(makefilePath, 'utf-8');
    const tasks: DetectedTask[] = [];

    // Parse targets from Makefile
    const targetRegex = /^([a-zA-Z_][a-zA-Z0-9_]*):/gm;
    let match;

    while ((match = targetRegex.exec(content)) !== null) {
      const target = match[1];
      
      // Skip special targets
      if (target.startsWith('.')) continue;

      let group: TaskGroup = 'none';
      if (/^(build|all|compile)/.test(target)) {
        group = 'build';
      } else if (/^(test|check)/.test(target)) {
        group = 'test';
      } else if (/^(run|start)/.test(target)) {
        group = 'run';
      } else if (/^(clean|install)/.test(target)) {
        group = 'build';
      }

      tasks.push({
        label: `make: ${target}`,
        type: 'shell',
        command: 'make',
        args: [target],
        group,
        source: 'make',
        description: `Make target: ${target}`,
      });
    }

    return tasks;
  }

  /**
   * Detect Gradle tasks
   */
  private detectGradleTasks(projectPath: string): DetectedTask[] {
    const buildGradle = path.join(projectPath, 'build.gradle');
    const buildGradleKts = path.join(projectPath, 'build.gradle.kts');

    if (!fs.existsSync(buildGradle) && !fs.existsSync(buildGradleKts)) {
      return [];
    }

    const isWrapper = fs.existsSync(path.join(projectPath, 'gradlew'));
    const command = isWrapper ? './gradlew' : 'gradle';

    return [
      {
        label: 'gradle: build',
        type: 'shell',
        command,
        args: ['build'],
        group: 'build',
        source: 'gradle',
        description: 'Build the project',
      },
      {
        label: 'gradle: test',
        type: 'shell',
        command,
        args: ['test'],
        group: 'test',
        source: 'gradle',
        description: 'Run tests',
      },
      {
        label: 'gradle: run',
        type: 'shell',
        command,
        args: ['run'],
        group: 'run',
        source: 'gradle',
        description: 'Run the application',
      },
      {
        label: 'gradle: clean',
        type: 'shell',
        command,
        args: ['clean'],
        group: 'build',
        source: 'gradle',
        description: 'Clean build directory',
      },
    ];
  }

  /**
   * Detect Maven tasks
   */
  private detectMavenTasks(projectPath: string): DetectedTask[] {
    const pomPath = path.join(projectPath, 'pom.xml');
    if (!fs.existsSync(pomPath)) return [];

    const isWrapper = fs.existsSync(path.join(projectPath, 'mvnw'));
    const command = isWrapper ? './mvnw' : 'mvn';

    return [
      {
        label: 'maven: compile',
        type: 'shell',
        command,
        args: ['compile'],
        group: 'build',
        source: 'maven',
        description: 'Compile the project',
      },
      {
        label: 'maven: test',
        type: 'shell',
        command,
        args: ['test'],
        group: 'test',
        source: 'maven',
        description: 'Run tests',
      },
      {
        label: 'maven: package',
        type: 'shell',
        command,
        args: ['package'],
        group: 'build',
        source: 'maven',
        description: 'Package the project',
      },
      {
        label: 'maven: clean',
        type: 'shell',
        command,
        args: ['clean'],
        group: 'build',
        source: 'maven',
        description: 'Clean target directory',
      },
      {
        label: 'maven: install',
        type: 'shell',
        command,
        args: ['install'],
        group: 'build',
        source: 'maven',
        description: 'Install to local repository',
      },
    ];
  }

  /**
   * Detect Python tasks
   */
  private detectPythonTasks(projectPath: string): DetectedTask[] {
    const tasks: DetectedTask[] = [];

    // Check for various Python project files
    const hasRequirements = fs.existsSync(path.join(projectPath, 'requirements.txt'));
    const hasSetupPy = fs.existsSync(path.join(projectPath, 'setup.py'));
    const hasPyproject = fs.existsSync(path.join(projectPath, 'pyproject.toml'));
    const hasPipfile = fs.existsSync(path.join(projectPath, 'Pipfile'));

    // Detect test framework
    if (fs.existsSync(path.join(projectPath, 'pytest.ini')) || 
        fs.existsSync(path.join(projectPath, 'pyproject.toml'))) {
      tasks.push({
        label: 'python: pytest',
        type: 'shell',
        command: 'python',
        args: ['-m', 'pytest'],
        group: 'test',
        source: 'python',
        description: 'Run pytest',
      });
    }

    if (fs.existsSync(path.join(projectPath, 'tox.ini'))) {
      tasks.push({
        label: 'python: tox',
        type: 'shell',
        command: 'tox',
        group: 'test',
        source: 'python',
        description: 'Run tox environments',
      });
    }

    // Install task
    if (hasRequirements) {
      tasks.push({
        label: 'python: install requirements',
        type: 'shell',
        command: 'pip',
        args: ['install', '-r', 'requirements.txt'],
        group: 'build',
        source: 'python',
        description: 'Install requirements',
      });
    }

    if (hasPipfile) {
      tasks.push({
        label: 'python: pipenv install',
        type: 'shell',
        command: 'pipenv',
        args: ['install'],
        group: 'build',
        source: 'python',
        description: 'Install pipenv dependencies',
      });
    }

    // Build task
    if (hasSetupPy || hasPyproject) {
      tasks.push({
        label: 'python: build',
        type: 'shell',
        command: 'python',
        args: ['-m', 'build'],
        group: 'build',
        source: 'python',
        description: 'Build package',
      });
    }

    // Look for main.py or app.py
    if (fs.existsSync(path.join(projectPath, 'main.py'))) {
      tasks.push({
        label: 'python: run main.py',
        type: 'shell',
        command: 'python',
        args: ['main.py'],
        group: 'run',
        source: 'python',
        description: 'Run main.py',
      });
    }

    if (fs.existsSync(path.join(projectPath, 'app.py'))) {
      tasks.push({
        label: 'python: run app.py',
        type: 'shell',
        command: 'python',
        args: ['app.py'],
        group: 'run',
        source: 'python',
        description: 'Run app.py',
      });
    }

    // Flake8 linting
    tasks.push({
      label: 'python: lint (flake8)',
      type: 'shell',
      command: 'flake8',
      args: ['.'],
      group: 'build',
      source: 'python',
      description: 'Run flake8 linter',
    });

    return tasks;
  }

  /**
   * Detect .NET tasks
   */
  private detectDotNetTasks(projectPath: string): DetectedTask[] {
    const csprojFiles = fs.readdirSync(projectPath).filter(f => f.endsWith('.csproj'));
    const slnFiles = fs.readdirSync(projectPath).filter(f => f.endsWith('.sln'));

    if (csprojFiles.length === 0 && slnFiles.length === 0) return [];

    const project = csprojFiles[0] || slnFiles[0];

    return [
      {
        label: 'dotnet: build',
        type: 'shell',
        command: 'dotnet',
        args: ['build', project],
        group: 'build',
        source: 'dotnet',
        description: 'Build the project',
      },
      {
        label: 'dotnet: test',
        type: 'shell',
        command: 'dotnet',
        args: ['test'],
        group: 'test',
        source: 'dotnet',
        description: 'Run tests',
      },
      {
        label: 'dotnet: run',
        type: 'shell',
        command: 'dotnet',
        args: ['run'],
        group: 'run',
        source: 'dotnet',
        description: 'Run the application',
      },
      {
        label: 'dotnet: restore',
        type: 'shell',
        command: 'dotnet',
        args: ['restore'],
        group: 'build',
        source: 'dotnet',
        description: 'Restore NuGet packages',
      },
      {
        label: 'dotnet: publish',
        type: 'shell',
        command: 'dotnet',
        args: ['publish'],
        group: 'build',
        source: 'dotnet',
        description: 'Publish the application',
      },
    ];
  }

  /**
   * Detect Go tasks
   */
  private detectGoTasks(projectPath: string): DetectedTask[] {
    const goModPath = path.join(projectPath, 'go.mod');
    if (!fs.existsSync(goModPath)) return [];

    return [
      {
        label: 'go: build',
        type: 'shell',
        command: 'go',
        args: ['build'],
        group: 'build',
        source: 'go',
        description: 'Build the project',
      },
      {
        label: 'go: test',
        type: 'shell',
        command: 'go',
        args: ['test', './...'],
        group: 'test',
        source: 'go',
        description: 'Run tests',
      },
      {
        label: 'go: run',
        type: 'shell',
        command: 'go',
        args: ['run', '.'],
        group: 'run',
        source: 'go',
        description: 'Run the project',
      },
      {
        label: 'go: vet',
        type: 'shell',
        command: 'go',
        args: ['vet', './...'],
        group: 'build',
        source: 'go',
        description: 'Run go vet',
      },
      {
        label: 'go: fmt',
        type: 'shell',
        command: 'go',
        args: ['fmt', './...'],
        group: 'build',
        source: 'go',
        description: 'Format code',
      },
      {
        label: 'go: mod tidy',
        type: 'shell',
        command: 'go',
        args: ['mod', 'tidy'],
        group: 'build',
        source: 'go',
        description: 'Tidy go.mod',
      },
    ];
  }
}
