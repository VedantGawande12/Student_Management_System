import React from 'react';
import { ValidatorReport } from '../../core/types';
import { API_BASE } from '../../core/api';
import { CheckCircle2, AlertCircle, Download } from 'lucide-react';

interface ValidatorHudBarProps {
  report: ValidatorReport | null;
  onDownloadSchedule?: () => void;
  onDownloadAfterSchedule?: () => void;
  hasAfterSchedule?: boolean;
}

export const ValidatorHudBar: React.FC<ValidatorHudBarProps> = ({
  report,
  hasAfterSchedule
}) => {
  const hardCount = report?.hard_violation_count ?? 0;
  const isClean = hardCount === 0 && (report?.bookings?.priority_inversions?.length || 0) === 0;
  const soft = report?.soft_penalties ?? { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0 };

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Validator Verdict */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-600">Official validator status:</span>
            {isClean ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 font-medium px-2 py-0.5 rounded border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>0 hard violations (verified valid)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-800 font-medium px-2 py-0.5 rounded border border-rose-300">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>{hardCount} hard violations</span>
              </span>
            )}
          </div>

          {/* Bookings & Priority Inversions */}
          {report?.bookings && (
            <div className="hidden md:flex items-center gap-2 border-l border-slate-200 pl-3">
              <span className="text-slate-500">Bookings score:</span>
              <span className="font-semibold text-slate-900">
                {report.bookings.booking_score} / {report.bookings.booking_score_max_if_all_approved}
              </span>
              <span className="text-slate-300">/</span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                report.bookings.priority_inversions.length === 0
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {report.bookings.priority_inversions.length} inversions
              </span>
            </div>
          )}

          {/* Exam Soft Penalty */}
          <div className="hidden lg:flex items-center gap-1.5 border-l border-slate-200 pl-3">
            <span className="text-slate-500">Exam soft penalty:</span>
            <span className="font-semibold text-emerald-700">
              {report?.exam_soft_penalty ?? 0}
            </span>
          </div>
        </div>

        {/* Soft Penalties Breakdown & Exports */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-200 font-mono text-[11px] text-slate-700">
            <span className="font-sans font-medium text-slate-500 mr-1">Soft: {report?.soft_total ?? 0}</span>
            <span title="S1: Faculty preferences avoided">S1:{soft.S1}</span>
            <span className="text-slate-300">/</span>
            <span title="S2: Student schedule gaps">S2:{soft.S2}</span>
            <span className="text-slate-300">/</span>
            <span title="S3: Daily hours over 6">S3:{soft.S3}</span>
            <span className="text-slate-300">/</span>
            <span title="S4: Duplicate lectures of same course on same day">S4:{soft.S4}</span>
            <span className="text-slate-300">/</span>
            <span title="S5: Room capacity underfill (<40%)">S5:{soft.S5}</span>
            <span className="text-slate-300">/</span>
            <span title="S6: Late period 9 sessions">S6:{soft.S6}</span>
          </div>

          {/* Export Downloads */}
          <div className="flex items-center gap-1.5">
            <a
              href={`${API_BASE}/export/schedule`}
              download="schedule.json"
              className="inline-flex items-center gap-1 px-2 py-1 text-slate-700 hover:text-blue-700 border border-slate-300 hover:border-slate-400 bg-white rounded font-medium transition-colors"
              title="Download exports/schedule.json"
            >
              <Download className="w-3 h-3 text-slate-500" />
              <span>Baseline</span>
            </a>
            <a
              href={`${API_BASE}/export/schedule-after`}
              download="schedule_after.json"
              className="inline-flex items-center gap-1 px-2 py-1 text-slate-700 hover:text-amber-800 border border-slate-300 hover:border-slate-400 bg-white rounded font-medium transition-colors"
              title="Download exports/schedule_after.json"
            >
              <Download className="w-3 h-3 text-slate-500" />
              <span>Disrupted</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
