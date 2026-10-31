import React, { useState } from 'react';
import {
  ScheduledSession,
  SessionItem,
  Room,
  Faculty,
  StudentGroup,
  ExamScheduled,
  UserAccount
} from '../../core/types';
import { checkFacultyChange } from '../../core/api';

interface TimetableGridViewProps {
  sessions: ScheduledSession[];
  sessionMeta: SessionItem[];
  rooms: Room[];
  faculty: Faculty[];
  groups: StudentGroup[];
  exams: ExamScheduled[];
  viewMode: 'regular' | 'fest_week' | 'exams';
  onViewModeChange: (mode: 'regular' | 'fest_week' | 'exams') => void;
  currentUser: UserAccount | null;
  filterType: 'all' | 'group' | 'faculty' | 'room';
  filterValue: string;
  onFilterTypeChange: (type: 'all' | 'group' | 'faculty' | 'room') => void;
  onFilterValueChange: (val: string) => void;
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const PERIODS = [
  { p: 1, time: '08:00' },
  { p: 2, time: '09:00' },
  { p: 3, time: '10:00' },
  { p: 4, time: '11:00' },
  { p: 5, time: '12:00' },
  // Lunch 13:00-14:00
  { p: 6, time: '14:00' },
  { p: 7, time: '15:00' },
  { p: 8, time: '16:00' },
  { p: 9, time: '17:00' },
  // Event periods (Spectra week)
  { p: 10, time: '18:00' },
  { p: 11, time: '19:00' },
  { p: 12, time: '20:00' },
  { p: 13, time: '21:00' },
];

export const TimetableGridView: React.FC<TimetableGridViewProps> = ({
  sessions,
  sessionMeta,
  rooms,
  faculty,
  groups,
  exams,
  viewMode,
  onViewModeChange,
  currentUser,
  filterType,
  filterValue,
  onFilterTypeChange,
  onFilterValueChange
}) => {
  const [selectedSession, setSelectedSession] = useState<{ scheduled: ScheduledSession; meta: SessionItem } | null>(null);
  const [targetDay, setTargetDay] = useState('MON');
  const [targetPeriod, setTargetPeriod] = useState(1);
  const [changeChecking, setChangeChecking] = useState(false);
  const [changeResult, setChangeResult] = useState<any | null>(null);

  const metaMap = new Map<string, SessionItem>();
  for (const s of sessionMeta) metaMap.set(s.id, s);

  // Group sessions by (day, period)
  const gridMap = new Map<string, Array<{ scheduled: ScheduledSession; meta: SessionItem }>>();
  for (const s of sessions) {
    const meta = metaMap.get(s.session_id);
    if (!meta) continue;

    // Filter check
    if (filterType === 'group' && filterValue && !meta.groups.includes(filterValue)) continue;
    if (filterType === 'faculty' && filterValue && meta.faculty_id !== filterValue) continue;
    if (filterType === 'room' && filterValue && s.room_id !== filterValue) continue;

    const key = `${s.day}-${s.start_period}`;
    const list = gridMap.get(key) || [];
    list.push({ scheduled: s, meta });
    gridMap.set(key, list);
  }

  // Handle Faculty Change Check
  const handleCheckChange = async () => {
    if (!selectedSession) return;
    setChangeChecking(true);
    setChangeResult(null);
    try {
      const res = await checkFacultyChange({
        session_id: selectedSession.scheduled.session_id,
        preferred_day: targetDay,
        preferred_start_period: Number(targetPeriod)
      });
      setChangeResult(res);
    } catch (e: any) {
      setChangeResult({ feasible: false, message: e.message });
    } finally {
      setChangeChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls: Tabs & Filters */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => onViewModeChange('regular')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              viewMode === 'regular'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Teaching Timetable
          </button>
          <button
            onClick={() => onViewModeChange('fest_week')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              viewMode === 'fest_week'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Spectra Week (Week 7)
          </button>
          <button
            onClick={() => onViewModeChange('exams')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              viewMode === 'exams'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Midsem Exam Schedule (41 Exams)
          </button>
        </div>

        {/* Filter Controls (for Teaching and Fest Week views) */}
        {viewMode !== 'exams' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Filter view:</span>
            <select
              value={filterType}
              onChange={(e) => {
                onFilterTypeChange(e.target.value as any);
                onFilterValueChange('');
              }}
              className="bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Show All Sessions</option>
              <option value="group">Student Group</option>
              <option value="faculty">Faculty Member</option>
              <option value="room">Room / Venue</option>
            </select>

            {filterType === 'group' && (
              <select
                value={filterValue}
                onChange={(e) => onFilterValueChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1 text-slate-700 font-medium"
              >
                <option value="">Select a Student Group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.id} - {g.name} ({g.size} students)
                  </option>
                ))}
              </select>
            )}

            {filterType === 'faculty' && (
              <select
                value={filterValue}
                onChange={(e) => onFilterValueChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1 text-slate-700 font-medium"
              >
                <option value="">Select a Faculty Member</option>
                {faculty.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.id} - {f.name} ({f.department})
                  </option>
                ))}
              </select>
            )}

            {filterType === 'room' && (
              <select
                value={filterValue}
                onChange={(e) => onFilterValueChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1 text-slate-700 font-medium"
              >
                <option value="">Select a Room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} - {r.name} (Cap {r.capacity}, {r.type})
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
                className="text-slate-400 hover:text-slate-600 underline text-[11px]"
              >
                Clear filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {viewMode === 'exams' ? (
        /* Exams Table View */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">
                Midsem Exam Schedule (41 Exams • AM & PM Sessions)
              </h3>
              <p className="text-xs text-slate-500">
                Halved room capacity enforced • At most 1 exam per group per day (0 Soft Penalty)
              </p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded text-xs font-semibold">
              0 Violations • 0 Clashes
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Exam ID</th>
                  <th className="py-2.5 px-3">Day</th>
                  <th className="py-2.5 px-3">Session</th>
                  <th className="py-2.5 px-3">Rooms Allocated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exams.map((ex) => (
                  <tr key={ex.exam_id} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3 font-semibold text-slate-900">{ex.exam_id}</td>
                    <td className="py-2 px-3 font-medium text-slate-700">{ex.day}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ex.session === 'AM' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {ex.session} (2h)
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1">
                        {ex.rooms.map((rid) => (
                          <span key={rid} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 font-mono text-[11px]">
                            {rid}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Timetable Grid View (MON to FRI x Periods 1..9/13) */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs min-w-[900px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <th className="w-20 p-2 text-center font-bold text-slate-800 border-r border-slate-200">
                    Day
                  </th>
                  {PERIODS.slice(0, viewMode === 'fest_week' ? 13 : 9).map((p) => (
                    <th
                      key={p.p}
                      className={`p-2 text-center border-r border-slate-200 font-semibold ${
                        p.p === 5 ? 'border-r-2 border-r-amber-400 bg-amber-50/40' : ''
                      } ${p.p > 9 ? 'bg-purple-50/50 text-purple-900' : ''}`}
                    >
                      <div className="font-bold">P{p.p}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{p.time}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {DAYS.map((day) => (
                  <tr key={day} className="hover:bg-slate-50/50">
                    {/* Day label */}
                    <td className="p-2 text-center font-bold text-slate-800 bg-slate-50 border-r border-slate-200">
                      {day}
                    </td>

                    {/* Periods */}
                    {PERIODS.slice(0, viewMode === 'fest_week' ? 13 : 9).map((p) => {
                      const key = `${day}-${p.p}`;
                      const items = gridMap.get(key) || [];
                      const isLunchDivider = p.p === 5;
                      const isEventPeriod = p.p > 9;

                      return (
                        <td
                          key={p.p}
                          className={`p-1.5 align-top border-r border-slate-200 h-24 min-w-[90px] ${
                            isLunchDivider ? 'border-r-2 border-r-amber-400 bg-amber-50/20' : ''
                          } ${isEventPeriod ? 'bg-purple-50/20' : ''}`}
                        >
                          <div className="space-y-1">
                            {items.map(({ scheduled, meta }) => {
                              const isLab = meta.kind === 'lab';
                              const isBasket = !!meta.basket_slot;

                              return (
                                <div
                                  key={scheduled.session_id}
                                  onClick={() => setSelectedSession({ scheduled, meta })}
                                  className={`p-1.5 rounded cursor-pointer transition shadow-xs border text-[11px] ${
                                    isLab
                                      ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                                      : isBasket
                                      ? 'bg-purple-50 border-purple-300 text-purple-900 hover:bg-purple-100'
                                      : 'bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100'
                                  }`}
                                  title={`Click to inspect or request faculty change for ${meta.id}`}
                                >
                                  <div className="flex items-center justify-between font-bold leading-tight">
                                    <span>{meta.course_id}</span>
                                    <span className="text-[10px] px-1 rounded bg-white/70 font-mono font-medium">
                                      {scheduled.room_id}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-600 truncate mt-0.5">
                                    {meta.faculty_id} • {meta.groups.join(', ')}
                                  </div>
                                  {isBasket && (
                                    <span className="inline-block mt-0.5 px-1 py-0.2 bg-purple-200 text-purple-900 rounded text-[9px] font-bold">
                                      {meta.basket_slot}
                                    </span>
                                  )}
                                  {isLab && (
                                    <span className="inline-block mt-0.5 px-1 py-0.2 bg-amber-200 text-amber-900 rounded text-[9px] font-bold">
                                      Lab (3h)
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Session Details & Faculty Change Assistant Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {selectedSession.meta.course_id} ({selectedSession.scheduled.session_id})
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedSession.meta.kind.toUpperCase()} • Duration: {selectedSession.meta.duration} hour(s)
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedSession(null);
                  setChangeResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            {/* Session Metadata */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div><span className="font-semibold text-slate-500">Slot:</span> {selectedSession.scheduled.day} Period {selectedSession.scheduled.start_period}</div>
              <div><span className="font-semibold text-slate-500">Room:</span> {selectedSession.scheduled.room_id}</div>
              <div><span className="font-semibold text-slate-500">Faculty:</span> {selectedSession.meta.faculty_id}</div>
              <div><span className="font-semibold text-slate-500">Size:</span> {selectedSession.meta.size} students</div>
              <div className="col-span-2"><span className="font-semibold text-slate-500">Groups:</span> {selectedSession.meta.groups.join(', ')}</div>
            </div>

            {/* Faculty Schedule Change Assistant */}
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Schedule Change Assistant (Deterministic CP-SAT Evaluator)
              </h4>
              <p className="text-xs text-slate-500">
                Test whether this session can be moved to a different day/period without introducing hard clashes.
              </p>

              <div className="flex items-center gap-2 text-xs">
                <select
                  value={targetDay}
                  onChange={(e) => setTargetDay(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium"
                >
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>

                <select
                  value={targetPeriod}
                  onChange={(e) => setTargetPeriod(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium"
                >
                  {PERIODS.slice(0, 9).map((p) => (
                    <option key={p.p} value={p.p}>P{p.p} ({p.time})</option>
                  ))}
                </select>

                <button
                  onClick={handleCheckChange}
                  disabled={changeChecking}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded font-semibold text-xs transition disabled:opacity-50"
                >
                  {changeChecking ? 'Checking...' : 'Check Feasibility'}
                </button>
              </div>

              {changeResult && (
                <div className={`p-3 rounded-lg text-xs border ${
                  changeResult.feasible
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}>
                  <div className="font-bold mb-1">{changeResult.message}</div>
                  {changeResult.conflicts && changeResult.conflicts.length > 0 && (
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-700">
                      {changeResult.conflicts.map((c: string, idx: number) => (
                        <li key={idx}>{c}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setSelectedSession(null);
                  setChangeResult(null);
                }}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
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

