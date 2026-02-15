// Java Language Support for Kimi IDE IDE
// Main exports

export { 
  JavaLanguageProvider, 
  JDKInfo, 
  BuildSystemInfo, 
  MavenGoal, 
  GradleTask 
} from './JavaLanguageProvider';

export { 
  JavaConfiguration, 
  DEFAULT_JAVA_CONFIGURATION, 
  JAVA_CONFIG_SCHEMA 
} from './JavaConfig';

export {
  MAVEN_LIFECYCLE_PHASES,
  MAVEN_GOALS,
  GRADLE_TASKS,
  GRADLE_TASK_GROUPS,
  JAVA_KEYWORDS,
  JAVA_COMMON_TYPES,
  JAVA_MODIFIERS,
  JAVA_FILE_PATTERNS,
  JDK_DETECTION_PATHS,
  ERROR_MESSAGES
} from './JavaConstants';

export { JavaStatusBar } from './ui/JavaStatusBar';
export { MavenPanel } from './ui/MavenPanel';
export { GradlePanel } from './ui/GradlePanel';
export { JavaIPCHandler } from './ipc/JavaIPCHandler';

// Version
export const JAVA_SUPPORT_VERSION = '1.0.0';
