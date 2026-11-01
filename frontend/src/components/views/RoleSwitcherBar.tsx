import React from 'react';
import { UserAccount, DatabaseStatus } from '../../core/types';
import {
  Shield,
  Play,
  AlertTriangle,
  RotateCcw,
  LogOut,
  Database,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface RoleSwitcherBarProps {
  currentUser: UserAccount | null;
  onSwitchUser?: (email: string) => Promise<void> | void;
  onLoginWithPassword?: (email: string, password: string) => Promise<any>;
  onLogout?: () => Promise<void> | void;
  onResetData: () => void;
  onGenerateSchedule: () => void;
  onApplySampleDisruption: () => void;
  isGenerating?: boolean;
  databaseStatus?: DatabaseStatus;
  onSyncDatabase?: () => Promise<any>;
  isSyncingDb?: boolean;
}

export const RoleSwitcherBar: React.FC<RoleSwitcherBarProps> = ({
  currentUser,
  onLogout,
  onResetData,
  onGenerateSchedule,
  onApplySampleDisruption,
  isGenerating,
  databaseStatus,
  onSyncDatabase,
  isSyncingDb
}) => {
  return (
    <header className="bg-slate-900 text-slate-100 border-b border-slate-800 sticky top-0 z-40 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-900 border border-blue-700/60 flex items-center justify-center font-bold text-white text-xs">
            CIT
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100 leading-tight">
              Chilika Institute of Technology
            </div>
            <div className="text-xs text-slate-400">
              Campus Scheduling &amp; Venue Engine
            </div>
          </div>
        </div>

        {/* Right: Engine actions + user display */}
        <div className="flex items-center gap-2">
          {/* Database status pill */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border font-medium cursor-help transition-all ${databaseStatus?.mode === 'supabase' && databaseStatus?.writable
                ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300'
                : databaseStatus?.mode === 'rls_blocked'
                  ? 'bg-amber-950/70 border-amber-700 text-amber-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400'
              }`}
            title={databaseStatus?.message || 'Database status'}
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden md:inline">
              {databaseStatus?.mode === 'supabase' && databaseStatus?.writable
                ? 'Supabase Live'
                : databaseStatus?.mode === 'rls_blocked'
                  ? 'Supabase (RLS Blocked)'
                  : 'Local Mode'}
            </span>
            {databaseStatus?.mode === 'supabase' && databaseStatus?.writable ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ) : databaseStatus?.mode === 'rls_blocked' ? (
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            ) : null}
          </div>

          {/* Sync DB button */}
          {onSyncDatabase && (
            <button
              onClick={() => onSyncDatabase()}
              disabled={isSyncingDb}
              className="inline-flex items-center gap-1 text-xs bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/60 px-2 py-1.5 rounded font-medium transition-colors disabled:opacity-50 mr-1"
              title="Synchronize active dataset and schedule to Supabase"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncingDb ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncingDb ? 'Syncing...' : 'Sync DB'}</span>
            </button>
          )}

          {/* Admin-only engine controls */}
          {currentUser?.role === 'admin' && (
            <div className="flex items-center gap-1.5 border-r border-slate-700 pr-2 mr-1">
              <button
                onClick={onGenerateSchedule}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded font-medium transition-colors disabled:opacity-50"
                title="Run deterministic 4-stage CP-SAT solver"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isGenerating ? 'Solving...' : 'Solve Timetable'}</span>
              </button>
              <button
                onClick={onApplySampleDisruption}
                className="inline-flex items-center gap-1.5 text-xs bg-amber-700 hover:bg-amber-600 text-white px-2.5 py-1.5 rounded font-medium transition-colors"
                title="Simulate minimal perturbation disruption diff"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Disruption</span>
              </button>
              <button
                onClick={onResetData}
                className="inline-flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1.5 rounded border border-slate-700 transition-colors"
                title="Restore initial dataset and baseline schedule"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden lg:inline">Reset</span>
              </button>
            </div>
          )}

          {/* Current user display + sign-out */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-800 px-2.5 py-1.5 rounded border border-slate-700">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-100 leading-tight">
                  {currentUser?.name || 'Guest'}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {currentUser?.email || 'Not logged in'}
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded bg-slate-900 text-slate-200 border border-slate-700 font-medium">
                <Shield className="w-3 h-3 text-blue-400" />
                <span>{currentUser?.badge || currentUser?.role || 'Guest'}</span>
              </span>
            </div>

            {onLogout && currentUser && (
              <button
                onClick={() => onLogout()}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
