// @ts-nocheck
import { useCallback, useRef, useEffect, useState } from 'react';

const { ipcRenderer } = window.require('electron');

export interface TerminalSession {
  id: string;
  name: string;
  ptyId: string | null;
  isActive: boolean;
  cwd: string;
  shell: string;
}

export interface UseTerminalOptions {
  folderPath: string | null;
  onData?: (data: string) => void;
  onExit?: (exitCode: number) => void;
}

export interface UseTerminalReturn {
  // State
  sessions: TerminalSession[];
  activeSessionId: string | null;
  
  // Actions
  createSession: (options?: { name?: string; cwd?: string }) => Promise<string>;
  closeSession: (sessionId: string) => void;
  activateSession: (sessionId: string) => void;
  renameSession: (sessionId: string, name: string) => void;
  
  // Terminal I/O
  sendText: (text: string, options?: { sessionId?: string; addNewline?: boolean }) => void;
  sendData: (data: string, sessionId?: string) => void;
  clearSession: (sessionId?: string) => void;
  killProcess: (sessionId?: string) => void;
  
  // Utility
  getActiveSession: () => TerminalSession | undefined;
  getSessionById: (sessionId: string) => TerminalSession | undefined;
  
  // Shell info
  shell: string;
}

// Detect available shell
const detectShell = (): string => {
  const platform = process.platform;
  
  if (platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe';
  }
  
  const shells = [
    process.env.SHELL,
    '/bin/zsh',
    '/bin/bash',
    '/usr/bin/fish',
    '/bin/sh'
  ];
  
  for (const shell of shells) {
    if (shell) {
      try {
        // We can't use fs directly in renderer, so we rely on env
        return shell;
      } catch {
        // Continue to next shell
      }
    }
  }
  
  return '/bin/sh';
};

// Generate unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const useTerminal = (options: UseTerminalOptions): UseTerminalReturn => {
  const { folderPath, onData, onExit } = options;
  
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const shellRef = useRef<string>(detectShell());
  const sessionCounterRef = useRef<number>(1);
  const dataHandlersRef = useRef<Map<string, (data: string) => void>>(new Map());
  const exitHandlersRef = useRef<Map<string, (exitCode: number) => void>>(new Map());

  // Get active session
  const getActiveSession = useCallback((): TerminalSession | undefined => {
    return sessions.find(s => s.id === activeSessionId);
  }, [sessions, activeSessionId]);

  // Get session by ID
  const getSessionById = useCallback((sessionId: string): TerminalSession | undefined => {
    return sessions.find(s => s.id === sessionId);
  }, [sessions]);

  // Create a new terminal session
  const createSession = useCallback(async (createOptions?: { 
    name?: string; 
    cwd?: string;
    cols?: number;
    rows?: number;
  }): Promise<string> => {
    const id = generateId();
    const name = createOptions?.name || `Terminal ${sessionCounterRef.current++}`;
    const cwd = createOptions?.cwd || folderPath || process.cwd();

    try {
      const ptyId = await ipcRenderer.invoke('terminal:create', {
        shell: shellRef.current,
        cwd,
        cols: createOptions?.cols || 80,
        rows: createOptions?.rows || 24,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        }
      });

      const newSession: TerminalSession = {
        id,
        name,
        ptyId,
        isActive: false,
        cwd,
        shell: shellRef.current
      };

      // Setup data handler
      const dataHandler = (event: any, data: { ptyId: string; data: string }) => {
        if (data.ptyId === ptyId) {
          onData?.(data.data);
        }
      };
      
      dataHandlersRef.current.set(id, dataHandler);
      ipcRenderer.on('terminal:data', dataHandler);

      // Setup exit handler
      const exitHandler = (event: any, data: { ptyId: string; exitCode: number }) => {
        if (data.ptyId === ptyId) {
          onExit?.(data.exitCode);
          // Remove the session when process exits
          setSessions(prev => prev.filter(s => s.id !== id));
          if (activeSessionId === id) {
            const remaining = sessions.filter(s => s.id !== id);
            setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
          }
        }
      };
      
      exitHandlersRef.current.set(id, exitHandler);
      ipcRenderer.on('terminal:exit', exitHandler);

      setSessions(prev => {
        // Deactivate all other sessions
        const updatedSessions = prev.map(s => ({ ...s, isActive: false }));
        return [...updatedSessions, { ...newSession, isActive: true }];
      });
      
      setActiveSessionId(id);

      return id;
    } catch (error) {
      console.error('Failed to create terminal session:', error);
      throw error;
    }
  }, [folderPath, onData, onExit, sessions, activeSessionId]);

  // Close a session
  const closeSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    // Kill PTY process
    if (session.ptyId) {
      ipcRenderer.invoke('terminal:kill', { ptyId: session.ptyId });
    }

    // Remove handlers
    const dataHandler = dataHandlersRef.current.get(sessionId);
    const exitHandler = exitHandlersRef.current.get(sessionId);
    
    if (dataHandler) {
      ipcRenderer.removeListener('terminal:data', dataHandler);
      dataHandlersRef.current.delete(sessionId);
    }
    
    if (exitHandler) {
      ipcRenderer.removeListener('terminal:exit', exitHandler);
      exitHandlersRef.current.delete(sessionId);
    }

    setSessions(prev => {
      const newSessions = prev.filter(s => s.id !== sessionId);
      
      // If closing active session, activate another one
      if (session.isActive && newSessions.length > 0) {
        newSessions[0].isActive = true;
        setActiveSessionId(newSessions[0].id);
      } else if (newSessions.length === 0) {
        setActiveSessionId(null);
      }
      
      return newSessions;
    });
  }, [sessions]);

  // Activate a session
  const activateSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.map(s => ({
      ...s,
      isActive: s.id === sessionId
    })));
    setActiveSessionId(sessionId);
  }, []);

  // Rename a session
  const renameSession = useCallback((sessionId: string, name: string) => {
    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, name } : s
    ));
  }, []);

  // Send text to a session
  const sendText = useCallback((text: string, sendOptions?: { 
    sessionId?: string; 
    addNewline?: boolean 
  }) => {
    const targetId = sendOptions?.sessionId || activeSessionId;
    if (!targetId) return;

    const session = sessions.find(s => s.id === targetId);
    if (!session?.ptyId) return;

    const data = sendOptions?.addNewline !== false ? text + '\r' : text;
    ipcRenderer.invoke('terminal:write', { ptyId: session.ptyId, data });
  }, [sessions, activeSessionId]);

  // Send raw data to a session
  const sendData = useCallback((data: string, sessionId?: string) => {
    const targetId = sessionId || activeSessionId;
    if (!targetId) return;

    const session = sessions.find(s => s.id === targetId);
    if (!session?.ptyId) return;

    ipcRenderer.invoke('terminal:write', { ptyId: session.ptyId, data });
  }, [sessions, activeSessionId]);

  // Clear a session
  const clearSession = useCallback((sessionId?: string) => {
    const targetId = sessionId || activeSessionId;
    if (!targetId) return;

    const session = sessions.find(s => s.id === targetId);
    if (!session?.ptyId) return;

    // Send clear screen escape sequence
    ipcRenderer.invoke('terminal:write', { 
      ptyId: session.ptyId, 
      data: '\x1b[2J\x1b[H' 
    });
  }, [sessions, activeSessionId]);

  // Kill process in a session
  const killProcess = useCallback((sessionId?: string) => {
    const targetId = sessionId || activeSessionId;
    if (!targetId) return;

    const session = sessions.find(s => s.id === targetId);
    if (!session?.ptyId) return;

    ipcRenderer.invoke('terminal:kill', { ptyId: session.ptyId });
  }, [sessions, activeSessionId]);

  // Resize a session
  const resizeSession = useCallback((sessionId: string, cols: number, rows: number) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session?.ptyId) return;

    ipcRenderer.invoke('terminal:resize', { ptyId: session.ptyId, cols, rows });
  }, [sessions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sessions.forEach(session => {
        if (session.ptyId) {
          ipcRenderer.invoke('terminal:kill', { ptyId: session.ptyId });
        }
      });

      // Remove all handlers
      dataHandlersRef.current.forEach((handler, id) => {
        ipcRenderer.removeListener('terminal:data', handler);
      });
      dataHandlersRef.current.clear();

      exitHandlersRef.current.forEach((handler, id) => {
        ipcRenderer.removeListener('terminal:exit', handler);
      });
      exitHandlersRef.current.clear();
    };
  }, []);

  // Auto-create first session when folderPath becomes available
  useEffect(() => {
    if (folderPath && sessions.length === 0) {
      createSession();
    }
  }, [folderPath, sessions.length, createSession]);

  return {
    sessions,
    activeSessionId,
    createSession,
    closeSession,
    activateSession,
    renameSession,
    sendText,
    sendData,
    clearSession,
    killProcess,
    getActiveSession,
    getSessionById,
    shell: shellRef.current
  };
};

export default useTerminal;

// Additional utility hook for terminal input handling
export const useTerminalInput = () => {
  const [history, setHistory] = useState<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const currentInputRef = useRef<string>('');

  const addToHistory = useCallback((command: string) => {
    if (command.trim()) {
      setHistory(prev => {
        // Remove duplicates and add to end
        const filtered = prev.filter(c => c !== command);
        return [...filtered, command].slice(-1000); // Keep last 1000 commands
      });
    }
    historyIndexRef.current = -1;
    currentInputRef.current = '';
  }, []);

  const getPreviousCommand = useCallback((): string | null => {
    if (history.length === 0) return null;
    
    historyIndexRef.current = Math.min(
      historyIndexRef.current + 1,
      history.length - 1
    );
    
    return history[history.length - 1 - historyIndexRef.current] || null;
  }, [history]);

  const getNextCommand = useCallback((): string | null => {
    if (historyIndexRef.current <= 0) {
      historyIndexRef.current = -1;
      return currentInputRef.current || null;
    }
    
    historyIndexRef.current--;
    return history[history.length - 1 - historyIndexRef.current] || null;
  }, [history]);

  const setCurrentInput = useCallback((input: string) => {
    currentInputRef.current = input;
  }, []);

  return {
    history,
    addToHistory,
    getPreviousCommand,
    getNextCommand,
    setCurrentInput
  };
};

// Hook for terminal theming
export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export const defaultDarkTheme: TerminalTheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  selectionBackground: '#264f78',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5'
};

export const useTerminalTheme = (customTheme?: Partial<TerminalTheme>) => {
  const theme = {
    ...defaultDarkTheme,
    ...customTheme
  };

  return theme;
};

// Utility functions for terminal operations
export const terminalUtils = {
  // Escape special characters for terminal
  escapeForTerminal: (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  },

  // Convert file path with line number to clickable format
  formatFileLink: (filePath: string, line?: number, column?: number): string => {
    if (line !== undefined) {
      const col = column !== undefined ? `:${column}` : '';
      return `${filePath}:${line}${col}`;
    }
    return filePath;
  },

  // Parse clickable file link
  parseFileLink: (link: string): { filePath: string; line?: number; column?: number } | null => {
    const match = link.match(/^(.+):(\d+)(?::(\d+))?$/);
    if (match) {
      return {
        filePath: match[1],
        line: parseInt(match[2], 10),
        column: match[3] ? parseInt(match[3], 10) : undefined
      };
    }
    return null;
  },

  // Common terminal commands
  commands: {
    clear: '\x1b[2J\x1b[H',
    bell: '\x07',
    carriageReturn: '\r',
    newLine: '\n',
    tab: '\t',
    backspace: '\x7f',
    escape: '\x1b',
    interrupt: '\x03', // Ctrl+C
    eof: '\x04', // Ctrl+D
    suspend: '\x1a', // Ctrl+Z
  }
};
