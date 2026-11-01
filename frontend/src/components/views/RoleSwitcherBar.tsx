import React, { useState } from 'react';
import { UserAccount, DatabaseStatus, TestCredential } from '../../core/types';
import {
  Shield,
  Play,
  AlertTriangle,
  RotateCcw,
  Database,
  Lock,
  LogOut,
  X,
  CheckCircle2,
  Key,
  RefreshCw,
  ExternalLink
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

const TEST_CREDENTIALS: TestCredential[] = [
  {
    email: 'admin@cit.edu.in',
    password: 'Admin@123',
    role: 'admin',
    name: 'Prof. Shreya Kapoor',
    badge: 'Dean / Admin',
    description: 'Full authority: CP-SAT solver, disruptions, DB sync, configuration'
  },
  {
    email: 'coord.cse@cit.edu.in',
    password: 'Coord@123',
    role: 'department_coordinator',
    name: 'Dr. Rajesh Verma',
    badge: 'CSE Coordinator',
    description: 'Venue decisions & approvals (with strict NO self-approval enforcement)'
  },
  {
    email: 'f12@cit.edu.in',
    password: 'Faculty@123',
    role: 'faculty',
    name: 'Dr. Amit Behera',
    badge: 'Faculty (F12)',
    description: 'View schedule, request rescheduling for F12 sessions, submit academic bookings'
  },
  {
    email: 'dramatics@cit.edu.in',
    password: 'Club@123',
    role: 'club',
    name: 'Dramatics Society',
    badge: 'Club Rep',
    description: 'Fest week bookings via AI copilot, view available auditorium slots'
  }
];

export const RoleSwitcherBar: React.FC<RoleSwitcherBarProps> = ({
  currentUser,
  onSwitchUser,
  onLoginWithPassword,
  onLogout,
  onResetData,
  onGenerateSchedule,
  onApplySampleDisruption,
  isGenerating,
  databaseStatus,
  onSyncDatabase,
  isSyncingDb
}) => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  const handleSelectCredential = (cred: TestCredential) => {
    setInputEmail(cred.email);
    setInputPassword(cred.password);
    setAuthError(null);
  };

  const handleQuickLogin = async (cred: TestCredential) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      if (onLoginWithPassword) {
        await onLoginWithPassword(cred.email, cred.password);
      } else {
        await onSwitchUser(cred.email);
      }
      setIsAuthModalOpen(false);
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputEmail.trim() || !inputPassword.trim()) {
      setAuthError('Please enter both email and password');
      return;
    }
    setIsSubmitting(true);
    setAuthError(null);
    try {
      if (onLoginWithPassword) {
        await onLoginWithPassword(inputEmail.trim(), inputPassword.trim());
      } else {
        await onSwitchUser(inputEmail.trim());
      }
      setIsAuthModalOpen(false);
    } catch (err: any) {
      setAuthError(err.message || 'Invalid credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSync = async () => {
    if (!onSyncDatabase) return;
    setSyncSuccessMsg(null);
    try {
      await onSyncDatabase();
      setSyncSuccessMsg('Successfully synced active dataset & schedule to Supabase');
    } catch (err: any) {
      setAuthError(err.message || 'Sync failed');
    }
  };

  const isSupabaseLive = databaseStatus?.connected && databaseStatus?.mode === 'supabase';

  return (
    <>
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

          {/* Center: Database & Role controls */}
          <div className="flex items-center gap-2">
            {/* Supabase DB Status Badge */}
            <button
              onClick={() => setIsDbModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors ${
                isSupabaseLive
                  ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
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

            {/* Quick Role Switcher Chips */}
            <div className="hidden md:flex items-center gap-1 bg-slate-800/90 p-0.5 rounded border border-slate-700">
              {TEST_CREDENTIALS.map((cred) => {
                const isActive = currentUser?.email === cred.email;
                return (
                  <button
                    key={cred.email}
                    onClick={() => onSwitchUser(cred.email)}
                    className={`text-[11px] px-2.5 py-1 rounded transition-colors font-medium ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                    }`}
                    title={`Switch to ${cred.badge} (${cred.email})`}
                  >
                    {cred.badge}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Engine Actions & User Profile */}
          <div className="flex items-center gap-2">
            {/* High-Privilege Admin Engine Controls (Strictly Admin only) */}
            {currentUser?.role === 'admin' && (
              <div className="flex items-center gap-1.5 border-r border-slate-800 pr-2 mr-1">
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

            {/* Active User Indicator & Switch Modal Trigger */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-750 px-2.5 py-1.5 rounded border border-slate-700 text-left transition-colors"
                title="Click to view credentials, switch accounts, or log in"
              >
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
                <Key className="w-3.5 h-3.5 text-slate-400 hover:text-slate-200 ml-0.5" />
              </button>

              {onLogout && currentUser && (
                <button
                  onClick={() => onLogout()}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 1. Sign In & Test Credentials Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-300 max-w-lg w-full p-5 space-y-4 shadow-2xl text-slate-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-blue-700" />
                  Authentication & Role Access Control
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sign in or select pre-configured test credentials for the 4 designated roles.
                </p>
              </div>
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {authError && (
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {authError}
              </div>
            )}

            {/* Quick 1-Click Test Credentials */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                1-Click Test Credentials (Designated Roles)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TEST_CREDENTIALS.map((cred) => {
                  const isCurrent = currentUser?.email === cred.email;
                  return (
                    <div
                      key={cred.email}
                      className={`p-2.5 rounded border text-left flex flex-col justify-between transition-colors ${
                        isCurrent
                          ? 'border-blue-500 bg-blue-50/50'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs text-slate-900">
                            {cred.badge}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] text-blue-700 font-medium">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                          {cred.email}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Password: {cred.password}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                          {cred.description}
                        </p>
                      </div>

                      <div className="mt-2.5 flex items-center gap-1.5 pt-1.5 border-t border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => handleQuickLogin(cred)}
                          disabled={isSubmitting}
                          className="flex-1 py-1 px-2 text-[11px] bg-blue-700 hover:bg-blue-800 text-white font-medium rounded transition-colors text-center disabled:opacity-50"
                        >
                          Sign In
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectCredential(cred)}
                          className="py-1 px-2 text-[11px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded transition-colors"
                          title="Fill form inputs"
                        >
                          Fill
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Manual Form */}
            <form onSubmit={handleFormLogin} className="space-y-3 pt-2 border-t border-slate-200">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Or Sign In With Email & Password
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-600 font-medium mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={inputEmail}
                    onChange={(e) => setInputEmail(e.target.value)}
                    placeholder="user@cit.edu.in"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 focus:outline-hidden focus:border-blue-600 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 font-medium mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={inputPassword}
                    onChange={(e) => setInputPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 focus:outline-hidden focus:border-blue-600 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">
                  Tokens stored securely in localStorage
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-medium rounded transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Authenticating...' : 'Sign In'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Supabase Connection Status Modal */}
      {isDbModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
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

            {/* Sync button for Admins */}
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
