/**
 * Cargo Panel Component
 * Displays Cargo.toml dependencies and project structure
 */

import React, { useState, useEffect, useCallback } from 'react';
import './CargoPanel.css';
import {
  CargoToml,
  CargoDependency,
} from '../types';
import {
  getProjectInfo,
  getDependencies,
  updateDependencies,
  build,
  runCargo,
} from '../renderer-api';

interface CargoPanelProps {
  workspaceRoot: string;
}

interface DependencyItem {
  name: string;
  version: string;
  isDev: boolean;
  details?: CargoDependency;
}

export const CargoPanel: React.FC<CargoPanelProps> = ({ workspaceRoot }) => {
  const [cargoToml, setCargoToml] = useState<CargoToml | null>(null);
  const [dependencies, setDependencies] = useState<DependencyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [expandedDeps, setExpandedDeps] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'dependencies' | 'features' | 'metadata'>('dependencies');
  const [searchQuery, setSearchQuery] = useState('');

  const loadProjectData = useCallback(async () => {
    if (!workspaceRoot) return;
    
    setIsLoading(true);
    try {
      const [projectInfo, deps] = await Promise.all([
        getProjectInfo(workspaceRoot),
        getDependencies(workspaceRoot),
      ]);
      
      setCargoToml(projectInfo.cargoToml);
      setDependencies(deps.map(d => ({
        ...d,
        details: projectInfo.cargoToml?.dependencies?.[d.name] || 
                 projectInfo.cargoToml?.['dev-dependencies']?.[d.name],
      })));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceRoot]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  const handleUpdate = useCallback(async () => {
    if (!workspaceRoot || isUpdating) return;
    
    setIsUpdating(true);
    try {
      await updateDependencies(workspaceRoot);
      await loadProjectData();
    } finally {
      setIsUpdating(false);
    }
  }, [workspaceRoot, isUpdating, loadProjectData]);

  const handleBuild = useCallback(async () => {
    if (!workspaceRoot) return;
    await build(workspaceRoot);
  }, [workspaceRoot]);

  const handleDoc = useCallback(async () => {
    if (!workspaceRoot) return;
    await runCargo(workspaceRoot, 'doc', {});
  }, [workspaceRoot]);

  const toggleDep = useCallback((name: string) => {
    setExpandedDeps(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const filteredDeps = dependencies.filter(dep =>
    dep.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const regularDeps = filteredDeps.filter(d => !d.isDev);
  const devDeps = filteredDeps.filter(d => d.isDev);

  const renderDependencyDetails = (dep: DependencyItem) => {
    if (typeof dep.details === 'string') {
      return <span className="cargo-panel__dep-version">{dep.details}</span>;
    }
    
    if (!dep.details) return null;

    return (
      <div className="cargo-panel__dep-details">
        {dep.details.version && (
          <div className="cargo-panel__dep-detail">
            <span className="cargo-panel__dep-label">version:</span>
            <span>{dep.details.version}</span>
          </div>
        )}
        {dep.details.git && (
          <div className="cargo-panel__dep-detail">
            <span className="cargo-panel__dep-label">git:</span>
            <span className="cargo-panel__dep-link">{dep.details.git}</span>
          </div>
        )}
        {dep.details.path && (
          <div className="cargo-panel__dep-detail">
            <span className="cargo-panel__dep-label">path:</span>
            <span>{dep.details.path}</span>
          </div>
        )}
        {dep.details.features && dep.details.features.length > 0 && (
          <div className="cargo-panel__dep-detail">
            <span className="cargo-panel__dep-label">features:</span>
            <span className="cargo-panel__dep-features">
              {dep.details.features.map(f => (
                <span key={f} className="cargo-panel__feature-tag">{f}</span>
              ))}
            </span>
          </div>
        )}
        {dep.details.optional && (
          <div className="cargo-panel__dep-detail">
            <span className="cargo-panel__dep-optional">optional</span>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="cargo-panel cargo-panel--loading">
        <div className="cargo-panel__spinner" />
        <span>Loading Cargo.toml...</span>
      </div>
    );
  }

  if (!cargoToml) {
    return (
      <div className="cargo-panel cargo-panel--empty">
        <div className="cargo-panel__icon">📦</div>
        <div className="cargo-panel__message">No Cargo.toml found</div>
        <div className="cargo-panel__submessage">
          Open a Rust project to view dependencies
        </div>
      </div>
    );
  }

  return (
    <div className="cargo-panel">
      <div className="cargo-panel__header">
        <div className="cargo-panel__title">
          <span className="cargo-panel__icon">📦</span>
          <span>Cargo</span>
          {cargoToml.package && (
            <span className="cargo-panel__package-name">
              {cargoToml.package.name}
            </span>
          )}
        </div>
        
        <div className="cargo-panel__actions">
          <button
            className="cargo-panel__btn"
            onClick={handleBuild}
            title="Build"
          >
            🔨
          </button>
          <button
            className="cargo-panel__btn"
            onClick={handleDoc}
            title="Documentation"
          >
            📖
          </button>
          <button
            className={`cargo-panel__btn ${isUpdating ? 'cargo-panel__btn--loading' : ''}`}
            onClick={handleUpdate}
            disabled={isUpdating}
            title="Update Dependencies"
          >
            {isUpdating ? '⏳' : '📥'}
          </button>
          <button
            className="cargo-panel__btn"
            onClick={loadProjectData}
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>

      {cargoToml.package && (
        <div className="cargo-panel__metadata">
          <span className="cargo-panel__version">v{cargoToml.package.version}</span>
          {cargoToml.package.edition && (
            <span className="cargo-panel__edition">Edition {cargoToml.package.edition}</span>
          )}
        </div>
      )}

      <div className="cargo-panel__tabs">
        <button
          className={`cargo-panel__tab ${activeTab === 'dependencies' ? 'cargo-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('dependencies')}
        >
          Dependencies
          {dependencies.length > 0 && (
            <span className="cargo-panel__tab-count">{dependencies.length}</span>
          )}
        </button>
        <button
          className={`cargo-panel__tab ${activeTab === 'features' ? 'cargo-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('features')}
        >
          Features
          {cargoToml?.features && Object.keys(cargoToml.features).length > 0 && (
            <span className="cargo-panel__tab-count">
              {Object.keys(cargoToml.features).length}
            </span>
          )}
        </button>
        <button
          className={`cargo-panel__tab ${activeTab === 'metadata' ? 'cargo-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('metadata')}
        >
          Metadata
        </button>
      </div>

      {activeTab === 'dependencies' && (
        <>
          <div className="cargo-panel__search">
            <input
              type="text"
              placeholder="Search dependencies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="cargo-panel__search-input"
            />
          </div>

          <div className="cargo-panel__content">
            {regularDeps.length > 0 && (
              <div className="cargo-panel__section">
                <h4 className="cargo-panel__section-title">
                  Dependencies ({regularDeps.length})
                </h4>
                <ul className="cargo-panel__dep-list">
                  {regularDeps.map(dep => (
                    <li
                      key={dep.name}
                      className={`cargo-panel__dep-item ${expandedDeps.has(dep.name) ? 'cargo-panel__dep-item--expanded' : ''}`}
                    >
                      <div
                        className="cargo-panel__dep-header"
                        onClick={() => toggleDep(dep.name)}
                      >
                        <span className="cargo-panel__dep-arrow">▶</span>
                        <span className="cargo-panel__dep-name">{dep.name}</span>
                        <span className="cargo-panel__dep-version-badge">{dep.version}</span>
                      </div>
                      {expandedDeps.has(dep.name) && renderDependencyDetails(dep)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {devDeps.length > 0 && (
              <div className="cargo-panel__section">
                <h4 className="cargo-panel__section-title">
                  Dev Dependencies ({devDeps.length})
                </h4>
                <ul className="cargo-panel__dep-list">
                  {devDeps.map(dep => (
                    <li
                      key={dep.name}
                      className={`cargo-panel__dep-item ${expandedDeps.has(dep.name) ? 'cargo-panel__dep-item--expanded' : ''}`}
                    >
                      <div
                        className="cargo-panel__dep-header"
                        onClick={() => toggleDep(dep.name)}
                      >
                        <span className="cargo-panel__dep-arrow">▶</span>
                        <span className="cargo-panel__dep-name">{dep.name}</span>
                        <span className="cargo-panel__dep-version-badge cargo-panel__dep-version-badge--dev">
                          {dep.version}
                        </span>
                      </div>
                      {expandedDeps.has(dep.name) && renderDependencyDetails(dep)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {filteredDeps.length === 0 && searchQuery && (
              <div className="cargo-panel__empty">
                No dependencies match "{searchQuery}"
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'features' && (
        <div className="cargo-panel__content">
          {cargoToml.features && Object.keys(cargoToml.features).length > 0 ? (
            <ul className="cargo-panel__feature-list">
              {Object.entries(cargoToml.features).map(([name, features]) => (
                <li key={name} className="cargo-panel__feature-item">
                  <span className="cargo-panel__feature-name">{name}</span>
                  <div className="cargo-panel__feature-deps">
                    {features.map(f => (
                      <span key={f} className="cargo-panel__feature-dep">{f}</span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="cargo-panel__empty">No features defined</div>
          )}
        </div>
      )}

      {activeTab === 'metadata' && cargoToml.package && (
        <div className="cargo-panel__content">
          <div className="cargo-panel__metadata-list">
            <div className="cargo-panel__metadata-item">
              <span className="cargo-panel__metadata-label">Name</span>
              <span className="cargo-panel__metadata-value">{cargoToml.package.name}</span>
            </div>
            <div className="cargo-panel__metadata-item">
              <span className="cargo-panel__metadata-label">Version</span>
              <span className="cargo-panel__metadata-value">{cargoToml.package.version}</span>
            </div>
            {cargoToml.package.edition && (
              <div className="cargo-panel__metadata-item">
                <span className="cargo-panel__metadata-label">Edition</span>
                <span className="cargo-panel__metadata-value">{cargoToml.package.edition}</span>
              </div>
            )}
            {cargoToml.package.authors && cargoToml.package.authors.length > 0 && (
              <div className="cargo-panel__metadata-item">
                <span className="cargo-panel__metadata-label">Authors</span>
                <span className="cargo-panel__metadata-value">
                  {cargoToml.package.authors.join(', ')}
                </span>
              </div>
            )}
            {cargoToml.package.description && (
              <div className="cargo-panel__metadata-item">
                <span className="cargo-panel__metadata-label">Description</span>
                <span className="cargo-panel__metadata-value">
                  {cargoToml.package.description}
                </span>
              </div>
            )}
            {cargoToml.package.license && (
              <div className="cargo-panel__metadata-item">
                <span className="cargo-panel__metadata-label">License</span>
                <span className="cargo-panel__metadata-value">{cargoToml.package.license}</span>
              </div>
            )}
            {cargoToml.package.repository && (
              <div className="cargo-panel__metadata-item">
                <span className="cargo-panel__metadata-label">Repository</span>
                <a 
                  href={cargoToml.package.repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cargo-panel__metadata-link"
                >
                  {cargoToml.package.repository}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CargoPanel;
