import React from 'react';
import { useBookingParser } from '../../hooks/useBookingParser';
import { UserAccount } from '../../core/types';

interface BookingCopilotViewProps {
  currentUser: UserAccount | null;
  onBookingSubmitted?: () => void;
}

const SAMPLE_PROMPTS = [
  'Need a room for 45 people on Tuesday 6 to 8 pm, projector please.',
  'Book the auditorium for the CSE department farewell, Friday evening, around 400 people, need stage and mic.',
  'Can I get a lab with computers for a 3-hour coding contest on Thursday afternoon? About 60 participants.',
  'seminar hall kal shaam 6 baje, 2 ghante, 100 log, mic chahiye',
  'I want SH-2 on Friday at 10 am for a wheelchair-accessible poster session, 60 people.',
  'Need somewhere for the quiz finals after lunch on Thursday, maybe 150 people.'
];

export const BookingCopilotView: React.FC<BookingCopilotViewProps> = ({
  currentUser,
  onBookingSubmitted
}) => {
  const parser = useBookingParser(onBookingSubmitted);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
      <div>
        <h2 className="text-base font-bold text-slate-800">
          Booking Copilot & Plain-Language Parser
        </h2>
        <p className="text-xs text-slate-500">
          Type venue requests in plain English or Hinglish (e.g. "kal shaam 6 baje, 2 ghante, mic chahiye"). The parser translates your request into an editable structured booking and detects constraints automatically.
        </p>
      </div>

      {/* Quick Prompts */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Quick Test Prompts (from sample_requests.md):
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => {
                parser.setInputText(prompt);
                parser.parseText(prompt);
              }}
              className="text-[11px] bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 px-2.5 py-1 rounded transition text-left"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Natural Language Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700">
            Natural Language Request (English / Hinglish):
          </label>
          <span className="text-[11px] text-slate-400">
            Active Role: <strong className="text-slate-700">{currentUser?.role.replace('_', ' ')}</strong> (Category capped automatically)
          </span>
        </div>
        <textarea
          rows={3}
          value={parser.inputText}
          onChange={(e) => parser.setInputText(e.target.value)}
          placeholder="e.g. Need seminar hall on Thursday 6 to 8 pm for 90 students with projector and mic..."
          className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans"
        />
        <div className="flex items-center justify-between">
          <button
            onClick={() => parser.parseText()}
            disabled={parser.isParsing || !parser.inputText.trim()}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold shadow-xs transition disabled:opacity-50"
          >
            {parser.isParsing ? 'Parsing Request...' : 'Parse with AI / Heuristics'}
          </button>
          {parser.error && (
            <span className="text-xs text-rose-600 font-medium">{parser.error}</span>
          )}
        </div>
      </div>

      {/* Alerts: Accessibility Warning Callout & Follow-up Banner */}
      {parser.roomWarning && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
          <span className="font-bold text-amber-700">⚠️ Accessibility Notice:</span>
          <span>{parser.roomWarning}</span>
        </div>
      )}

      {parser.followUp && (
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 text-xs text-blue-900 flex items-start gap-2">
          <span className="font-bold text-blue-700">ℹ️ Clarification Needed:</span>
          <span>{parser.followUp}</span>
        </div>
      )}

      {/* Editable Structured Booking Form (Mandatory Manual Fallback) */}
      <div className="border-t border-slate-200 pt-4 space-y-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Editable Booking Specification
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Title */}
          <div className="sm:col-span-2">
            <label className="block text-slate-600 font-medium mb-1">Event Title:</label>
            <input
              type="text"
              value={parser.title}
              onChange={(e) => parser.setTitle(e.target.value)}
              placeholder="e.g. CSE Farewell / Drama Rehearsal"
              className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Attendance */}
          <div>
            <label className="block text-slate-600 font-medium mb-1">Attendance (Pax):</label>
            <input
              type="number"
              value={parser.attendance}
              onChange={(e) => parser.setAttendance(Number(e.target.value))}
              className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-slate-600 font-medium mb-1">Duration (Periods):</label>
            <input
              type="number"
              min={1}
              max={13}
              value={parser.durationPeriods}
              onChange={(e) => parser.setDurationPeriods(Number(e.target.value))}
              className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Day */}
          <div>
            <label className="block text-slate-600 font-medium mb-1">Preferred Day:</label>
            <select
              value={parser.day}
              onChange={(e) => parser.setDay(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Time Window From/To */}
          <div>
            <label className="block text-slate-600 font-medium mb-1">From Period:</label>
            <select
              value={parser.fromPeriod}
              onChange={(e) => parser.setFromPeriod(Number(e.target.value))}
              className="w-full p-2 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              {Array.from({ length: 13 }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>P{p} ({p <= 5 ? `${7 + p}:00` : p <= 9 ? `${8 + p}:00` : `${8 + p}:00`})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">To Period:</label>
            <select
              value={parser.toPeriod}
              onChange={(e) => parser.setToPeriod(Number(e.target.value))}
              className="w-full p-2 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              {Array.from({ length: 13 }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>P{p}</option>
              ))}
            </select>
          </div>

          {/* Specific Room Request */}
          <div>
            <label className="block text-slate-600 font-medium mb-1">Requested Room (Optional):</label>
            <input
              type="text"
              value={parser.requestedRoom}
              onChange={(e) => parser.setRequestedRoom(e.target.value)}
              placeholder="e.g. SH-1, AUD, OAT"
              className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Needs & Equipment checkboxes */}
        <div className="space-y-1.5 text-xs">
          <label className="block text-slate-600 font-medium">Equipment & Accessibility Needs:</label>
          <div className="flex flex-wrap gap-3">
            {[
              { id: 'projector', label: 'Projector' },
              { id: 'pa_system', label: 'PA / Microphone' },
              { id: 'stage', label: 'Stage' },
              { id: 'accessible', label: 'Wheelchair Accessible' },
              { id: 'ac', label: 'Air Conditioning' }
            ].map(({ id, label }) => (
              <label key={id} className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={parser.needs.includes(id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      parser.setNeeds([...parser.needs, id]);
                    } else {
                      parser.setNeeds(parser.needs.filter((n) => n !== id));
                    }
                  }}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-between pt-2">
          {parser.successMessage && (
            <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded border border-emerald-300">
              {parser.successMessage}
            </span>
          )}
          <button
            onClick={() => parser.submit()}
            disabled={parser.isSubmitting}
            className="ml-auto text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg font-bold shadow transition disabled:opacity-50"
          >
            {parser.isSubmitting ? 'Submitting Booking...' : 'Submit Booking Request'}
          </button>
        </div>
      </div>
    </div>
  );
};

