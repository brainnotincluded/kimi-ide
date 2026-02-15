/**
 * Go Settings Panel Component
 * 
 * Configuration panel for Go language settings
 */

import React, { useState, useEffect } from 'react';
import { go } from '../renderer-ipc';
import { GoConfiguration, GoToolsStatus, GoInstallation } from '../types';
import { 
  LINT_TOOLS, 
  FORMAT_TOOLS, 
  TOOLS_MANAGEMENT, 
  RECOMMENDED_TOOLS,
  defaultGoConfig 
} from '../config';

export const GoSettingsPanel: React.FC = () => {
  const [config, setConfig] = useState<GoConfiguration>(defaultGoConfig);
  const [toolsStatus, setToolsStatus] = useState<GoToolsStatus | null>(null);
  const [installation, setInstallation] = useState<GoInstallation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfg, tools, install] = await Promise.all([
        go.getConfig(),
        go.getToolsStatus(),
        go.checkInstallation()
      ]);
      setConfig(cfg);
      setToolsStatus(tools);
      setInstallation(install);
    } catch (error) {
      showMessage('error', 'Failed to load Go settings');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await go.updateConfig(config);
      showMessage('success', 'Settings saved');
    } catch (error) {
      showMessage('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const installTool = async (tool: string) => {
    setInstalling(tool);
    try {
      const result = await go.installTools([tool]);
      if (result[tool]) {
        showMessage('success', `${tool} installed successfully`);
        await loadData();
      } else {
        showMessage('error', `Failed to install ${tool}`);
      }
    } catch (error) {
      showMessage('error', `Failed to install ${tool}`);
    } finally {
      setInstalling(null);
    }
  };

  const installAllTools = async () => {
    setInstalling('all');
    try {
      const results = await go.installTools(RECOMMENDED_TOOLS);
      const success = Object.values(results).filter(Boolean).length;
      const failed = Object.values(results).filter(v => !v).length;
      
      if (failed === 0) {
        showMessage('success', `All ${success} tools installed`);
      } else {
        showMessage('error', `${success} installed, ${failed} failed`);
      }
      
      await loadData();
    } catch (error) {
      showMessage('error', 'Failed to install tools');
    } finally {
      setInstalling(null);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading Go settings...</div>
      </div>
    );
  }

  const isGoInstalled = installation?.version !== 'not installed';

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>Go Settings</h2>

      {message && (
        <div style={{
          ...styles.message,
          ...(message.type === 'success' ? styles.messageSuccess : styles.messageError)
        }}>
          {message.text}
        </div>
      )}

      {/* Installation Status */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Installation</h3>
        
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Go Version:</span>
          <span style={{
            ...styles.infoValue,
            color: isGoInstalled ? '#4caf50' : '#f44336'
          }}>
            {installation?.version || 'Not found'}
          </span>
        </div>
        
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>GOROOT:</span>
          <span style={styles.infoValue}>{installation?.goroot || 'Not set'}</span>
        </div>
        
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>GOPATH:</span>
          <span style={styles.infoValue}>{installation?.gopath || 'Not set'}</span>
        </div>

        {!isGoInstalled && (
          <div style={styles.warning}>
            Go is not installed. Please install Go to use language features.
          </div>
        )}
      </section>

      {/* Paths Configuration */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Paths</h3>
        
        <div style={styles.field}>
          <label style={styles.label}>GOROOT (optional)</label>
          <input
            type="text"
            style={styles.input}
            value={config.goroot || ''}
            onChange={(e) => setConfig({ ...config, goroot: e.target.value })}
            placeholder="/usr/local/go"
          />
          <span style={styles.hint}>Path to Go SDK (auto-detected if empty)</span>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>GOPATH (optional)</label>
          <input
            type="text"
            style={styles.input}
            value={config.gopath || ''}
            onChange={(e) => setConfig({ ...config, gopath: e.target.value })}
            placeholder="~/go"
          />
          <span style={styles.hint}>Go workspace path (auto-detected if empty)</span>
        </div>
      </section>

      {/* Tools Configuration */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Tools</h3>
        
        <div style={styles.field}>
          <label style={styles.label}>Tools Management</label>
          <select
            style={styles.select}
            value={config.toolsManagement}
            onChange={(e) => setConfig({ ...config, toolsManagement: e.target.value as any })}
          >
            {TOOLS_MANAGEMENT.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} - {opt.description}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Lint Tool</label>
          <select
            style={styles.select}
            value={config.lintTool}
            onChange={(e) => setConfig({ ...config, lintTool: e.target.value as any })}
          >
            {LINT_TOOLS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} - {opt.description}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Format Tool</label>
          <select
            style={styles.select}
            value={config.formatTool}
            onChange={(e) => setConfig({ ...config, formatTool: e.target.value as any })}
          >
            {FORMAT_TOOLS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} - {opt.description}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={config.enableGopls}
              onChange={(e) => setConfig({ ...config, enableGopls: e.target.checked })}
            />
            <span>Enable gopls (Language Server)</span>
          </label>
        </div>
      </section>

      {/* Tools Status */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Tools Status</h3>
        
        <div style={styles.toolsGrid}>
          {toolsStatus && Object.entries(toolsStatus).map(([tool, installed]) => (
            <div key={tool} style={styles.toolRow}>
              <span style={styles.toolName}>{tool}</span>
              <div style={styles.toolActions}>
                {installed ? (
                  <span style={styles.installedBadge}>✓ Installed</span>
                ) : (
                  <>
                    <span style={styles.missingBadge}>Not installed</span>
                    <button
                      style={styles.installBtn}
                      onClick={() => installTool(tool)}
                      disabled={!!installing}
                    >
                      {installing === tool ? 'Installing...' : 'Install'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          style={styles.installAllBtn}
          onClick={installAllTools}
          disabled={installing === 'all'}
        >
          {installing === 'all' ? 'Installing...' : 'Install All Recommended Tools'}
        </button>
      </section>

      {/* Build/Test Flags */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Build & Test Flags</h3>
        
        <div style={styles.field}>
          <label style={styles.label}>Build Flags</label>
          <input
            type="text"
            style={styles.input}
            value={config.buildFlags?.join(' ') || ''}
            onChange={(e) => setConfig({ 
              ...config, 
              buildFlags: e.target.value.split(' ').filter(Boolean) 
            })}
            placeholder="-ldflags='-s -w'"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Test Flags</label>
          <input
            type="text"
            style={styles.input}
            value={config.testFlags?.join(' ') || ''}
            onChange={(e) => setConfig({ 
              ...config, 
              testFlags: e.target.value.split(' ').filter(Boolean) 
            })}
            placeholder="-v -race"
          />
        </div>
      </section>

      {/* Save Button */}
      <div style={styles.footer}>
        <button
          style={styles.saveBtn}
          onClick={saveConfig}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px',
    maxWidth: '700px',
    margin: '0 auto',
    color: '#cccccc',
    fontSize: '13px'
  },
  loading: {
    padding: '40px',
    textAlign: 'center',
    color: '#888'
  },
  header: {
    margin: '0 0 20px 0',
    fontSize: '20px',
    fontWeight: 'normal',
    color: '#fff'
  },
  message: {
    padding: '10px 16px',
    borderRadius: '4px',
    marginBottom: '16px',
    fontSize: '13px'
  },
  messageSuccess: {
    backgroundColor: '#1e4620',
    color: '#4caf50'
  },
  messageError: {
    backgroundColor: '#3c1414',
    color: '#f44336'
  },
  section: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#252526',
    borderRadius: '4px'
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#fff'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid #333'
  },
  infoLabel: {
    color: '#888'
  },
  infoValue: {
    fontFamily: 'monospace',
    fontSize: '12px'
  },
  warning: {
    marginTop: '12px',
    padding: '10px',
    backgroundColor: '#3c1414',
    borderLeft: '3px solid #f44336',
    color: '#f44336',
    fontSize: '12px'
  },
  field: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    color: '#bbbbbb'
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #454545',
    borderRadius: '3px',
    backgroundColor: '#3c3c3c',
    color: '#cccccc',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  select: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #454545',
    borderRadius: '3px',
    backgroundColor: '#3c3c3c',
    color: '#cccccc',
    fontSize: '13px',
    outline: 'none'
  },
  hint: {
    display: 'block',
    marginTop: '4px',
    fontSize: '11px',
    color: '#888'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer'
  },
  toolsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px'
  },
  toolRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#1e1e1e',
    borderRadius: '3px'
  },
  toolName: {
    fontFamily: 'monospace',
    fontSize: '13px'
  },
  toolActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  installedBadge: {
    color: '#4caf50',
    fontSize: '11px'
  },
  missingBadge: {
    color: '#888',
    fontSize: '11px'
  },
  installBtn: {
    padding: '4px 10px',
    border: 'none',
    borderRadius: '3px',
    backgroundColor: '#0e639c',
    color: '#fff',
    fontSize: '11px',
    cursor: 'pointer'
  },
  installAllBtn: {
    width: '100%',
    padding: '8px',
    border: 'none',
    borderRadius: '3px',
    backgroundColor: '#2d6a4f',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer'
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    paddingTop: '16px',
    borderTop: '1px solid #333'
  },
  saveBtn: {
    padding: '8px 24px',
    border: 'none',
    borderRadius: '3px',
    backgroundColor: '#0e639c',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer'
  }
};

export default GoSettingsPanel;
