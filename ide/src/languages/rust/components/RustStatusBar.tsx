/**
 * Rust Status Bar Component
 * Displays Rust version, toolchain info and quick action buttons
 */

import React, { useState, useEffect, useCallback } from 'react';
import './RustStatusBar.css';
import {
  RustToolchainInfo,
  RustInstallationCheck,
  CargoResult,
} from '../types';
import {
  checkRustInstallation,
  getToolchainInfo,
  build,
  test,
  run,
  checkCode,
  getProjectInfo,
} from '../renderer-api';

interface RustStatusBarProps {
  workspaceRoot: string;
}

export const RustStatusBar: React.FC<RustStatusBarProps> = ({ workspaceRoot }) => {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [toolchainInfo, setToolchainInfo] = useState<RustToolchainInfo | null>(null);
  const [isRustProject, setIsRustProject] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastResult, setLastResult] = useState<{ type: string; success: boolean } | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    checkInstallation();
    loadProjectInfo();
  }, [workspaceRoot]);

  const checkInstallation = async () => {
    const check = await checkRustInstallation();
    setInstalled(check.installed);
    
    if (check.installed) {
      const info = await getToolchainInfo();
      setToolchainInfo(info);
    }
  };

  const loadProjectInfo = async () => {
    if (!workspaceRoot) return;
    
    const info = await getProjectInfo(workspaceRoot);
    setIsRustProject(info.isRustProject);
    setProjectName(info.projectName);
  };

  const handleBuild = useCallback(async (release = false) => {
    if (!workspaceRoot || isBuilding) return;
    
    setIsBuilding(true);
    setLastResult(null);
    
    try {
      const result = await build(workspaceRoot, release);
      setLastResult({ type: release ? 'build-release' : 'build', success: result.success });
    } finally {
      setIsBuilding(false);
    }
  }, [workspaceRoot, isBuilding]);

  const handleTest = useCallback(async () => {
    if (!workspaceRoot || isTesting) return;
    
    setIsTesting(true);
    setLastResult(null);
    
    try {
      const result = await test(workspaceRoot);
      setLastResult({ type: 'test', success: result.success });
    } finally {
      setIsTesting(false);
    }
  }, [workspaceRoot, isTesting]);

  const handleRun = useCallback(async () => {
    if (!workspaceRoot || isRunning) return;
    
    setIsRunning(true);
    setLastResult(null);
    
    try {
      const result = await run(workspaceRoot);
      setLastResult({ type: 'run', success: result.success });
    } finally {
      setIsRunning(false);
    }
  }, [workspaceRoot, isRunning]);

  const handleCheck = useCallback(async () => {
    if (!workspaceRoot || isChecking) return;
    
    setIsChecking(true);
    setLastResult(null);
    
    try {
      const diagnostics = await checkCode(workspaceRoot);
      const hasErrors = diagnostics.some(d => d.severity === 'error');
      setLastResult({ type: 'check', success: !hasErrors });
    } finally {
      setIsChecking(false);
    }
  }, [workspaceRoot, isChecking]);

  if (installed === null) {
    return (
      <div className="rust-status-bar rust-status-bar--loading">
        <span className="rust-status-bar__icon">🦀</span>
        <span className="rust-status-bar__text">Checking Rust...</span>
      </div>
    );
  }

  if (!installed) {
    return (
      <div className="rust-status-bar rust-status-bar--error">
        <span className="rust-status-bar__icon">🦀</span>
        <span className="rust-status-bar__text">Rust not installed</span>
        <button 
          className="rust-status-bar__action"
          onClick={() => window.open('https://rustup.rs/', '_blank')}
        >
          Install
        </button>
      </div>
    );
  }

  return (
    <div className="rust-status-bar">
      <div className="rust-status-bar__info" onClick={() => setShowDetails(!showDetails)}>
        <span className="rust-status-bar__icon">🦀</span>
        <span className="rust-status-bar__version">
          {toolchainInfo?.version || 'Rust'}
        </span>
        <span className="rust-status-bar__toolchain">
          {toolchainInfo?.toolchain}
        </span>
        {projectName && (
          <span className="rust-status-bar__project">{projectName}</span>
        )}
      </div>

      {isRustProject && (
        <div className="rust-status-bar__actions">
          <button
            className={`rust-status-bar__btn ${isBuilding ? 'rust-status-bar__btn--loading' : ''}`}
            onClick={() => handleBuild(false)}
            disabled={isBuilding}
            title="Cargo Build"
          >
            {isBuilding ? '⏳' : '🔨'} Build
          </button>
          
          <button
            className={`rust-status-bar__btn ${isChecking ? 'rust-status-bar__btn--loading' : ''}`}
            onClick={handleCheck}
            disabled={isChecking}
            title="Cargo Check"
          >
            {isChecking ? '⏳' : '✓'} Check
          </button>
          
          <button
            className={`rust-status-bar__btn ${isRunning ? 'rust-status-bar__btn--loading' : ''}`}
            onClick={handleRun}
            disabled={isRunning}
            title="Cargo Run"
          >
            {isRunning ? '⏳' : '▶'} Run
          </button>
          
          <button
            className={`rust-status-bar__btn ${isTesting ? 'rust-status-bar__btn--loading' : ''}`}
            onClick={handleTest}
            disabled={isTesting}
            title="Cargo Test"
          >
            {isTesting ? '⏳' : '🧪'} Test
          </button>
        </div>
      )}

      {lastResult && (
        <span 
          className={`rust-status-bar__result rust-status-bar__result--${
            lastResult.success ? 'success' : 'error'
          }`}
        >
          {lastResult.success ? '✓' : '✗'}
        </span>
      )}

      {showDetails && toolchainInfo && (
        <div className="rust-status-bar__tooltip">
          <div className="rust-status-bar__tooltip-row">
            <span>Version:</span>
            <span>{toolchainInfo.version}</span>
          </div>
          <div className="rust-status-bar__tooltip-row">
            <span>Toolchain:</span>
            <span>{toolchainInfo.toolchain}</span>
          </div>
          <div className="rust-status-bar__tooltip-row">
            <span>Target:</span>
            <span>{toolchainInfo.target}</span>
          </div>
          {toolchainInfo.commitHash && (
            <div className="rust-status-bar__tooltip-row">
              <span>Commit:</span>
              <span>{toolchainInfo.commitHash.slice(0, 8)}</span>
            </div>
          )}
          {projectName && (
            <div className="rust-status-bar__tooltip-row">
              <span>Project:</span>
              <span>{projectName}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RustStatusBar;
