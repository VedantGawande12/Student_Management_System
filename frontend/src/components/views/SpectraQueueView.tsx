import React, { useState } from 'react';
import { BookingRequest, BookingDecision, UserAccount } from '../../core/types';
import { canApproveBooking, canCancelBooking } from '../../core/permissions';
import { decideBooking, cancelBooking, explainDecision } from '../../core/api';

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

  const decMap = new Map<string, BookingDecision>();
  for (const d of decisions) decMap.set(d.request_id, d);

  const handleApprove = async (req: BookingRequest) => {
    setActionError(null);
    try {
      await decideBooking({
        request_id: req.id,
        status: 'approved',
        reason: `Manually approved by ${currentUser?.name}`
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">
            Spectra Week (Week 7) Venue Queue & Decisions
          </h2>
          <p className="text-xs text-slate-500">
            Processed strictly in priority order ({'institute_event > guest_lecture > department_event > club_event'}). 0 Priority Inversions guaranteed.
          </p>
        </div>
        <div className="text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-medium text-slate-600">
          Total Requests: <strong className="text-slate-900">{requests.length}</strong>
        </div>
      </div>

      {actionError && (
        <div className="bg-rose-50 border border-rose-300 rounded p-2.5 text-xs text-rose-700 font-medium">
          {actionError}
        </div>
      )}

      {/* Requests Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100/75 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Req ID</th>
              <th className="py-2.5 px-3">Event / Requester</th>
              <th className="py-2.5 px-3">Category & Role</th>
              <th className="py-2.5 px-3">Attendance</th>
              <th className="py-2.5 px-3">Window</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Venue Assigned</th>
              <th className="py-2.5 px-3">Decision Reason</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map((req) => {
              const dec = decMap.get(req.id);
              const status = dec?.status || 'pending';
              const isApproved = status === 'approved';
              const isAlt = status === 'alternative_offered';
              const isRejected = status === 'rejected';

              const allowApprove = canApproveBooking(currentUser, req);
              const allowCancel = canCancelBooking(currentUser, req);
              const isSelf = req.requester === currentUser?.name || req.requester === currentUser?.email;

              return (
                <tr key={req.id} className="hover:bg-slate-50 transition">
                  {/* ID */}
                  <td className="py-2.5 px-3 font-bold font-mono text-slate-800">{req.id}</td>

                  {/* Title & Requester */}
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-900">{req.title}</div>
                    <div className="text-[11px] text-slate-500">{req.requester}</div>
                  </td>

                  {/* Category */}
                  <td className="py-2.5 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      req.requested_category === 'institute_event'
                        ? 'bg-purple-100 text-purple-800'
                        : req.requested_category === 'guest_lecture'
                        ? 'bg-blue-100 text-blue-800'
                        : req.requested_category === 'department_event'
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {req.requested_category.replace('_', ' ')}
                    </span>
                    <div className="text-[10px] text-slate-400 capitalize mt-0.5">Role: {req.role}</div>
                  </td>

                  {/* Attendance */}
                  <td className="py-2.5 px-3 font-medium text-slate-700">
                    {req.attendance} pax ({req.duration_periods}h)
                  </td>

                  {/* Windows */}
                  <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                    {req.windows.map((w, idx) => (
                      <div key={idx}>{w.day} P{w.from_period}–P{w.to_period}</div>
                    ))}
                  </td>

                  {/* Status Badge */}
                  <td className="py-2.5 px-3">
                    {isApproved && (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300">
                        Approved
                      </span>
                    )}
                    {isAlt && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-300" title="Alternative Offered (0.5x score)">
                        Alternative
                      </span>
                    )}
                    {isRejected && (
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] border border-rose-300">
                        Rejected
                      </span>
                    )}
                  </td>

                  {/* Venue Assigned */}
                  <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                    {dec?.room_id ? (
                      <div>
                        <span className="font-bold text-blue-700">{dec.room_id}</span>
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
                        className="px-2 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium transition"
                        title="View AI / deterministic explanation"
                      >
                        Explain
                      </button>

                      {allowCancel && status !== 'rejected' && (
                        <button
                          onClick={() => handleCancel(req)}
                          className="px-2 py-1 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-medium transition"
                        >
                          Cancel
                        </button>
                      )}

                      {/* No self-approval indicator */}
                      {isSelf && currentUser?.role !== 'admin' && (
                        <span className="text-[10px] text-slate-400 italic" title="Self-approval forbidden">
                          Own req
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Explanation Modal */}
      {explainingId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">
                Decision Explanation: {explainingId}
              </h3>
              <button
                onClick={() => setExplainingId(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
              {explanationText || 'Computing explanation...'}
            </p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setExplainingId(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
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

