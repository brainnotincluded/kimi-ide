/**
 * Go Modules Panel Component
 * 
 * Displays go.mod dependencies tree and versions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { GoLanguageProvider } from '../provider';
import { GoModule, GoRequire, GoReplace } from '../types';

interface GoModulesPanelProps {
  provider: GoLanguageProvider;
  onModTidy?: () => void;
  onModDownload?: () => void;
}

interface TreeNode {
  id: string;
  name: string;
  version: string;
  indirect: boolean;
  expanded: boolean;
  children: TreeNode[];
  isReplaced: boolean;
  replacement?: string;
}

export const GoModulesPanel: React.FC<GoModulesPanelProps> = ({
  provider,
  onModTidy,
  onModDownload
}) => {
  const [module, setModule] = useState<GoModule | null>(null);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showIndirect, setShowIndirect] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const loadModules = useCallback(async () => {
    setLoading(true);
    try {
      const modInfo = await provider.getModulesInfo();
      setModule(modInfo);
      
      if (modInfo) {
        const tree = buildModuleTree(modInfo);
        setTreeData(tree);
      }
    } catch (error) {
      console.error('Failed to load modules:', error);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    loadModules();
    
    // Listen for module changes
    provider.on('modTidyComplete', loadModules);
    
    return () => {
      provider.removeListener('modTidyComplete', loadModules);
    };
  }, [loadModules, provider]);

  const buildModuleTree = (mod: GoModule): TreeNode[] => {
    const replaceMap = new Map<string, GoReplace>();
    mod.replace.forEach(r => replaceMap.set(r.old, r));

    // Group by path prefix for tree structure
    const groups = new Map<string, GoRequire[]>();
    
    mod.require.forEach(req => {
      if (!showIndirect && req.indirect) return;
      
      const parts = req.path.split('/');
      const topLevel = parts.slice(0, 2).join('/');
      
      if (!groups.has(topLevel)) {
        groups.set(topLevel, []);
      }
      groups.get(topLevel)!.push(req);
    });

    return Array.from(groups.entries()).map(([prefix, reqs]) => ({
      id: prefix,
      name: prefix,
      version: '',
      indirect: false,
      expanded: false,
      isReplaced: false,
      children: reqs.map(req => {
        const replace = replaceMap.get(req.path);
        return {
          id: req.path,
          name: req.path,
          version: req.version,
          indirect: req.indirect,
          expanded: false,
          children: [],
          isReplaced: !!replace,
          replacement: replace ? `${replace.new}${replace.newVersion ? '@' + replace.newVersion : ''}` : undefined
        };
      })
    }));
  };

  const toggleNode = (nodeId: string) => {
    setTreeData(prev => toggleNodeInTree(prev, nodeId));
  };

  const toggleNodeInTree = (nodes: TreeNode[], nodeId: string): TreeNode[] => {
    return nodes.map(node => {
      if (node.id === nodeId) {
        return { ...node, expanded: !node.expanded };
      }
      if (node.children.length > 0) {
        return { ...node, children: toggleNodeInTree(node.children, nodeId) };
      }
      return node;
    });
  };

  const filterNodes = (nodes: TreeNode[], term: string): TreeNode[] => {
    if (!term) return nodes;
    
    return nodes.map(node => {
      const matches = node.name.toLowerCase().includes(term.toLowerCase()) ||
                     node.version.toLowerCase().includes(term.toLowerCase());
      
      const filteredChildren = filterNodes(node.children, term);
      
      if (matches || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren, expanded: true };
      }
      return null;
    }).filter(Boolean) as TreeNode[];
  };

  const handleModTidy = async () => {
    setLoading(true);
    try {
      await provider.goModTidy();
      onModTidy?.();
      await loadModules();
    } finally {
      setLoading(false);
    }
  };

  const handleModDownload = async () => {
    setLoading(true);
    try {
      await provider.goModDownload();
      onModDownload?.();
    } finally {
      setLoading(false);
    }
  };

  const handleGoGet = async (pkg: string) => {
    setLoading(true);
    try {
      await provider.runGo('get', [pkg]);
      await loadModules();
    } finally {
      setLoading(false);
    }
  };

  const filteredTree = filterNodes(treeData, searchTerm);

  const renderNode = (node: TreeNode, level: number = 0): JSX.Element => (
    <div key={node.id} style={{ marginLeft: level * 16 }}>
      <div
        style={{
          ...styles.node,
          ...(selectedNode === node.id ? styles.nodeSelected : {})
        }}
        onClick={() => {
          setSelectedNode(node.id);
          if (node.children.length > 0) {
            toggleNode(node.id);
          }
        }}
      >
        {node.children.length > 0 && (
          <span style={styles.expandIcon}>
            {node.expanded ? '▼' : '▶'}
          </span>
        )}
        
        <span style={styles.nodeName} title={node.name}>
          {node.name.split('/').pop() || node.name}
        </span>
        
        {node.version && (
          <span style={{
            ...styles.version,
            ...(node.isReplaced ? styles.versionReplaced : {})
          }}>
            {node.version}
          </span>
        )}
        
        {node.indirect && (
          <span style={styles.indirectBadge}>indirect</span>
        )}
        
        {node.isReplaced && (
          <span style={styles.replacedBadge} title={`→ ${node.replacement}`}>
            replaced
          </span>
        )}
      </div>
      
      {node.expanded && node.children.length > 0 && (
        <div style={styles.children}>
          {node.children.map(child => renderNode(child, level + 1))}
        </div>
      )}
    </div>
  );

  if (!module) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>Go Modules</h3>
        </div>
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>No go.mod file found</p>
          <button style={styles.button} onClick={loadModules}>
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Go Modules</h3>
        
        <div style={styles.toolbar}>
          <button
            style={styles.iconButton}
            onClick={loadModules}
            title="Refresh"
            disabled={loading}
          >
            🔄
          </button>
          <button
            style={styles.iconButton}
            onClick={handleModTidy}
            title="Go Mod Tidy"
            disabled={loading}
          >
            🧹
          </button>
          <button
            style={styles.iconButton}
            onClick={handleModDownload}
            title="Download Modules"
            disabled={loading}
          >
            ⬇
          </button>
        </div>
      </div>

      {/* Module Info */}
      <div style={styles.moduleInfo}>
        <div style={styles.moduleName} title={module.module}>
          {module.module}
        </div>
        <div style={styles.moduleVersion}>
          Go {module.goVersion || 'unknown'}
        </div>
      </div>

      {/* Stats */}
      <div style={styles.stats}>
        <span style={styles.stat}>
          {module.require.length} dependencies
        </span>
        <span style={styles.stat}>
          {module.require.filter(r => r.indirect).length} indirect
        </span>
        {module.replace.length > 0 && (
          <span style={styles.stat}>
            {module.replace.length} replaced
          </span>
        )}
      </div>

      {/* Search & Filter */}
      <div style={styles.filterBar}>
        <input
          type="text"
          style={styles.searchInput}
          placeholder="Search packages..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={showIndirect}
            onChange={(e) => {
              setShowIndirect(e.target.checked);
              loadModules();
            }}
          />
          <span style={styles.checkboxLabel}>Show indirect</span>
        </label>
      </div>

      {/* Dependencies Tree */}
      <div style={styles.treeContainer}>
        {loading ? (
          <div style={styles.loading}>Loading...</div>
        ) : filteredTree.length > 0 ? (
          <div style={styles.tree}>
            {filteredTree.map(node => renderNode(node))}
          </div>
        ) : (
          <div style={styles.noResults}>No matching packages</div>
        )}
      </div>

      {/* Add Dependency Input */}
      <div style={styles.addSection}>
        <input
          type="text"
          style={styles.addInput}
          placeholder="Add package (e.g., github.com/gin-gonic/gin)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleGoGet(e.currentTarget.value);
              e.currentTarget.value = '';
            }
          }}
        />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#252526',
    color: '#cccccc',
    fontSize: '13px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid #333'
  },
  title: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#bbbbbb'
  },
  toolbar: {
    display: 'flex',
    gap: '4px'
  },
  iconButton: {
    padding: '4px 6px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    borderRadius: '3px',
    fontSize: '12px',
    transition: 'background-color 0.2s'
  },
  moduleInfo: {
    padding: '10px 12px',
    borderBottom: '1px solid #333',
    backgroundColor: '#1e1e1e'
  },
  moduleName: {
    fontWeight: 'bold',
    fontSize: '13px',
    color: '#fff',
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  moduleVersion: {
    fontSize: '11px',
    color: '#888',
    fontFamily: 'monospace'
  },
  stats: {
    display: 'flex',
    gap: '12px',
    padding: '6px 12px',
    borderBottom: '1px solid #333',
    backgroundColor: '#1e1e1e',
    fontSize: '11px'
  },
  stat: {
    color: '#888'
  },
  filterBar: {
    padding: '8px 12px',
    borderBottom: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  searchInput: {
    padding: '6px 8px',
    border: '1px solid #454545',
    borderRadius: '3px',
    backgroundColor: '#3c3c3c',
    color: '#cccccc',
    fontSize: '12px',
    outline: 'none'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    cursor: 'pointer'
  },
  checkboxLabel: {
    color: '#bbbbbb'
  },
  treeContainer: {
    flex: 1,
    overflow: 'auto',
    padding: '8px 0'
  },
  tree: {
    padding: '0 8px'
  },
  node: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    minHeight: '22px'
  },
  nodeSelected: {
    backgroundColor: '#094771'
  },
  expandIcon: {
    fontSize: '10px',
    color: '#888',
    width: '12px',
    textAlign: 'center'
  },
  nodeName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  version: {
    fontSize: '10px',
    color: '#888',
    fontFamily: 'monospace',
    backgroundColor: '#333',
    padding: '1px 4px',
    borderRadius: '2px'
  },
  versionReplaced: {
    textDecoration: 'line-through',
    opacity: 0.6
  },
  indirectBadge: {
    fontSize: '9px',
    color: '#888',
    backgroundColor: '#333',
    padding: '1px 4px',
    borderRadius: '2px'
  },
  replacedBadge: {
    fontSize: '9px',
    color: '#ff9800',
    backgroundColor: '#333',
    padding: '1px 4px',
    borderRadius: '2px'
  },
  children: {
    marginTop: '2px'
  },
  loading: {
    padding: '20px',
    textAlign: 'center',
    color: '#888'
  },
  noResults: {
    padding: '20px',
    textAlign: 'center',
    color: '#888'
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    gap: '12px'
  },
  emptyText: {
    color: '#888',
    margin: 0
  },
  button: {
    padding: '6px 16px',
    border: 'none',
    borderRadius: '3px',
    backgroundColor: '#0e639c',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px'
  },
  addSection: {
    padding: '8px 12px',
    borderTop: '1px solid #333',
    backgroundColor: '#1e1e1e'
  },
  addInput: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #454545',
    borderRadius: '3px',
    backgroundColor: '#3c3c3c',
    color: '#cccccc',
    fontSize: '12px',
    outline: 'none',
    boxSizing: 'border-box'
  }
};

export default GoModulesPanel;
