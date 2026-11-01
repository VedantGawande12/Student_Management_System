export type UserRole = 'admin' | 'department_coordinator' | 'faculty' | 'club';

export interface UserAccount {
  email: string;
  name: string;
  role: UserRole;
  department: string | null;
  faculty_id: string | null;
  badge: string;
}

export interface Room {
  id: string;
  name: string;
  building: string;
  type: string;
  capacity: number;
  features: string[];
  accessible: boolean;
  allowed_uses: string[];
}

export interface Faculty {
  id: string;
  name: string;
  department: string;
  max_hours_per_day: number;
  needs_accessible: boolean;
  unavailable: Array<{ day: string; periods: number[]; reason: string }>;
  preferences: Array<{ type: string; days?: string[]; periods: number[]; note?: string }>;
}

export interface StudentGroup {
  id: string;
  name: string;
  year: number;
  department: string;
  size: number;
  needs_accessible: boolean;
}

export interface SessionItem {
  id: string;
  course_id: string;
  kind: 'lecture' | 'tutorial' | 'lab';
  groups: string[];
  faculty_id: string;
  size: number;
  duration: number;
  room_types: string[];
  needs_accessible: boolean;
  basket_slot: string | null;
  fixed_slot: { day: string; start_period: number } | null;
}

export interface ScheduledSession {
  session_id: string;
  day: string;
  start_period: number;
  room_id: string;
}

export interface BookingRequest {
  id: string;
  submitted_at: string;
  requester: string;
  role: UserRole;
  department?: string | null;
  requested_category: string;
  title: string;
  attendance: number;
  duration_periods: number;
  windows: Array<{ day: string; from_period: number; to_period: number }>;
  room_types: string[];
  needs: string[];
  requested_room: string | null;
  mandatory_for_groups: string[];
  series_id: string | null;
  raw_text?: string;
}

export interface BookingDecision {
  request_id: string;
  status: 'approved' | 'rejected' | 'alternative_offered';
  day?: string;
  start_period?: number;
  end_period?: number;
  room_id?: string;
  reason?: string;
}

export interface SessionOverride {
  session_id: string;
  day: string;
  start_period: number;
  room_id: string;
  displaced_by: string;
}

export interface ExamScheduled {
  exam_id: string;
  day: string;
  session: 'AM' | 'PM';
  rooms: string[];
}

export interface FullSchedule {
  team: string;
  dataset_id: string;
  sessions: ScheduledSession[];
  fest_week: {
    bookings: BookingDecision[];
    session_overrides: SessionOverride[];
  };
  exams: ExamScheduled[];
}

export interface HardViolation {
  rule: string;
  where: string;
  detail: string;
}

export interface ValidatorReport {
  dataset_id: string;
  schedule_dataset_id: string;
  team: string;
  hard_violation_count: number;
  hard_by_rule: Record<string, number>;
  hard_violations: HardViolation[];
  soft_total: number;
  soft_penalties: {
    S1: number;
    S2: number;
    S3: number;
    S4: number;
    S5: number;
    S6: number;
  };
  bookings?: {
    booking_score: number;
    booking_score_max_if_all_approved: number;
    approved: number;
    alternatives: number;
    rejected: number;
    session_overrides: number;
    priority_inversions: string[];
  };
  exam_soft_penalty?: number;
  stability?: {
    sessions_moved: number;
    time_changed: number;
    room_only_changed: number;
    moved_ids: string[];
  };
  warnings: string[];
}

export interface DisruptionDiffItem {
  session_id: string;
  before: { day: string; start_period: number; room_id: string };
  after: { day: string; start_period: number; room_id: string };
  type: 'time_only' | 'room_only' | 'time_and_room';
}

export interface DisruptionDiff {
  sessions_moved_count: number;
  time_changed_count: number;
  room_only_count: number;
  changes: DisruptionDiffItem[];
}

export interface AuditLog {
  timestamp: string;
  actor: string;
  action: string;
  details: Record<string, any>;
}

export interface TestCredential {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  badge: string;
  description: string;
}

export interface DatabaseStatus {
  configured: boolean;
  connected: boolean;
  writable?: boolean;
  mode: 'supabase' | 'rls_blocked' | 'read_only' | 'local_fallback' | string;
  url?: string;
  key_type?: string;
  tables_count?: Record<string, number>;
  write_error?: string | null;
  last_synced?: string | null;
  message: string;
  error?: string;
}

export interface AppStateResponse {
  dataset_summary: {
    dataset_id: string;
    institute: string;
    rooms_count: number;
    faculty_count: number;
    sessions_count: number;
    groups_count: number;
    booking_requests_count: number;
    exams_count: number;
  };
  rooms: Room[];
  faculty: Faculty[];
  student_groups: StudentGroup[];
  sessions: SessionItem[];
  exams_meta?: Array<{ id: string; course_ids: string[]; groups: string[] }>;
  booking_requests: BookingRequest[];
  cancellations: Array<{ request_id: string; cancelled_at: string; by: string; note: string }>;
  active_schedule: FullSchedule | null;
  disrupted_schedule: FullSchedule | null;
  disruption_diff: DisruptionDiff | null;
  pending_disruption: any | null;
  last_approved_diff?: DisruptionDiff | null;
  validator_report: ValidatorReport | null;
  disruption_validator_report: ValidatorReport | null;
  current_user: UserAccount;
  audit_logs: AuditLog[];
  database_status?: DatabaseStatus;
}

export interface AIParseResult {
  attendance: number | null;
  duration_periods: number;
  windows: Array<{ day: string; from_period: number; to_period: number }>;
  room_types: string[];
  needs: string[];
  requested_room: string | null;
  mandatory_for_groups: string[];
  requested_category: string;
  effective_category: string;
  room_warning: string | null;
  follow_up: string | null;
  raw_text: string;
}

