import React, { useState } from 'react';
import { UserAccount, DatabaseStatus, TestCredential } from '../../core/types';
import {
  Shield,
  Play,
  AlertTriangle,
  RotateCcw,
  Database,
  LogOut,
  X,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface RoleSwitcherBarProps {
  currentUser: UserAccount | null;
  onSwitchUser: (email: string) => Promise<void> | void;
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
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  const handleManualSync = async () => {
    if (!onSyncDatabase) return;
    setSyncSuccessMsg(null);
    try {
      await onSyncDatabase();
      setSyncSuccessMsg('Successfully synced active dataset & schedule to Supabase');
    } catch (err: any) {
      console.error('Sync failed:', err);
    }
  };

  const isSupabaseLive = databaseStatus?.connected && databaseStatus?.mode === 'supabase';

  return (
    <>
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

          {/* Center: DB status */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDbModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors ${
                isSupabaseLive
                  ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title="Click to view database connection status and sync settings"
            >
              <Database className={`w-3 h-3 ${isSupabaseLive ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className="font-mono text-[11px]">
                {isSupabaseLive ? 'Supabase Live' : 'Local DB'}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSupabaseLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                }`}
              />
            </button>
          </div>

          {/* Right: Engine actions + user display */}
          <div className="flex items-center gap-2">
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

      {/* Supabase Connection Status Modal */}
      {isDbModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-300 max-w-md w-full p-5 space-y-3.5 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Supabase Database Status
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsDbModalOpen(false);
                  setSyncSuccessMsg(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {syncSuccessMsg && (
              <div className="p-2.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{syncSuccessMsg}</span>
              </div>
            )}

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Connection Mode:</span>
                  <span className={`font-semibold uppercase tracking-wider text-[11px] ${isSupabaseLive ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {databaseStatus?.mode || 'local_fallback'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <span className="font-medium text-slate-800">
                    {databaseStatus?.connected ? 'Online & Connected' : 'Local Storage Fallback'}
                  </span>
                </div>
                {databaseStatus?.url && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Supabase Host:</span>
                    <span className="font-mono text-slate-700 text-[11px]">{databaseStatus.url}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Last Synced:</span>
                  <span className="font-mono text-slate-700 text-[11px]">
                    {databaseStatus?.last_synced ? new Date(databaseStatus.last_synced).toLocaleString() : 'Ready'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                {databaseStatus?.message ||
                  'The application is seamlessly paired with Supabase PostgreSQL (schema.sql). When credentials are present in .env, tables are synchronized automatically.'}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-[11px] text-slate-400">
                {currentUser?.role === 'admin' ? 'Admin action' : 'Admin sync only'}
              </span>
              <div className="flex items-center gap-2">
                {currentUser?.role === 'admin' && onSyncDatabase && (
                  <button
                    onClick={handleManualSync}
                    disabled={isSyncingDb}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-700 hover:bg-blue-800 text-white font-medium rounded transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDb ? 'animate-spin' : ''}`} />
                    <span>{isSyncingDb ? 'Syncing...' : 'Sync to Supabase'}</span>
                  </button>
                )}
                <button
                  onClick={() => setIsDbModalOpen(false)}
                  className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
