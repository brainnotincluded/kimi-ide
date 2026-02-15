/**
 * Git UI Components
 * UI components for Git integration
 */

export { 
  SourceControlPanel, 
  createSourceControlPanel,
  SourceControlPanelCallbacks 
} from './SourceControlPanel';

export { 
  GitStatusBar, 
  createGitStatusBar,
  GitStatusBarCallbacks 
} from './GitStatusBar';

export { 
  InlineDecorationsManager,
  createInlineDecorations,
  createMonacoIntegration,
  createCodeMirrorIntegration,
  EditorIntegration
} from './inline-decorations';
