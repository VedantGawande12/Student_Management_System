import React, { useState } from 'react';
import {
  ScheduledSession,
  SessionItem,
  Room,
  Faculty,
  StudentGroup,
  ExamScheduled,
  UserAccount,
  BookingRequest,
  DisruptionDiff,
  ValidatorReport
} from '../../core/types';
import { checkFacultyChange, applySessionMove } from '../../core/api';
import {
  Calendar,
  Filter,
  X,
  Check,
  AlertTriangle,
  Sparkles,
  PartyPopper,
  GraduationCap,
  Percent,
  Clock,
  CheckCircle2,
  Coffee
} from 'lucide-react';

interface TimetableGridViewProps {
  sessions: ScheduledSession[];
  sessionMeta: SessionItem[];
  rooms: Room[];
  faculty: Faculty[];
  groups: StudentGroup[];
  exams: ExamScheduled[];
  examsMeta?: Array<{ id: string; course_ids: string[]; groups: string[] }>;
  viewMode: 'regular' | 'fest_week' | 'exams';
  onViewModeChange: (mode: 'regular' | 'fest_week' | 'exams') => void;
  currentUser: UserAccount | null;
  filterType: 'all' | 'group' | 'faculty' | 'room';
  filterValue: string;
  onFilterTypeChange: (type: 'all' | 'group' | 'faculty' | 'room') => void;
  onFilterValueChange: (val: string) => void;
  festBookings?: Array<{
    request_id: string;
    status: string;
    day?: string;
    start_period?: number;
    end_period?: number;
    room_id?: string;
    reason?: string;
  }>;
  bookingRequests?: BookingRequest[];
  sessionOverrides?: Array<{
    session_id: string;
    day: string;
    start_period: number;
    room_id: string;
    displaced_by: string;
  }>;
  lastApprovedDiff?: DisruptionDiff | null;
  validatorReport?: ValidatorReport | null;
  onRefresh?: () => Promise<void> | void;
}

const WEEK_DAYS = [
  { code: 'MON', label: 'Monday' },
  { code: 'TUE', label: 'Tuesday' },
  { code: 'WED', label: 'Wednesday' },
  { code: 'THU', label: 'Thursday' },
  { code: 'FRI', label: 'Friday' },
];

const EXAM_DAYS = [
  { code: 'MON', label: 'Monday', date: '22 Feb' },
  { code: 'TUE', label: 'Tuesday', date: '23 Feb' },
  { code: 'WED', label: 'Wednesday', date: '24 Feb' },
  { code: 'THU', label: 'Thursday', date: '25 Feb' },
  { code: 'FRI', label: 'Friday', date: '26 Feb' },
  { code: 'SAT', label: 'Saturday', date: '27 Feb' },
];

const PERIODS = [
  { p: 1, time: '08:00', label: 'P1' },
  { p: 2, time: '09:00', label: 'P2' },
  { p: 3, time: '10:00', label: 'P3' },
  { p: 4, time: '11:00', label: 'P4' },
  { p: 5, time: '12:00', label: 'P5' },
  // Lunch Break 13:00 - 14:00
  { p: 6, time: '14:00', label: 'P6' },
  { p: 7, time: '15:00', label: 'P7' },
  { p: 8, time: '16:00', label: 'P8' },
  { p: 9, time: '17:00', label: 'P9' },
  // Event periods (Week 7 Fest only)
  { p: 10, time: '18:00', label: 'P10' },
  { p: 11, time: '19:00', label: 'P11' },
  { p: 12, time: '20:00', label: 'P12' },
  { p: 13, time: '21:00', label: 'P13' },
];

export const TimetableGridView: React.FC<TimetableGridViewProps> = ({
  sessions,
  sessionMeta,
  rooms,
  faculty,
  groups,
  exams,
  examsMeta = [],
  viewMode,
  onViewModeChange,
  filterType,
  filterValue,
  onFilterTypeChange,
  onFilterValueChange,
  festBookings = [],
  bookingRequests = [],
  sessionOverrides = [],
  lastApprovedDiff,
  validatorReport,
  onRefresh
}) => {
  const [selectedSession, setSelectedSession] = useState<{
    scheduled: ScheduledSession;
    meta: SessionItem;
    diffChange?: any;
    override?: any;
  } | null>(null);

  const [selectedEvent, setSelectedEvent] = useState<{
    bookingMeta?: BookingRequest;
    decision: any;
  } | null>(null);

  // Faculty change assistant states
  const [targetDay, setTargetDay] = useState('MON');
  const [targetPeriod, setTargetPeriod] = useState(1);
  const [selectedMoveRoom, setSelectedMoveRoom] = useState<string>('');
  const [changeChecking, setChangeChecking] = useState(false);
  const [changeResult, setChangeResult] = useState<any | null>(null);
  const [isApplyingMove, setIsApplyingMove] = useState(false);
  const [moveSuccess, setMoveSuccess] = useState<string | null>(null);

  // Lookup maps
  const metaMap = new Map<string, SessionItem>();
  for (const s of sessionMeta) metaMap.set(s.id, s);

  const examMetaMap = new Map<string, { id: string; course_ids: string[]; groups: string[] }>();
  for (const em of examsMeta) examMetaMap.set(em.id, em);

  const bookingMetaMap = new Map<string, BookingRequest>();
  for (const b of bookingRequests) bookingMetaMap.set(b.id, b);

  const diffMap = new Map<string, any>();
  if (lastApprovedDiff?.changes) {
    for (const c of lastApprovedDiff.changes) {
      diffMap.set(c.session_id, c);
    }
  }

  const overrideMap = new Map<string, any>();
  for (const o of sessionOverrides) {
    overrideMap.set(o.session_id, o);
  }

  // Hard violations map by session id
  const violationBySession = new Map<string, string>();
  if (validatorReport?.hard_violations) {
    for (const hv of validatorReport.hard_violations) {
      if (hv.where) {
        violationBySession.set(hv.where, hv.detail || hv.rule);
      }
    }
  }

  // Group academic sessions by (day, period)
  const gridMap = new Map<string, Array<{
    scheduled: ScheduledSession;
    meta: SessionItem;
    diffChange?: any;
    override?: any;
    errorNote?: string;
  }>>();

  // Also collect all sessions by slot to detect clashes accurately across all data
  const rawSlotMap = new Map<string, ScheduledSession[]>();
  for (const s of sessions) {
    const k = `${s.day}-${s.start_period}`;
    const list = rawSlotMap.get(k) || [];
    list.push(s);
    rawSlotMap.set(k, list);
  }

  for (const s of sessions) {
    const meta = metaMap.get(s.session_id);
    if (!meta) continue;

    // Filter check
    if (filterType === 'group' && filterValue && !meta.groups.includes(filterValue)) continue;
    if (filterType === 'faculty' && filterValue && meta.faculty_id !== filterValue) continue;
    if (filterType === 'room' && filterValue && s.room_id !== filterValue) continue;

    const diffChange = diffMap.get(s.session_id);
    const override = overrideMap.get(s.session_id);
    const errorNote = violationBySession.get(s.session_id);

    const key = `${s.day}-${s.start_period}`;
    const list = gridMap.get(key) || [];
    list.push({ scheduled: s, meta, diffChange, override, errorNote });
    gridMap.set(key, list);
  }

  // Group approved Week 7 Fest Bookings by (day, period)
  const festGridMap = new Map<string, Array<{
    decision: any;
    bookingMeta?: BookingRequest;
  }>>();

  if (viewMode === 'fest_week') {
    for (const d of festBookings) {
      if (d.status !== 'approved' && d.status !== 'alternative_offered') continue;
      if (!d.day || !d.start_period) continue;

      if (filterType === 'room' && filterValue && d.room_id !== filterValue) continue;

      const meta = bookingMetaMap.get(d.request_id);
      const startP = d.start_period;
      const endP = d.end_period || startP;

      for (let p = startP; p <= endP; p++) {
        const key = `${d.day}-${p}`;
        const list = festGridMap.get(key) || [];
        list.push({ decision: d, bookingMeta: meta });
        festGridMap.set(key, list);
      }
    }
  }

  // Check faculty change feasibility
  const handleCheckChange = async () => {
    if (!selectedSession) return;
    setChangeChecking(true);
    setChangeResult(null);
    setMoveSuccess(null);
    try {
      const res = await checkFacultyChange({
        session_id: selectedSession.scheduled.session_id,
        preferred_day: targetDay,
        preferred_start_period: Number(targetPeriod)
      });
      setChangeResult(res);
      if (res.available_rooms && res.available_rooms.length > 0) {
        setSelectedMoveRoom(res.available_rooms[0]);
      }
    } catch (e: any) {
      setChangeResult({ feasible: false, message: e.message });
    } finally {
      setChangeChecking(false);
    }
  };

  // Apply & confirm the faculty change dynamically
  const handleConfirmMove = async () => {
    if (!selectedSession || !changeResult?.feasible) return;
    setIsApplyingMove(true);
    setMoveSuccess(null);
    try {
      await applySessionMove({
        session_id: selectedSession.scheduled.session_id,
        day: targetDay,
        start_period: Number(targetPeriod),
        room_id: selectedMoveRoom || selectedSession.scheduled.room_id
      });
      setMoveSuccess(`Session moved to ${targetDay} Period ${targetPeriod} (${selectedMoveRoom || selectedSession.scheduled.room_id})!`);
      if (onRefresh) {
        await onRefresh();
      }
      setTimeout(() => {
        setSelectedSession(null);
        setChangeResult(null);
        setMoveSuccess(null);
      }, 1000);
    } catch (e: any) {
      setChangeResult({ ...changeResult, message: `Failed to move session: ${e.message}` });
    } finally {
      setIsApplyingMove(false);
    }
  };

  const numPeriods = viewMode === 'fest_week' ? 13 : 9;

  // ── Utilization & Operational Statistics ────────────────────────────────────
  const totalTeachingSlots = rooms.length * 5 * 8;
  const occupiedSlots = sessions.reduce((acc, s) => {
    const meta = metaMap.get(s.session_id);
    return acc + (meta?.duration || 1);
  }, 0);
  const campusUtilization = totalTeachingSlots > 0 ? Math.min(100, Math.round((occupiedSlots / totalTeachingSlots) * 100)) : 0;

  let selectedRoomUtil: number | null = null;
  if (filterType === 'room' && filterValue) {
    const roomOccupied = sessions
      .filter(s => s.room_id === filterValue)
      .reduce((acc, s) => {
        const meta = metaMap.get(s.session_id);
        return acc + (meta?.duration || 1);
      }, 0);
    selectedRoomUtil = Math.min(100, Math.round((roomOccupied / 40) * 100));
  }

  const pendingCount = (bookingRequests || []).filter(b => {
    const dec = (festBookings || []).find(f => f.request_id === b.id);
    return !dec || dec.status === 'pending';
  }).length;

  let totalConflictsCount = 0;
  for (const slotSessions of rawSlotMap.values()) {
    const roomCounts = new Map<string, number>();
    for (const s of slotSessions) {
      roomCounts.set(s.room_id, (roomCounts.get(s.room_id) || 0) + 1);
    }
    for (const cnt of roomCounts.values()) {
      if (cnt > 1) totalConflictsCount += 1;
    }
  }
  if (validatorReport?.hard_violations) {
    totalConflictsCount += validatorReport.hard_violations.length;
  }

  return (
    <div className="space-y-3">
      {/* 1. Clean Top Bar: View Mode Selector + Filters (No Jargon Stats) */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Timetable Sub-View Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded">
          <button
            onClick={() => onViewModeChange('regular')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              viewMode === 'regular'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-blue-700" />
            <span>Weekly teaching timetable</span>
          </button>

          <button
            onClick={() => onViewModeChange('fest_week')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              viewMode === 'fest_week'
                ? 'bg-white text-purple-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PartyPopper className="w-3.5 h-3.5 text-purple-600" />
            <span>Week 7 (Spectra '27)</span>
            {festBookings.filter(b => b.status === 'approved').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-800 font-bold border border-purple-200">
                {festBookings.filter(b => b.status === 'approved').length}
              </span>
            )}
          </button>

          <button
            onClick={() => onViewModeChange('exams')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              viewMode === 'exams'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-amber-700" />
            <span>Midsem exams (Week 8)</span>
          </button>
        </div>

        {/* Filter Dropdown */}
        {viewMode !== 'exams' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Filter:</span>
            </span>
            <select
              value={filterType}
              onChange={(e) => {
                onFilterTypeChange(e.target.value as any);
                onFilterValueChange('');
              }}
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium"
            >
              <option value="all">All classes</option>
              <option value="group">Student group</option>
              <option value="faculty">Faculty</option>
              <option value="room">Room / Venue</option>
            </select>

            {filterType === 'group' && (
              <select
                value={filterValue}
                onChange={(e) => onFilterValueChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium max-w-xs"
              >
                <option value="">Select group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.id} ({g.size} students)
                  </option>
                ))}
              </select>
            )}

            {filterType === 'faculty' && (
              <select
                value={filterValue}
                onChange={(e) => onFilterValueChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium max-w-xs"
              >
                <option value="">Select faculty</option>
                {faculty.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.id} — {f.name}
                  </option>
                ))}
              </select>
            )}

            {filterType === 'room' && (
              <select
                value={filterValue}
                onChange={(e) => onFilterValueChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium max-w-xs"
              >
                <option value="">Select room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} (cap {r.capacity})
                  </option>
                ))}
              </select>
            )}

            {filterType !== 'all' && filterValue && (
              <button
                onClick={() => {
                  onFilterTypeChange('all');
                  onFilterValueChange('');
                }}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs ml-1 bg-slate-100 px-2 py-1 rounded"
              >
                <X className="w-3 h-3" />
                <span>Reset filter</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Operational Metrics & Utilization Strip */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-5 text-slate-700">
          <div className="flex items-center gap-1.5">
            <Percent className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              {selectedRoomUtil !== null ? `${filterValue} Utilization: ` : 'Room Utilization: '}
              <strong className="text-slate-900 font-bold">
                {selectedRoomUtil !== null ? `${selectedRoomUtil}%` : `${campusUtilization}%`}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>Pending Approvals: <strong className="text-slate-900 font-bold">{pendingCount}</strong></span>
          </div>

          <div className="flex items-center gap-1.5">
            {totalConflictsCount === 0 ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>0 Conflicts (Verified)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-red-700 font-bold animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>{totalConflictsCount} Conflicts Detected</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
          <Coffee className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Lunch Break: <strong className="text-slate-700 font-semibold">13:00–14:00</strong> (Between P5 &amp; P6)</span>
        </div>
      </div>

      {/* 3. Main Timetable / Exam Display */}
      {viewMode === 'exams' ? (
        /* Midsem Exam Table View */
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="font-bold text-slate-800 text-xs">
              Mid-Semester Examinations (Week 8: 22 Feb – 27 Feb 2027)
            </span>
            <span className="text-[11px] text-slate-500">
              AM: 09:30–11:30 • PM: 14:00–16:00
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Exam Code</th>
                  <th className="p-2.5">Course(s)</th>
                  <th className="p-2.5">Day</th>
                  <th className="p-2.5">Slot</th>
                  <th className="p-2.5">Rooms</th>
                  <th className="p-2.5">Student Groups</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {exams.map((ex) => {
                  const dayMeta = EXAM_DAYS.find(d => d.code === ex.day);
                  const meta = examMetaMap.get(ex.exam_id);
                  return (
                    <tr key={ex.exam_id} className="hover:bg-slate-50/60">
                      <td className="p-2.5 font-mono font-bold text-slate-900">{ex.exam_id}</td>
                      <td className="p-2.5 font-semibold text-slate-800">
                        {meta?.course_ids ? meta.course_ids.join(', ') : ex.exam_id.replace('EX-', '')}
                      </td>
                      <td className="p-2.5 font-medium text-slate-800">
                        {dayMeta?.label || ex.day} <span className="text-slate-400 font-normal">({dayMeta?.date || ''})</span>
                      </td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold ${
                          ex.session === 'AM' ? 'bg-blue-100 text-blue-900' : 'bg-purple-100 text-purple-900'
                        }`}>
                          {ex.session === 'AM' ? 'AM (09:30–11:30)' : 'PM (14:00–16:00)'}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap gap-1">
                          {ex.rooms.map((rid: string) => (
                            <span key={rid} className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-slate-800">
                              {rid}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-2.5 text-slate-600">
                        {meta?.groups ? meta.groups.join(', ') : 'All registered groups'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Regular & Week 7 Weekly Time Grid */
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
          {viewMode === 'fest_week' && (
            <div className="bg-purple-50/80 border-b border-purple-200 px-4 py-2 flex items-center justify-between text-xs text-purple-900">
              <div className="flex items-center gap-2">
                <PartyPopper className="w-4 h-4 text-purple-700" />
                <span className="font-bold">Week 7 Festival Overlay (15 Feb – 19 Feb 2027):</span>
                <span>Daytime classes + Evening festival venues (P10–P13 · 18:00–22:00)</span>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs min-w-[950px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <th className="w-24 p-2.5 text-center font-bold text-slate-800 border-r border-slate-200">
                    Day
                  </th>
                  {PERIODS.slice(0, numPeriods).map((p) => {
                    const isLunchBoundary = p.p === 5;
                    const isEventPeriod = p.p > 9;
                    return (
                      <th
                        key={p.p}
                        className={`p-2 text-center border-r border-slate-200 font-medium ${
                          isLunchBoundary ? 'border-r-4 border-r-amber-400 bg-amber-50/30' : ''
                        } ${isEventPeriod ? 'bg-purple-100/60 text-purple-950' : ''}`}
                      >
                        <div className="font-bold text-slate-900">
                          {p.label}
                          {isEventPeriod && (
                            <span className="ml-1 text-[9px] px-1 rounded bg-purple-200 text-purple-800 font-bold uppercase">
                              Fest
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{p.time}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {WEEK_DAYS.map((dayItem) => {
                  const dayCode = dayItem.code;
                  return (
                    <tr key={dayCode} className="hover:bg-slate-50/40">
                      {/* Clean Day Header */}
                      <td className="p-2.5 text-center font-bold text-slate-900 bg-slate-50 border-r border-slate-200 align-top">
                        <div className="text-xs font-bold uppercase">{dayCode}</div>
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5">{dayItem.label}</div>
                      </td>

                      {/* Periods */}
                      {PERIODS.slice(0, numPeriods).map((p) => {
                        const key = `${dayCode}-${p.p}`;
                        const academicItems = gridMap.get(key) || [];
                        const festItems = festGridMap.get(key) || [];
                        const allSlotSessions = rawSlotMap.get(key) || [];
                        const isLunchBoundary = p.p === 5;
                        const isEventPeriod = p.p > 9;

                        // Check for clash/overlap in this cell:
                        // 1. Room overlap: duplicate rooms in this slot
                        const roomCounts = new Map<string, number>();
                        for (const s of allSlotSessions) {
                          roomCounts.set(s.room_id, (roomCounts.get(s.room_id) || 0) + 1);
                        }
                        const roomClash = Array.from(roomCounts.entries()).find(([_, count]) => count > 1);

                        // 2. Faculty overlap
                        const facCounts = new Map<string, number>();
                        for (const s of allSlotSessions) {
                          const m = metaMap.get(s.session_id);
                          if (m?.faculty_id) {
                            facCounts.set(m.faculty_id, (facCounts.get(m.faculty_id) || 0) + 1);
                          }
                        }
                        const facClash = Array.from(facCounts.entries()).find(([_, count]) => count > 1);

                        // 3. Validator error on session
                        const cellErrors = academicItems.filter(i => !!i.errorNote);

                        const hasClash = !!roomClash || !!facClash || cellErrors.length > 0;

                        return (
                          <td
                            key={p.p}
                            className={`p-1.5 align-top border-r border-slate-200 min-h-[90px] min-w-[90px] ${
                              isLunchBoundary ? 'border-r-4 border-r-amber-400' : ''
                            } ${isEventPeriod ? 'bg-purple-50/30' : ''}`}
                          >
                            <div className="space-y-1.5">
                              {/* RED COLORED CLASH / ERROR CARD */}
                              {hasClash && (
                                <div className="p-1.5 rounded bg-red-50 border-2 border-red-500 text-red-950 shadow-xs mb-1 animate-pulse">
                                  <div className="flex items-center gap-1 text-[11px] font-bold text-red-700">
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                    <span>Conflict Detected</span>
                                  </div>
                                  <div className="text-[10px] text-red-900 font-medium mt-0.5 leading-tight">
                                    {roomClash && `Room double-booked: ${roomClash[0]}`}
                                    {facClash && `Faculty double-booked: ${facClash[0]}`}
                                    {cellErrors.length > 0 && cellErrors[0].errorNote}
                                  </div>
                                </div>
                              )}

                              {/* Academic Classes */}
                              {academicItems.map(({ scheduled, meta, diffChange, override, errorNote }) => {
                                const isLab = meta.kind === 'lab';
                                const isBasket = !!meta.basket_slot;
                                const isChanged = !!diffChange;
                                const isOverridden = !!override;
                                const isError = !!errorNote;

                                return (
                                  <div
                                    key={scheduled.session_id}
                                    onClick={() => setSelectedSession({ scheduled, meta, diffChange, override })}
                                    className={`p-1.5 rounded cursor-pointer transition-all border text-[11px] shadow-2xs relative ${
                                      isError
                                        ? 'bg-red-50 border-red-500 text-red-950 ring-1 ring-red-500 hover:bg-red-100'
                                        : isChanged
                                        ? 'bg-emerald-50/90 border-emerald-400 text-emerald-950 ring-1 ring-emerald-400 hover:bg-emerald-100'
                                        : isOverridden
                                        ? 'bg-rose-50/90 border-rose-300 text-rose-950 ring-1 ring-rose-300 hover:bg-rose-100'
                                        : isLab
                                        ? 'bg-amber-50/80 border-amber-300 text-amber-950 hover:bg-amber-100'
                                        : isBasket
                                        ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 hover:bg-indigo-100'
                                        : 'bg-white border-slate-300 text-slate-900 hover:border-slate-400'
                                    }`}
                                    title={`Click to inspect or change ${meta.id}`}
                                  >
                                    {/* Updated slot pill */}
                                    {isChanged && (
                                      <span className="absolute -top-1.5 -right-1 px-1 py-0.2 bg-emerald-700 text-white rounded text-[8px] font-bold">
                                        Updated
                                      </span>
                                    )}

                                    {/* Week 7 override pill */}
                                    {isOverridden && (
                                      <span className="absolute -top-1.5 -right-1 px-1 py-0.2 bg-rose-700 text-white rounded text-[8px] font-bold">
                                        Overridden
                                      </span>
                                    )}

                                    <div className="flex items-center justify-between font-bold leading-tight">
                                      <span>{meta.course_id}</span>
                                      <span className="text-[10px] px-1 py-0.2 rounded bg-slate-100 font-mono text-slate-700 font-semibold">
                                        {scheduled.room_id}
                                      </span>
                                    </div>

                                    <div className="text-[10px] text-slate-600 truncate mt-0.5">
                                      {meta.faculty_id} • {meta.groups.join(', ')}
                                    </div>

                                    {isChanged && (
                                      <div className="text-[9px] text-emerald-800 font-medium truncate mt-0.5">
                                        Moved from {diffChange.before.day} P{diffChange.before.start_period}
                                      </div>
                                    )}

                                    <div className="flex items-center gap-1 mt-0.5">
                                      {isBasket && (
                                        <span className="px-1 rounded bg-indigo-100 text-indigo-800 text-[9px] font-medium">
                                          {meta.basket_slot}
                                        </span>
                                      )}
                                      {isLab && (
                                        <span className="px-1 rounded bg-amber-100 text-amber-900 text-[9px] font-medium">
                                          Lab · 3h
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Approved Week 7 Fest Events */}
                              {viewMode === 'fest_week' && festItems.map(({ decision, bookingMeta }, idx) => (
                                <div
                                  key={`${decision.request_id}-${idx}`}
                                  onClick={() => setSelectedEvent({ bookingMeta, decision })}
                                  className="p-1.5 rounded cursor-pointer transition-all border border-purple-400 bg-purple-100/90 hover:bg-purple-200 text-purple-950 text-[11px] shadow-xs"
                                  title={`View fest event ${decision.request_id}`}
                                >
                                  <div className="flex items-center justify-between font-bold leading-tight">
                                    <span className="truncate max-w-[80px]">
                                      {bookingMeta?.title || decision.request_id}
                                    </span>
                                    <span className="text-[10px] px-1 py-0.2 rounded bg-purple-200 font-mono text-purple-900 font-bold">
                                      {decision.room_id}
                                    </span>
                                  </div>

                                  <div className="text-[10px] text-purple-800 truncate mt-0.5 font-medium">
                                    {bookingMeta?.requester || 'Fest Event'}
                                  </div>

                                  <div className="flex items-center gap-1 mt-1">
                                    <span className="px-1 py-0.2 rounded bg-purple-300/80 text-purple-900 text-[9px] font-bold uppercase">
                                      {bookingMeta?.requested_category || 'Fest'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Session Inspector & Faculty Rescheduling Assistant Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-300 max-w-lg w-full p-5 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="text-base font-bold text-slate-900">
                  {selectedSession.meta.course_id} ({selectedSession.scheduled.session_id})
                </div>
                <div className="text-xs text-slate-500">
                  {selectedSession.meta.kind} • duration: {selectedSession.meta.duration} hour(s)
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedSession(null);
                  setChangeResult(null);
                  setMoveSuccess(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Changed Slot Notice */}
            {selectedSession.diffChange && (
              <div className="p-2.5 rounded bg-emerald-50 border border-emerald-300 text-xs text-emerald-900">
                <span className="font-bold">Updated Slot:</span> Moved from{' '}
                <span className="font-semibold">{selectedSession.diffChange.before.day} Period {selectedSession.diffChange.before.start_period} ({selectedSession.diffChange.before.room_id})</span>{' '}
                to <span className="font-semibold">{selectedSession.scheduled.day} Period {selectedSession.scheduled.start_period} ({selectedSession.scheduled.room_id})</span>.
              </div>
            )}

            {/* Current Metadata */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded border border-slate-200">
              <div><span className="text-slate-500 font-medium">Assigned Slot:</span> <span className="font-semibold">{selectedSession.scheduled.day} Period {selectedSession.scheduled.start_period}</span></div>
              <div><span className="text-slate-500 font-medium">Room:</span> <span className="font-semibold">{selectedSession.scheduled.room_id}</span></div>
              <div><span className="text-slate-500 font-medium">Faculty:</span> <span className="font-semibold">{selectedSession.meta.faculty_id}</span></div>
              <div><span className="text-slate-500 font-medium">Students:</span> <span className="font-semibold">{selectedSession.meta.size}</span></div>
              <div className="col-span-2"><span className="text-slate-500 font-medium">Groups:</span> <span className="font-semibold">{selectedSession.meta.groups.join(', ')}</span></div>
            </div>

            {/* Rescheduling Assistant */}
            <div className="border-t border-slate-200 pt-3 space-y-2.5">
              <div className="text-xs font-semibold text-slate-800">
                Reschedule this session to another slot
              </div>

              {moveSuccess && (
                <div className="p-2.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-medium">
                  {moveSuccess}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                <select
                  value={targetDay}
                  onChange={(e) => setTargetDay(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-700 font-medium"
                >
                  {WEEK_DAYS.map((d) => (
                    <option key={d.code} value={d.code}>{d.label}</option>
                  ))}
                </select>

                <select
                  value={targetPeriod}
                  onChange={(e) => setTargetPeriod(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-700 font-medium"
                >
                  {PERIODS.slice(0, 9).map((p) => (
                    <option key={p.p} value={p.p}>Period {p.p} ({p.time})</option>
                  ))}
                </select>

                <button
                  onClick={handleCheckChange}
                  disabled={changeChecking}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-3.5 py-1.5 rounded font-medium text-xs transition-colors disabled:opacity-50"
                >
                  {changeChecking ? 'Checking...' : 'Check Slot'}
                </button>
              </div>

              {changeResult && (
                <div className={`p-3 rounded text-xs border space-y-2 ${
                  changeResult.feasible
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}>
                  <div className="font-semibold flex items-center gap-1.5">
                    {changeResult.feasible ? (
                      <Check className="w-4 h-4 text-emerald-700" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-700" />
                    )}
                    <span>{changeResult.message}</span>
                  </div>

                  {changeResult.feasible && changeResult.available_rooms?.length > 0 && (
                    <div className="pt-2 border-t border-emerald-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-emerald-900">Room:</span>
                        <select
                          value={selectedMoveRoom}
                          onChange={(e) => setSelectedMoveRoom(e.target.value)}
                          className="bg-white border border-emerald-400 rounded px-2 py-1 text-xs font-mono font-semibold"
                        >
                          {changeResult.available_rooms.map((rid: string) => (
                            <option key={rid} value={rid}>{rid}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={handleConfirmMove}
                        disabled={isApplyingMove}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded font-bold text-xs transition-colors disabled:opacity-50"
                      >
                        {isApplyingMove ? 'Moving...' : 'Apply Move →'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Fest Event Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-300 max-w-md w-full p-5 space-y-3 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <PartyPopper className="w-4 h-4 text-purple-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Approved Fest Event (Week 7)
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-purple-50 rounded border border-purple-200 space-y-1">
              <div className="text-sm font-bold text-purple-950">
                {selectedEvent.bookingMeta?.title || selectedEvent.decision.request_id}
              </div>
              <div className="text-xs text-purple-800 font-medium">
                Organized by: <span className="font-semibold">{selectedEvent.bookingMeta?.requester || 'Club'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded border border-slate-200">
              <div><span className="text-slate-500 font-medium">Slot:</span> <span className="font-semibold">{selectedEvent.decision.day} Period {selectedEvent.decision.start_period}–{selectedEvent.decision.end_period || selectedEvent.decision.start_period}</span></div>
              <div><span className="text-slate-500 font-medium">Venue:</span> <span className="font-semibold">{selectedEvent.decision.room_id}</span></div>
              <div><span className="text-slate-500 font-medium">Category:</span> <span className="font-semibold uppercase">{selectedEvent.bookingMeta?.requested_category || 'Club Event'}</span></div>
              <div><span className="text-slate-500 font-medium">Attendance:</span> <span className="font-semibold">{selectedEvent.bookingMeta?.attendance || 100}</span></div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-3.5 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-medium rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
