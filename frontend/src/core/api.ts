import {
  AppStateResponse,
  UserAccount,
  AIParseResult,
  BookingRequest,
  DisruptionDiff,
  FullSchedule
} from './types';

const API_BASE = '/api';

export async function fetchState(): Promise<AppStateResponse> {
  const res = await fetch(`${API_BASE}/state`);
  if (!res.ok) throw new Error(`Failed to fetch state: ${res.statusText}`);
  return res.json();
}

export async function switchUser(email: string): Promise<UserAccount> {
  const res = await fetch(`${API_BASE}/auth/switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  if (!res.ok) throw new Error(`Failed to switch user: ${res.statusText}`);
  return res.json();
}

export async function generateSchedule(): Promise<{ status: string; schedule: FullSchedule }> {
  const res = await fetch(`${API_BASE}/schedule/generate`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Schedule generation failed');
  }
  return res.json();
}

export async function applyDisruption(disruption?: any): Promise<{ status: string; diff: DisruptionDiff; disrupted_schedule: FullSchedule }> {
  const res = await fetch(`${API_BASE}/disruption/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(disruption || null)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to apply disruption');
  }
  return res.json();
}

export async function approveDisruption(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/disruption/approve`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to approve disruption');
  }
  return res.json();
}

export async function rejectDisruption(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/disruption/reject`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to reject disruption');
  }
  return res.json();
}

export async function resetDemoData(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/admin/reset`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`Failed to reset demo data: ${res.statusText}`);
  return res.json();
}

export async function parseBookingAI(text: string, current_day: string = 'MON'): Promise<AIParseResult> {
  const res = await fetch(`${API_BASE}/ai/parse-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, current_day })
  });
  if (!res.ok) throw new Error(`Failed to parse AI request: ${res.statusText}`);
  return res.json();
}

export async function submitBooking(bookingData: Partial<BookingRequest>): Promise<{ status: string; booking: BookingRequest }> {
  const res = await fetch(`${API_BASE}/bookings/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bookingData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to submit booking');
  }
  return res.json();
}

export async function decideBooking(decision: {
  request_id: string;
  status: string;
  day?: string;
  start_period?: number;
  end_period?: number;
  room_id?: string;
  reason?: string;
}): Promise<{ status: string; decision: any }> {
  const res = await fetch(`${API_BASE}/bookings/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(decision)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to decide booking');
  }
  return res.json();
}

export async function cancelBooking(requestId: string): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/bookings/cancel?request_id=${encodeURIComponent(requestId)}`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to cancel booking');
  }
  return res.json();
}

export async function checkFacultyChange(change: {
  session_id: string;
  preferred_day: string;
  preferred_start_period: number;
  note?: string;
}): Promise<{
  feasible: boolean;
  conflicts: string[];
  available_rooms: string[];
  message: string;
  proposed_slot: any;
}> {
  const res = await fetch(`${API_BASE}/ai/faculty-change`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(change)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to evaluate faculty change');
  }
  return res.json();
}

export async function explainDecision(decision: any, request: any): Promise<{ explanation: string }> {
  const res = await fetch(`${API_BASE}/ai/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, request })
  });
  if (!res.ok) throw new Error(`Failed to explain decision: ${res.statusText}`);
  return res.json();
}

