import React from 'react';
import { useBookingParser } from '../../hooks/useBookingParser';
import { UserAccount } from '../../core/types';
import { Sparkles, AlertTriangle, Info, Send } from 'lucide-react';

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
    <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-5">
      <div>
        <h2 className="text-base font-bold text-slate-900">
          Booking copilot and plain-language parser
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Submit venue requests in conversational English or Hinglish (e.g. &ldquo;kal shaam 6 baje, 2 ghante, mic chahiye&rdquo;). The parser extracts structured parameters and automatically evaluates venue accessibility.
        </p>
      </div>

      {/* Preset Prompts from sample_requests.md */}
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-slate-600">
          Sample test prompts (from sample_requests.md):
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => {
                parser.setInputText(prompt);
                parser.parseText(prompt);
              }}
              className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded transition-colors text-left font-normal"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Natural Language Input Box */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-700">
            Natural language request:
          </label>
          <span className="text-[11px] text-slate-500">
            Current role: <strong className="text-slate-800">{currentUser?.role.replace('_', ' ')}</strong> (role category cap enforced)
          </span>
        </div>
        <textarea
          rows={3}
          value={parser.inputText}
          onChange={(e) => parser.setInputText(e.target.value)}
          placeholder="e.g. Need seminar hall on Thursday 6 to 8 pm for 90 students with projector and mic..."
          className="w-full text-xs p-3 border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <button
            onClick={() => parser.parseText()}
            disabled={parser.isParsing || !parser.inputText.trim()}
            className="inline-flex items-center gap-1.5 text-xs bg-blue-700 hover:bg-blue-800 text-white px-3.5 py-1.5 rounded font-medium transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{parser.isParsing ? 'Parsing request...' : 'Parse with AI / NLP'}</span>
          </button>
          {parser.error && (
            <span className="text-xs text-rose-700 font-medium">{parser.error}</span>
          )}
        </div>
      </div>

      {/* Accessibility Alert & Follow-Up Notice */}
      {parser.roomWarning && (
        <div className="bg-amber-50 border border-amber-300 rounded p-3 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-900">Accessibility notice: </span>
            <span>{parser.roomWarning}</span>
          </div>
        </div>
      )}

      {parser.followUp && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-900 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-blue-900">Clarification required: </span>
            <span>{parser.followUp}</span>
          </div>
        </div>
      )}

      {/* Structured Editable Booking Form (Mandatory Manual Fallback) */}
      <div className="border-t border-slate-200 pt-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-800">
            Editable booking specification (manual fallback enabled)
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            Destination:{' '}
            {parser.recurrence === 'recurring' ? (
              <span className="text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded font-semibold">
                Normal Teaching Weeks Queue (Recurring)
              </span>
            ) : parser.targetWeek === 7 ? (
              <span className="text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded font-semibold">
                🎪 Spectra Fest Week 7 Queue
              </span>
            ) : (
              <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-semibold">
                📚 Normal Teaching Week {parser.targetWeek} Queue
              </span>
            )}
          </div>
        </div>

        {/* Recurrence & Target Week Configuration */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="font-semibold text-slate-700 block mb-1">Event recurrence:</span>
              <div className="inline-flex rounded-md shadow-sm border border-slate-300 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => parser.setRecurrence('once')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    parser.recurrence === 'once'
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Once (One-time event)
                </button>
                <button
                  type="button"
                  onClick={() => parser.setRecurrence('recurring')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    parser.recurrence === 'recurring'
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Recurring (Every week)
                </button>
              </div>
            </div>

            {parser.recurrence === 'once' ? (
              <div className="flex-1 min-w-[240px]">
                <label className="font-semibold text-slate-700 block mb-1">
                  Target week (Which week do you need this slot?):
                </label>
                <select
                  value={parser.targetWeek ?? 7}
                  onChange={(e) => parser.setTargetWeek(Number(e.target.value))}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none"
                >
                  <option value={7}>Week 7 — Spectra Cultural Fest Week (Enters Spectra Queue)</option>
                  <option value={1}>Week 1 — Normal Semester Teaching Week</option>
                  <option value={2}>Week 2 — Normal Semester Teaching Week</option>
                  <option value={3}>Week 3 — Normal Semester Teaching Week</option>
                  <option value={4}>Week 4 — Normal Semester Teaching Week</option>
                  <option value={5}>Week 5 — Normal Semester Teaching Week</option>
                  <option value={6}>Week 6 — Normal Semester Teaching Week</option>
                  <option value={8}>Week 8 — Normal Semester Teaching Week</option>
                  <option value={9}>Week 9 — Normal Semester Teaching Week</option>
                  <option value={10}>Week 10 — Normal Semester Teaching Week</option>
                  <option value={11}>Week 11 — Normal Semester Teaching Week</option>
                  <option value={12}>Week 12 — Normal Semester Teaching Week</option>
                  <option value={13}>Week 13 — Normal Semester Teaching Week</option>
                  <option value={14}>Week 14 — Normal Semester Teaching Week</option>
                </select>
              </div>
            ) : (
              <div className="flex-1 min-w-[240px] text-slate-600 text-[11px] flex items-center gap-1.5 bg-white p-2 rounded border border-slate-200">
                <span>🔄 <strong>Recurring weekly event:</strong> Automatically routed to the Normal Teaching Weeks Queue so classes are never displaced.</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Title */}
          <div className="sm:col-span-2">
            <label className="block text-slate-600 font-medium mb-1">Event title:</label>
            <input
              type="text"
              value={parser.title}
              onChange={(e) => parser.setTitle(e.target.value)}
              placeholder="e.g. CSE Farewell / Drama Rehearsal"
              className="w-full p-2 border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* Attendance */}
          <div>
            <label className="block text-slate-600 font-medium mb-1">Expected attendance:</label>
            <input
              type="number"
              value={parser.attendance}
              onChange={(e) => parser.setAttendance(Number(e.target.value))}
              className="w-full p-2 border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-slate-600 font-medium mb-1">Duration (periods):</label>
            <input
              type="number"
              min={1}
              max={13}
              value={parser.durationPeriods}
              onChange={(e) => parser.setDurationPeriods(Number(e.target.value))}
              className="w-full p-2 border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* Day */}
          <div>
            <label className="block text-slate-600 font-medium mb-1">Preferred day:</label>
            <select
              value={parser.day}
              onChange={(e) => parser.setDay(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white focus:border-blue-600 focus:outline-none"
            >
              {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Time Window From/To */}
          <div>
            <label className="block text-slate-600 font-medium mb-1">From period:</label>
            <select
              value={parser.fromPeriod}
              onChange={(e) => parser.setFromPeriod(Number(e.target.value))}
              className="w-full p-2 border border-slate-300 rounded bg-white focus:border-blue-600 focus:outline-none"
            >
              {Array.from({ length: 13 }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>Period {p} ({p <= 5 ? `${7 + p}:00` : `${8 + p}:00`})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">To period:</label>
            <select
              value={parser.toPeriod}
              onChange={(e) => parser.setToPeriod(Number(e.target.value))}
              className="w-full p-2 border border-slate-300 rounded bg-white focus:border-blue-600 focus:outline-none"
            >
              {Array.from({ length: 13 }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>Period {p}</option>
              ))}
            </select>
          </div>

          {/* Specific Room Request */}
          <div>
            <label className="block text-slate-600 font-medium mb-1">Requested room (optional):</label>
            <input
              type="text"
              value={parser.requestedRoom}
              onChange={(e) => parser.setRequestedRoom(e.target.value)}
              placeholder="e.g. SH-1, AUD, OAT"
              className="w-full p-2 border border-slate-300 rounded focus:border-blue-600 focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Needs & Equipment checkboxes */}
        <div className="space-y-1.5 text-xs">
          <label className="block text-slate-600 font-medium">Equipment and accessibility requirements:</label>
          <div className="flex flex-wrap gap-4">
            {[
              { id: 'projector', label: 'Projector' },
              { id: 'pa_system', label: 'PA / microphone' },
              { id: 'stage', label: 'Stage' },
              { id: 'accessible', label: 'Wheelchair accessible' },
              { id: 'ac', label: 'Air conditioning' }
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
                  className="rounded text-blue-700 focus:ring-0"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-2">
          {parser.successMessage && (
            <span className="text-xs text-emerald-800 font-medium bg-emerald-50 px-3 py-1 rounded border border-emerald-300">
              {parser.successMessage}
            </span>
          )}
          <button
            onClick={() => parser.submit()}
            disabled={parser.isSubmitting}
            className="ml-auto inline-flex items-center gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded font-medium transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{parser.isSubmitting ? 'Submitting booking...' : 'Submit booking request'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
