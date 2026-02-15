import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import './Editor.css';

// Configure Monaco to use local instance instead of CDN
loader.config({ monaco });

const { ipcRenderer } = window.require('electron');

interface EditorProps {
  filePath: string;
  onDirtyChange?: (isDirty: boolean) => void;
}

const languageMap: Record<string, string> = {
  'ts': 'typescript',
  'tsx': 'typescript',
  'js': 'javascript',
  'jsx': 'javascript',
  'py': 'python',
  'rs': 'rust',
  'go': 'go',
  'java': 'java',
  'c': 'c',
  'cpp': 'cpp',
  'cc': 'cpp',
  'h': 'c',
  'hpp': 'cpp',
  'css': 'css',
  'scss': 'scss',
  'less': 'less',
  'html': 'html',
  'json': 'json',
  'md': 'markdown',
  'yaml': 'yaml',
  'yml': 'yaml',
  'toml': 'ini',
  'xml': 'xml',
  'sh': 'shell',
  'bash': 'shell',
  'zsh': 'shell',
  'sql': 'sql',
  'dart': 'dart',
  'kt': 'kotlin',
  'swift': 'swift',
  'rb': 'ruby',
  'php': 'php',
};

export const CodeEditor: React.FC<EditorProps> = ({ filePath, onDirtyChange }) => {
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [language, setLanguage] = useState<string>('plaintext');
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);

  // Load file content
  useEffect(() => {
    loadFile(filePath);
  }, [filePath]);

  // Detect language
  useEffect(() => {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    setLanguage(languageMap[ext] || 'plaintext');
  }, [filePath]);

  // Notify parent about dirty state
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const loadFile = async (path: string) => {
    setIsLoading(true);
    try {
      const data = await ipcRenderer.invoke('workspace:readFile', path);
      setContent(data);
      setOriginalContent(data);
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to load file:', err);
      setContent(`// Error loading file: ${err}`);
    }
    setIsLoading(false);
  };

  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    try {
      await ipcRenderer.invoke('workspace:writeFile', filePath, content);
      setOriginalContent(content);
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  }, [content, filePath, isDirty]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof monaco) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;

    // Configure editor
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'on',
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true
      }
    });

    // Add save command
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      handleSave();
    });
  };

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      setContent(value);
      setIsDirty(value !== originalContent);
    }
  };

  if (isLoading) {
    return (
      <div className="editor-loading">
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="editor-instance">
      <Editor
        height="100%"
        language={language}
        value={content}
        theme="vs-dark"
        onChange={handleChange}
        onMount={handleEditorDidMount}
        options={{
          selectOnLineNumbers: true,
          matchBrackets: 'always',
          autoIndent: 'full',
          formatOnPaste: true,
          formatOnType: true,
        }}
        loading={
          <div className="editor-loading">
            <span>Loading Editor...</span>
          </div>
        }
      />
    </div>
  );
};
