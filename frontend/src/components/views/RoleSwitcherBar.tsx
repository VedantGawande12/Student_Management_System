import React from 'react';
import { UserAccount } from '../../core/types';

interface RoleSwitcherBarProps {
  currentUser: UserAccount | null;
  onSwitchUser: (email: string) => void;
  onResetData: () => void;
  onGenerateSchedule: () => void;
  onApplySampleDisruption: () => void;
  isGenerating?: boolean;
}

const DEMO_USERS = [
  { email: 'admin@cit.edu.in', label: 'Admin (Dean)', role: 'Dean\'s Office', badge: 'bg-purple-100 text-purple-800 border-purple-300' },
  { email: 'coord.cse@cit.edu.in', label: 'Coordinator', role: 'CSE Dept', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  { email: 'f12@cit.edu.in', label: 'Faculty (F12)', role: 'Dr. Amit Behera', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { email: 'dramatics@cit.edu.in', label: 'Club Rep', role: 'Dramatics Society', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
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
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 px-4 py-2.5 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-tr from-blue-600 to-teal-400 flex items-center justify-center font-bold text-white tracking-wider text-sm shadow">
            CIT
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-slate-100">
              Campus Scheduling & Venue Engine
            </h1>
            <p className="text-[11px] text-slate-400">
              Crunch Week Monorepo • Chilika Institute of Technology
            </p>
          </div>
        </div>

        {/* Demo Role Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-lg border border-slate-700/80">
          <span className="text-[11px] text-slate-400 px-2 font-medium">Demo Role:</span>
          {DEMO_USERS.map((user) => {
            const isActive = currentUser?.email === user.email;
            return (
              <button
                key={user.email}
                onClick={() => onSwitchUser(user.email)}
                className={`text-xs px-2.5 py-1 rounded transition-all font-medium ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
                title={`Switch to ${user.role} (${user.email})`}
              >
                {user.label}
              </button>
            );
          })}
        </div>

        {/* Quick Admin Actions */}
        <div className="flex items-center gap-2">
          {currentUser?.role === 'admin' && (
            <>
              <button
                onClick={onGenerateSchedule}
                disabled={isGenerating}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded font-medium shadow-sm transition disabled:opacity-50"
              >
                {isGenerating ? 'Solving...' : 'Solve Timetable'}
              </button>
              <button
                onClick={onApplySampleDisruption}
                className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded font-medium shadow-sm transition"
              >
                Test Disruption
              </button>
              <button
                onClick={onResetData}
                className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1.5 rounded font-medium transition"
                title="Restore initial cit_public.json and baseline schedule"
              >
                Reset Demo
              </button>
            </>
          )}

          {/* Active User Indicator */}
          <div className="hidden sm:flex items-center gap-2 border-l border-slate-700 pl-3 ml-1">
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-200 leading-tight">
                {currentUser?.name || 'Guest'}
              </div>
              <div className="text-[10px] text-slate-400">
                {currentUser?.email}
              </div>
            </div>
            <span className="inline-block px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-slate-800 text-teal-400 border border-teal-500/30">
              {currentUser?.role.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

