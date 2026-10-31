import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AppStateResponse,
  FullSchedule,
  ScheduledSession,
  Room,
  Faculty,
  StudentGroup,
  SessionItem
} from '../core/types';
import {
  fetchState,
  generateSchedule as apiGenerateSchedule,
  resetDemoData as apiResetDemoData,
  syncDatabase as apiSyncDatabase
} from '../core/api';

export type TimetableViewMode = 'regular' | 'fest_week' | 'exams';
export type FilterType = 'all' | 'group' | 'faculty' | 'room';

export function useSchedule() {
  const [appState, setAppState] = useState<AppStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [syncingDb, setSyncingDb] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [viewMode, setViewMode] = useState<TimetableViewMode>('regular');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterValue, setFilterValue] = useState<string>('');

  const refreshState = useCallback(async () => {
    try {
      const data = await fetchState();
      setAppState(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load application state');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      await apiGenerateSchedule();
      await refreshState();
    } catch (err: any) {
      setError(err.message || 'Failed to generate timetable');
      throw err;
    } finally {
      setGenerating(false);
    }
  }, [refreshState]);

  const reset = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await apiResetDemoData();
      await refreshState();
    } catch (err: any) {
      setError(err.message || 'Failed to reset demo data');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshState]);

  const syncDb = useCallback(async () => {
    setSyncingDb(true);
    try {
      const res = await apiSyncDatabase();
      await refreshState();
      return res;
    } catch (err: any) {
      setError(err.message || 'Failed to sync database');
      throw err;
    } finally {
      setSyncingDb(false);
    }
  }, [refreshState]);

  // Timetable grid representation: map of (day, period) -> items
  const activeSessions = useMemo(() => {
    if (!appState?.active_schedule) return [];
    
    // If fest_week view, merge base with session_overrides and fest bookings
    if (viewMode === 'fest_week') {
      const baseMap = new Map<string, ScheduledSession>();
      for (const s of appState.active_schedule.sessions) {
        baseMap.set(s.session_id, s);
      }
      for (const o of appState.active_schedule.fest_week.session_overrides) {
        baseMap.set(o.session_id, {
          session_id: o.session_id,
          day: o.day,
          start_period: o.start_period,
          room_id: o.room_id
        });
      }
      return Array.from(baseMap.values());
    }
    
    return appState.active_schedule.sessions;
  }, [appState?.active_schedule, viewMode]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    if (!appState) return [];
    const sessionMap = new Map<string, SessionItem>();
    for (const s of appState.sessions) {
      sessionMap.set(s.id, s);
    }

    return activeSessions.filter((s) => {
      if (filterType === 'all' || !filterValue) return true;
      const meta = sessionMap.get(s.session_id);
      if (!meta) return true;

      if (filterType === 'group') {
        return meta.groups.includes(filterValue);
      }
      if (filterType === 'faculty') {
        return meta.faculty_id === filterValue;
      }
      if (filterType === 'room') {
        return s.room_id === filterValue;
      }
      return true;
    });
  }, [activeSessions, appState, filterType, filterValue]);

  return {
    appState,
    loading,
    generating,
    error,
    refreshState,
    generate,
    reset,
    syncDb,
    syncingDb,
    viewMode,
    setViewMode,
    filterType,
    setFilterType,
    filterValue,
    setFilterValue,
    activeSessions,
    filteredSessions,
    rooms: appState?.rooms ?? [],
    faculty: appState?.faculty ?? [],
    groups: appState?.student_groups ?? [],
    exams: appState?.active_schedule?.exams ?? [],
    bookings: appState?.booking_requests ?? [],
    festDecisions: appState?.active_schedule?.fest_week.bookings ?? [],
    sessionOverrides: appState?.active_schedule?.fest_week.session_overrides ?? []
  };
}

