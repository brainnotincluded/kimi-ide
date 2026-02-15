import { EventEmitter } from 'events';
import { JavaLanguageProvider, JDKInfo, BuildSystemInfo } from '../JavaLanguageProvider';
import { ConfigManager } from '../../../config/ConfigManager';
import { Logger } from '../../../utils/Logger';

export interface StatusBarItem {
  id: string;
  text: string;
  tooltip: string;
  command?: string;
  color?: string;
  priority: number;
}

/**
 * Java Status Bar Component
 * Shows JDK version, build system status, and quick action buttons
 */
export class JavaStatusBar extends EventEmitter {
  private provider: JavaLanguageProvider;
  private configManager: ConfigManager;
  private logger: Logger;
  private items: Map<string, StatusBarItem> = new Map();
  private isVisible: boolean = false;

  constructor(provider: JavaLanguageProvider) {
    super();
    this.provider = provider;
    this.configManager = ConfigManager.getInstance();
    this.logger = Logger.getInstance();
    
    this.setupListeners();
  }

  /**
   * Setup event listeners
   */
  private setupListeners(): void {
    this.provider.on('jdkDetected', (jdk: JDKInfo) => {
      this.updateJDKItem(jdk);
      this.emit('updated', this.getItems());
    });

    this.provider.on('jdkNotFound', () => {
      this.updateJDKNotFound();
      this.emit('updated', this.getItems());
    });

    this.provider.on('buildSystemDetected', (buildSystem: BuildSystemInfo) => {
      this.updateBuildSystemItem(buildSystem);
      this.emit('updated', this.getItems());
    });

    this.provider.on('mavenStart', ({ goal }: { goal: string }) => {
      this.updateBuildStatus('maven', goal, 'running');
    });

    this.provider.on('mavenComplete', ({ goal, success }: { goal: string; success: boolean }) => {
      this.updateBuildStatus('maven', goal, success ? 'success' : 'error');
    });

    this.provider.on('gradleStart', ({ task }: { task: string }) => {
      this.updateBuildStatus('gradle', task, 'running');
    });

    this.provider.on('gradleComplete', ({ task, success }: { task: string; success: boolean }) => {
      this.updateBuildStatus('gradle', task, success ? 'success' : 'error');
    });
  }

  /**
   * Show status bar
   */
  public show(): void {
    this.isVisible = true;
    this.initializeItems();
    this.emit('show', this.getItems());
  }

  /**
   * Hide status bar
   */
  public hide(): void {
    this.isVisible = false;
    this.emit('hide');
  }

  /**
   * Initialize all status bar items
   */
  private initializeItems(): void {
    // JDK version item
    const jdkInfo = this.provider.getJDKInfo();
    if (jdkInfo) {
      this.updateJDKItem(jdkInfo);
    } else {
      this.updateJDKNotFound();
    }

    // Build system item
    const buildSystem = this.provider.getCurrentBuildSystem();
    if (buildSystem) {
      this.updateBuildSystemItem(buildSystem);
    }

    // Lifecycle actions
    this.updateLifecycleItems();
  }

  /**
   * Update JDK status item
   */
  private updateJDKItem(jdk: JDKInfo): void {
    const version = this.formatJDKVersion(jdk.version);
    const item: StatusBarItem = {
      id: 'java.jdk',
      text: `$(coffee) Java ${version}`,
      tooltip: `JDK: ${jdk.home}\nVersion: ${jdk.version}`,
      command: 'java.selectJDK',
      color: undefined,
      priority: 100
    };
    this.items.set('jdk', item);
    this.emit('itemUpdated', item);
  }

  /**
   * Update JDK not found status
   */
  private updateJDKNotFound(): void {
    const item: StatusBarItem = {
      id: 'java.jdk',
      text: '$(error) No JDK',
      tooltip: 'No JDK found. Click to configure.',
      command: 'java.selectJDK',
      color: '#ff6b6b',
      priority: 100
    };
    this.items.set('jdk', item);
    this.emit('itemUpdated', item);
  }

  /**
   * Update build system status item
   */
  private updateBuildSystemItem(buildSystem: BuildSystemInfo): void {
    if (buildSystem.type === 'none') {
      this.items.delete('buildSystem');
      return;
    }

    const icon = buildSystem.type === 'maven' ? '$(package)' : '$(tools)';
    const text = buildSystem.type === 'maven' ? 'Maven' : 'Gradle';
    const version = buildSystem.version ? ` ${buildSystem.version}` : '';

    const item: StatusBarItem = {
      id: 'java.buildSystem',
      text: `${icon} ${text}${version}`,
      tooltip: `${text} Project\nConfig: ${buildSystem.configFile}`,
      command: buildSystem.type === 'maven' ? 'java.showMavenPanel' : 'java.showGradlePanel',
      priority: 90
    };
    this.items.set('buildSystem', item);
    this.emit('itemUpdated', item);
  }

  /**
   * Update build status indicator
   */
  private updateBuildStatus(
    type: 'maven' | 'gradle', 
    task: string, 
    status: 'running' | 'success' | 'error'
  ): void {
    const icons = {
      running: '$(sync~spin)',
      success: '$(check)',
      error: '$(error)'
    };
    const colors = {
      running: undefined,
      success: '#4ec9b0',
      error: '#f48771'
    };

    const item: StatusBarItem = {
      id: 'java.buildStatus',
      text: `${icons[status]} ${type === 'maven' ? 'mvn' : 'gradle'} ${task}`,
      tooltip: status === 'running' ? `Running ${task}...` : `${task} ${status}`,
      color: colors[status],
      priority: 95
    };
    
    this.items.set('buildStatus', item);
    this.emit('itemUpdated', item);

    // Clear status after a delay on completion
    if (status !== 'running') {
      setTimeout(() => {
        if (this.items.get('buildStatus')?.text === item.text) {
          this.items.delete('buildStatus');
          this.emit('itemUpdated', { id: 'java.buildStatus', remove: true } as any);
        }
      }, 3000);
    }
  }

  /**
   * Update lifecycle quick action items
   */
  private updateLifecycleItems(): void {
    const buildSystem = this.provider.getCurrentBuildSystem();
    if (!buildSystem || buildSystem.type === 'none') {
      return;
    }

    if (buildSystem.type === 'maven') {
      const goals = [
        { name: 'clean', icon: '$(trashcan)' },
        { name: 'compile', icon: '$(gear)' },
        { name: 'test', icon: '$(beaker)' },
        { name: 'package', icon: '$(package)' }
      ];

      goals.forEach((goal, index) => {
        const item: StatusBarItem = {
          id: `java.maven.${goal.name}`,
          text: `${goal.icon}`,
          tooltip: `Maven ${goal.name}`,
          command: `java.runMaven.${goal.name}`,
          priority: 80 - index
        };
        this.items.set(`maven-${goal.name}`, item);
      });
    } else {
      const tasks = [
        { name: 'build', icon: '$(gear)' },
        { name: 'test', icon: '$(beaker)' },
        { name: 'clean', icon: '$(trashcan)' }
      ];

      tasks.forEach((task, index) => {
        const item: StatusBarItem = {
          id: `java.gradle.${task.name}`,
          text: `${task.icon}`,
          tooltip: `Gradle ${task.name}`,
          command: `java.runGradle.${task.name}`,
          priority: 80 - index
        };
        this.items.set(`gradle-${task.name}`, item);
      });
    }
  }

  /**
   * Format JDK version for display
   */
  private formatJDKVersion(version: string): string {
    // Handle versions like "1.8.0_301" or "11.0.12" or "17"
    if (version.startsWith('1.')) {
      return version.split('.')[1]; // 1.8 -> 8
    }
    const majorVersion = version.split('.')[0];
    return majorVersion;
  }

  /**
   * Get all status bar items
   */
  public getItems(): StatusBarItem[] {
    return Array.from(this.items.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get specific item
   */
  public getItem(id: string): StatusBarItem | undefined {
    return this.items.get(id);
  }

  /**
   * Refresh status bar
   */
  public refresh(): void {
    this.initializeItems();
    this.emit('updated', this.getItems());
  }

  /**
   * Show quick pick for JDK selection
   */
  public async showJDKSelector(): Promise<void> {
    this.emit('showJDKSelector');
  }

  /**
   * Dispose
   */
  public dispose(): void {
    this.items.clear();
    this.removeAllListeners();
  }
}
