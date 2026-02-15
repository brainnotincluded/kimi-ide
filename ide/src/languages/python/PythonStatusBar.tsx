import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { PythonLanguageProvider, PythonEnvironment } from './PythonProvider';
import { PythonConfig, PythonVenvInfo, PythonPackage } from './PythonConfig';

interface PythonStatusBarProps {
  provider: PythonLanguageProvider;
  config: PythonConfig;
}

interface VenvMenuItem {
  label: string;
  description: string;
  venv: PythonVenvInfo;
  isActive: boolean;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  action: () => void;
}

export const PythonStatusBar: React.FC<PythonStatusBarProps> = ({ provider, config }) => {
  const [activeEnv, setActiveEnv] = useState<PythonEnvironment | null>(null);
  const [venvs, setVenvs] = useState<PythonVenvInfo[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [packages, setPackages] = useState<PythonPackage[]>([]);
  const [showPackageInstaller, setShowPackageInstaller] = useState(false);
  const [packageInput, setPackageInput] = useState('');

  // Обновление информации об активном окружении
  const updateActiveEnv = useCallback(() => {
    const env = provider.getActiveEnvironment();
    setActiveEnv(env);
    if (env) {
      provider.getInstalledPackages().then(setPackages);
    }
  }, [provider]);

  // Загрузка venv при монтировании
  useEffect(() => {
    updateActiveEnv();
    
    // Подписываемся на события
    provider.on('venvActivated', updateActiveEnv);
    provider.on('packagesInstalled', () => {
      provider.getInstalledPackages().then(setPackages);
    });

    return () => {
      provider.off('venvActivated', updateActiveEnv);
    };
  }, [provider, updateActiveEnv]);

  // Детект venv в проекте
  const detectVenvs = async () => {
    setIsLoading(true);
    try {
      const projectPath = await getProjectPath();
      const detected = await provider.detectVenv(projectPath);
      setVenvs(detected);
    } catch (error) {
      console.error('Failed to detect venvs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Выбор venv
  const selectVenv = async (venv: PythonVenvInfo) => {
    setIsLoading(true);
    try {
      await provider.activateVenv(venv.path);
      await config.setVenvPath(venv.path);
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Failed to activate venv:', error);
      alert(`Failed to activate venv: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Установка пакетов
  const installPackages = async () => {
    if (!packageInput.trim()) return;
    
    const packages = packageInput.split(/[,\s]+/).filter(p => p.trim());
    setIsLoading(true);
    try {
      await provider.installPackages(packages);
      setPackageInput('');
      setShowPackageInstaller(false);
      alert(`Successfully installed: ${packages.join(', ')}`);
    } catch (error) {
      console.error('Failed to install packages:', error);
      alert(`Failed to install packages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Быстрые действия
  const quickActions: QuickAction[] = [
    {
      id: 'install',
      label: 'Install Packages...',
      icon: '⬇️',
      action: () => {
        setShowPackageInstaller(true);
        setIsQuickActionsOpen(false);
      },
    },
    {
      id: 'refresh',
      label: 'Refresh Environments',
      icon: '🔄',
      action: () => {
        detectVenvs();
        setIsQuickActionsOpen(false);
      },
    },
    {
      id: 'terminal',
      label: 'Open Python Terminal',
      icon: '💻',
      action: () => {
        openPythonTerminal();
        setIsQuickActionsOpen(false);
      },
    },
    {
      id: 'repl',
      label: 'Open Python REPL',
      icon: '▶️',
      action: () => {
        openPythonREPL();
        setIsQuickActionsOpen(false);
      },
    },
    {
      id: 'settings',
      label: 'Python Settings',
      icon: '⚙️',
      action: () => {
        openSettings();
        setIsQuickActionsOpen(false);
      },
    },
  ];

  // Получение версии Python
  const getPythonVersion = () => {
    if (activeEnv?.version) {
      return activeEnv.version;
    }
    return 'Select Interpreter';
  };

  // Получение имени активного venv
  const getVenvName = () => {
    if (activeEnv?.venvPath) {
      const parts = activeEnv.venvPath.split(/[/\\]/);
      return parts[parts.length - 1];
    }
    return null;
  };

  // Получение иконки для типа venv
  const getVenvTypeIcon = (type: string) => {
    switch (type) {
      case 'poetry': return '📦';
      case 'pipenv': return '🐍';
      case 'conda': return '🅒';
      default: return '🔧';
    }
  };

  return (
    <div className="python-status-bar">
      {/* Основной индикатор */}
      <div className="python-status-bar__main">
        <button
          className={`python-status-bar__button ${activeEnv ? 'active' : 'inactive'}`}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          disabled={isLoading}
          title="Select Python Interpreter"
        >
          <span className="python-status-bar__icon">🐍</span>
          <span className="python-status-bar__version">
            {isLoading ? 'Loading...' : getPythonVersion()}
          </span>
          {activeEnv && (
            <span className="python-status-bar__venv-badge">
              {getVenvName()}
            </span>
          )}
          <span className="python-status-bar__chevron">▼</span>
        </button>

        {/* Кнопка быстрых действий */}
        <button
          className="python-status-bar__quick-actions-btn"
          onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
          title="Quick Actions"
        >
          ⚡
        </button>
      </div>

      {/* Меню выбора venv */}
      {isMenuOpen && (
        <div className="python-status-bar__menu">
          <div className="python-status-bar__menu-header">
            <span>Select Interpreter</span>
            <button
              className="python-status-bar__refresh-btn"
              onClick={detectVenvs}
              disabled={isLoading}
            >
              🔄
            </button>
          </div>

          {venvs.length === 0 ? (
            <div className="python-status-bar__menu-empty">
              <p>No virtual environments found</p>
              <button onClick={detectVenvs} disabled={isLoading}>
                {isLoading ? 'Scanning...' : 'Scan for Environments'}
              </button>
            </div>
          ) : (
            <ul className="python-status-bar__venv-list">
              {venvs.map((venv, index) => (
                <li
                  key={index}
                  className={`python-status-bar__venv-item ${
                    activeEnv?.venvPath === venv.path ? 'active' : ''
                  }`}
                  onClick={() => selectVenv(venv)}
                >
                  <span className="python-status-bar__venv-icon">
                    {getVenvTypeIcon(venv.type)}
                  </span>
                  <div className="python-status-bar__venv-info">
                    <span className="python-status-bar__venv-name">
                      {venv.path.split(/[/\\]/).pop()}
                    </span>
                    <span className="python-status-bar__venv-version">
                      Python {venv.version} • {venv.type}
                    </span>
                  </div>
                  {activeEnv?.venvPath === venv.path && (
                    <span className="python-status-bar__venv-check">✓</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="python-status-bar__menu-footer">
            <button onClick={openSystemInterpreter}>
              Browse System Interpreters...
            </button>
          </div>
        </div>
      )}

      {/* Меню быстрых действий */}
      {isQuickActionsOpen && (
        <div className="python-status-bar__quick-actions-menu">
          {quickActions.map((action) => (
            <button
              key={action.id}
              className="python-status-bar__quick-action-item"
              onClick={action.action}
            >
              <span className="python-status-bar__quick-action-icon">
                {action.icon}
              </span>
              <span className="python-status-bar__quick-action-label">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Диалог установки пакетов */}
      {showPackageInstaller && (
        <div className="python-status-bar__modal-overlay" onClick={() => setShowPackageInstaller(false)}>
          <div className="python-status-bar__modal" onClick={(e) => e.stopPropagation()}>
            <h3>Install Python Packages</h3>
            <div className="python-status-bar__modal-content">
              <input
                type="text"
                placeholder="Enter package names (comma or space separated)"
                value={packageInput}
                onChange={(e) => setPackageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && installPackages()}
                autoFocus
              />
              <div className="python-status-bar__modal-hint">
                Examples: requests, numpy pandas matplotlib
              </div>
            </div>
            <div className="python-status-bar__modal-actions">
              <button
                onClick={() => setShowPackageInstaller(false)}
                className="python-status-bar__btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={installPackages}
                disabled={isLoading || !packageInput.trim()}
                className="python-status-bar__btn-primary"
              >
                {isLoading ? 'Installing...' : 'Install'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Список установленных пакетов (мини) */}
      {activeEnv && packages.length > 0 && (
        <div className="python-status-bar__packages-tooltip">
          <div className="python-status-bar__packages-count">
            {packages.length} packages installed
          </div>
        </div>
      )}
    </div>
  );
};

// Вспомогательные функции

async function getProjectPath(): Promise<string> {
  // В VS Code получаем путь к workspace
  if (typeof vscode !== 'undefined') {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      return folders[0].uri.fsPath;
    }
  }
  return process.cwd();
}

function openPythonTerminal() {
  if (typeof vscode !== 'undefined') {
    const terminal = vscode.window.createTerminal('Python');
    terminal.show();
  }
}

function openPythonREPL() {
  if (typeof vscode !== 'undefined') {
    const terminal = vscode.window.createTerminal('Python REPL');
    terminal.sendText('python');
    terminal.show();
  }
}

function openSettings() {
  if (typeof vscode !== 'undefined') {
    vscode.commands.executeCommand('workbench.action.openSettings', 'python');
  }
}

function openSystemInterpreter() {
  if (typeof vscode !== 'undefined') {
    vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'Python': ['exe', ''],
      },
      title: 'Select Python Interpreter',
    }).then((uris) => {
      if (uris && uris.length > 0) {
        // Устанавливаем выбранный интерпретатор
        const config = vscode.workspace.getConfiguration('python');
        config.update('pythonPath', uris[0].fsPath, true);
      }
    });
  }
}

// CSS стили для компонента
export const pythonStatusBarStyles = `
.python-status-bar {
  display: inline-flex;
  align-items: center;
  position: relative;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
}

.python-status-bar__main {
  display: flex;
  align-items: center;
  gap: 4px;
}

.python-status-bar__button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.python-status-bar__button:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}

.python-status-bar__button.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.python-status-bar__icon {
  font-size: 14px;
}

.python-status-bar__version {
  font-weight: 500;
}

.python-status-bar__venv-badge {
  font-size: 10px;
  padding: 1px 4px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  border-radius: 3px;
  margin-left: 4px;
}

.python-status-bar__chevron {
  font-size: 10px;
  margin-left: 2px;
  opacity: 0.7;
}

.python-status-bar__quick-actions-btn {
  padding: 2px 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 4px;
  opacity: 0.7;
}

.python-status-bar__quick-actions-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
  opacity: 1;
}

.python-status-bar__menu,
.python-status-bar__quick-actions-menu {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 8px;
  min-width: 280px;
  background: var(--vscode-dropdown-background);
  border: 1px solid var(--vscode-dropdown-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.python-status-bar__menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vscode-dropdown-border);
  font-weight: 600;
  color: var(--vscode-foreground);
}

.python-status-bar__refresh-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
}

.python-status-bar__refresh-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.python-status-bar__venv-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  max-height: 300px;
  overflow-y: auto;
}

.python-status-bar__venv-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.python-status-bar__venv-item:hover {
  background: var(--vscode-list-hoverBackground);
}

.python-status-bar__venv-item.active {
  background: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-list-activeSelectionForeground);
}

.python-status-bar__venv-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.python-status-bar__venv-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.python-status-bar__venv-name {
  font-weight: 500;
}

.python-status-bar__venv-version {
  font-size: 11px;
  opacity: 0.7;
}

.python-status-bar__venv-check {
  color: var(--vscode-testing-iconPassed);
  font-weight: bold;
}

.python-status-bar__menu-empty {
  padding: 20px;
  text-align: center;
  color: var(--vscode-descriptionForeground);
}

.python-status-bar__menu-empty button {
  margin-top: 10px;
  padding: 6px 12px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.python-status-bar__menu-footer {
  padding: 8px 12px;
  border-top: 1px solid var(--vscode-dropdown-border);
}

.python-status-bar__menu-footer button {
  width: 100%;
  padding: 6px;
  background: transparent;
  border: 1px solid var(--vscode-button-border);
  color: var(--vscode-button-foreground);
  border-radius: 4px;
  cursor: pointer;
}

.python-status-bar__menu-footer button:hover {
  background: var(--vscode-button-hoverBackground);
}

.python-status-bar__quick-actions-menu {
  min-width: 200px;
}

.python-status-bar__quick-action-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: var(--vscode-foreground);
  cursor: pointer;
  text-align: left;
}

.python-status-bar__quick-action-item:hover {
  background: var(--vscode-list-hoverBackground);
}

.python-status-bar__quick-action-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
}

.python-status-bar__modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.python-status-bar__modal {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  padding: 20px;
  min-width: 400px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.python-status-bar__modal h3 {
  margin: 0 0 16px 0;
  color: var(--vscode-foreground);
}

.python-status-bar__modal-content input {
  width: 100%;
  padding: 8px 12px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  font-size: 14px;
}

.python-status-bar__modal-hint {
  margin-top: 8px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.python-status-bar__modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.python-status-bar__btn-secondary {
  padding: 6px 16px;
  background: transparent;
  border: 1px solid var(--vscode-button-border);
  color: var(--vscode-button-foreground);
  border-radius: 4px;
  cursor: pointer;
}

.python-status-bar__btn-primary {
  padding: 6px 16px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.python-status-bar__btn-primary:hover {
  background: var(--vscode-button-hoverBackground);
}

.python-status-bar__btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.python-status-bar__packages-tooltip {
  position: absolute;
  bottom: calc(100% + 4px);
  right: 0;
  padding: 4px 8px;
  background: var(--vscode-editorHoverWidget-background);
  border: 1px solid var(--vscode-editorHoverWidget-border);
  border-radius: 4px;
  font-size: 11px;
  color: var(--vscode-editorHoverWidget-foreground);
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.python-status-bar:hover .python-status-bar__packages-tooltip {
  opacity: 1;
}
`;
