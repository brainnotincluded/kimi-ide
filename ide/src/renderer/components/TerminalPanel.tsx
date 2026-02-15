import React, { useState, useCallback } from 'react';
import './TerminalPanel.css';
import { Terminal } from './Terminal';

interface TerminalTab {
  id: string;
  name: string;
}

interface TerminalPanelProps {
  workspace: string | null;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ workspace }) => {
  const [tabs, setTabs] = useState<TerminalTab[]>([{ id: 'term-1', name: 'Terminal' }]);
  const [activeTabId, setActiveTabId] = useState<string>('term-1');
  const [nextId, setNextId] = useState(2);

  const addTerminal = useCallback(() => {
    const newId = `term-${nextId}`;
    setTabs((prev) => [...prev, { id: newId, name: `Terminal ${nextId}` }]);
    setActiveTabId(newId);
    setNextId((n) => n + 1);
  }, [nextId]);

  const closeTerminal = useCallback((tabId: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId && newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      }
      return newTabs;
    });
  }, [activeTabId]);

  const renameTab = useCallback((tabId: string, newName: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, name: newName } : t))
    );
  }, []);

  return (
    <div className="terminal-panel">
      <div className="terminal-tabs">
        <div className="terminal-tabs-list">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`terminal-tab ${activeTabId === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="terminal-tab-name">{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  className="terminal-tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminal(tab.id);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <button className="terminal-add-btn" onClick={addTerminal} title="New Terminal">
          +
        </button>
      </div>
      <div className="terminal-content-area">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`terminal-tab-content ${activeTabId === tab.id ? 'active' : ''}`}
          >
            {activeTabId === tab.id && (
              <Terminal workspace={workspace} terminalId={tab.id} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
