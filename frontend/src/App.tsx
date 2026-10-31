import React, { useState } from 'react';
import { useSchedule } from './hooks/useSchedule';
import { useRoleAuth } from './hooks/useRoleAuth';
import { useDisruptionDiff } from './hooks/useDisruptionDiff';
import { useValidatorReport } from './hooks/useValidatorReport';

import { RoleSwitcherBar } from './components/views/RoleSwitcherBar';
import { ValidatorHudBar } from './components/views/ValidatorHudBar';
import { TimetableGridView } from './components/views/TimetableGridView';
import { BookingCopilotView } from './components/views/BookingCopilotView';
import { SpectraQueueView } from './components/views/SpectraQueueView';
import { DisruptionDiffModal } from './components/views/DisruptionDiffModal';

export const App: React.FC = () => {
  const scheduleState = useSchedule();
  const auth = useRoleAuth(scheduleState.appState?.current_user);
  const disruption = useDisruptionDiff(scheduleState.refreshState);
  const validatorHud = useValidatorReport(scheduleState.appState?.validator_report || null);

  const [activeTab, setActiveTab] = useState<'timetable' | 'copilot' | 'spectra' | 'audit'>('timetable');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* 1. Role Switcher Top Bar */}
      <RoleSwitcherBar
        currentUser={auth.currentUser || scheduleState.appState?.current_user || null}
        onSwitchUser={async (email) => {
          await auth.changeRole(email);
          scheduleState.refreshState();
        }}
        onResetData={scheduleState.reset}
        onGenerateSchedule={scheduleState.generate}
        onApplySampleDisruption={() => disruption.apply()}
        isGenerating={scheduleState.generating}
      />

      {/* 2. Live Validator HUD Bar */}
      <ValidatorHudBar
        report={validatorHud.report}
        hasAfterSchedule={!!scheduleState.appState?.disrupted_schedule}
      />

      {/* 3. Main Navigation Sub-Bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
          <nav className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('timetable')}
              className={`py-3 text-xs font-bold border-b-2 transition ${
                activeTab === 'timetable'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              📅 Schedule & Exams
            </button>
            <button
              onClick={() => setActiveTab('copilot')}
              className={`py-3 text-xs font-bold border-b-2 transition ${
                activeTab === 'copilot'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🤖 Booking Copilot (AI)
            </button>
            <button
              onClick={() => setActiveTab('spectra')}
              className={`py-3 text-xs font-bold border-b-2 transition ${
                activeTab === 'spectra'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🎪 Spectra Week Queue ({scheduleState.bookings.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`py-3 text-xs font-bold border-b-2 transition ${
                activeTab === 'audit'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              📋 Audit Trail
            </button>
          </nav>

          {/* Quick Notice */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
            <span>Dataset: <strong>{scheduleState.appState?.dataset_summary?.dataset_id || 'cit-public-v1'}</strong></span>
            <span>•</span>
            <span>Sessions: <strong>{scheduleState.appState?.dataset_summary?.sessions_count || 189}</strong></span>
          </div>
        </div>
      </div>

      {/* 4. Tab Views Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {scheduleState.loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-medium">Loading schedule state from FastAPI backend...</p>
          </div>
        ) : (
          <>
            {activeTab === 'timetable' && (
              <TimetableGridView
                sessions={scheduleState.activeSessions}
                sessionMeta={scheduleState.appState?.sessions || []}
                rooms={scheduleState.rooms}
                faculty={scheduleState.faculty}
                groups={scheduleState.groups}
                exams={scheduleState.exams}
                viewMode={scheduleState.viewMode}
                onViewModeChange={scheduleState.setViewMode}
                currentUser={auth.currentUser || scheduleState.appState?.current_user || null}
                filterType={scheduleState.filterType}
                filterValue={scheduleState.filterValue}
                onFilterTypeChange={scheduleState.setFilterType}
                onFilterValueChange={scheduleState.setFilterValue}
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
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <h3 className="font-bold text-slate-800 text-sm">System Audit Logs</h3>
                <div className="divide-y divide-slate-100 text-xs">
                  {(scheduleState.appState?.audit_logs || []).map((log, idx) => (
                    <div key={idx} className="py-2.5 flex items-start justify-between gap-3">
                      <div>
                        <span className="font-semibold text-slate-900">{log.actor}:</span>{' '}
                        <span className="text-slate-700">{log.action}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
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

