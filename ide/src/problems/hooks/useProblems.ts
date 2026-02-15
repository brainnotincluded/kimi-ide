/**
 * Problems Panel React Hook
 * IDE Kimi IDE - Hook for managing problems panel state
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ProblemItemData,
  ProblemsCount,
  ProblemsFilter,
  DEFAULT_FILTER,
  ProblemsGroupBy,
  GroupedProblems,
  ProblemsChangedEvent,
  filterProblemsBySeverity,
  groupProblems,
  calculateCounts,
} from '../types';
import * as problemsAPI from '../renderer-ipc';

export interface UseProblemsOptions {
  /** Initial filter settings */
  initialFilter?: Partial<ProblemsFilter>;
  /** Initial group by setting */
  initialGroupBy?: ProblemsGroupBy;
}

export interface UseProblemsReturn {
  // State
  problems: ProblemItemData[];
  filteredProblems: ProblemItemData[];
  groupedProblems: GroupedProblems[];
  counts: ProblemsCount;
  filter: ProblemsFilter;
  groupBy: ProblemsGroupBy;
  expandedGroups: Set<string>;
  isLoading: boolean;
  selectedProblemId?: string;

  // Actions
  setFilter: (filter: Partial<ProblemsFilter>) => void;
  setGroupBy: (groupBy: ProblemsGroupBy) => void;
  toggleGroup: (groupKey: string) => void;
  expandAllGroups: () => void;
  collapseAllGroups: () => void;
  selectProblem: (problemId: string | undefined) => void;
  clearAll: () => Promise<void>;
  clearForFile: (filePath: string) => Promise<void>;
  openProblem: (problem: ProblemItemData) => Promise<void>;
  copyMessage: (message: string) => Promise<void>;
  refresh: () => Promise<void>;

  // Helpers
  hasErrors: boolean;
  hasWarnings: boolean;
  totalProblems: number;
}

export function useProblems(options: UseProblemsOptions = {}): UseProblemsReturn {
  const { initialFilter, initialGroupBy = 'file' } = options;

  // State
  const [problems, setProblems] = useState<ProblemItemData[]>([]);
  const [filter, setFilterState] = useState<ProblemsFilter>({
    ...DEFAULT_FILTER,
    ...initialFilter,
  });
  const [groupBy, setGroupBy] = useState<ProblemsGroupBy>(initialGroupBy);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProblemId, setSelectedProblemId] = useState<string | undefined>();

  // Load initial data
  useEffect(() => {
    const loadProblems = async () => {
      setIsLoading(true);
      try {
        const allProblems = await problemsAPI.getAllProblems();
        setProblems(allProblems);
        
        // Initialize expanded groups
        const initialExpanded = new Set<string>();
        const grouped = groupProblems(allProblems, groupBy);
        grouped.forEach((g) => initialExpanded.add(g.key));
        setExpandedGroups(initialExpanded);
      } finally {
        setIsLoading(false);
      }
    };

    loadProblems();
  }, [groupBy]);

  // Listen for changes
  useEffect(() => {
    const unsubscribe = problemsAPI.onProblemsChanged((event: ProblemsChangedEvent) => {
      setProblems(event.problems);
    });

    return unsubscribe;
  }, []);

  // Computed values
  const filteredProblems = useMemo(() => {
    return filterProblemsBySeverity(problems, filter);
  }, [problems, filter]);

  const groupedProblems = useMemo(() => {
    const grouped = groupProblems(filteredProblems, groupBy);
    // Filter to only expanded groups
    return grouped.map((g) => ({
      ...g,
      expanded: expandedGroups.has(g.key),
    }));
  }, [filteredProblems, groupBy, expandedGroups]);

  const counts = useMemo(() => calculateCounts(problems), [problems]);

  const hasErrors = counts.errors > 0;
  const hasWarnings = counts.warnings > 0;
  const totalProblems = counts.total;

  // Actions
  const setFilter = useCallback((newFilter: Partial<ProblemsFilter>) => {
    setFilterState((prev) => {
      const updated = { ...prev, ...newFilter };
      // Sync with main process
      problemsAPI.setProblemsFilter(newFilter);
      return updated;
    });
  }, []);

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const expandAllGroups = useCallback(() => {
    const allKeys = new Set(groupedProblems.map((g) => g.key));
    setExpandedGroups(allKeys);
  }, [groupedProblems]);

  const collapseAllGroups = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  const selectProblem = useCallback((problemId: string | undefined) => {
    setSelectedProblemId(problemId);
  }, []);

  const clearAll = useCallback(async () => {
    await problemsAPI.clearAllProblems();
  }, []);

  const clearForFile = useCallback(async (filePath: string) => {
    await problemsAPI.clearProblemsForFile(filePath);
  }, []);

  const openProblem = useCallback(async (problem: ProblemItemData) => {
    await problemsAPI.openFileAtPosition(problem.file, {
      line: problem.diagnostic.range.start.line,
      character: problem.diagnostic.range.start.character,
    });
  }, []);

  const copyMessage = useCallback(async (message: string) => {
    await problemsAPI.copyProblemMessage(message);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const allProblems = await problemsAPI.getAllProblems();
      setProblems(allProblems);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    // State
    problems,
    filteredProblems,
    groupedProblems,
    counts,
    filter,
    groupBy,
    expandedGroups,
    isLoading,
    selectedProblemId,

    // Actions
    setFilter,
    setGroupBy,
    toggleGroup,
    expandAllGroups,
    collapseAllGroups,
    selectProblem,
    clearAll,
    clearForFile,
    openProblem,
    copyMessage,
    refresh,

    // Helpers
    hasErrors,
    hasWarnings,
    totalProblems,
  };
}
