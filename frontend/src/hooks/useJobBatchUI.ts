import { useState, useMemo } from 'react';
import type { JobItem } from '../types';

export interface JobBatchUIState {
  isExpanded: boolean;
  selectedIds: Set<number>;
  filterText: string;
  filteredJobs: JobItem[];
}

export function useJobBatchUI(jobs: JobItem[] = []) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterText, setFilterText] = useState('');

  // Filter jobs based on search text
  const filteredJobs = useMemo(
    () => jobs.filter(job =>
      job.sourceUrl.toLowerCase().includes(filterText.toLowerCase())
    ),
    [jobs, filterText]
  );

  // Selection handlers
  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredJobs.map(job => job.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const isAllSelected = filteredJobs.length > 0 &&
    filteredJobs.every(job => selectedIds.has(job.id));

  const isIndeterminate = filteredJobs.some(job => selectedIds.has(job.id)) &&
    !isAllSelected;

  return {
    // State
    isExpanded,
    selectedIds,
    filterText,
    filteredJobs,
    isAllSelected,
    isIndeterminate,

    // Actions
    setIsExpanded,
    setFilterText,
    toggleSelection,
    selectAll,
    clearSelection,
  };
}