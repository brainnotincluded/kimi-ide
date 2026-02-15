import { EventEmitter } from 'events';
import { JavaLanguageProvider, JDKInfo, BuildSystemInfo } from '../JavaLanguageProvider';
import { JavaStatusBar } from '../ui/JavaStatusBar';
import { MavenPanel } from '../ui/MavenPanel';
import { GradlePanel } from '../ui/GradlePanel';
import { Logger } from '../../../utils/Logger';

export interface IPCRequest {
  id: string;
  channel: string;
  args: any[];
}

export interface IPCResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Java IPC Handler
 * Handles all IPC communication for Java language support
 */
export class JavaIPCHandler extends EventEmitter {
  private provider: JavaLanguageProvider;
  private statusBar: JavaStatusBar;
  private mavenPanel: MavenPanel;
  private gradlePanel: GradlePanel;
  private logger: Logger;

  constructor(
    provider: JavaLanguageProvider,
    statusBar: JavaStatusBar,
    mavenPanel: MavenPanel,
    gradlePanel: GradlePanel
  ) {
    super();
    this.provider = provider;
    this.statusBar = statusBar;
    this.mavenPanel = mavenPanel;
    this.gradlePanel = gradlePanel;
    this.logger = Logger.getInstance();
    
    this.setupHandlers();
  }

  /**
   * Setup IPC handlers
   */
  private setupHandlers(): void {
    // JDK detection
    this.on('java:detectJDK', this.handleDetectJDK.bind(this));
    
    // Maven commands
    this.on('java:runMaven', this.handleRunMaven.bind(this));
    this.on('java:getMavenGoals', this.handleGetMavenGoals.bind(this));
    this.on('java:showMavenPanel', this.handleShowMavenPanel.bind(this));
    
    // Gradle commands
    this.on('java:runGradle', this.handleRunGradle.bind(this));
    this.on('java:getGradleTasks', this.handleGetGradleTasks.bind(this));
    this.on('java:showGradlePanel', this.handleShowGradlePanel.bind(this));
    
    // Workspace commands
    this.on('java:refreshWorkspace', this.handleRefreshWorkspace.bind(this));
    this.on('java:getBuildSystem', this.handleGetBuildSystem.bind(this));
    
    // Code commands
    this.on('java:formatCode', this.handleFormatCode.bind(this));
    this.on('java:getDiagnostics', this.handleGetDiagnostics.bind(this));
    this.on('java:getCompletions', this.handleGetCompletions.bind(this));
    
    // Configuration commands
    this.on('java:selectJDK', this.handleSelectJDK.bind(this));
    this.on('java:getJDKInfo', this.handleGetJDKInfo.bind(this));
    this.on('java:updateConfig', this.handleUpdateConfig.bind(this));
  }

  /**
   * Handle incoming IPC request
   */
  public async handleRequest(request: IPCRequest): Promise<IPCResponse> {
    const { id, channel, args } = request;
    
    try {
      this.logger.debug(`Java IPC: ${channel}`, args);
      
      const handler = this.listeners(channel).find(() => true);
      if (!handler) {
        return {
          id,
          success: false,
          error: `Unknown channel: ${channel}`
        };
      }

      const result = await handler(...args);
      
      return {
        id,
        success: true,
        data: result
      };
    } catch (error: any) {
      this.logger.error(`Java IPC error on ${channel}:`, error);
      return {
        id,
        success: false,
        error: error.message || String(error)
      };
    }
  }

  /**
   * Handle java:detectJDK
   */
  private async handleDetectJDK(): Promise<JDKInfo | null> {
    const jdk = await this.provider.detectJDK();
    return jdk;
  }

  /**
   * Handle java:runMaven
   */
  private async handleRunMaven(goal: string, args?: string[]): Promise<any> {
    const result = await this.provider.runMaven(goal, args || []);
    return result;
  }

  /**
   * Handle java:getMavenGoals
   */
  private async handleGetMavenGoals(): Promise<any[]> {
    return this.provider.getMavenLifecycleGoals();
  }

  /**
   * Handle java:showMavenPanel
   */
  private async handleShowMavenPanel(): Promise<void> {
    this.mavenPanel.show();
  }

  /**
   * Handle java:runGradle
   */
  private async handleRunGradle(task: string, args?: string[]): Promise<any> {
    const result = await this.provider.runGradle(task, args || []);
    return result;
  }

  /**
   * Handle java:getGradleTasks
   */
  private async handleGetGradleTasks(): Promise<any[]> {
    return this.provider.getGradleTasks();
  }

  /**
   * Handle java:showGradlePanel
   */
  private async handleShowGradlePanel(): Promise<void> {
    this.gradlePanel.show();
  }

  /**
   * Handle java:refreshWorkspace
   */
  private async handleRefreshWorkspace(): Promise<void> {
    await this.provider.refreshWorkspace();
  }

  /**
   * Handle java:getBuildSystem
   */
  private async handleGetBuildSystem(): Promise<BuildSystemInfo | null> {
    return this.provider.getCurrentBuildSystem();
  }

  /**
   * Handle java:formatCode
   */
  private async handleFormatCode(filePath: string, range?: any): Promise<string | null> {
    return this.provider.formatCode(filePath, range);
  }

  /**
   * Handle java:getDiagnostics
   */
  private async handleGetDiagnostics(filePath: string): Promise<any[]> {
    return this.provider.getDiagnostics(filePath);
  }

  /**
   * Handle java:getCompletions
   */
  private async handleGetCompletions(filePath: string, position: any): Promise<any[]> {
    return this.provider.getCompletions(filePath, position);
  }

  /**
   * Handle java:selectJDK
   */
  private async handleSelectJDK(javaHome?: string): Promise<JDKInfo | null> {
    if (javaHome) {
      // Validate and set the provided JDK path
      // This would update the configuration
      this.emit('selectJDK', javaHome);
    } else {
      // Show JDK selector UI
      this.statusBar.showJDKSelector();
    }
    return this.provider.getJDKInfo();
  }

  /**
   * Handle java:getJDKInfo
   */
  private async handleGetJDKInfo(): Promise<JDKInfo | null> {
    return this.provider.getJDKInfo();
  }

  /**
   * Handle java:updateConfig
   */
  private async handleUpdateConfig(key: string, value: any): Promise<void> {
    this.emit('updateConfig', { key, value });
  }

  // ============ UI Event Forwarders ============

  /**
   * Forward status bar events
   */
  public forwardStatusBarEvents(): void {
    this.statusBar.on('updated', (items) => {
      this.emit('statusBar:updated', items);
    });
    
    this.statusBar.on('itemUpdated', (item) => {
      this.emit('statusBar:itemUpdated', item);
    });
    
    this.statusBar.on('showJDKSelector', () => {
      this.emit('ui:showJDKSelector');
    });
  }

  /**
   * Forward Maven panel events
   */
  public forwardMavenEvents(): void {
    this.mavenPanel.on('refresh', (items) => {
      this.emit('mavenPanel:refresh', items);
    });
    
    this.mavenPanel.on('itemUpdated', (item) => {
      this.emit('mavenPanel:itemUpdated', item);
    });
    
    this.mavenPanel.on('goalStart', ({ goal }) => {
      this.emit('mavenPanel:goalStart', { goal });
    });
    
    this.mavenPanel.on('goalComplete', ({ goal, result }) => {
      this.emit('mavenPanel:goalComplete', { goal, result });
    });
    
    this.mavenPanel.on('showCustomCommandInput', () => {
      this.emit('ui:showMavenCustomCommand');
    });
  }

  /**
   * Forward Gradle panel events
   */
  public forwardGradleEvents(): void {
    this.gradlePanel.on('refresh', (items) => {
      this.emit('gradlePanel:refresh', items);
    });
    
    this.gradlePanel.on('itemUpdated', (item) => {
      this.emit('gradlePanel:itemUpdated', item);
    });
    
    this.gradlePanel.on('taskStart', ({ task }) => {
      this.emit('gradlePanel:taskStart', { task });
    });
    
    this.gradlePanel.on('taskComplete', ({ task, result }) => {
      this.emit('gradlePanel:taskComplete', { task, result });
    });
    
    this.gradlePanel.on('showCustomTaskInput', () => {
      this.emit('ui:showGradleCustomTask');
    });
  }

  /**
   * Forward provider events
   */
  public forwardProviderEvents(): void {
    this.provider.on('jdkDetected', (jdk) => {
      this.emit('provider:jdkDetected', jdk);
    });
    
    this.provider.on('jdkNotFound', () => {
      this.emit('provider:jdkNotFound');
    });
    
    this.provider.on('buildSystemDetected', (buildSystem) => {
      this.emit('provider:buildSystemDetected', buildSystem);
    });
    
    this.provider.on('jdtlsStarted', () => {
      this.emit('provider:jdtlsStarted');
    });
    
    this.provider.on('jdtlsStopped', () => {
      this.emit('provider:jdtlsStopped');
    });
  }

  /**
   * Initialize all event forwarding
   */
  public initializeEventForwarding(): void {
    this.forwardStatusBarEvents();
    this.forwardMavenEvents();
    this.forwardGradleEvents();
    this.forwardProviderEvents();
  }

  /**
   * Send message to renderer process
   */
  public send(channel: string, ...args: any[]): void {
    this.emit('send-to-renderer', channel, ...args);
  }

  /**
   * Dispose
   */
  public dispose(): void {
    this.removeAllListeners();
  }
}
