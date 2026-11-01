import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BookingRequest, BookingDecision, UserAccount } from '../../core/types';
import { canApproveBooking, canCancelBooking } from '../../core/permissions';
import { decideBooking, cancelBooking, explainDecision } from '../../core/api';
import { X, HelpCircle, Layers, Sparkles, BookOpen, Calendar, Repeat, CheckCircle2 } from 'lucide-react';

interface SpectraQueueViewProps {
  requests: BookingRequest[];
  decisions: BookingDecision[];
  currentUser: UserAccount | null;
  onRefresh: () => void;
}

interface ExplainingState {
  request: BookingRequest;
  decision?: BookingDecision;
  explanationText: string | null;
  isLoading: boolean;
}

export const SpectraQueueView: React.FC<SpectraQueueViewProps> = ({
  requests,
  decisions,
  currentUser,
  onRefresh
}) => {
  const [explainingState, setExplainingState] = useState<ExplainingState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<'all' | 'spectra' | 'normal'>('all');

  const decMap = new Map<string, BookingDecision>();
  for (const d of decisions) decMap.set(d.request_id, d);

  const isSpectraReq = (req: BookingRequest) =>
    req.week_scope === 'spectra' ||
    req.target_week === 7 ||
    (!req.week_scope && (req.target_week === undefined || req.target_week === null));

  const isNormalReq = (req: BookingRequest) =>
    req.week_scope === 'normal' ||
    req.recurrence === 'recurring' ||
    (req.target_week !== undefined && req.target_week !== null && req.target_week !== 7);

  const spectraRequests = requests.filter(isSpectraReq);
  const normalRequests = requests.filter(isNormalReq);

  const displayedRequests =
    queueFilter === 'all'
      ? requests
      : queueFilter === 'spectra'
      ? spectraRequests
      : normalRequests;

  // Close popup on Escape key and prevent background scroll while open
  useEffect(() => {
    if (!explainingState) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExplainingState(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [explainingState]);

  const handleApprove = async (req: BookingRequest) => {
    setActionError(null);
    try {
      await decideBooking({
        request_id: req.id,
        status: 'approved',
        reason: `Approved by ${currentUser?.name}`
      });
      onRefresh();
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const handleReject = async (req: BookingRequest) => {
    setActionError(null);
    try {
      await decideBooking({
        request_id: req.id,
        status: 'rejected',
        reason: `Rejected by ${currentUser?.name}`
      });
      onRefresh();
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const handleCancel = async (req: BookingRequest) => {
    setActionError(null);
    try {
      await cancelBooking(req.id);
      onRefresh();
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const handleExplain = async (req: BookingRequest, dec?: BookingDecision) => {
    setExplainingState({
      request: req,
      decision: dec,
      explanationText: null,
      isLoading: true
    });
    try {
      const res = await explainDecision(dec || { status: 'pending' }, req);
      setExplainingState((prev) =>
        prev && prev.request.id === req.id
          ? {
              ...prev,
              explanationText: res.explanation,
              isLoading: false
            }
          : prev
      );
    } catch (e: any) {
      setExplainingState((prev) =>
        prev && prev.request.id === req.id
          ? {
              ...prev,
              explanationText: 'Failed to compute decision explanation.',
              isLoading: false
            }
          : prev
      );
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
      {/* Header and Queue Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {queueFilter === 'spectra'
              ? 'Spectra Fest (Week 7) venue queue'
              : queueFilter === 'normal'
              ? 'Normal teaching weeks venue queue'
              : 'Campus venue queues and allocation decisions'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {queueFilter === 'spectra'
              ? 'Processed strictly in institutional priority order with cultural fest overrides. 0 priority inversions guaranteed.'
              : queueFilter === 'normal'
              ? 'Regular semester ad-hoc and recurring requests. Academic timetable classes are protected and never displaced.'
              : 'Unified view of all campus venue requests across normal academic teaching weeks and Spectra Fest.'}
          </p>
        </div>

        {/* Segmented Queue Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1 rounded border border-slate-200">
          <button
            type="button"
            onClick={() => setQueueFilter('all')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 ${
              queueFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All requests</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${queueFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {requests.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setQueueFilter('spectra')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700 ${
              queueFilter === 'spectra'
                ? 'bg-purple-800 text-white'
                : 'text-purple-800 hover:bg-purple-100/70'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Spectra Fest (Week 7)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${queueFilter === 'spectra' ? 'bg-purple-950 text-white' : 'bg-purple-100 text-purple-900'}`}>
              {spectraRequests.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setQueueFilter('normal')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
              queueFilter === 'normal'
                ? 'bg-blue-800 text-white'
                : 'text-blue-800 hover:bg-blue-100/70'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Normal teaching weeks</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${queueFilter === 'normal' ? 'bg-blue-950 text-white' : 'bg-blue-100 text-blue-900'}`}>
              {normalRequests.length}
            </span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="bg-rose-50 border border-rose-300 rounded p-2.5 text-xs text-rose-800" role="alert">
          {actionError}
        </div>
      )}

      {/* Streamlined Requests Table: Fits 100% in one window without horizontal scroll */}
      <div className="w-full">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3 w-[28%]">Request and event</th>
              <th className="py-2.5 px-3 w-[26%]">Schedule and queue</th>
              <th className="py-2.5 px-3 w-[26%]">Venue allocation and decision</th>
              <th className="py-2.5 px-3 w-[20%] text-right">Governance actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedRequests.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500">
                  No venue requests in this queue. Submit a request using the Booking Copilot.
                </td>
              </tr>
            ) : (
              displayedRequests.map((req) => {
                const dec = decMap.get(req.id);
                const status = dec?.status || 'pending';
                const isApproved = status === 'approved';
                const isAlt = status === 'alternative_offered';
                const isRejected = status === 'rejected';

                const allowApprove = canApproveBooking(currentUser, req);
                const allowCancel = canCancelBooking(currentUser, req);
                const isSelf = req.requester === currentUser?.name || req.requester === currentUser?.email;

                const isSpectra = isSpectraReq(req);
                const isRecur = req.recurrence === 'recurring';
                const targetWk = req.target_week;

                return (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Column 1: Request & Event */}
                    <td className="py-3 px-3 align-top">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold font-mono text-slate-900">{req.id}</span>
                        {isApproved && (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-medium text-[11px] border border-emerald-300">
                            Approved
                          </span>
                        )}
                        {isAlt && (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-medium text-[11px] border border-amber-300" title="Alternative offered (0.5x category weight)">
                            Alternative offered
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 font-medium text-[11px] border border-rose-300">
                            Rejected
                          </span>
                        )}
                        {!isApproved && !isAlt && !isRejected && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200">
                            Pending review
                          </span>
                        )}
                      </div>

                      <div className="font-semibold text-slate-900 leading-snug">
                        {req.title}
                      </div>

                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {req.requester} <span className="text-slate-400">/</span> {req.role}
                      </div>

                      <div className="mt-1">
                        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                          {req.requested_category.replace('_', ' ')}
                        </span>
                      </div>
                    </td>

                    {/* Column 2: Schedule & Queue Scope */}
                    <td className="py-3 px-3 align-top">
                      <div className="mb-1">
                        {isSpectra ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-800 border border-purple-200">
                            <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />
                            <span>Spectra Fest (Week 7)</span>
                          </span>
                        ) : isRecur ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-teal-800 border border-teal-200">
                            <Repeat className="w-3 h-3 text-teal-600 shrink-0" />
                            <span>Normal (Weekly Recurring)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                            <Calendar className="w-3 h-3 text-blue-600 shrink-0" />
                            <span>Normal (Week {targetWk ?? 3})</span>
                          </span>
                        )}
                      </div>

                      <div className="text-slate-700 font-mono text-[11px] leading-tight mt-1">
                        {req.windows.map((w, idx) => (
                          <div key={idx}>
                            {w.day} Period {w.from_period}–{w.to_period}
                          </div>
                        ))}
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1">
                        {req.attendance} attendees for {req.duration_periods} {req.duration_periods === 1 ? 'period' : 'periods'}
                      </div>
                    </td>

                    {/* Column 3: Venue Allocation & Decision Reason */}
                    <td className="py-3 px-3 align-top">
                      {dec?.room_id ? (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-blue-900 font-mono text-xs">
                            {dec.room_id}
                            <span className="text-slate-600 font-normal ml-1">
                              ({dec.day} Period {dec.start_period}–{dec.end_period})
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-400 text-xs">
                          No venue assigned
                        </div>
                      )}

                      {dec?.reason ? (
                        <div className="text-[11px] text-slate-600 mt-1.5 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100">
                          {dec.reason}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 mt-1">
                          Awaiting committee review
                        </div>
                      )}
                    </td>

                    {/* Column 4: Governance Actions */}
                    <td className="py-3 px-3 align-top text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleExplain(req, dec)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700"
                            title="Explain decision"
                          >
                            <HelpCircle className="w-3 h-3 text-slate-500" />
                            <span>Explain</span>
                          </button>

                          {allowApprove && status !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => handleApprove(req)}
                              className="px-2 py-1 text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                              title="Approve booking request"
                            >
                              Approve
                            </button>
                          )}

                          {allowApprove && status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleReject(req)}
                              className="px-2 py-1 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700"
                              title="Reject booking request"
                            >
                              Reject
                            </button>
                          )}

                          {allowCancel && status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleCancel(req)}
                              className="px-2 py-1 text-[11px] bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700"
                              title="Cancel booking"
                            >
                              Cancel
                            </button>
                          )}
                        </div>

                        {/* No self-approval indicator */}
                        {isSelf && (
                          <span
                            className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-right"
                            title="Conflict of interest: Self-approval is strictly forbidden (requester != approver)."
                          >
                            Cannot self-approve
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Decision Explanation Pop-up (Rendered into document.body via Portal) */}
      {explainingState &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setExplainingState(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="explain-popup-title"
          >
            <div
              className="bg-white rounded-lg border border-slate-300 max-w-lg w-full p-5 space-y-4 shadow-2xl text-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {explainingState.request.id}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                      Decision rationale
                    </span>
                  </div>
                  <h3 id="explain-popup-title" className="text-xs font-semibold text-slate-900 mt-1">
                    {explainingState.request.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setExplainingState(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700"
                  aria-label="Close explanation popup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Context Snapshot */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <span className="text-slate-500 font-medium">Requester:</span>{' '}
                  <span className="font-semibold text-slate-800">{explainingState.request.requester}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Role:</span>{' '}
                  <span className="font-semibold text-slate-800">{explainingState.request.role}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Category:</span>{' '}
                  <span className="font-semibold text-slate-800">
                    {explainingState.request.requested_category.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Status:</span>{' '}
                  <span className="font-semibold text-slate-800">
                    {explainingState.decision?.status || 'Pending review'}
                  </span>
                </div>
                {explainingState.decision?.room_id && (
                  <div className="col-span-2">
                    <span className="text-slate-500 font-medium">Assigned venue:</span>{' '}
                    <span className="font-mono font-semibold text-blue-900">
                      {explainingState.decision.room_id}
                    </span>{' '}
                    <span className="text-slate-600">
                      ({explainingState.decision.day} Period {explainingState.decision.start_period}–
                      {explainingState.decision.end_period})
                    </span>
                  </div>
                )}
              </div>

              {/* Deterministic Explanation Body */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-700">
                  System explanation:
                </div>
                <div className="p-3 bg-blue-50/70 rounded border border-blue-200 text-xs text-slate-800 leading-relaxed min-h-[72px]">
                  {explainingState.isLoading ? (
                    <div className="flex items-center gap-2 text-blue-800">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Computing deterministic rationale...</span>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{explainingState.explanationText}</p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-[11px] text-slate-500">
                  Evaluated against official CIT scheduling constraints and category priorities.
                </span>
                <button
                  type="button"
                  onClick={() => setExplainingState(null)}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
