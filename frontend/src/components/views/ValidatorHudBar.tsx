import React from 'react';
import { ValidatorReport } from '../../core/types';

interface ValidatorHudBarProps {
  report: ValidatorReport | null;
  onDownloadSchedule?: () => void;
  onDownloadAfterSchedule?: () => void;
  hasAfterSchedule?: boolean;
}

export const ValidatorHudBar: React.FC<ValidatorHudBarProps> = ({
  report,
  onDownloadSchedule,
  onDownloadAfterSchedule,
  hasAfterSchedule
}) => {
  const hardCount = report?.hard_violation_count ?? 0;
  const isClean = hardCount === 0 && (report?.bookings?.priority_inversions?.length || 0) === 0;
  const soft = report?.soft_penalties ?? { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0 };

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2.5 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Validator Verdict */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">validator.py Status:</span>
            {isClean ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-full border border-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                0 Hard Violations (Verified Valid)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 font-semibold px-2.5 py-1 rounded-full border border-rose-300">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                {hardCount} Hard Violations
              </span>
            )}
          </div>

          {/* Bookings & Priority Inversions */}
          {report?.bookings && (
            <div className="hidden md:flex items-center gap-2 border-l border-slate-200 pl-3">
              <span className="text-slate-500">Bookings Score:</span>
              <span className="font-bold text-slate-800">
                {report.bookings.booking_score} / {report.bookings.booking_score_max_if_all_approved}
              </span>
              <span className="text-slate-300">•</span>
              <span className={`px-2 py-0.5 rounded font-medium ${
                report.bookings.priority_inversions.length === 0
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {report.bookings.priority_inversions.length} Inversions
              </span>
            </div>
          )}

          {/* Exam Soft Penalty */}
          <div className="hidden lg:flex items-center gap-2 border-l border-slate-200 pl-3">
            <span className="text-slate-500">Exam Soft Penalty:</span>
            <span className="font-bold text-emerald-600">
              {report?.exam_soft_penalty ?? 0}
            </span>
          </div>
        </div>

        {/* Soft Penalties Breakdown */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 font-mono text-[11px]">
            <span className="text-slate-500 font-sans font-medium mr-1">Soft: {report?.soft_total ?? 0}</span>
            <span title="S1: Faculty Avoid Preferences" className="text-slate-700">S1:{soft.S1}</span>
            <span className="text-slate-300">|</span>
            <span title="S2: Student Schedule Gaps" className="text-slate-700">S2:{soft.S2}</span>
            <span className="text-slate-300">|</span>
            <span title="S3: Daily Hours > 6" className="text-slate-700">S3:{soft.S3}</span>
            <span className="text-slate-300">|</span>
            <span title="S4: Duplicate Lectures on Same Day" className="text-slate-700">S4:{soft.S4}</span>
            <span className="text-slate-300">|</span>
            <span title="S5: Room Underfill (<40%)" className="text-slate-700">S5:{soft.S5}</span>
            <span className="text-slate-300">|</span>
            <span title="S6: Late Period 9 Usage" className="text-slate-700">S6:{soft.S6}</span>
          </div>

          {/* Download Exports */}
          <div className="flex items-center gap-1.5">
            <a
              href="/api/export/schedule"
              download="schedule.json"
              className="px-2.5 py-1 text-slate-700 hover:text-blue-600 border border-slate-300 hover:border-blue-400 bg-white rounded font-medium transition"
              title="Download exports/schedule.json"
            >
              Export Baseline
            </a>
            <a
              href="/api/export/schedule-after"
              download="schedule_after.json"
              className="px-2.5 py-1 text-slate-700 hover:text-amber-600 border border-slate-300 hover:border-amber-400 bg-white rounded font-medium transition"
              title="Download exports/schedule_after.json"
            >
              Export Disrupted
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

