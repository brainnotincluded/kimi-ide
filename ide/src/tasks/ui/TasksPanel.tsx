/**
 * Tasks Panel Component
 * Displays task list organized by groups
 */

import React, { useState, useCallback, useMemo } from 'react';
import './TasksPanel.css';
import {
  TaskDefinition,
  TaskStatus,
  TaskGroup,
  DetectedTask,
} from '../types';

interface TasksPanelProps {
  tasks: TaskDefinition[];
  detectedTasks: DetectedTask[];
  runningTasks: Set<string>;
  selectedTaskId?: string;
  onRunTask: (taskId: string) => void;
  onStopTask: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
  onImportTask: (detected: DetectedTask) => void;
  onRefresh?: () => void;
}

type ViewMode = 'defined' | 'detected' | 'all';
type GroupBy = 'group' | 'source' | 'none';

export const TasksPanel: React.FC<TasksPanelProps> = ({
  tasks,
  detectedTasks,
  runningTasks,
  selectedTaskId,
  onRunTask,
  onStopTask,
  onSelectTask,
  onImportTask,
  onRefresh,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('group');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['build', 'test', 'run']));

  const toggleGroup = useCallback((group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }, []);

  const filteredTasks = useMemo(() => {
    let result = tasks.filter(t => !t.hide);

    if (viewMode === 'detected') {
      return [];
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.label.toLowerCase().includes(query) ||
        t.command.toLowerCase().includes(query)
      );
    }

    return result;
  }, [tasks, viewMode, searchQuery]);

  const filteredDetected = useMemo(() => {
    if (viewMode === 'defined') return [];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return detectedTasks.filter(t =>
        t.label.toLowerCase().includes(query) ||
        t.command.toLowerCase().includes(query)
      );
    }

    return detectedTasks;
  }, [detectedTasks, viewMode, searchQuery]);

  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Tasks': filteredTasks };
    }

    if (groupBy === 'source') {
      const groups: Record<string, TaskDefinition[]> = {};
      for (const task of filteredTasks) {
        const source = task.id.startsWith('auto-') ? 'Auto-detected' : 'User Defined';
        groups[source] = groups[source] || [];
        groups[source].push(task);
      }
      return groups;
    }

    // Group by task group
    const groupOrder: TaskGroup[] = ['build', 'test', 'run', 'none'];
    const groupNames: Record<TaskGroup, string> = {
      build: 'Build',
      test: 'Test',
      run: 'Run',
      none: 'Other',
    };

    const groups: Record<string, TaskDefinition[]> = {};
    
    for (const group of groupOrder) {
      const groupTasks = filteredTasks.filter(t => t.group === group);
      if (groupTasks.length > 0) {
        groups[groupNames[group]] = groupTasks;
      }
    }

    return groups;
  }, [filteredTasks, groupBy]);

  const groupedDetected = useMemo(() => {
    const groups: Record<string, DetectedTask[]> = {};
    
    for (const task of filteredDetected) {
      const source = task.source.charAt(0).toUpperCase() + task.source.slice(1);
      groups[source] = groups[source] || [];
      groups[source].push(task);
    }

    return groups;
  }, [filteredDetected]);

  const getTaskIcon = (group?: TaskGroup): string => {
    switch (group) {
      case 'build': return '🔨';
      case 'test': return '🧪';
      case 'run': return '▶️';
      default: return '📋';
    }
  };

  const getStatusIcon = (taskId: string): string => {
    if (runningTasks.has(taskId)) {
      return '⏳';
    }
    return '';
  };

  return (
    <div className="tasks-panel">
      <div className="tasks-panel__header">
        <div className="tasks-panel__title">
          <span>Tasks</span>
          <span className="tasks-panel__count">
            {tasks.length} defined, {detectedTasks.length} detected
          </span>
        </div>
        
        <div className="tasks-panel__actions">
          <button
            className="tasks-panel__icon-btn"
            onClick={onRefresh}
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="tasks-panel__toolbar">
        <input
          type="text"
          className="tasks-panel__search"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="tasks-panel__filters">
        <select
          className="tasks-panel__select"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as ViewMode)}
        >
          <option value="all">All Tasks</option>
          <option value="defined">Defined</option>
          <option value="detected">Detected</option>
        </select>

        <select
          className="tasks-panel__select"
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
        >
          <option value="group">Group by Category</option>
          <option value="source">Group by Source</option>
          <option value="none">No Grouping</option>
        </select>
      </div>

      <div className="tasks-panel__content">
        {(viewMode === 'all' || viewMode === 'defined') && (
          <>
            <div className="tasks-panel__section-title">Defined Tasks</div>
            {Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
              <div key={groupName} className="tasks-panel__group">
                <div
                  className="tasks-panel__group-header"
                  onClick={() => toggleGroup(groupName)}
                >
                  <span className={`tasks-panel__expand-icon ${expandedGroups.has(groupName) ? 'expanded' : ''}`}>
                    ▶
                  </span>
                  <span className="tasks-panel__group-name">{groupName}</span>
                  <span className="tasks-panel__group-count">({groupTasks.length})</span>
                </div>

                {expandedGroups.has(groupName) && (
                  <div className="tasks-panel__group-items">
                    {groupTasks.map(task => (
                      <div
                        key={task.id}
                        className={`tasks-panel__item ${selectedTaskId === task.id ? 'selected' : ''}`}
                        onClick={() => onSelectTask(task.id)}
                      >
                        <span className="tasks-panel__item-icon">
                          {getTaskIcon(task.group)}
                        </span>
                        <span className="tasks-panel__item-label">{task.label}</span>
                        
                        {task.isDefault && (
                          <span className="tasks-panel__item-badge" title="Default">★</span>
                        )}

                        <div className="tasks-panel__item-actions">
                          {runningTasks.has(task.id) ? (
                            <button
                              className="tasks-panel__action-btn stop"
                              onClick={(e) => {
                                e.stopPropagation();
                                onStopTask(task.id);
                              }}
                              title="Stop"
                            >
                              ⏹️
                            </button>
                          ) : (
                            <button
                              className="tasks-panel__action-btn run"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRunTask(task.id);
                              }}
                              title="Run"
                            >
                              ▶️
                            </button>
                          )}
                        </div>

                        {getStatusIcon(task.id) && (
                          <span className="tasks-panel__item-status">
                            {getStatusIcon(task.id)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {filteredTasks.length === 0 && (
              <div className="tasks-panel__empty">
                No tasks defined.
                <br />
                <small>Create a .traitor/tasks.json file</small>
              </div>
            )}
          </>
        )}

        {(viewMode === 'all' || viewMode === 'detected') && (
          <>
            <div className="tasks-panel__section-title">Auto-Detected Tasks</div>
            {Object.entries(groupedDetected).map(([source, sourceTasks]) => (
              <div key={source} className="tasks-panel__group">
                <div
                  className="tasks-panel__group-header"
                  onClick={() => toggleGroup(`detected-${source}`)}
                >
                  <span className={`tasks-panel__expand-icon ${expandedGroups.has(`detected-${source}`) ? 'expanded' : ''}`}>
                    ▶
                  </span>
                  <span className="tasks-panel__group-name">{source}</span>
                  <span className="tasks-panel__group-count">({sourceTasks.length})</span>
                </div>

                {expandedGroups.has(`detected-${source}`) && (
                  <div className="tasks-panel__group-items">
                    {sourceTasks.map((task, index) => (
                      <div
                        key={`${task.label}-${index}`}
                        className="tasks-panel__item detected"
                      >
                        <span className="tasks-panel__item-icon">
                          {getTaskIcon(task.group)}
                        </span>
                        <span className="tasks-panel__item-label">{task.label}</span>
                        <span className="tasks-panel__item-description">
                          {task.description}
                        </span>
                        
                        <div className="tasks-panel__item-actions">
                          <button
                            className="tasks-panel__action-btn import"
                            onClick={() => onImportTask(task)}
                            title="Import to tasks.json"
                          >
                            ⬇️
                          </button>
                          <button
                            className="tasks-panel__action-btn run"
                            onClick={() => {
                              // Run detected task directly
                              const mockId = `temp-${Date.now()}`;
                              onRunTask(mockId);
                            }}
                            title="Run without importing"
                          >
                            ▶️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {filteredDetected.length === 0 && viewMode === 'detected' && (
              <div className="tasks-panel__empty">
                No tasks detected.
                <br />
                <small>Open a project with build configuration</small>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TasksPanel;
