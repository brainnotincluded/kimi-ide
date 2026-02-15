/**
 * Java Language Support Configuration
 * 
 * This file defines all configuration options for Java support in Kimi IDE IDE.
 */

export interface JavaConfiguration {
  // JDK Configuration
  'java.home': string | null;
  'java.jdtls.home': string | null;
  'java.jdtls.enabled': boolean;
  
  // Import/Build Configuration
  'java.import.maven.enabled': boolean;
  'java.import.gradle.enabled': boolean;
  'java.import.exclusions': string[];
  
  // Build Configuration
  'java.configuration.updateBuildConfiguration': 'automatic' | 'disabled';
  'java.autobuild.enabled': boolean;
  
  // Formatting
  'java.format.enabled': boolean;
  'java.format.style': 'google' | 'aosp';
  'java.format.settings.url': string | null;
  'java.format.google-java-format.jar': string | null;
  
  // Code Actions
  'java.codeActions.organizeImports.enabled': boolean;
  'java.codeActions.organizeImports.onSave': boolean;
  
  // Diagnostics
  'java.diagnostics.enabled': boolean;
  'java.diagnostics.javac.enabled': boolean;
  'java.checkstyle.enabled': boolean;
  'java.checkstyle.jar': string | null;
  'java.spotbugs.enabled': boolean;
  
  // Completion
  'java.completion.enabled': boolean;
  'java.completion.guessMethodArguments': boolean;
  'java.completion.favoriteStaticMembers': string[];
  
  // Hover
  'java.hover.enabled': boolean;
  
  // Signature Help
  'java.signatureHelp.enabled': boolean;
  
  // Sources
  'java.sources.organizeImports.starThreshold': number;
  'java.sources.organizeImports.staticStarThreshold': number;
}

export const DEFAULT_JAVA_CONFIGURATION: Partial<JavaConfiguration> = {
  'java.home': null,
  'java.jdtls.home': null,
  'java.jdtls.enabled': true,
  
  'java.import.maven.enabled': true,
  'java.import.gradle.enabled': true,
  'java.import.exclusions': [
    '**/node_modules/**',
    '**/.git/**',
    '**/target/**',
    '**/build/**',
    '**/.gradle/**'
  ],
  
  'java.configuration.updateBuildConfiguration': 'automatic',
  'java.autobuild.enabled': true,
  
  'java.format.enabled': true,
  'java.format.style': 'google',
  'java.format.settings.url': null,
  'java.format.google-java-format.jar': null,
  
  'java.codeActions.organizeImports.enabled': true,
  'java.codeActions.organizeImports.onSave': true,
  
  'java.diagnostics.enabled': true,
  'java.diagnostics.javac.enabled': true,
  'java.checkstyle.enabled': false,
  'java.checkstyle.jar': null,
  'java.spotbugs.enabled': false,
  
  'java.completion.enabled': true,
  'java.completion.guessMethodArguments': true,
  'java.completion.favoriteStaticMembers': [
    'org.junit.Assert.*',
    'org.junit.Assume.*',
    'org.junit.jupiter.api.Assertions.*',
    'org.junit.jupiter.api.Assumptions.*',
    'org.junit.jupiter.api.DynamicContainer.*',
    'org.junit.jupiter.api.DynamicTest.*',
    'org.mockito.Mockito.*',
    'org.mockito.ArgumentMatchers.*',
    'org.mockito.Answers.*'
  ],
  
  'java.hover.enabled': true,
  'java.signatureHelp.enabled': true,
  
  'java.sources.organizeImports.starThreshold': 99,
  'java.sources.organizeImports.staticStarThreshold': 99
};

/**
 * Configuration schema for IDE settings UI
 */
export const JAVA_CONFIG_SCHEMA = {
  type: 'object',
  title: 'Java',
  properties: {
    'java.home': {
      type: 'string',
      title: 'Java Home',
      description: 'Path to JDK home directory (overrides JAVA_HOME)',
      format: 'directory'
    },
    'java.jdtls.home': {
      type: 'string',
      title: 'JDTLS Home',
      description: 'Path to Eclipse JDT Language Server',
      format: 'directory'
    },
    'java.jdtls.enabled': {
      type: 'boolean',
      title: 'Enable JDTLS',
      description: 'Start Eclipse JDT Language Server for advanced features',
      default: true
    },
    'java.import.maven.enabled': {
      type: 'boolean',
      title: 'Enable Maven Import',
      description: 'Enable importing Maven projects',
      default: true
    },
    'java.import.gradle.enabled': {
      type: 'boolean',
      title: 'Enable Gradle Import',
      description: 'Enable importing Gradle projects',
      default: true
    },
    'java.configuration.updateBuildConfiguration': {
      type: 'string',
      title: 'Update Build Configuration',
      description: 'How to update build configuration when config files change',
      enum: ['automatic', 'disabled'],
      enumLabels: ['Automatic', 'Disabled'],
      default: 'automatic'
    },
    'java.autobuild.enabled': {
      type: 'boolean',
      title: 'Autobuild',
      description: 'Automatically build workspace on save',
      default: true
    },
    'java.format.enabled': {
      type: 'boolean',
      title: 'Enable Formatting',
      description: 'Enable Java code formatting',
      default: true
    },
    'java.format.style': {
      type: 'string',
      title: 'Formatter Style',
      description: 'Code formatting style',
      enum: ['google', 'aosp'],
      enumLabels: ['Google Style', 'AOSP Style (Android)'],
      default: 'google'
    },
    'java.format.google-java-format.jar': {
      type: 'string',
      title: 'google-java-format Path',
      description: 'Path to google-java-format JAR file',
      format: 'file'
    },
    'java.codeActions.organizeImports.onSave': {
      type: 'boolean',
      title: 'Organize Imports on Save',
      description: 'Automatically organize imports when saving files',
      default: true
    },
    'java.checkstyle.enabled': {
      type: 'boolean',
      title: 'Enable Checkstyle',
      description: 'Run Checkstyle analysis',
      default: false
    },
    'java.checkstyle.jar': {
      type: 'string',
      title: 'Checkstyle JAR Path',
      description: 'Path to checkstyle JAR file',
      format: 'file'
    },
    'java.spotbugs.enabled': {
      type: 'boolean',
      title: 'Enable SpotBugs',
      description: 'Run SpotBugs static analysis',
      default: false
    }
  }
};
