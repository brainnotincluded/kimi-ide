import { EventEmitter } from 'events';
import { JavaLanguageProvider, GradleTask, BuildSystemInfo } from '../JavaLanguageProvider';
import { Logger } from '../../../utils/Logger';

export interface GradleTreeItem {
  id: string;
  label: string;
  description?: string;
  tooltip?: string;
  icon?: string;
  collapsibleState?: 'expanded' | 'collapsed' | 'none';
  command?: string;
  children?: GradleTreeItem[];
  contextValue?: string;
}

/**
 * Gradle Panel - Tree view for Gradle tasks
 */
export class GradlePanel extends EventEmitter {
  private provider: JavaLanguageProvider;
  private logger: Logger;
  private isVisible: boolean = false;
  private rootItems: GradleTreeItem[] = [];
  private runningTasks: Set<string> = new Set();
  private taskCache: GradleTask[] | null = null;

  constructor(provider: JavaLanguageProvider) {
    super();
    this.provider = provider;
    this.logger = Logger.getInstance();
    
    this.setupListeners();
  }

  /**
   * Setup event listeners
   */
  private setupListeners(): void {
    this.provider.on('buildSystemDetected', (buildSystem: BuildSystemInfo) => {
      if (buildSystem.type === 'gradle') {
        this.refresh();
      }
    });

    this.provider.on('gradleStart', ({ task }: { task: string }) => {
      this.runningTasks.add(task);
      this.updateTaskStatus(task, 'running');
    });

    this.provider.on('gradleComplete', ({ task, success }: { task: string; success: boolean }) => {
      this.runningTasks.delete(task);
      this.updateTaskStatus(task, success ? 'success' : 'error');
    });
  }

  /**
   * Show Gradle panel
   */
  public show(): void {
    this.isVisible = true;
    this.refresh();
    this.emit('show');
  }

  /**
   * Hide Gradle panel
   */
  public hide(): void {
    this.isVisible = false;
    this.emit('hide');
  }

  /**
   * Check if panel is visible
   */
  public get visible(): boolean {
    return this.isVisible;
  }

  /**
   * Refresh panel content
   */
  public async refresh(): Promise<void> {
    const buildSystem = this.provider.getCurrentBuildSystem();
    if (!buildSystem || buildSystem.type !== 'gradle') {
      this.rootItems = [{
        id: 'not-gradle',
        label: 'Not a Gradle project',
        description: 'Open a project with build.gradle',
        icon: '$(info)'
      }];
      this.emit('refresh', this.rootItems);
      return;
    }

    // Load tasks
    this.taskCache = await this.provider.getGradleTasks();
    this.rootItems = this.buildTreeItems();
    this.emit('refresh', this.rootItems);
  }

  /**
   * Build tree items
   */
  private buildTreeItems(): GradleTreeItem[] {
    const items: GradleTreeItem[] = [];

    // Quick actions
    items.push(this.buildQuickActionsSection());

    // Tasks grouped by category
    items.push(this.buildTasksSection());

    // Dependencies
    items.push(this.buildDependenciesSection());

    // Build scripts
    items.push(this.buildScriptsSection());

    return items;
  }

  /**
   * Build quick actions section
   */
  private buildQuickActionsSection(): GradleTreeItem {
    const quickTasks = [
      { name: 'build', icon: '$(gear)', description: 'Assemble and test' },
      { name: 'clean', icon: '$(trashcan)', description: 'Delete build directory' },
      { name: 'test', icon: '$(beaker)', description: 'Run unit tests' },
      { name: 'check', icon: '$(check)', description: 'Run all checks' }
    ];

    return {
      id: 'quick-actions',
      label: 'Quick Actions',
      collapsibleState: 'expanded',
      icon: '$(zap)',
      children: quickTasks.map(task => ({
        id: `quick.${task.name}`,
        label: task.name,
        description: task.description,
        icon: task.icon,
        command: `java.runGradle.${task.name}`,
        contextValue: 'gradleQuickTask'
      }))
    };
  }

  /**
   * Build tasks section
   */
  private buildTasksSection(): GradleTreeItem {
    const tasks = this.taskCache || this.getDefaultTasks();
    
    // Group tasks by their group property
    const groups: Record<string, GradleTask[]> = {};
    const otherTasks: GradleTask[] = [];

    for (const task of tasks) {
      if (task.group && task.group !== 'Other') {
        if (!groups[task.group]) {
          groups[task.group] = [];
        }
        groups[task.group].push(task);
      } else {
        otherTasks.push(task);
      }
    }

    const children: GradleTreeItem[] = [];

    // Add grouped tasks
    const groupOrder = ['Build', 'Verification', 'Documentation', 'Publishing', 'Help'];
    for (const groupName of groupOrder) {
      const groupTasks = groups[groupName];
      if (groupTasks && groupTasks.length > 0) {
        children.push({
          id: `group.${groupName}`,
          label: groupName,
          collapsibleState: 'collapsed',
          icon: this.getGroupIcon(groupName),
          children: groupTasks.map(task => this.createTaskItem(task))
        });
      }
    }

    // Add other tasks
    if (otherTasks.length > 0) {
      children.push({
        id: 'group.other',
        label: 'Other Tasks',
        collapsibleState: 'collapsed',
        icon: '$(list-unordered)',
        children: otherTasks.map(task => this.createTaskItem(task))
      });
    }

    return {
      id: 'tasks',
      label: 'Tasks',
      collapsibleState: 'expanded',
      icon: '$(tasklist)',
      children
    };
  }

  /**
   * Get default tasks when gradle tasks command fails
   */
  private getDefaultTasks(): GradleTask[] {
    return [
      { name: 'assemble', description: 'Assemble the outputs of this project', group: 'Build' },
      { name: 'build', description: 'Assembles and tests this project', group: 'Build' },
      { name: 'classes', description: 'Assembles main classes', group: 'Build' },
      { name: 'jar', description: 'Assembles a jar archive containing the main classes', group: 'Build' },
      { name: 'testClasses', description: 'Assembles test classes', group: 'Build' },
      { name: 'clean', description: 'Deletes the build directory', group: 'Build' },
      { name: 'check', description: 'Runs all checks', group: 'Verification' },
      { name: 'test', description: 'Runs the test suite', group: 'Verification' },
      { name: 'javadoc', description: 'Generates Javadoc API documentation', group: 'Documentation' }
    ];
  }

  /**
   * Get icon for task group
   */
  private getGroupIcon(group: string): string {
    const icons: Record<string, string> = {
      'Build': '$(gear)',
      'Verification': '$(check)',
      'Documentation': '$(book)',
      'Publishing': '$(cloud-upload)',
      'Help': '$(question)'
    };
    return icons[group] || '$(list-unordered)';
  }

  /**
   * Create a task tree item
   */
  private createTaskItem(task: GradleTask): GradleTreeItem {
    const isRunning = this.runningTasks.has(task.name);
    const statusIcon = isRunning ? '$(sync~spin)' : '$(play)';
    
    return {
      id: `task.${task.name}`,
      label: task.name,
      description: task.description,
      tooltip: `${task.name}: ${task.description}`,
      icon: statusIcon,
      command: `java.runGradle.${task.name}`,
      contextValue: 'gradleTask'
    };
  }

  /**
   * Build dependencies section
   */
  private buildDependenciesSection(): GradleTreeItem {
    return {
      id: 'dependencies',
      label: 'Dependencies',
      collapsibleState: 'collapsed',
      icon: '$(package)',
      children: [
        {
          id: 'deps.declaration',
          label: 'Declared Dependencies',
          icon: '$(list)',
          command: 'java.gradle.dependencies'
        },
        {
          id: 'deps.refresh',
          label: 'Refresh Dependencies',
          icon: '$(refresh)',
          command: 'java.runGradle.buildEnvironment'
        },
        {
          id: 'deps.download-sources',
          label: 'Download Sources',
          icon: '$(cloud-download)',
          command: 'java.gradle.downloadSources'
        }
      ]
    };
  }

  /**
   * Build scripts section
   */
  private buildScriptsSection(): GradleTreeItem {
    return {
      id: 'scripts',
      label: 'Build Scripts',
      collapsibleState: 'collapsed',
      icon: '$(file-code)',
      children: [
        {
          id: 'script.build-gradle',
          label: 'build.gradle',
          icon: '$(file)',
          command: 'java.gradle.openBuildScript'
        },
        {
          id: 'script.settings-gradle',
          label: 'settings.gradle',
          icon: '$(file)',
          command: 'java.gradle.openSettings'
        },
        {
          id: 'script.gradle-properties',
          label: 'gradle.properties',
          icon: '$(file)',
          command: 'java.gradle.openProperties'
        }
      ]
    };
  }

  /**
   * Update task status
   */
  private updateTaskStatus(taskName: string, status: 'running' | 'success' | 'error'): void {
    const updateItem = (items: GradleTreeItem[]): boolean => {
      for (const item of items) {
        if (item.id === `task.${taskName}` || item.command === `java.runGradle.${taskName}`) {
          const icons = {
            running: '$(sync~spin)',
            success: '$(check)',
            error: '$(error)'
          };
          item.icon = icons[status];
          this.emit('itemUpdated', item);
          return true;
        }
        if (item.children && updateItem(item.children)) {
          return true;
        }
      }
      return false;
    };

    updateItem(this.rootItems);
  }

  /**
   * Get tree items
   */
  public getTreeItems(): GradleTreeItem[] {
    return this.rootItems;
  }

  /**
   * Run a Gradle task
   */
  public async runTask(task: string, args: string[] = []): Promise<void> {
    this.emit('taskStart', { task });
    
    try {
      const result = await this.provider.runGradle(task, args);
      this.emit('taskComplete', { task, result });
    } catch (error) {
      this.emit('taskError', { task, error });
    }
  }

  /**
   * Run custom task
   */
  public async runCustomTask(): Promise<void> {
    this.emit('showCustomTaskInput');
  }

  /**
   * Execute custom Gradle task
   */
  public async executeCustomTask(command: string): Promise<void> {
    const parts = command.trim().split(/\s+/);
    const task = parts[0];
    const args = parts.slice(1);
    
    await this.runTask(task, args);
  }

  /**
   * Open build scan
   */
  public async openBuildScan(): Promise<void> {
    this.emit('openBuildScan');
    await this.provider.runGradle('build', ['--scan']);
  }

  /**
   * Show dependency tree
   */
  public async showDependencyTree(): Promise<void> {
    this.emit('showDependencyTree');
    await this.provider.runGradle('dependencies');
  }

  /**
   * Refresh dependencies
   */
  public async refreshDependencies(): Promise<void> {
    this.emit('refreshDependencies');
    await this.provider.runGradle('buildEnvironment');
    await this.refresh();
  }

  /**
   * Toggle offline mode
   */
  public async toggleOfflineMode(): Promise<void> {
    this.emit('toggleOfflineMode');
  }

  /**
   * Configure Gradle wrapper
   */
  public async configureWrapper(): Promise<void> {
    this.emit('configureWrapper');
    await this.provider.runGradle('wrapper');
  }

  /**
   * Dispose
   */
  public dispose(): void {
    this.runningTasks.clear();
    this.taskCache = null;
    this.removeAllListeners();
  }
}
