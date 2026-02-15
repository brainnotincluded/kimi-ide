import { EventEmitter } from 'events';
import { JavaLanguageProvider, MavenGoal, BuildSystemInfo } from '../JavaLanguageProvider';
import { Logger } from '../../../utils/Logger';

export interface MavenTreeItem {
  id: string;
  label: string;
  description?: string;
  tooltip?: string;
  icon?: string;
  collapsibleState?: 'expanded' | 'collapsed' | 'none';
  command?: string;
  children?: MavenTreeItem[];
  contextValue?: string;
}

/**
 * Maven Panel - Tree view for Maven lifecycle and plugins
 */
export class MavenPanel extends EventEmitter {
  private provider: JavaLanguageProvider;
  private logger: Logger;
  private isVisible: boolean = false;
  private rootItems: MavenTreeItem[] = [];
  private runningGoals: Set<string> = new Set();

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
      if (buildSystem.type === 'maven') {
        this.refresh();
      }
    });

    this.provider.on('mavenStart', ({ goal }: { goal: string }) => {
      this.runningGoals.add(goal);
      this.updateGoalStatus(goal, 'running');
    });

    this.provider.on('mavenComplete', ({ goal, success }: { goal: string; success: boolean }) => {
      this.runningGoals.delete(goal);
      this.updateGoalStatus(goal, success ? 'success' : 'error');
    });
  }

  /**
   * Show Maven panel
   */
  public show(): void {
    this.isVisible = true;
    this.refresh();
    this.emit('show');
  }

  /**
   * Hide Maven panel
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
  public refresh(): void {
    const buildSystem = this.provider.getCurrentBuildSystem();
    if (!buildSystem || buildSystem.type !== 'maven') {
      this.rootItems = [{
        id: 'not-maven',
        label: 'Not a Maven project',
        description: 'Open a project with pom.xml',
        icon: '$(info)'
      }];
      this.emit('refresh', this.rootItems);
      return;
    }

    this.rootItems = this.buildTreeItems();
    this.emit('refresh', this.rootItems);
  }

  /**
   * Build tree items
   */
  private buildTreeItems(): MavenTreeItem[] {
    const items: MavenTreeItem[] = [];

    // Lifecycle phases
    items.push(this.buildLifecycleSection());

    // Plugins section
    items.push(this.buildPluginsSection());

    // Dependencies section
    items.push(this.buildDependenciesSection());

    // Profiles section
    items.push(this.buildProfilesSection());

    return items;
  }

  /**
   * Build lifecycle section
   */
  private buildLifecycleSection(): MavenTreeItem {
    const goals = this.provider.getMavenLifecycleGoals();
    
    const phases = {
      clean: goals.filter(g => g.phase === 'clean'),
      default: goals.filter(g => g.phase === 'default'),
      site: goals.filter(g => g.phase === 'site')
    };

    const children: MavenTreeItem[] = [
      {
        id: 'lifecycle.clean',
        label: 'Clean Lifecycle',
        collapsibleState: 'collapsed',
        icon: '$(trashcan)',
        children: phases.clean.map(goal => this.createGoalItem(goal))
      },
      {
        id: 'lifecycle.default',
        label: 'Default Lifecycle',
        collapsibleState: 'expanded',
        icon: '$(gear)',
        children: phases.default.map(goal => this.createGoalItem(goal))
      },
      {
        id: 'lifecycle.site',
        label: 'Site Lifecycle',
        collapsibleState: 'collapsed',
        icon: '$(book)',
        children: phases.site.map(goal => this.createGoalItem(goal))
      }
    ];

    return {
      id: 'lifecycle',
      label: 'Lifecycle',
      collapsibleState: 'expanded',
      icon: '$(sync)',
      children
    };
  }

  /**
   * Create a goal tree item
   */
  private createGoalItem(goal: MavenGoal): MavenTreeItem {
    const isRunning = this.runningGoals.has(goal.name);
    const statusIcon = isRunning ? '$(sync~spin)' : '$(play)';
    
    return {
      id: `goal.${goal.name}`,
      label: goal.name,
      description: goal.description,
      tooltip: `${goal.name}: ${goal.description}`,
      icon: statusIcon,
      command: `java.runMaven.${goal.name}`,
      contextValue: 'mavenGoal'
    };
  }

  /**
   * Build plugins section
   */
  private buildPluginsSection(): MavenTreeItem {
    const commonPlugins = [
      { name: 'compiler', goals: ['compile', 'testCompile'] },
      { name: 'surefire', goals: ['test'] },
      { name: 'failsafe', goals: ['integration-test', 'verify'] },
      { name: 'jar', goals: ['jar', 'test-jar'] },
      { name: 'war', goals: ['war'] },
      { name: 'dependency', goals: ['tree', 'analyze', 'copy-dependencies'] },
      { name: 'javadoc', goals: ['javadoc', 'jar'] },
      { name: 'source', goals: ['jar'] },
      { name: 'enforcer', goals: ['enforce'] },
      { name: 'checkstyle', goals: ['checkstyle'] },
      { name: 'spotbugs', goals: ['spotbugs'] }
    ];

    const children: MavenTreeItem[] = commonPlugins.map(plugin => ({
      id: `plugin.${plugin.name}`,
      label: `maven-${plugin.name}-plugin`,
      collapsibleState: 'collapsed',
      icon: '$(extensions)',
      children: plugin.goals.map(goal => ({
        id: `plugin.${plugin.name}.${goal}`,
        label: goal,
        icon: '$(play-circle)',
        command: `java.runMaven.${plugin.name}:${goal}`,
        contextValue: 'mavenPluginGoal'
      }))
    }));

    return {
      id: 'plugins',
      label: 'Plugins',
      collapsibleState: 'collapsed',
      icon: '$(extensions)',
      children
    };
  }

  /**
   * Build dependencies section
   */
  private buildDependenciesSection(): MavenTreeItem {
    return {
      id: 'dependencies',
      label: 'Dependencies',
      collapsibleState: 'collapsed',
      icon: '$(package)',
      command: 'java.maven.dependencies.show',
      children: [
        {
          id: 'deps.tree',
          label: 'Show Dependency Tree',
          icon: '$(list-tree)',
          command: 'java.runMaven.dependency:tree'
        },
        {
          id: 'deps.analyze',
          label: 'Analyze Dependencies',
          icon: '$(search)',
          command: 'java.runMaven.dependency:analyze'
        },
        {
          id: 'deps.download-sources',
          label: 'Download Sources',
          icon: '$(cloud-download)',
          command: 'java.runMaven.dependency:sources'
        }
      ]
    };
  }

  /**
   * Build profiles section
   */
  private buildProfilesSection(): MavenTreeItem {
    return {
      id: 'profiles',
      label: 'Profiles',
      collapsibleState: 'collapsed',
      icon: '$(layers)',
      children: [
        {
          id: 'profile.active',
          label: 'Active Profiles',
          description: 'View active profiles',
          icon: '$(eye)',
          command: 'java.maven.profiles.active'
        },
        {
          id: 'profile.select',
          label: 'Select Profile...',
          icon: '$(list-selection)',
          command: 'java.maven.profiles.select'
        }
      ]
    };
  }

  /**
   * Update goal status
   */
  private updateGoalStatus(goal: string, status: 'running' | 'success' | 'error'): void {
    const updateItem = (items: MavenTreeItem[]): boolean => {
      for (const item of items) {
        if (item.id === `goal.${goal}` || item.command === `java.runMaven.${goal}`) {
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
  public getTreeItems(): MavenTreeItem[] {
    return this.rootItems;
  }

  /**
   * Run a Maven goal
   */
  public async runGoal(goal: string, args: string[] = []): Promise<void> {
    this.emit('goalStart', { goal });
    
    try {
      const result = await this.provider.runMaven(goal, args);
      this.emit('goalComplete', { goal, result });
    } catch (error) {
      this.emit('goalError', { goal, error });
    }
  }

  /**
   * Run custom command
   */
  public async runCustomCommand(): Promise<void> {
    this.emit('showCustomCommandInput');
  }

  /**
   * Execute custom Maven command
   */
  public async executeCustomCommand(command: string): Promise<void> {
    const parts = command.trim().split(/\s+/);
    const goal = parts[0];
    const args = parts.slice(1);
    
    await this.runGoal(goal, args);
  }

  /**
   * Open effective POM
   */
  public async openEffectivePOM(): Promise<void> {
    this.emit('openEffectivePOM');
    await this.provider.runMaven('help:effective-pom');
  }

  /**
   * Open dependency tree
   */
  public async openDependencyTree(): Promise<void> {
    this.emit('openDependencyTree');
    await this.provider.runMaven('dependency:tree');
  }

  /**
   * Dispose
   */
  public dispose(): void {
    this.runningGoals.clear();
    this.removeAllListeners();
  }
}
