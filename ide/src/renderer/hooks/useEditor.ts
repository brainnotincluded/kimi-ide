import { useState, useCallback, useRef } from 'react';

export interface EditorTab {
  id: string;
  path: string;
  name: string;
  content: string;
  isModified: boolean;
  isActive: boolean;
  language?: string;
}

export interface UseEditorReturn {
  tabs: EditorTab[];
  activeTabId: string | null;
  openFile: (path: string, name: string, content: string, language?: string) => void;
  closeTab: (tabId: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabContent: (tabId: string, content: string) => void;
  markTabSaved: (tabId: string) => void;
  saveActiveTab: () => Promise<boolean>;
  getActiveTab: () => EditorTab | null;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// Language detection based on file extension
const getLanguageFromPath = (path: string): string | undefined => {
  const ext = path.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    rs: 'rust',
    go: 'go',
    rb: 'ruby',
    php: 'php',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    ps1: 'powershell',
    dockerfile: 'dockerfile',
    vue: 'vue',
    svelte: 'svelte',
  };
  return ext ? languageMap[ext] : undefined;
};

// Generate unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export function useEditor(): UseEditorReturn {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  // History for undo/redo functionality
  const historyRef = useRef<Map<string, { past: string[]; future: string[] }>>(new Map());

  const getActiveTab = useCallback((): EditorTab | null => {
    return tabs.find((tab) => tab.id === activeTabId) || null;
  }, [tabs, activeTabId]);

  const openFile = useCallback((path: string, name: string, content: string, language?: string) => {
    // Check if file is already open
    const existingTab = tabs.find((tab) => tab.path === path);
    
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    const detectedLanguage = language || getLanguageFromPath(path);
    const newTab: EditorTab = {
      id: generateId(),
      path,
      name,
      content,
      isModified: false,
      isActive: true,
      language: detectedLanguage,
    };

    // Initialize history for this tab
    historyRef.current.set(newTab.id, { past: [], future: [] });

    setTabs((prev) => {
      // Deactivate all other tabs
      const updatedTabs = prev.map((tab) => ({ ...tab, isActive: false }));
      return [...updatedTabs, newTab];
    });
    setActiveTabId(newTab.id);
  }, [tabs]);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const tabIndex = prev.findIndex((tab) => tab.id === tabId);
      if (tabIndex === -1) return prev;

      const newTabs = prev.filter((tab) => tab.id !== tabId);
      
      // If closing active tab, activate another one
      if (activeTabId === tabId && newTabs.length > 0) {
        const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
        newTabs[newActiveIndex] = { ...newTabs[newActiveIndex], isActive: true };
        setActiveTabId(newTabs[newActiveIndex].id);
      }

      // Clean up history
      historyRef.current.delete(tabId);

      return newTabs;
    });

    if (tabs.length === 1) {
      setActiveTabId(null);
    }
  }, [activeTabId, tabs.length]);

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
    historyRef.current.clear();
  }, []);

  const closeOtherTabs = useCallback((tabId: string) => {
    setTabs((prev) => {
      const keepTab = prev.find((tab) => tab.id === tabId);
      if (!keepTab) return prev;
      
      // Clean up history for removed tabs
      prev.forEach((tab) => {
        if (tab.id !== tabId) {
          historyRef.current.delete(tab.id);
        }
      });

      return [{ ...keepTab, isActive: true }];
    });
    setActiveTabId(tabId);
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    setTabs((prev) =>
      prev.map((tab) => ({
        ...tab,
        isActive: tab.id === tabId,
      }))
    );
    setActiveTabId(tabId);
  }, []);

  const updateTabContent = useCallback((tabId: string, newContent: string) => {
    setTabs((prev) => {
      const tab = prev.find((t) => t.id === tabId);
      if (!tab || tab.content === newContent) return prev;

      // Update history
      const history = historyRef.current.get(tabId);
      if (history) {
        history.past.push(tab.content);
        history.future = [];
        setCanUndo(history.past.length > 0);
        setCanRedo(false);
      }

      return prev.map((t) =>
        t.id === tabId
          ? { ...t, content: newContent, isModified: t.content !== newContent }
          : t
      );
    });
  }, []);

  const markTabSaved = useCallback((tabId: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId ? { ...tab, isModified: false } : tab
      )
    );
  }, []);

  const saveActiveTab = useCallback(async (): Promise<boolean> => {
    const activeTab = getActiveTab();
    if (!activeTab || !activeTab.isModified) return false;

    // This would typically call workspace.writeFile
    // For now, just mark as saved
    markTabSaved(activeTab.id);
    return true;
  }, [getActiveTab, markTabSaved]);

  const undo = useCallback(() => {
    const activeTab = getActiveTab();
    if (!activeTab) return;

    const history = historyRef.current.get(activeTab.id);
    if (!history || history.past.length === 0) return;

    const previousContent = history.past.pop();
    if (previousContent !== undefined) {
      history.future.unshift(activeTab.content);
      
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTab.id
            ? { ...tab, content: previousContent, isModified: true }
            : tab
        )
      );
      
      setCanUndo(history.past.length > 0);
      setCanRedo(history.future.length > 0);
    }
  }, [getActiveTab]);

  const redo = useCallback(() => {
    const activeTab = getActiveTab();
    if (!activeTab) return;

    const history = historyRef.current.get(activeTab.id);
    if (!history || history.future.length === 0) return;

    const nextContent = history.future.shift();
    if (nextContent !== undefined) {
      history.past.push(activeTab.content);
      
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTab.id
            ? { ...tab, content: nextContent, isModified: true }
            : tab
        )
      );
      
      setCanUndo(history.past.length > 0);
      setCanRedo(history.future.length > 0);
    }
  }, [getActiveTab]);

  return {
    tabs,
    activeTabId,
    openFile,
    closeTab,
    closeAllTabs,
    closeOtherTabs,
    setActiveTab,
    updateTabContent,
    markTabSaved,
    saveActiveTab,
    getActiveTab,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}

export default useEditor;
