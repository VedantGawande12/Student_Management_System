import React from 'react';
import { UserAccount } from '../../core/types';
import { Shield, Play, AlertTriangle, RotateCcw } from 'lucide-react';

interface RoleSwitcherBarProps {
  currentUser: UserAccount | null;
  onSwitchUser: (email: string) => void;
  onResetData: () => void;
  onGenerateSchedule: () => void;
  onApplySampleDisruption: () => void;
  isGenerating?: boolean;
}

const DEMO_USERS = [
  { email: 'admin@cit.edu.in', label: 'Admin (Dean)', role: 'Dean\'s Office' },
  { email: 'coord.cse@cit.edu.in', label: 'Coordinator', role: 'CSE Department' },
  { email: 'f12@cit.edu.in', label: 'Faculty (F12)', role: 'Dr. Amit Behera' },
  { email: 'dramatics@cit.edu.in', label: 'Club Rep', role: 'Dramatics Society' },
];

export const RoleSwitcherBar: React.FC<RoleSwitcherBarProps> = ({
  currentUser,
  onSwitchUser,
  onResetData,
  onGenerateSchedule,
  onApplySampleDisruption,
  isGenerating
}) => {
  return (
    <header className="bg-slate-900 text-slate-100 border-b border-slate-800 sticky top-0 z-40 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand - institutional calm typography */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-900 border border-blue-700/60 flex items-center justify-center font-bold text-white text-xs">
            CIT
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100 leading-tight">
              Chilika Institute of Technology
            </div>
            <div className="text-xs text-slate-400">
              Campus Scheduling & Venue Engine
            </div>
          </div>
        </div>

        {/* Demo Role Switcher */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded border border-slate-700">
          <span className="text-xs text-slate-400 px-2 font-normal">Active role:</span>
          {DEMO_USERS.map((user) => {
            const isActive = currentUser?.email === user.email;
            return (
              <button
                key={user.email}
                onClick={() => onSwitchUser(user.email)}
                className={`text-xs px-2.5 py-1 rounded transition-colors font-medium ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/70'
                }`}
                title={`Switch to ${user.role} (${user.email})`}
              >
                {user.label}
              </button>
            );
          })}
        </div>

        {/* Admin Engine Controls */}
        <div className="flex items-center gap-2">
          {currentUser?.role === 'admin' && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onGenerateSchedule}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isGenerating ? 'Solving...' : 'Solve Timetable'}</span>
              </button>
              <button
                onClick={onApplySampleDisruption}
                className="inline-flex items-center gap-1.5 text-xs bg-amber-700 hover:bg-amber-600 text-white px-3 py-1.5 rounded font-medium transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Simulate Disruption</span>
              </button>
              <button
                onClick={onResetData}
                className="inline-flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded border border-slate-700 transition-colors"
                title="Restore initial dataset and baseline schedule"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Demo</span>
              </button>
            </div>
          )}

          {/* Active User Indicator */}
          <div className="hidden sm:flex items-center gap-2 border-l border-slate-800 pl-3 ml-1">
            <div className="text-right">
              <div className="text-xs font-medium text-slate-200">
                {currentUser?.name || 'Guest'}
              </div>
              <div className="text-[11px] text-slate-400">
                {currentUser?.email}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
              <Shield className="w-3 h-3 text-slate-400" />
              <span>{currentUser?.role.replace('_', ' ')}</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
