import {
  AppStateResponse,
  UserAccount,
  AIParseResult,
  BookingRequest,
  DisruptionDiff,
  FullSchedule,
  TestCredential,
  DatabaseStatus
} from './types';

export const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
const TOKEN_KEY = 'cit_auth_token';

let _memoryToken: string | null = null;

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || _memoryToken;
  } catch {
    return _memoryToken;
  }
}

export function setStoredToken(token: string): void {
  _memoryToken = token;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    // Explicitly clean any stale tokens from localStorage
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function clearStoredToken(): void {
  _memoryToken = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore
  }
}

function getAuthHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...customHeaders };
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchState(): Promise<AppStateResponse> {
  const res = await fetch(`${API_BASE}/state`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch state: ${res.statusText}`);
  return res.json();
}

export async function login(email: string, password: string): Promise<{ token: string; user: UserAccount }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Login failed');
  }
  const data = await res.json();
  if (data.token) {
    setStoredToken(data.token);
  }
  return data;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } finally {
    clearStoredToken();
  }
}

export async function fetchCurrentUser(): Promise<UserAccount | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      clearStoredToken();
      return null;
    }
    return res.json();
  } catch {
    return null;
  }
}

export async function getTestCredentials(): Promise<TestCredential[]> {
  const res = await fetch(`${API_BASE}/auth/test-credentials`);
  if (!res.ok) throw new Error('Failed to load test credentials');
  return res.json();
}

export async function switchUser(email: string): Promise<UserAccount> {
  const res = await fetch(`${API_BASE}/auth/switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  if (!res.ok) throw new Error(`Failed to switch user: ${res.statusText}`);
  const data = await res.json();
  if (data.token) {
    setStoredToken(data.token);
  }
  return data.user || data;
}

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  const res = await fetch(`${API_BASE}/database/status`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to check database status');
  return res.json();
}

export async function syncDatabase(): Promise<any> {
  const res = await fetch(`${API_BASE}/database/sync`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Database synchronization failed');
  }
  return res.json();
}

export async function generateSchedule(): Promise<{ status: string; schedule: FullSchedule }> {
  const res = await fetch(`${API_BASE}/schedule/generate`, {
    method: 'POST',
    headers: getAuthHeaders()
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
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to approve disruption');
  }
  return res.json();
}

export async function rejectDisruption(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/disruption/reject`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to reject disruption');
  }
  return res.json();
}

export async function resetDemoData(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/admin/reset`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Failed to reset demo data: ${res.statusText}`);
  return res.json();
}

export async function parseBookingAI(text: string, current_day?: string): Promise<AIParseResult> {
  const res = await fetch(`${API_BASE}/ai/parse-request`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ text, current_day })
  });
  if (!res.ok) throw new Error(`Failed to parse AI request: ${res.statusText}`);
  return res.json();
}

export async function submitBooking(bookingData: Partial<BookingRequest>): Promise<{ status: string; booking: BookingRequest }> {
  const res = await fetch(`${API_BASE}/bookings/submit`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
    method: 'POST',
    headers: getAuthHeaders()
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
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(change)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to evaluate faculty change');
  }
  return res.json();
}

export async function applySessionMove(payload: {
  session_id: string;
  day: string;
  start_period: number;
  room_id: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/schedule/move-session`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to move session');
  }
  return res.json();
}

export async function explainDecision(decision: any, request: any): Promise<{ explanation: string }> {
  const res = await fetch(`${API_BASE}/ai/explain`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ decision, request })
  });
  if (!res.ok) throw new Error(`Failed to explain decision: ${res.statusText}`);
  return res.json();
}
