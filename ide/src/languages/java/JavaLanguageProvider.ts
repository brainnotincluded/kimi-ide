import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { 
  ILanguageProvider, 
  IDiagnostic, 
  ICompletionItem,
  DiagnosticSeverity,
  CompletionItemKind,
  Position,
  Range
} from '../ILanguageProvider';
import { ConfigManager } from '../../config/ConfigManager';
import { Logger } from '../../utils/Logger';
import { FileUtils } from '../../utils/FileUtils';

const execAsync = promisify(cp.exec);
const existsAsync = promisify(fs.exists);

export interface JDKInfo {
  version: string;
  home: string;
  javaPath: string;
  javacPath: string;
}

export interface BuildSystemInfo {
  type: 'maven' | 'gradle' | 'none';
  version?: string;
  rootDir: string;
  configFile: string;
}

export interface MavenGoal {
  name: string;
  description: string;
  phase: string;
}

export interface GradleTask {
  name: string;
  description: string;
  group: string;
}

export class JavaLanguageProvider extends EventEmitter implements ILanguageProvider {
  public readonly id = 'java';
  public readonly name = 'Java';
  public readonly extensions = ['.java'];
  
  private jdkInfo: JDKInfo | null = null;
  private buildSystem: BuildSystemInfo | null = null;
  private configManager: ConfigManager;
  private logger: Logger;
  private jdtlsProcess: cp.ChildProcess | null = null;
  private workspaceRoot: string = '';

  constructor(workspaceRoot: string) {
    super();
    this.workspaceRoot = workspaceRoot;
    this.configManager = ConfigManager.getInstance();
    this.logger = Logger.getInstance();
  }

  /**
   * Initialize Java language support
   */
  public async initialize(): Promise<void> {
    this.logger.info('Initializing Java language support...');
    
    // Detect JDK
    await this.detectJDK();
    
    // Detect build system
    await this.getBuildSystem();
    
    // Start JDTLS if enabled
    if (this.configManager.get('java.jdtls.enabled', true)) {
      await this.startJDTLS();
    }
    
    this.emit('initialized');
  }

  /**
   * Detect JDK installation
   */
  public async detectJDK(): Promise<JDKInfo | null> {
    try {
      // Check config first
      const configJavaHome = this.configManager.get<string>('java.home');
      if (configJavaHome && await this.validateJDK(configJavaHome)) {
        this.jdkInfo = await this.getJDKInfo(configJavaHome);
        this.logger.info(`Using JDK from config: ${this.jdkInfo.version}`);
        this.emit('jdkDetected', this.jdkInfo);
        return this.jdkInfo;
      }

      // Check JAVA_HOME environment variable
      const javaHome = process.env.JAVA_HOME;
      if (javaHome && await this.validateJDK(javaHome)) {
        this.jdkInfo = await this.getJDKInfo(javaHome);
        this.logger.info(`Using JDK from JAVA_HOME: ${this.jdkInfo.version}`);
        this.emit('jdkDetected', this.jdkInfo);
        return this.jdkInfo;
      }

      // Try to find java in PATH
      try {
        const { stdout } = await execAsync('java -version 2>&1');
        const versionMatch = stdout.match(/version "?(\d+(?:\.\d+)*)/);
        if (versionMatch) {
          // Try to find JAVA_HOME from java path
          const { stdout: javaPath } = await execAsync('which java');
          const resolvedPath = await fs.promises.realpath(javaPath.trim());
          const inferredHome = path.resolve(resolvedPath, '..', '..');
          
          if (await this.validateJDK(inferredHome)) {
            this.jdkInfo = await this.getJDKInfo(inferredHome);
            this.logger.info(`Using JDK from PATH: ${this.jdkInfo.version}`);
            this.emit('jdkDetected', this.jdkInfo);
            return this.jdkInfo;
          }
        }
      } catch {
        // java not in PATH
      }

      // Search common JDK locations
      const commonPaths = this.getCommonJDKPaths();
      for (const jdkPath of commonPaths) {
        if (await this.validateJDK(jdkPath)) {
          this.jdkInfo = await this.getJDKInfo(jdkPath);
          this.logger.info(`Found JDK at common path: ${this.jdkInfo.version}`);
          this.emit('jdkDetected', this.jdkInfo);
          return this.jdkInfo;
        }
      }

      this.logger.warn('No JDK found');
      this.emit('jdkNotFound');
      return null;
    } catch (error) {
      this.logger.error('Error detecting JDK:', error);
      return null;
    }
  }

  /**
   * Get common JDK installation paths based on platform
   */
  private getCommonJDKPaths(): string[] {
    const platform = process.platform;
    const paths: string[] = [];

    if (platform === 'darwin') {
      paths.push(
        '/Library/Java/JavaVirtualMachines/Contents/Home',
        '/System/Library/Java/JavaVirtualMachines/Contents/Home'
      );
      // Check for specific JDK versions on macOS
      for (let v = 8; v <= 21; v++) {
        paths.push(`/Library/Java/JavaVirtualMachines/temurin-${v}.jdk/Contents/Home`);
        paths.push(`/Library/Java/JavaVirtualMachines/adoptopenjdk-${v}.jdk/Contents/Home`);
        paths.push(`/Library/Java/JavaVirtualMachines/zulu-${v}.jdk/Contents/Home`);
        paths.push(`/Library/Java/JavaVirtualMachines/jdk-${v}.jdk/Contents/Home`);
        paths.push(`/Library/Java/JavaVirtualMachines/openjdk-${v}.jdk/Contents/Home`);
      }
    } else if (platform === 'win32') {
      paths.push(
        'C:\\Program Files\\Java',
        'C:\\Program Files\\Eclipse Adoptium',
        'C:\\Program Files\\Amazon Corretto',
        'C:\\Program Files\\Microsoft'
      );
    } else {
      // Linux
      paths.push(
        '/usr/lib/jvm/default-java',
        '/usr/lib/jvm/java',
        '/usr/lib/jvm/default',
        '/usr/java/default'
      );
      for (let v = 8; v <= 21; v++) {
        paths.push(`/usr/lib/jvm/java-${v}-openjdk`);
        paths.push(`/usr/lib/jvm/java-${v}-openjdk-amd64`);
        paths.push(`/usr/lib/jvm/temurin-${v}-jdk`);
        paths.push(`/usr/lib/jvm/zulu-${v}-azure`);
      }
    }

    return paths;
  }

  /**
   * Validate JDK installation
   */
  private async validateJDK(javaHome: string): Promise<boolean> {
    try {
      const javaPath = path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
      const javacPath = path.join(javaHome, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac');
      
      const [javaExists, javacExists] = await Promise.all([
        existsAsync(javaPath),
        existsAsync(javacPath)
      ]);
      
      return javaExists && javacExists;
    } catch {
      return false;
    }
  }

  /**
   * Get JDK information
   */
  private async getJDKInfo(javaHome: string): Promise<JDKInfo> {
    const javaPath = path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    const javacPath = path.join(javaHome, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac');
    
    const { stdout } = await execAsync(`"${javaPath}" -version 2>&1`);
    const versionMatch = stdout.match(/version "?(\d+(?:\.\d+)*)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';
    
    return {
      version,
      home: javaHome,
      javaPath,
      javacPath
    };
  }

  /**
   * Get current JDK info
   */
  public getCurrentJDKInfo(): JDKInfo | null {
    return this.jdkInfo;
  }

  /**
   * Detect build system (Maven or Gradle)
   */
  public async getBuildSystem(): Promise<BuildSystemInfo | null> {
    try {
      // Check for Maven
      const pomPath = path.join(this.workspaceRoot, 'pom.xml');
      if (await existsAsync(pomPath)) {
        if (this.configManager.get('java.import.maven.enabled', true)) {
          const version = await this.getMavenVersion();
          this.buildSystem = {
            type: 'maven',
            version,
            rootDir: this.workspaceRoot,
            configFile: pomPath
          };
          this.logger.info(`Detected Maven project${version ? ` (v${version})` : ''}`);
          this.emit('buildSystemDetected', this.buildSystem);
          return this.buildSystem;
        }
      }

      // Check for Gradle
      const gradlePaths = [
        path.join(this.workspaceRoot, 'build.gradle'),
        path.join(this.workspaceRoot, 'build.gradle.kts'),
        path.join(this.workspaceRoot, 'settings.gradle'),
        path.join(this.workspaceRoot, 'settings.gradle.kts')
      ];
      
      for (const gradlePath of gradlePaths) {
        if (await existsAsync(gradlePath)) {
          if (this.configManager.get('java.import.gradle.enabled', true)) {
            const version = await this.getGradleVersion();
            this.buildSystem = {
              type: 'gradle',
              version,
              rootDir: this.workspaceRoot,
              configFile: gradlePath
            };
            this.logger.info(`Detected Gradle project${version ? ` (v${version})` : ''}`);
            this.emit('buildSystemDetected', this.buildSystem);
            return this.buildSystem;
          }
        }
      }

      this.buildSystem = {
        type: 'none',
        rootDir: this.workspaceRoot,
        configFile: ''
      };
      
      return this.buildSystem;
    } catch (error) {
      this.logger.error('Error detecting build system:', error);
      return null;
    }
  }

  /**
   * Get Maven version
   */
  private async getMavenVersion(): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync('mvn -version', { cwd: this.workspaceRoot });
      const match = stdout.match(/Apache Maven (\d+\.\d+\.\d+)/);
      return match?.[1];
    } catch {
      return undefined;
    }
  }

  /**
   * Get Gradle version
   */
  private async getGradleVersion(): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync('./gradlew --version', { cwd: this.workspaceRoot });
      const match = stdout.match(/Gradle (\d+\.\d+\.\d+)/);
      return match?.[1];
    } catch {
      try {
        const { stdout } = await execAsync('gradle --version', { cwd: this.workspaceRoot });
        const match = stdout.match(/Gradle (\d+\.\d+\.\d+)/);
        return match?.[1];
      } catch {
        return undefined;
      }
    }
  }

  /**
   * Get current build system
   */
  public getCurrentBuildSystem(): BuildSystemInfo | null {
    return this.buildSystem;
  }

  /**
   * Run Maven goal
   */
  public async runMaven(goal: string, args: string[] = []): Promise<{ success: boolean; output: string; errors: string[] }> {
    if (!this.buildSystem || this.buildSystem.type !== 'maven') {
      return { success: false, output: '', errors: ['Not a Maven project'] };
    }

    this.emit('mavenStart', { goal });
    
    try {
      const mvnCmd = process.platform === 'win32' ? 'mvn.cmd' : 'mvn';
      const cmd = `${mvnCmd} ${goal} ${args.join(' ')}`;
      
      this.logger.info(`Running Maven: ${cmd}`);
      
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: this.workspaceRoot,
        env: {
          ...process.env,
          JAVA_HOME: this.jdkInfo?.home
        },
        timeout: 300000 // 5 minutes timeout
      });

      const errors = this.parseMavenErrors(stderr || stdout);
      const success = !errors.some(e => e.includes('BUILD FAILURE'));
      
      this.emit('mavenComplete', { goal, success, output: stdout });
      
      return { success, output: stdout, errors };
    } catch (error: any) {
      const errors = this.parseMavenErrors(error.stdout || error.stderr || error.message);
      this.emit('mavenComplete', { goal, success: false, output: error.stdout || '', errors });
      return { success: false, output: error.stdout || '', errors };
    }
  }

  /**
   * Parse Maven errors from output
   */
  private parseMavenErrors(output: string): string[] {
    const errors: string[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('[ERROR]') || line.includes('BUILD FAILURE')) {
        errors.push(line.trim());
      }
    }
    
    return errors;
  }

  /**
   * Run Gradle task
   */
  public async runGradle(task: string, args: string[] = []): Promise<{ success: boolean; output: string; errors: string[] }> {
    if (!this.buildSystem || this.buildSystem.type !== 'gradle') {
      return { success: false, output: '', errors: ['Not a Gradle project'] };
    }

    this.emit('gradleStart', { task });
    
    try {
      // Try wrapper first
      const isWin = process.platform === 'win32';
      const gradleWrapper = path.join(this.workspaceRoot, isWin ? 'gradlew.bat' : 'gradlew');
      const hasWrapper = await existsAsync(gradleWrapper);
      
      const gradleCmd = hasWrapper ? (isWin ? 'gradlew.bat' : './gradlew') : 'gradle';
      const cmd = `${gradleCmd} ${task} ${args.join(' ')}`;
      
      this.logger.info(`Running Gradle: ${cmd}`);
      
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: this.workspaceRoot,
        env: {
          ...process.env,
          JAVA_HOME: this.jdkInfo?.home
        },
        timeout: 300000
      });

      const errors = this.parseGradleErrors(stderr || stdout);
      const success = !errors.some(e => e.includes('FAILURE'));
      
      this.emit('gradleComplete', { task, success, output: stdout });
      
      return { success, output: stdout, errors };
    } catch (error: any) {
      const errors = this.parseGradleErrors(error.stdout || error.stderr || error.message);
      this.emit('gradleComplete', { task, success: false, output: error.stdout || '', errors });
      return { success: false, output: error.stdout || '', errors };
    }
  }

  /**
   * Parse Gradle errors from output
   */
  private parseGradleErrors(output: string): string[] {
    const errors: string[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.toLowerCase().includes('error') || line.includes('FAILURE')) {
        errors.push(line.trim());
      }
    }
    
    return errors;
  }

  /**
   * Get Maven lifecycle goals
   */
  public getMavenLifecycleGoals(): MavenGoal[] {
    return [
      { name: 'clean', description: 'Remove all files generated by the previous build', phase: 'clean' },
      { name: 'validate', description: 'Validate the project is correct', phase: 'default' },
      { name: 'compile', description: 'Compile the source code', phase: 'default' },
      { name: 'test', description: 'Run tests using a suitable unit testing framework', phase: 'default' },
      { name: 'package', description: 'Package compiled code into distributable format', phase: 'default' },
      { name: 'verify', description: 'Run any checks to verify the package is valid', phase: 'default' },
      { name: 'install', description: 'Install the package into the local repository', phase: 'default' },
      { name: 'deploy', description: 'Copy the final package to the remote repository', phase: 'default' },
      { name: 'site', description: 'Generate project documentation', phase: 'site' }
    ];
  }

  /**
   * Get Gradle tasks
   */
  public async getGradleTasks(): Promise<GradleTask[]> {
    if (!this.buildSystem || this.buildSystem.type !== 'gradle') {
      return [];
    }

    try {
      const isWin = process.platform === 'win32';
      const gradleWrapper = path.join(this.workspaceRoot, isWin ? 'gradlew.bat' : 'gradlew');
      const hasWrapper = await existsAsync(gradleWrapper);
      const gradleCmd = hasWrapper ? (isWin ? 'gradlew.bat' : './gradlew') : 'gradle';
      
      const { stdout } = await execAsync(`${gradleCmd} tasks --all`, {
        cwd: this.workspaceRoot,
        env: { ...process.env, JAVA_HOME: this.jdkInfo?.home }
      });

      const tasks: GradleTask[] = [];
      const lines = stdout.split('\n');
      let currentGroup = 'Other';
      
      for (const line of lines) {
        // Check for group header
        const groupMatch = line.match(/^(\w[\w\s]*) tasks$/);
        if (groupMatch) {
          currentGroup = groupMatch[1];
          continue;
        }
        
        // Parse task line
        const taskMatch = line.match(/^(\w+)\s+-\s+(.+)$/);
        if (taskMatch) {
          tasks.push({
            name: taskMatch[1],
            description: taskMatch[2],
            group: currentGroup
          });
        }
      }
      
      return tasks;
    } catch (error) {
      this.logger.error('Error getting Gradle tasks:', error);
      return this.getDefaultGradleTasks();
    }
  }

  /**
   * Get default Gradle tasks
   */
  private getDefaultGradleTasks(): GradleTask[] {
    return [
      { name: 'build', description: 'Assembles and tests this project', group: 'Build' },
      { name: 'clean', description: 'Deletes the build directory', group: 'Build' },
      { name: 'assemble', description: 'Assembles the outputs of this project', group: 'Build' },
      { name: 'check', description: 'Runs all checks', group: 'Verification' },
      { name: 'test', description: 'Runs the unit tests', group: 'Verification' },
      { name: 'classes', description: 'Assembles main classes', group: 'Build' },
      { name: 'jar', description: 'Assembles a jar archive containing the main classes', group: 'Build' },
      { name: 'javadoc', description: 'Generates Javadoc API documentation', group: 'Documentation' }
    ];
  }

  /**
   * Get diagnostics using javac, checkstyle, spotbugs
   */
  public async getDiagnostics(filePath: string): Promise<IDiagnostic[]> {
    const diagnostics: IDiagnostic[] = [];
    
    // Run javac compilation check
    const javacDiagnostics = await this.runJavacCheck(filePath);
    diagnostics.push(...javacDiagnostics);
    
    // Run checkstyle if enabled
    if (this.configManager.get('java.checkstyle.enabled', false)) {
      const checkstyleDiagnostics = await this.runCheckstyle(filePath);
      diagnostics.push(...checkstyleDiagnostics);
    }
    
    // Run SpotBugs if enabled
    if (this.configManager.get('java.spotbugs.enabled', false)) {
      const spotbugsDiagnostics = await this.runSpotBugs(filePath);
      diagnostics.push(...spotbugsDiagnostics);
    }
    
    return diagnostics;
  }

  /**
   * Run javac compilation check
   */
  private async runJavacCheck(filePath: string): Promise<IDiagnostic[]> {
    if (!this.jdkInfo) return [];
    
    const diagnostics: IDiagnostic[] = [];
    
    try {
      // Build classpath from Maven/Gradle dependencies
      const classpath = await this.buildClasspath();
      
      const cmd = `"${this.jdkInfo.javacPath}" -d /tmp/javac_out -classpath "${classpath}" -Xlint:all ${filePath}`;
      
      await execAsync(cmd, { cwd: this.workspaceRoot });
    } catch (error: any) {
      const output = error.stderr || error.stdout || '';
      const lines = output.split('\n');
      
      for (const line of lines) {
        // Parse javac error format: File.java:line: error: message
        const match = line.match(/^(.*):(\d+):\s*(error|warning|note):\s*(.+)$/);
        if (match) {
          const [, file, lineNum, severity, message] = match;
          const lineNumber = parseInt(lineNum, 10) - 1;
          
          diagnostics.push({
            file: filePath,
            line: lineNumber,
            column: 0,
            severity: severity === 'error' ? DiagnosticSeverity.Error : 
                     severity === 'warning' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Information,
            message: message.trim(),
            code: 'javac',
            source: 'Java Compiler'
          });
        }
      }
    }
    
    return diagnostics;
  }

  /**
   * Build classpath from dependencies
   */
  private async buildClasspath(): Promise<string> {
    const classpathParts: string[] = [];
    
    // Add build output directories
    if (this.buildSystem?.type === 'maven') {
      classpathParts.push(
        path.join(this.workspaceRoot, 'target', 'classes'),
        path.join(this.workspaceRoot, 'target', 'test-classes')
      );
      
      // Get Maven dependencies
      try {
        const { stdout } = await execAsync('mvn dependency:build-classpath -Dmdep.outputFile=/dev/stdout -q', {
          cwd: this.workspaceRoot,
          env: { ...process.env, JAVA_HOME: this.jdkInfo?.home }
        });
        classpathParts.push(stdout.trim());
      } catch {
        // Ignore
      }
    } else if (this.buildSystem?.type === 'gradle') {
      classpathParts.push(
        path.join(this.workspaceRoot, 'build', 'classes', 'java', 'main'),
        path.join(this.workspaceRoot, 'build', 'classes', 'java', 'test')
      );
    }
    
    return classpathParts.join(path.delimiter);
  }

  /**
   * Run Checkstyle
   */
  private async runCheckstyle(filePath: string): Promise<IDiagnostic[]> {
    const diagnostics: IDiagnostic[] = [];
    
    try {
      const configUrl = this.configManager.get<string>('java.format.settings.url');
      const checkstyleJar = this.configManager.get<string>('java.checkstyle.jar');
      
      if (!checkstyleJar) return [];
      
      const cmd = `java -jar "${checkstyleJar}" -c "${configUrl || 'google_checks.xml'}" "${filePath}"`;
      const { stdout } = await execAsync(cmd);
      
      // Parse Checkstyle XML output
      // This is simplified - real implementation would parse XML
      const lines = stdout.split('\n');
      for (const line of lines) {
        const match = line.match(/.*\[(\d+):(\d+)\]\s*(.+)/);
        if (match) {
          const [, lineNum, colNum, message] = match;
          diagnostics.push({
            file: filePath,
            line: parseInt(lineNum, 10) - 1,
            column: parseInt(colNum, 10) - 1,
            severity: DiagnosticSeverity.Warning,
            message: message.trim(),
            code: 'checkstyle',
            source: 'Checkstyle'
          });
        }
      }
    } catch (error) {
      // Checkstyle exits with non-zero on violations
    }
    
    return diagnostics;
  }

  /**
   * Run SpotBugs
   */
  private async runSpotBugs(filePath: string): Promise<IDiagnostic[]> {
    // Placeholder - SpotBugs integration would require more setup
    return [];
  }

  /**
   * Format code using google-java-format
   */
  public async formatCode(filePath: string, range?: Range): Promise<string | null> {
    try {
      const formatterPath = this.configManager.get<string>('java.format.google-java-format.jar');
      
      if (!formatterPath || !await existsAsync(formatterPath)) {
        this.logger.warn('google-java-format not found');
        return null;
      }
      
      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      // If range is specified, we need to handle partial formatting
      // For now, format entire file
      const args = ['--replace'];
      
      // Check for custom style settings
      const style = this.configManager.get<'google' | 'aosp'>('java.format.style', 'google');
      if (style === 'aosp') {
        args.push('--aosp');
      }
      
      args.push(filePath);
      
      await execAsync(`java -jar "${formatterPath}" ${args.join(' ')}`);
      
      // Read formatted content
      const formatted = await fs.promises.readFile(filePath, 'utf-8');
      
      this.emit('codeFormatted', { filePath });
      return formatted;
    } catch (error) {
      this.logger.error('Error formatting code:', error);
      return null;
    }
  }

  /**
   * Get completions using JDTLS
   */
  public async getCompletions(filePath: string, position: Position): Promise<ICompletionItem[]> {
    if (!this.jdtlsProcess) {
      // Fallback to basic completions
      return this.getBasicCompletions(filePath, position);
    }
    
    // Send completion request to JDTLS via LSP protocol
    // This is simplified - real implementation would use proper LSP client
    return this.getBasicCompletions(filePath, position);
  }

  /**
   * Get basic completions (fallback)
   */
  private async getBasicCompletions(filePath: string, position: Position): Promise<ICompletionItem[]> {
    const completions: ICompletionItem[] = [];
    
    // Read file content to get context
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const line = lines[position.line];
    
    // Simple keyword completions
    const keywords = [
      'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
      'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
      'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
      'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
      'package', 'private', 'protected', 'public', 'return', 'short', 'static',
      'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
      'transient', 'try', 'void', 'volatile', 'while', 'true', 'false', 'null',
      'var', 'yield', 'record', 'sealed', 'permits', 'non-sealed'
    ];
    
    for (const keyword of keywords) {
      completions.push({
        label: keyword,
        kind: CompletionItemKind.Keyword,
        detail: 'keyword',
        insertText: keyword
      });
    }
    
    // Common types
    const types = [
      'String', 'Object', 'Integer', 'Double', 'Boolean', 'List', 'Map', 'Set',
      'ArrayList', 'HashMap', 'HashSet', 'Optional', 'Stream', 'System', 'Math'
    ];
    
    for (const type of types) {
      completions.push({
        label: type,
        kind: CompletionItemKind.Class,
        detail: 'class',
        insertText: type
      });
    }
    
    return completions;
  }

  /**
   * Start Eclipse JDT Language Server
   */
  private async startJDTLS(): Promise<void> {
    try {
      const jdtlsHome = this.configManager.get<string>('java.jdtls.home');
      if (!jdtlsHome || !await existsAsync(jdtlsHome)) {
        this.logger.warn('JDTLS not found, skipping LSP start');
        return;
      }
      
      // Find launcher jar
      const pluginsDir = path.join(jdtlsHome, 'plugins');
      const files = await fs.promises.readdir(pluginsDir);
      const launcherJar = files.find(f => f.startsWith('org.eclipse.equinox.launcher_') && f.endsWith('.jar'));
      
      if (!launcherJar) {
        this.logger.warn('JDTLS launcher not found');
        return;
      }
      
      const launcherPath = path.join(pluginsDir, launcherJar);
      const configDir = path.join(jdtlsHome, 'config_' + (process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux'));
      
      // Create workspace directory for JDTLS
      const jdtlsWorkspace = path.join(this.workspaceRoot, '.jdtls');
      await fs.promises.mkdir(jdtlsWorkspace, { recursive: true });
      
      const args = [
        '-Declipse.application=org.eclipse.jdt.ls.core.id1',
        '-Dosgi.bundles.defaultStartLevel=4',
        '-Declipse.product=org.eclipse.jdt.ls.core.product',
        '-Dlog.protocol=true',
        '-Dlog.level=ALL',
        '-Xmx1G',
        '-jar', launcherPath,
        '-configuration', configDir,
        '-data', jdtlsWorkspace
      ];
      
      this.jdtlsProcess = cp.spawn(this.jdkInfo?.javaPath || 'java', args, {
        cwd: this.workspaceRoot,
        env: { ...process.env, JAVA_HOME: this.jdkInfo?.home }
      });
      
      this.jdtlsProcess.stdout?.on('data', (data) => {
        this.emit('jdtlsLog', { type: 'stdout', data: data.toString() });
      });
      
      this.jdtlsProcess.stderr?.on('data', (data) => {
        this.emit('jdtlsLog', { type: 'stderr', data: data.toString() });
      });
      
      this.jdtlsProcess.on('close', (code) => {
        this.logger.info(`JDTLS exited with code ${code}`);
        this.jdtlsProcess = null;
      });
      
      this.logger.info('JDTLS started');
      this.emit('jdtlsStarted');
    } catch (error) {
      this.logger.error('Error starting JDTLS:', error);
    }
  }

  /**
   * Stop JDTLS
   */
  public async stopJDTLS(): Promise<void> {
    if (this.jdtlsProcess) {
      this.jdtlsProcess.kill();
      this.jdtlsProcess = null;
      this.emit('jdtlsStopped');
    }
  }

  /**
   * Refresh workspace - re-import Maven/Gradle projects
   */
  public async refreshWorkspace(): Promise<void> {
    const updateConfig = this.configManager.get<'automatic' | 'disabled'>('java.configuration.updateBuildConfiguration', 'automatic');
    
    if (updateConfig === 'disabled') {
      return;
    }
    
    if (this.buildSystem?.type === 'maven') {
      await this.runMaven('clean');
      await this.runMaven('compile');
    } else if (this.buildSystem?.type === 'gradle') {
      await this.runGradle('clean');
      await this.runGradle('classes');
    }
    
    this.emit('workspaceRefreshed');
  }

  /**
   * Dispose resources
   */
  public async dispose(): Promise<void> {
    await this.stopJDTLS();
    this.removeAllListeners();
  }
}
