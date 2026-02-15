/**
 * Task Status Bar Component
 * Quick access to common tasks in the status bar
 */

import React, { useState, useCallback } from 'react';
import './TaskStatusBar.css';
import {
  TaskDefinition,
  TaskGroup,
} from '../types';

interface TaskStatusBarProps {
  tasks: TaskDefinition[];
  runningTasks: Set<string>;
  onRunTask: (taskId: string) => void;
  onStopTask: (taskId: string) => void;
  onOpenTasksPanel: () => void;
  recentTasks?: string[];
}

export const TaskStatusBar: React.FC<TaskStatusBarProps> = ({
  tasks,
  runningTasks,
  onRunTask,
  onStopTask,
  onOpenTasksPanel,
  recentTasks = [],
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showBuildMenu, setShowBuildMenu] = useState(false);
  const [showTestMenu, setShowTestMenu] = useState(false);
  const [showRunMenu, setShowRunMenu] = useState(false);

  const buildTasks = tasks.filter(t => t.group === 'build');
  const testTasks = tasks.filter(t => t.group === 'test');
  const runTasks = tasks.filter(t => t.group === 'run');

  const defaultBuildTask = buildTasks.find(t => t.isDefault) || buildTasks[0];
  const defaultTestTask = testTasks.find(t => t.isDefault) || testTasks[0];
  const defaultRunTask = runTasks.find(t => t.isDefault) || runTasks[0];

  const hasRunningTasks = runningTasks.size > 0;
  const runningCount = runningTasks.size;

  const runBuild = useCallback(() => {
    if (defaultBuildTask) {
      onRunTask(defaultBuildTask.id);
    }
  }, [defaultBuildTask, onRunTask]);

  const runTest = useCallback(() => {
    if (defaultTestTask) {
      onRunTask(defaultTestTask.id);
    }
  }, [defaultTestTask, onRunTask]);

  const runRun = useCallback(() => {
    if (defaultRunTask) {
      onRunTask(defaultRunTask.id);
    }
  }, [defaultRunTask, onRunTask]);

  const stopAll = useCallback(() => {
    for (const taskId of runningTasks) {
      onStopTask(taskId);
    }
  }, [runningTasks, onStopTask]);

  const getTaskGroupIcon = (group?: TaskGroup): string => {
    switch (group) {
      case 'build': return '🔨';
      case 'test': return '🧪';
      case 'run': return '▶️';
      default: return '📋';
    }
  };

  return (
    <div className="task-status-bar">
      {/* Build Button */}
      {buildTasks.length > 0 && (
        <div className="task-status-bar__group">
          <button
            className="task-status-bar__btn"
            onClick={runBuild}
            title={defaultBuildTask?.label || 'Build'}
          >
            <span className="task-status-bar__icon">🔨</span>
            <span className="task-status-bar__label">Build</span>
          </button>
          
          {buildTasks.length > 1 && (
            <button
              className="task-status-bar__dropdown-btn"
              onClick={() => setShowBuildMenu(!showBuildMenu)}
              onBlur={() => setTimeout(() => setShowBuildMenu(false), 200)}
            >
              ▼
            </button>
          )}

          {showBuildMenu && buildTasks.length > 1 && (
            <div className="task-status-bar__menu">
              {buildTasks.map(task => (
                <button
                  key={task.id}
                  className="task-status-bar__menu-item"
                  onClick={() => {
                    onRunTask(task.id);
                    setShowBuildMenu(false);
                  }}
                >
                  <span className="task-status-bar__menu-icon">
                    {runningTasks.has(task.id) ? '⏳' : getTaskGroupIcon(task.group)}
                  </span>
                  <span className="task-status-bar__menu-label">{task.label}</span>
                  {task.isDefault && <span className="task-status-bar__menu-badge">★</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Test Button */}
      {testTasks.length > 0 && (
        <div className="task-status-bar__group">
          <button
            className="task-status-bar__btn"
            onClick={runTest}
            title={defaultTestTask?.label || 'Test'}
          >
            <span className="task-status-bar__icon">🧪</span>
            <span className="task-status-bar__label">Test</span>
          </button>

          {testTasks.length > 1 && (
            <button
              className="task-status-bar__dropdown-btn"
              onClick={() => setShowTestMenu(!showTestMenu)}
              onBlur={() => setTimeout(() => setShowTestMenu(false), 200)}
            >
              ▼
            </button>
          )}

          {showTestMenu && testTasks.length > 1 && (
            <div className="task-status-bar__menu">
              {testTasks.map(task => (
                <button
                  key={task.id}
                  className="task-status-bar__menu-item"
                  onClick={() => {
                    onRunTask(task.id);
                    setShowTestMenu(false);
                  }}
                >
                  <span className="task-status-bar__menu-icon">
                    {runningTasks.has(task.id) ? '⏳' : getTaskGroupIcon(task.group)}
                  </span>
                  <span className="task-status-bar__menu-label">{task.label}</span>
                  {task.isDefault && <span className="task-status-bar__menu-badge">★</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Run Button */}
      {runTasks.length > 0 && (
        <div className="task-status-bar__group">
          <button
            className="task-status-bar__btn"
            onClick={runRun}
            title={defaultRunTask?.label || 'Run'}
          >
            <span className="task-status-bar__icon">▶️</span>
            <span className="task-status-bar__label">Run</span>
          </button>

          {runTasks.length > 1 && (
            <button
              className="task-status-bar__dropdown-btn"
              onClick={() => setShowRunMenu(!showRunMenu)}
              onBlur={() => setTimeout(() => setShowRunMenu(false), 200)}
            >
              ▼
            </button>
          )}

          {showRunMenu && runTasks.length > 1 && (
            <div className="task-status-bar__menu">
              {runTasks.map(task => (
                <button
                  key={task.id}
                  className="task-status-bar__menu-item"
                  onClick={() => {
                    onRunTask(task.id);
                    setShowRunMenu(false);
                  }}
                >
                  <span className="task-status-bar__menu-icon">
                    {runningTasks.has(task.id) ? '⏳' : getTaskGroupIcon(task.group)}
                  </span>
                  <span className="task-status-bar__menu-label">{task.label}</span>
                  {task.isDefault && <span className="task-status-bar__menu-badge">★</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Running Tasks Indicator */}
      {hasRunningTasks && (
        <div className="task-status-bar__group">
          <button
            className="task-status-bar__btn running"
            onClick={() => setShowMenu(!showMenu)}
          >
            <span className="task-status-bar__spinner" />
            <span className="task-status-bar__label">{runningCount} Running</span>
          </button>
          
          <button
            className="task-status-bar__btn stop"
            onClick={stopAll}
            title="Stop All"
          >
            ⏹️
          </button>

          {showMenu && (
            <div className="task-status-bar__menu">
              <div className="task-status-bar__menu-header">Running Tasks</div>
              {Array.from(runningTasks).map(taskId => {
                const task = tasks.find(t => t.id === taskId);
                return (
                  <div key={taskId} className="task-status-bar__menu-item">
                    <span className="task-status-bar__menu-icon">⏳</span>
                    <span className="task-status-bar__menu-label">
                      {task?.label || taskId}
                    </span>
                    <button
                      className="task-status-bar__menu-action"
                      onClick={() => onStopTask(taskId)}
                    >
                      ⏹️
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* More Tasks Button */}
      <button
        className="task-status-bar__btn"
        onClick={onOpenTasksPanel}
        title="Open Tasks Panel"
      >
        <span className="task-status-bar__icon">📋</span>
        <span className="task-status-bar__label">Tasks</span>
      </button>

      {/* Recent Tasks (if available) */}
      {recentTasks.length > 0 && (
        <div className="task-status-bar__separator" />
      )}

      {recentTasks.slice(0, 3).map(taskId => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return null;
        
        return (
          <button
            key={taskId}
            className="task-status-bar__btn recent"
            onClick={() => onRunTask(taskId)}
            title={`Recent: ${task.label}`}
          >
            <span className="task-status-bar__icon">{getTaskGroupIcon(task.group)}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TaskStatusBar;
