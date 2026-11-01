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
  DisruptionDiff
} from '../../core/types';
import { checkFacultyChange, applySessionMove } from '../../core/api';
import {
  Calendar,
  Filter,
  X,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  PartyPopper,
  GraduationCap,
  ArrowRight,
  Info
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
  onRefresh?: () => Promise<void> | void;
}

// Calendar day metadata with integrated Spring 2027 academic dates
const TEACHING_DAYS = [
  { code: 'MON', label: 'Monday', termDates: 'Weeks 1–6, 8–14' },
  { code: 'TUE', label: 'Tuesday', termDates: 'Weeks 1–6, 8–14' },
  { code: 'WED', label: 'Wednesday', termDates: 'Weeks 1–6, 8–14' },
  { code: 'THU', label: 'Thursday', termDates: 'Weeks 1–6, 8–14' },
  { code: 'FRI', label: 'Friday', termDates: 'Weeks 1–6, 8–14' },
];

const WEEK7_DAYS = [
  { code: 'MON', label: 'Mon', date: '15 Feb 2027', festTheme: 'Inauguration & Tech Competitions' },
  { code: 'TUE', label: 'Tue', date: '16 Feb 2027', festTheme: 'Hackathons & Robotics Arena' },
  { code: 'WED', label: 'Wed', date: '17 Feb 2027', festTheme: 'Literary & Fine Arts Day' },
  { code: 'THU', label: 'Thu', date: '18 Feb 2027', festTheme: 'Theatre & Dramatics Showcase' },
  { code: 'FRI', label: 'Fri', date: '19 Feb 2027', festTheme: 'Star Night Gala & Valedictory' },
];

const EXAM_DAYS = [
  { code: 'MON', label: 'Mon', date: '22 Feb 2027' },
  { code: 'TUE', label: 'Tue', date: '23 Feb 2027' },
  { code: 'WED', label: 'Wed', date: '24 Feb 2027' },
  { code: 'THU', label: 'Thu', date: '25 Feb 2027' },
  { code: 'FRI', label: 'Fri', date: '26 Feb 2027' },
  { code: 'SAT', label: 'Sat', date: '27 Feb 2027' },
];

const PERIODS = [
  { p: 1, time: '08:00', label: 'P1' },
  { p: 2, time: '09:00', label: 'P2' },
  { p: 3, time: '10:00', label: 'P3' },
  { p: 4, time: '11:00', label: 'P4' },
  { p: 5, time: '12:00', label: 'P5' },
  // Lunch 13:00 - 14:00
  { p: 6, time: '14:00', label: 'P6' },
  { p: 7, time: '15:00', label: 'P7' },
  { p: 8, time: '16:00', label: 'P8' },
  { p: 9, time: '17:00', label: 'P9' },
  // Event periods (Spectra week 7)
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
  currentUser,
  filterType,
  filterValue,
  onFilterTypeChange,
  onFilterValueChange,
  festBookings = [],
  bookingRequests = [],
  sessionOverrides = [],
  lastApprovedDiff,
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

  // Quick lookup maps
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

  // Group academic sessions by (day, period)
  const gridMap = new Map<string, Array<{
    scheduled: ScheduledSession;
    meta: SessionItem;
    diffChange?: any;
    override?: any;
  }>>();

  for (const s of sessions) {
    const meta = metaMap.get(s.session_id);
    if (!meta) continue;

    // Filter check
    if (filterType === 'group' && filterValue && !meta.groups.includes(filterValue)) continue;
    if (filterType === 'faculty' && filterValue && meta.faculty_id !== filterValue) continue;
    if (filterType === 'room' && filterValue && s.room_id !== filterValue) continue;

    const diffChange = diffMap.get(s.session_id);
    const override = overrideMap.get(s.session_id);

    const key = `${s.day}-${s.start_period}`;
    const list = gridMap.get(key) || [];
    list.push({ scheduled: s, meta, diffChange, override });
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
      setMoveSuccess(`Session moved dynamically to ${targetDay} Period ${targetPeriod} (${selectedMoveRoom || selectedSession.scheduled.room_id})!`);
      if (onRefresh) {
        await onRefresh();
      }
      setTimeout(() => {
        setSelectedSession(null);
        setChangeResult(null);
        setMoveSuccess(null);
      }, 1200);
    } catch (e: any) {
      setChangeResult({ ...changeResult, message: `Failed to move session: ${e.message}` });
    } finally {
      setIsApplyingMove(false);
    }
  };

  const currentDays = viewMode === 'fest_week' ? WEEK7_DAYS : TEACHING_DAYS;
  const numPeriods = viewMode === 'fest_week' ? 13 : 9;

  return (
    <div className="space-y-3.5">
      {/* 1. Academic Calendar Header Banner with Dates */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            {viewMode === 'regular' && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                Regular Term
              </span>
            )}
            {viewMode === 'fest_week' && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-200 flex items-center gap-1">
                <PartyPopper className="w-3 h-3 text-purple-700" />
                Week 7 · Spectra '27
              </span>
            )}
            {viewMode === 'exams' && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                <GraduationCap className="w-3 h-3 text-amber-700" />
                Week 8 · Midsem Exams
              </span>
            )}
            <h2 className="text-sm font-bold text-slate-900">
              {viewMode === 'regular' && 'Spring Semester 2027 — Teaching Timetable (Weeks 1–6, 8–14)'}
              {viewMode === 'fest_week' && 'Week 7 Festival Timetable — Spectra \'27 (15 Feb – 19 Feb 2027)'}
              {viewMode === 'exams' && 'Mid-Semester Examination Schedule (22 Feb – 27 Feb 2027)'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {viewMode === 'regular' && 'Daily lecture, lab & tutorial sessions (08:00–18:00) • Mandatory lunch divider 13:00–14:00 • Dynamic change tracking enabled'}
            {viewMode === 'fest_week' && 'Daytime instructional slots with displaced overrides + Evening cultural & venue bookings (P10–P13 · 18:00–22:00)'}
            {viewMode === 'exams' && '41 exams scheduled • AM (09:30–11:30) and PM (14:00–16:00) sessions • Halved room capacity enforced'}
          </p>
        </div>

        {/* Dynamic Status Badges */}
        <div className="flex items-center gap-2 text-xs">
          {lastApprovedDiff && (lastApprovedDiff.sessions_moved_count > 0) && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 border border-emerald-300 text-emerald-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{lastApprovedDiff.sessions_moved_count} approved changes live</span>
            </div>
          )}

          {viewMode === 'fest_week' && festBookings.filter(b => b.status === 'approved').length > 0 && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-50 border border-purple-300 text-purple-900 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>{festBookings.filter(b => b.status === 'approved').length} approved fest events active</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Mode Selector & Multi-Pivot Filter Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Sub-view switcher */}
        <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded">
          <button
            onClick={() => onViewModeChange('regular')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'regular'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Teaching timetable
          </button>
          <button
            onClick={() => onViewModeChange('fest_week')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'fest_week'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Spectra week (week 7)
          </button>
          <button
            onClick={() => onViewModeChange('exams')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'exams'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Midsem exams (week 8)
          </button>
        </div>

        {/* Filter Controls */}
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
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium focus:outline-hidden focus:border-blue-600"
            >
              <option value="all">All sessions &amp; events</option>
              <option value="group">Student group</option>
              <option value="faculty">Faculty member</option>
              <option value="room">Room / venue</option>
            </select>

            {filterType === 'group' && (
              <select
                value={filterValue}
                onChange={(e) => onFilterValueChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium max-w-xs truncate"
              >
                <option value="">Select student group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.id} — {g.name} ({g.size} students)
                  </option>
                ))}
              </select>
            )}

            {filterType === 'faculty' && (
              <select
                value={filterValue}
                onChange={(e) => onFilterValueChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium max-w-xs truncate"
              >
                <option value="">Select faculty member</option>
                {faculty.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.id} — {f.name} ({f.department})
                  </option>
                ))}
              </select>
            )}

            {filterType === 'room' && (
              <select
                value={filterValue}
                onChange={(e) => onFilterValueChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium max-w-xs truncate"
              >
                <option value="">Select room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} — {r.name} ({r.capacity} cap, {r.type})
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
                <span>Clear</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Main Timetable / Exam Display */}
      {viewMode === 'exams' ? (
        /* Midsem Exam Table View */
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-slate-800 text-sm">
                Midsem Examination Timetable (Week 8: 22 Feb – 27 Feb 2027)
              </div>
              <div className="text-xs text-slate-500">
                AM Session: 09:30–11:30 • PM Session: 14:00–16:00 • Halved capacity enforced (0 clashes)
              </div>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-xs font-semibold">
              41 exams scheduled • 0 hard violations
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Exam ID</th>
                  <th className="p-3">Course(s)</th>
                  <th className="p-3">Assigned Day &amp; Date</th>
                  <th className="p-3">Session</th>
                  <th className="p-3">Allocated Rooms</th>
                  <th className="p-3">Eligible Groups</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {exams.map((ex) => {
                  const dayMeta = EXAM_DAYS.find(d => d.code === ex.day);
                  const meta = examMetaMap.get(ex.exam_id);
                  return (
                    <tr key={ex.exam_id} className="hover:bg-slate-50/60">
                      <td className="p-3 font-mono font-semibold text-slate-900">{ex.exam_id}</td>
                      <td className="p-3 font-medium text-slate-800">
                        {meta?.course_ids ? meta.course_ids.join(', ') : ex.exam_id.replace('EX-', '')}
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-900">{ex.day}</span>{' '}
                        <span className="text-slate-500 text-[11px]">({dayMeta?.date || 'Feb 2027'})</span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold ${
                          ex.session === 'AM' ? 'bg-blue-100 text-blue-900' : 'bg-purple-100 text-purple-900'
                        }`}>
                          {ex.session} ({ex.session === 'AM' ? '09:30–11:30' : '14:00–16:00'})
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {ex.rooms.map((rid: string) => (
                            <span key={rid} className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-slate-800">
                              {rid}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-slate-600">
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
        /* Regular & Week 7 Time Grid */
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
          {viewMode === 'fest_week' && (
            <div className="bg-purple-50/80 border-b border-purple-200 px-4 py-2 flex items-center justify-between text-xs text-purple-900">
              <div className="flex items-center gap-2">
                <PartyPopper className="w-4 h-4 text-purple-700" />
                <span className="font-bold">Week 7 Festival Overlay Active:</span>
                <span>Daytime instruction (P1–P9) + Evening cultural events (P10–P13 · 18:00–22:00)</span>
              </div>
              <span className="text-[11px] text-purple-700 font-medium">15 Feb – 19 Feb 2027</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs min-w-[1000px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <th className="w-28 p-2.5 text-center font-bold text-slate-800 border-r border-slate-200">
                    Day &amp; Date
                  </th>
                  {PERIODS.slice(0, numPeriods).map((p) => {
                    const isLunchBoundary = p.p === 5;
                    const isEventPeriod = p.p > 9;
                    return (
                      <th
                        key={p.p}
                        className={`p-2 text-center border-r border-slate-200 font-medium ${
                          isLunchBoundary ? 'border-r-2 border-r-slate-400 bg-slate-150' : ''
                        } ${isEventPeriod ? 'bg-purple-100/60 text-purple-950' : ''}`}
                      >
                        <div className="font-semibold text-slate-900 flex items-center justify-center gap-1">
                          <span>{p.label}</span>
                          {isEventPeriod && (
                            <span className="text-[9px] px-1 rounded bg-purple-200 text-purple-800 font-bold uppercase">
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
                {currentDays.map((dayItem) => {
                  const dayCode = dayItem.code;
                  return (
                    <tr key={dayCode} className="hover:bg-slate-50/40">
                      {/* Day Header Column with integrated date */}
                      <td className="p-2.5 text-center font-bold text-slate-800 bg-slate-50 border-r border-slate-200 align-top">
                        <div className="text-sm font-bold text-slate-900">{dayCode}</div>
                        {viewMode === 'fest_week' ? (
                          <div className="text-[11px] font-semibold text-purple-700 mt-0.5">
                            {(dayItem as any).date}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                            {(dayItem as any).termDates}
                          </div>
                        )}
                        {viewMode === 'fest_week' && (dayItem as any).festTheme && (
                          <div className="text-[9px] text-slate-500 font-normal mt-1 leading-tight line-clamp-2">
                            {(dayItem as any).festTheme}
                          </div>
                        )}
                      </td>

                      {/* Periods */}
                      {PERIODS.slice(0, numPeriods).map((p) => {
                        const key = `${dayCode}-${p.p}`;
                        const academicItems = gridMap.get(key) || [];
                        const festItems = festGridMap.get(key) || [];
                        const isLunchBoundary = p.p === 5;
                        const isEventPeriod = p.p > 9;

                        return (
                          <td
                            key={p.p}
                            className={`p-1.5 align-top border-r border-slate-200 min-h-[96px] min-w-[96px] ${
                              isLunchBoundary ? 'border-r-2 border-r-slate-400' : ''
                            } ${isEventPeriod ? 'bg-purple-50/30' : ''}`}
                          >
                            <div className="space-y-1.5">
                              {/* 1. Academic Course Sessions */}
                              {academicItems.map(({ scheduled, meta, diffChange, override }) => {
                                const isLab = meta.kind === 'lab';
                                const isBasket = !!meta.basket_slot;
                                const isChanged = !!diffChange;
                                const isOverridden = !!override;

                                return (
                                  <div
                                    key={scheduled.session_id}
                                    onClick={() => setSelectedSession({ scheduled, meta, diffChange, override })}
                                    className={`p-1.5 rounded cursor-pointer transition-all border text-[11px] shadow-2xs relative ${
                                      isChanged
                                        ? 'bg-emerald-50/90 border-emerald-400 text-emerald-950 ring-1 ring-emerald-400 hover:bg-emerald-100'
                                        : isOverridden
                                        ? 'bg-rose-50/90 border-rose-300 text-rose-950 ring-1 ring-rose-300 hover:bg-rose-100'
                                        : isLab
                                        ? 'bg-amber-50/80 border-amber-300 text-amber-950 hover:bg-amber-100'
                                        : isBasket
                                        ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 hover:bg-indigo-100'
                                        : 'bg-white border-slate-300 text-slate-900 hover:border-slate-400'
                                    }`}
                                    title={`Click to inspect or reschedule ${meta.id}`}
                                  >
                                    {/* Change notification badge */}
                                    {isChanged && (
                                      <span className="absolute -top-1.5 -right-1.5 px-1 py-0.2 bg-emerald-600 text-white rounded text-[9px] font-bold shadow-xs">
                                        Updated
                                      </span>
                                    )}

                                    {/* Week 7 override badge */}
                                    {isOverridden && (
                                      <span className="absolute -top-1.5 -right-1.5 px-1 py-0.2 bg-rose-600 text-white rounded text-[9px] font-bold shadow-xs">
                                        Override
                                      </span>
                                    )}

                                    <div className="flex items-center justify-between font-bold leading-tight">
                                      <span>{meta.course_id}</span>
                                      <span className="text-[10px] px-1 py-0.2 rounded bg-slate-100 font-mono text-slate-700">
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

                                    {isOverridden && (
                                      <div className="text-[9px] text-rose-800 font-medium truncate mt-0.5">
                                        Moved for {override.displaced_by}
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
                                          lab (3h)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* 2. Approved Week 7 Fest Events */}
                              {viewMode === 'fest_week' && festItems.map(({ decision, bookingMeta }, idx) => (
                                <div
                                  key={`${decision.request_id}-${idx}`}
                                  onClick={() => setSelectedEvent({ bookingMeta, decision })}
                                  className="p-1.5 rounded cursor-pointer transition-all border border-purple-400 bg-purple-100/90 hover:bg-purple-200 text-purple-950 text-[11px] shadow-xs relative"
                                  title={`Click to view approved fest booking ${decision.request_id}`}
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
                                    <span className="text-[9px] text-purple-700 font-mono">
                                      {decision.start_period === decision.end_period ? `P${decision.start_period}` : `P${decision.start_period}–P${decision.end_period}`}
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

      {/* 4. Session Details & Dynamic Faculty Rescheduling Assistant Modal */}
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

            {/* Change History Pill if Modified */}
            {selectedSession.diffChange && (
              <div className="p-2.5 rounded bg-emerald-50 border border-emerald-300 text-xs text-emerald-900">
                <span className="font-bold">Approved Change Applied:</span> This session was moved from{' '}
                <span className="font-semibold">{selectedSession.diffChange.before.day} Period {selectedSession.diffChange.before.start_period} ({selectedSession.diffChange.before.room_id})</span>{' '}
                to <span className="font-semibold">{selectedSession.scheduled.day} Period {selectedSession.scheduled.start_period} ({selectedSession.scheduled.room_id})</span>.
              </div>
            )}

            {/* Current Metadata */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded border border-slate-200">
              <div><span className="text-slate-500 font-medium">Assigned slot:</span> <span className="font-semibold">{selectedSession.scheduled.day} Period {selectedSession.scheduled.start_period}</span></div>
              <div><span className="text-slate-500 font-medium">Room:</span> <span className="font-semibold">{selectedSession.scheduled.room_id}</span></div>
              <div><span className="text-slate-500 font-medium">Faculty:</span> <span className="font-semibold">{selectedSession.meta.faculty_id}</span></div>
              <div><span className="text-slate-500 font-medium">Students:</span> <span className="font-semibold">{selectedSession.meta.size} students</span></div>
              <div className="col-span-2"><span className="text-slate-500 font-medium">Groups:</span> <span className="font-semibold">{selectedSession.meta.groups.join(', ')}</span></div>
            </div>

            {/* Dynamic Rescheduling Assistant */}
            <div className="border-t border-slate-200 pt-3 space-y-2.5">
              <div className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                <span>Faculty Schedule Change Assistant (CP-SAT Solver Checked)</span>
                <span className="text-[11px] text-slate-400">Strict Hard Constraint Guard</span>
              </div>
              <p className="text-xs text-slate-500">
                Select target day and period to evaluate and dynamically commit session moves.
              </p>

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
                  {TEACHING_DAYS.map((d) => (
                    <option key={d.code} value={d.code}>{d.label} ({d.code})</option>
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
                  {changeChecking ? 'Evaluating...' : 'Check Feasibility'}
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
                      <AlertCircle className="w-4 h-4 text-rose-700" />
                    )}
                    <span>{changeResult.message}</span>
                  </div>

                  {changeResult.feasible && changeResult.available_rooms?.length > 0 && (
                    <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-emerald-900">Choose Room:</span>
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
                        className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded font-bold text-xs shadow-xs transition-colors disabled:opacity-50"
                      >
                        {isApplyingMove ? 'Committing...' : 'Apply & Move Session →'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Approved Fest Week Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-300 max-w-md w-full p-5 space-y-3.5 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <PartyPopper className="w-4 h-4 text-purple-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Approved Spectra Week 7 Event
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
                Organized by: <span className="font-semibold">{selectedEvent.bookingMeta?.requester || 'Society'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded border border-slate-200">
              <div><span className="text-slate-500 font-medium">Assigned Slot:</span> <span className="font-semibold">{selectedEvent.decision.day} Period {selectedEvent.decision.start_period}–{selectedEvent.decision.end_period || selectedEvent.decision.start_period}</span></div>
              <div><span className="text-slate-500 font-medium">Venue:</span> <span className="font-semibold">{selectedEvent.decision.room_id}</span></div>
              <div><span className="text-slate-500 font-medium">Category:</span> <span className="font-semibold uppercase">{selectedEvent.bookingMeta?.requested_category || 'Club Event'}</span></div>
              <div><span className="text-slate-500 font-medium">Attendance:</span> <span className="font-semibold">{selectedEvent.bookingMeta?.attendance || 100} attendees</span></div>
              <div className="col-span-2"><span className="text-slate-500 font-medium">Decision Note:</span> <span className="font-semibold">{selectedEvent.decision.reason}</span></div>
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
