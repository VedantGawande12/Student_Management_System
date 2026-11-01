import React, { useState } from 'react';
import { BookingRequest, BookingDecision, UserAccount } from '../../core/types';
import { canApproveBooking, canCancelBooking } from '../../core/permissions';
import { decideBooking, cancelBooking, explainDecision } from '../../core/api';
import { X, HelpCircle, Check, Ban } from 'lucide-react';

interface SpectraQueueViewProps {
  requests: BookingRequest[];
  decisions: BookingDecision[];
  currentUser: UserAccount | null;
  onRefresh: () => void;
}

export const SpectraQueueView: React.FC<SpectraQueueViewProps> = ({
  requests,
  decisions,
  currentUser,
  onRefresh
}) => {
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [explanationText, setExplanationText] = useState<string | null>(null);
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
    setExplainingId(req.id);
    setExplanationText(null);
    try {
      const res = await explainDecision(dec || { status: 'pending' }, req);
      setExplanationText(res.explanation);
    } catch (e: any) {
      setExplanationText('Failed to generate explanation.');
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden space-y-4 p-4">
      {/* Header and Queue Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {queueFilter === 'spectra'
              ? '🎪 Spectra Fest Week (Week 7) Venue Queue'
              : queueFilter === 'normal'
              ? '📚 Normal Teaching Weeks Venue Queue'
              : 'Campus Venue Queues & Decisions'}
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
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setQueueFilter('all')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              queueFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <span>All Requests</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${queueFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {requests.length}
            </span>
          </button>

          <button
            onClick={() => setQueueFilter('spectra')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              queueFilter === 'spectra'
                ? 'bg-purple-700 text-white shadow-sm'
                : 'text-purple-800 hover:bg-purple-100/70'
            }`}
          >
            <span>🎪 Spectra Fest (Week 7)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${queueFilter === 'spectra' ? 'bg-purple-900 text-white' : 'bg-purple-100 text-purple-800'}`}>
              {spectraRequests.length}
            </span>
          </button>

          <button
            onClick={() => setQueueFilter('normal')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              queueFilter === 'normal'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-blue-800 hover:bg-blue-100/70'
            }`}
          >
            <span>📚 Normal Teaching Weeks</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${queueFilter === 'normal' ? 'bg-blue-900 text-white' : 'bg-blue-100 text-blue-800'}`}>
              {normalRequests.length}
            </span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="bg-rose-50 border border-rose-300 rounded p-2.5 text-xs text-rose-800">
          {actionError}
        </div>
      )}

      {/* Requests Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100/75 text-slate-700 font-medium border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Req id</th>
              <th className="py-2.5 px-3">Queue & week</th>
              <th className="py-2.5 px-3">Event and requester</th>
              <th className="py-2.5 px-3">Category and role</th>
              <th className="py-2.5 px-3">Attendance</th>
              <th className="py-2.5 px-3">Requested window</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Assigned venue</th>
              <th className="py-2.5 px-3">Decision reason</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedRequests.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-500">
                  No venue requests in this queue. Submit a request using the Booking Copilot!
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
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    {/* ID */}
                    <td className="py-2.5 px-3 font-semibold font-mono text-slate-900">{req.id}</td>

                    {/* Queue Scope & Week */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {isSpectra ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                          🎪 Spectra (W7)
                        </span>
                      ) : isRecur ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                          🔄 Normal (Weekly)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                          📚 Normal (W{targetWk ?? 3})
                        </span>
                      )}
                    </td>

                    {/* Title & Requester */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{req.title}</div>
                      <div className="text-[11px] text-slate-500">{req.requester}</div>
                    </td>

                  {/* Category */}
                  <td className="py-2.5 px-3">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                      {req.requested_category.replace('_', ' ')}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-0.5">Role: {req.role}</div>
                  </td>

                  {/* Attendance */}
                  <td className="py-2.5 px-3 font-medium text-slate-700">
                    {req.attendance} pax ({req.duration_periods}h)
                  </td>

                  {/* Windows */}
                  <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                    {req.windows.map((w, idx) => (
                      <div key={idx}>{w.day} Period {w.from_period}–{w.to_period}</div>
                    ))}
                  </td>

                  {/* Status Badge */}
                  <td className="py-2.5 px-3">
                    {isApproved && (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-medium text-[11px] border border-emerald-300">
                        Approved
                      </span>
                    )}
                    {isAlt && (
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-medium text-[11px] border border-amber-300" title="Alternative offered (0.5x category weight)">
                        Alternative
                      </span>
                    )}
                    {isRejected && (
                      <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 font-medium text-[11px] border border-rose-300">
                        Rejected
                      </span>
                    )}
                  </td>

                  {/* Assigned Venue */}
                  <td className="py-2.5 px-3 font-mono text-slate-800">
                    {dec?.room_id ? (
                      <div>
                        <span className="font-semibold text-blue-900">{dec.room_id}</span>
                        <span className="text-[10px] text-slate-500 ml-1">
                          ({dec.day} P{dec.start_period}–P{dec.end_period})
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Reason */}
                  <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate" title={dec?.reason || ''}>
                    {dec?.reason || '—'}
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleExplain(req, dec)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition-colors"
                        title="Explain decision"
                      >
                        <HelpCircle className="w-3 h-3 text-slate-500" />
                        <span>Explain</span>
                      </button>

                      {allowApprove && status !== 'approved' && (
                        <button
                          onClick={() => handleApprove(req)}
                          className="px-2 py-1 text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded transition-colors font-medium"
                          title="Approve booking request"
                        >
                          Approve
                        </button>
                      )}

                      {allowApprove && status !== 'rejected' && (
                        <button
                          onClick={() => handleReject(req)}
                          className="px-2 py-1 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded transition-colors font-medium"
                          title="Reject booking request"
                        >
                          Reject
                        </button>
                      )}

                      {allowCancel && status !== 'rejected' && (
                        <button
                          onClick={() => handleCancel(req)}
                          className="px-2 py-1 text-[11px] bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded transition-colors"
                          title="Cancel booking"
                        >
                          Cancel
                        </button>
                      )}

                      {/* No self-approval indicator */}
                      {isSelf && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 font-mono border border-slate-200"
                          title="Conflict of Interest: Self-approval is strictly forbidden (requester != approver)."
                        >
                          Cannot self-approve
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>

      {/* Decision Explanation Modal */}
      {explainingId && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 max-w-md w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="text-sm font-bold text-slate-900">
                Decision explanation: {explainingId}
              </div>
              <button
                onClick={() => setExplainingId(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200">
              {explanationText || 'Computing explanation...'}
            </p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setExplainingId(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
