import React from 'react';
import { DisruptionDiff, UserAccount } from '../../core/types';
import { X, ArrowRight, Check } from 'lucide-react';

interface DisruptionDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  diff: DisruptionDiff | null;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  currentUser: UserAccount | null;
}

export const DisruptionDiffModal: React.FC<DisruptionDiffModalProps> = ({
  isOpen,
  onClose,
  diff,
  onApprove,
  onReject,
  isApproving,
  currentUser
}) => {
  if (!isOpen || !diff) return null;

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg border border-slate-200 max-w-2xl w-full p-5 space-y-4 max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <span>Disruption reschedule diff</span>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-900 border border-amber-300">
                minimal perturbation
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              CP-SAT solver adjusted the minimum sessions necessary to accommodate disruptions with zero hard violations.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diff Metric Summary Cards */}
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <div className="text-slate-500 font-medium">Total sessions moved</div>
            <div className="text-lg font-bold text-slate-900 font-mono">{diff.sessions_moved_count}</div>
          </div>
          <div className="bg-amber-50 p-2.5 rounded border border-amber-200">
            <div className="text-amber-800 font-medium">Time changed</div>
            <div className="text-lg font-bold text-amber-950 font-mono">{diff.time_changed_count}</div>
          </div>
          <div className="bg-blue-50 p-2.5 rounded border border-blue-200">
            <div className="text-blue-800 font-medium">Room only changed</div>
            <div className="text-lg font-bold text-blue-950 font-mono">{diff.room_only_count}</div>
          </div>
        </div>

        {/* Changes Table */}
        <div className="overflow-y-auto flex-1 border border-slate-200 rounded">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-medium sticky top-0 border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">Session ID</th>
                <th className="py-2 px-3">Baseline slot</th>
                <th className="py-2 px-3">New slot</th>
                <th className="py-2 px-3">Change type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {diff.changes.map((item) => (
                <tr key={item.session_id} className="hover:bg-slate-50 font-mono text-[11px]">
                  <td className="py-2 px-3 font-semibold text-slate-900">{item.session_id}</td>
                  <td className="py-2 px-3 text-slate-600">
                    {item.before.day} Period {item.before.start_period} ({item.before.room_id})
                  </td>
                  <td className="py-2 px-3 text-blue-900 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 text-blue-600 shrink-0" />
                      <span>{item.after.day} Period {item.after.start_period} ({item.after.room_id})</span>
                    </span>
                  </td>
                  <td className="py-2 px-3 font-sans">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      item.type === 'room_only'
                        ? 'bg-blue-50 text-blue-800 border border-blue-200'
                        : item.type === 'time_only'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                      {item.type.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="text-xs text-slate-500">
            {isAdmin ? (
              <span>Approving will commit these minimal changes to the active schedule.</span>
            ) : (
              <span className="text-amber-800 font-medium">Admin authorization required to commit diff.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReject}
              className="px-3.5 py-1.5 text-xs text-slate-700 hover:text-slate-900 border border-slate-300 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700"
            >
              Discard changes
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={onApprove}
                disabled={isApproving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isApproving ? 'Committing...' : 'Approve and commit changes'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
