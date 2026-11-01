import React, { useState } from 'react';
import { useSchedule } from './hooks/useSchedule';
import { useRoleAuth } from './hooks/useRoleAuth';
import { useDisruptionDiff } from './hooks/useDisruptionDiff';

import { LoginPage } from './components/views/LoginPage';
import { RoleSwitcherBar } from './components/views/RoleSwitcherBar';
import { TimetableGridView } from './components/views/TimetableGridView';
import { BookingCopilotView } from './components/views/BookingCopilotView';
import { SpectraQueueView } from './components/views/SpectraQueueView';
import { DisruptionDiffModal } from './components/views/DisruptionDiffModal';

import { Calendar, Sparkles, Clock, FileText } from 'lucide-react';

export const App: React.FC = () => {
  const scheduleState = useSchedule();
  const auth = useRoleAuth(scheduleState.appState?.current_user);
  const disruption = useDisruptionDiff(scheduleState.refreshState);

  const [activeTab, setActiveTab] = useState<'timetables' | 'copilot' | 'spectra' | 'audit'>('timetables');

  // ── Auth gate: show login page when no user is authenticated ─────────────
  if (auth.loading && !auth.currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500 text-xs">
          <div className="w-7 h-7 border-2 border-slate-300 border-t-blue-700 rounded-full animate-spin" />
          <span>Restoring session…</span>
        </div>
      </div>
    );
  }

  if (!auth.currentUser) {
    return (
      <LoginPage
        onLogin={async (email, password) => {
          await auth.loginWithPassword(email, password);
          await scheduleState.refreshState();
        }}
        error={auth.error}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* 1. Institutional Role & Action Bar */}
      <RoleSwitcherBar
        currentUser={auth.currentUser || scheduleState.appState?.current_user || null}
        onSwitchUser={async (email) => {
          await auth.changeRole(email);
          scheduleState.refreshState();
        }}
        onLoginWithPassword={async (email, password) => {
          await auth.loginWithPassword(email, password);
          scheduleState.refreshState();
        }}
        onLogout={async () => {
          await auth.logoutUser();
          scheduleState.refreshState();
        }}
        onResetData={scheduleState.reset}
        onGenerateSchedule={scheduleState.generate}
        onApplySampleDisruption={() => disruption.apply()}
        isGenerating={scheduleState.generating}
        databaseStatus={scheduleState.appState?.database_status}
        onSyncDatabase={scheduleState.syncDb}
        isSyncingDb={scheduleState.syncingDb}
      />

      {/* 2. Section Navigation Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
          <nav className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('timetables')}
              className={`inline-flex items-center gap-1.5 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'timetables'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Timetables</span>
            </button>

            <button
              onClick={() => setActiveTab('copilot')}
              className={`inline-flex items-center gap-1.5 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'copilot'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Booking copilot</span>
            </button>

            <button
              onClick={() => setActiveTab('spectra')}
              className={`inline-flex items-center gap-1.5 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'spectra'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Venue queues ({scheduleState.bookings.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`inline-flex items-center gap-1.5 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'audit'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Audit trail</span>
            </button>
          </nav>

          {/* Institutional Metadata Tag */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500 whitespace-nowrap">
            <span>Dataset: <span className="font-medium text-slate-800">{scheduleState.appState?.dataset_summary?.dataset_id || 'cit-public-v1'}</span></span>
            <span>/</span>
            <span>Sessions: <span className="font-medium text-slate-800">{scheduleState.appState?.dataset_summary?.sessions_count || 189}</span></span>
          </div>
        </div>
      </div>

      {/* 3. Main Views Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-5">
        {scheduleState.loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-700 rounded-full animate-spin"></div>
            <span>Loading schedule state...</span>
          </div>
        ) : (
          <div className="mom-animate-fade-up">
            {activeTab === 'timetables' && (
              <TimetableGridView
                sessions={scheduleState.activeSessions}
                sessionMeta={scheduleState.appState?.sessions || []}
                rooms={scheduleState.rooms}
                faculty={scheduleState.faculty}
                groups={scheduleState.groups}
                exams={scheduleState.exams}
                examsMeta={scheduleState.appState?.exams_meta}
                viewMode={scheduleState.viewMode}
                onViewModeChange={scheduleState.setViewMode}
                currentUser={auth.currentUser || scheduleState.appState?.current_user || null}
                filterType={scheduleState.filterType}
                filterValue={scheduleState.filterValue}
                onFilterTypeChange={scheduleState.setFilterType}
                onFilterValueChange={scheduleState.setFilterValue}
                festBookings={scheduleState.festDecisions}
                bookingRequests={scheduleState.bookings}
                sessionOverrides={scheduleState.sessionOverrides}
                lastApprovedDiff={scheduleState.lastApprovedDiff}
                validatorReport={scheduleState.appState?.validator_report || null}
                onRefresh={scheduleState.refreshState}
              />
            )}

            {activeTab === 'copilot' && (
              <BookingCopilotView
                currentUser={auth.currentUser || scheduleState.appState?.current_user || null}
                onBookingSubmitted={scheduleState.refreshState}
              />
            )}

            {activeTab === 'spectra' && (
              <SpectraQueueView
                requests={scheduleState.bookings}
                decisions={scheduleState.festDecisions}
                currentUser={auth.currentUser || scheduleState.appState?.current_user || null}
                onRefresh={scheduleState.refreshState}
              />
            )}

            {activeTab === 'audit' && (
              <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="font-semibold text-slate-900 text-xs">System audit logs</div>
                <div className="divide-y divide-slate-100 text-xs">
                  {(scheduleState.appState?.audit_logs || []).map((log, idx) => (
                    <div key={idx} className="py-2.5 flex items-start justify-between gap-3">
                      <div>
                        <span className="font-medium text-slate-900">{log.actor}:</span>{' '}
                        <span className="text-slate-700">{log.action}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 5. Minimal-Perturbation Disruption Diff Modal */}
      <DisruptionDiffModal
        isOpen={disruption.isOpen}
        onClose={() => disruption.setIsOpen(false)}
        diff={disruption.diff}
        onApprove={disruption.approve}
        onReject={disruption.reject}
        isApproving={disruption.approving}
        currentUser={auth.currentUser || scheduleState.appState?.current_user || null}
      />
    </div>
  );
};
