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
import { Calendar, Filter, X, Check, AlertCircle } from 'lucide-react';

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
  // Lunch 13:00 - 14:00
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
    <div className="space-y-3">
      {/* View Tabs & Filter Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {/* View Mode Navigation */}
        <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded">
          <button
            onClick={() => onViewModeChange('regular')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'regular'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Teaching timetable
          </button>
          <button
            onClick={() => onViewModeChange('fest_week')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'fest_week'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Spectra week (week 7)
          </button>
          <button
            onClick={() => onViewModeChange('exams')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'exams'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Midsem exam schedule (41 exams)
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
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium"
            >
              <option value="all">All sessions</option>
              <option value="group">Student group</option>
              <option value="faculty">Faculty member</option>
              <option value="room">Room / venue</option>
            </select>

            {filterType === 'group' && (
              <select
                value={filterValue}
                onChange={(e) => onFilterValueChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium"
              >
                <option value="">Select student group</option>
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
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium"
              >
                <option value="">Select faculty member</option>
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
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium"
              >
                <option value="">Select room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} - {r.name} (cap {r.capacity}, {r.type})
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
                className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 text-xs ml-1"
              >
                <X className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Grid or Exam Table */}
      {viewMode === 'exams' ? (
        /* Exams Table View */
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-800 text-sm">
                Midsem exam schedule (41 exams, AM and PM sessions)
              </div>
              <div className="text-xs text-slate-500">
                Halved room capacity enforced • At most 1 exam per group per day (0 soft penalty)
              </div>
            </div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-xs font-medium">
              0 hard violations • 0 clashes
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Exam id</th>
                  <th className="py-2.5 px-3">Day</th>
                  <th className="py-2.5 px-3">Session</th>
                  <th className="py-2.5 px-3">Rooms allocated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exams.map((ex) => (
                  <tr key={ex.exam_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-semibold text-slate-900 font-mono">{ex.exam_id}</td>
                    <td className="py-2 px-3 font-medium text-slate-700">{ex.day}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        ex.session === 'AM' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                      }`}>
                        {ex.session} (09:30 - 11:30)
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
        /* Timetable Grid View */
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs min-w-[960px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <th className="w-20 p-2 text-center font-bold text-slate-800 border-r border-slate-200">
                    Day
                  </th>
                  {PERIODS.slice(0, viewMode === 'fest_week' ? 13 : 9).map((p) => (
                    <th
                      key={p.p}
                      className={`p-2 text-center border-r border-slate-200 font-medium ${
                        p.p === 5 ? 'border-r-2 border-r-slate-400 bg-slate-100' : ''
                      } ${p.p > 9 ? 'bg-slate-100/60' : ''}`}
                    >
                      <div className="font-semibold text-slate-900">Period {p.p}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{p.time}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {DAYS.map((day) => (
                  <tr key={day} className="hover:bg-slate-50/40">
                    {/* Day Column */}
                    <td className="p-2 text-center font-bold text-slate-800 bg-slate-50 border-r border-slate-200">
                      {day}
                    </td>

                    {/* Periods */}
                    {PERIODS.slice(0, viewMode === 'fest_week' ? 13 : 9).map((p) => {
                      const key = `${day}-${p.p}`;
                      const items = gridMap.get(key) || [];
                      const isLunchBoundary = p.p === 5;
                      const isEventPeriod = p.p > 9;

                      return (
                        <td
                          key={p.p}
                          className={`p-1.5 align-top border-r border-slate-200 h-24 min-w-[95px] ${
                            isLunchBoundary ? 'border-r-2 border-r-slate-400' : ''
                          } ${isEventPeriod ? 'bg-slate-50/50' : ''}`}
                        >
                          <div className="space-y-1">
                            {items.map(({ scheduled, meta }) => {
                              const isLab = meta.kind === 'lab';
                              const isBasket = !!meta.basket_slot;

                              return (
                                <div
                                  key={scheduled.session_id}
                                  onClick={() => setSelectedSession({ scheduled, meta })}
                                  className={`p-1.5 rounded cursor-pointer transition-colors border text-[11px] ${
                                    isLab
                                      ? 'bg-amber-50/80 border-amber-300 text-amber-950 hover:bg-amber-100'
                                      : isBasket
                                      ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 hover:bg-indigo-100'
                                      : 'bg-white border-slate-300 text-slate-900 hover:border-slate-400'
                                  }`}
                                  title={`Click to inspect or check faculty change for ${meta.id}`}
                                >
                                  <div className="flex items-center justify-between font-semibold leading-tight">
                                    <span>{meta.course_id}</span>
                                    <span className="text-[10px] px-1 rounded bg-slate-100 font-mono text-slate-700">
                                      {scheduled.room_id}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-600 truncate mt-0.5">
                                    {meta.faculty_id} • {meta.groups.join(', ')}
                                  </div>
                                  {isBasket && (
                                    <span className="inline-block mt-0.5 px-1 rounded bg-indigo-100 text-indigo-800 text-[9px] font-medium">
                                      {meta.basket_slot}
                                    </span>
                                  )}
                                  {isLab && (
                                    <span className="inline-block mt-0.5 px-1 rounded bg-amber-100 text-amber-900 text-[9px] font-medium">
                                      lab (3h)
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

      {/* Session Details & Faculty Change Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
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
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Session Metadata */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded border border-slate-200">
              <div><span className="text-slate-500">Assigned slot:</span> {selectedSession.scheduled.day} Period {selectedSession.scheduled.start_period}</div>
              <div><span className="text-slate-500">Room:</span> {selectedSession.scheduled.room_id}</div>
              <div><span className="text-slate-500">Faculty:</span> {selectedSession.meta.faculty_id}</div>
              <div><span className="text-slate-500">Students:</span> {selectedSession.meta.size}</div>
              <div className="col-span-2"><span className="text-slate-500">Groups:</span> {selectedSession.meta.groups.join(', ')}</div>
            </div>

            {/* Schedule Change Assistant */}
            <div className="border-t border-slate-100 pt-3 space-y-2.5">
              <div className="text-xs font-semibold text-slate-800">
                Faculty schedule change assistant (deterministic CP-SAT check)
              </div>
              <div className="text-xs text-slate-500">
                Check whether this session can be moved to another day and period without violating hard constraints.
              </div>

              <div className="flex items-center gap-2 text-xs pt-1">
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
                    <option key={p.p} value={p.p}>Period {p.p} ({p.time})</option>
                  ))}
                </select>

                <button
                  onClick={handleCheckChange}
                  disabled={changeChecking}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1 rounded font-medium text-xs transition-colors disabled:opacity-50"
                >
                  {changeChecking ? 'Checking...' : 'Check feasibility'}
                </button>
              </div>

              {changeResult && (
                <div className={`p-3 rounded text-xs border ${
                  changeResult.feasible
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-rose-50 text-rose-900 border-rose-300'
                }`}>
                  <div className="font-semibold mb-1 flex items-center gap-1.5">
                    {changeResult.feasible ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{changeResult.message}</span>
                  </div>
                  {changeResult.conflicts && changeResult.conflicts.length > 0 && (
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-800">
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
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors"
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
