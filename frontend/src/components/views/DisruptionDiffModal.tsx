import React from 'react';
import { DisruptionDiff, UserAccount } from '../../core/types';

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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full p-5 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>Disruption Reschedule Diff</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                Minimal Perturbation
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Deterministic CP-SAT solver adjusted the minimum sessions necessary to accommodate disruptions.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg"
          >
            &times;
          </button>
        </div>

        {/* Diff Metric Summary Cards */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Moved</div>
            <div className="text-lg font-bold text-slate-800">{diff.sessions_moved_count}</div>
          </div>
          <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
            <div className="text-[10px] text-amber-700 font-semibold uppercase">Time Changed</div>
            <div className="text-lg font-bold text-amber-900">{diff.time_changed_count}</div>
          </div>
          <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-200">
            <div className="text-[10px] text-blue-700 font-semibold uppercase">Room Only</div>
            <div className="text-lg font-bold text-blue-900">{diff.room_only_count}</div>
          </div>
        </div>

        {/* Changes Table */}
        <div className="overflow-y-auto flex-1 border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 text-[10px] uppercase">
              <tr>
                <th className="py-2 px-3">Session ID</th>
                <th className="py-2 px-3">Baseline Slot</th>
                <th className="py-2 px-3">New Slot</th>
                <th className="py-2 px-3">Change Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {diff.changes.map((item) => (
                <tr key={item.session_id} className="hover:bg-slate-50 font-mono text-[11px]">
                  <td className="py-2 px-3 font-bold text-slate-800">{item.session_id}</td>
                  <td className="py-2 px-3 text-slate-600">
                    {item.before.day} P{item.before.start_period} • <span className="font-semibold text-slate-700">{item.before.room_id}</span>
                  </td>
                  <td className="py-2 px-3 text-blue-700 font-bold">
                    {item.after.day} P{item.after.start_period} • <span className="font-semibold">{item.after.room_id}</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                      item.type === 'room_only'
                        ? 'bg-blue-100 text-blue-800'
                        : item.type === 'time_only'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
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
              <span>Approving will commit these changes to active schedule.</span>
            ) : (
              <span className="text-amber-600 font-medium">Admin permission required to approve diff.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onReject}
              className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 border border-slate-300 rounded font-medium transition"
            >
              Discard Changes
            </button>
            {isAdmin && (
              <button
                onClick={onApprove}
                disabled={isApproving}
                className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold shadow transition disabled:opacity-50"
              >
                {isApproving ? 'Committing...' : 'Approve & Commit Changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

