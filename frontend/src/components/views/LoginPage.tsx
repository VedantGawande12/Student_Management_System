import React, { useState, useRef } from 'react';
import { Shield, Building2, BookOpen, Users } from 'lucide-react';
import './LoginPage.css';

export type RoleKey = 'admin' | 'department_coordinator' | 'faculty' | 'club';

interface RoleConfig {
  key: RoleKey;
  label: string;
  subLabel: string;
  email: string;
  password: string;
  icon: React.ReactNode;
  description: string;
  accessNote: string;
}

const ROLES: RoleConfig[] = [
  {
    key: 'admin',
    label: 'Admin',
    subLabel: "Dean's Office",
    email: 'admin@cit.edu.in',
    password: 'Admin@123',
    icon: <Shield className="w-5 h-5" />,
    description: 'Full authority over the CP-SAT solver, disruptions, and Supabase sync.',
    accessNote: 'Tier 1 — all controls',
  },
  {
    key: 'department_coordinator',
    label: 'Coordinator',
    subLabel: 'Dept / Labs',
    email: 'coord.cse@cit.edu.in',
    password: 'Coord@123',
    icon: <Building2 className="w-5 h-5" />,
    description: 'Review and approve venue requests; strict no self-approval enforcement.',
    accessNote: 'Tier 2 — approvals',
  },
  {
    key: 'faculty',
    label: 'Faculty',
    subLabel: 'Schedules & Swaps',
    email: 'f12@cit.edu.in',
    password: 'Faculty@123',
    icon: <BookOpen className="w-5 h-5" />,
    description: 'View timetable, evaluate slot feasibility, and submit academic bookings.',
    accessNote: 'Tier 3 — academic',
  },
  {
    key: 'club',
    label: 'Club Rep',
    subLabel: 'Spectra & Venues',
    email: 'dramatics@cit.edu.in',
    password: 'Club@123',
    icon: <Users className="w-5 h-5" />,
    description: 'Submit fest-week venue requests via the AI copilot; view Spectra slots.',
    accessNote: 'Tier 4 — fest booking',
  },
];

// ── Animated canvas panels ─────────────────────────────────────────────────
function AdminCanvas({ active }: { active: boolean }) {
  return (
    <div
      className="lp-canvas-panel"
      style={{ opacity: active ? 1 : 0, transition: 'opacity 0.45s ease' }}
      aria-hidden="true"
    >
      {/* Timetable grid illustration */}
      <div className="lp-grid-label">Monday</div>
      {[1, 2, 3, 4, 5, 6].map((row) => (
        <div key={row} className="lp-timetable-row">
          {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((day, i) => (
            <div
              key={day}
              className="lp-timetable-cell"
              style={{
                animationDelay: `${(row * 5 + i) * 80}ms`,
                opacity: active ? 1 : 0,
                transform: active ? 'scaleX(1)' : 'scaleX(0)',
                transition: `opacity 0.3s ease ${(row * 5 + i) * 50}ms, transform 0.3s ease ${(row * 5 + i) * 50}ms`,
              }}
            >
              {(row + i) % 4 === 0 && <span className="lp-cell-tag lp-cell-lab">LAB</span>}
              {(row + i) % 7 === 0 && <span className="lp-cell-tag lp-cell-lec">LEC</span>}
              {(row + i) % 5 === 0 && <span className="lp-cell-tag lp-cell-tut">TUT</span>}
            </div>
          ))}
        </div>
      ))}
      <div className="lp-canvas-badge">0 hard violations</div>
    </div>
  );
}

function CoordCanvas({ active }: { active: boolean }) {
  const bars = [85, 62, 94, 51, 78, 43, 88];
  return (
    <div
      className="lp-canvas-panel"
      style={{ opacity: active ? 1 : 0, transition: 'opacity 0.45s ease' }}
      aria-hidden="true"
    >
      <div className="lp-grid-label">Dept. venue utilisation</div>
      <div className="lp-bar-chart">
        {['CSE', 'ECE', 'MECH', 'CIVIL', 'EEE', 'IT', 'CHEM'].map((dept, i) => (
          <div key={dept} className="lp-bar-row">
            <span className="lp-bar-label">{dept}</span>
            <div className="lp-bar-track">
              <div
                className="lp-bar-fill"
                style={{
                  width: active ? `${bars[i]}%` : '0%',
                  transition: `width 0.6s cubic-bezier(0.22,1,0.36,1) ${i * 80}ms`,
                }}
              />
            </div>
            <span className="lp-bar-val">{bars[i]}%</span>
          </div>
        ))}
      </div>
      <div className="lp-canvas-badge">0 priority inversions</div>
    </div>
  );
}

function FacultyCanvas({ active }: { active: boolean }) {
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const slots = [
    [1, 0, 1, 0, 1],
    [0, 1, 0, 1, 0],
    [1, 1, 0, 0, 1],
    [0, 0, 1, 1, 0],
  ];
  return (
    <div
      className="lp-canvas-panel"
      style={{ opacity: active ? 1 : 0, transition: 'opacity 0.45s ease' }}
      aria-hidden="true"
    >
      <div className="lp-grid-label">F12 — Dr. Amit Behera</div>
      <div className="lp-faculty-grid">
        <div className="lp-faculty-header">
          {days.map((d) => (
            <span key={d} className="lp-fac-day">{d}</span>
          ))}
        </div>
        {slots.map((row, ri) => (
          <div key={ri} className="lp-faculty-row">
            {row.map((filled, ci) => (
              <div
                key={ci}
                className={`lp-fac-slot ${filled ? 'lp-fac-filled' : 'lp-fac-empty'}`}
                style={{
                  opacity: active ? 1 : 0,
                  transform: active ? 'scale(1)' : 'scale(0.8)',
                  transition: `opacity 0.25s ease ${(ri * 5 + ci) * 60}ms, transform 0.25s ease ${(ri * 5 + ci) * 60}ms`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="lp-canvas-badge">Rescheduling available</div>
    </div>
  );
}

function ClubCanvas({ active }: { active: boolean }) {
  const venues = [
    { id: 'AUD', name: 'Auditorium', cap: 800, status: 'free' },
    { id: 'SH-1', name: 'Seminar Hall 1', cap: 200, status: 'booked' },
    { id: 'SH-2', name: 'Seminar Hall 2', cap: 180, status: 'free' },
    { id: 'OAT', name: 'Open Air Theatre', cap: 500, status: 'free' },
    { id: 'LT-A', name: 'Lecture Theatre A', cap: 120, status: 'booked' },
  ];
  return (
    <div
      className="lp-canvas-panel"
      style={{ opacity: active ? 1 : 0, transition: 'opacity 0.45s ease' }}
      aria-hidden="true"
    >
      <div className="lp-grid-label">Spectra week venues</div>
      <div className="lp-venue-list">
        {venues.map((v, i) => (
          <div
            key={v.id}
            className="lp-venue-row"
            style={{
              opacity: active ? 1 : 0,
              transform: active ? 'translateY(0)' : 'translateY(8px)',
              transition: `opacity 0.3s ease ${i * 70}ms, transform 0.3s ease ${i * 70}ms`,
            }}
          >
            <span className="lp-venue-id">{v.id}</span>
            <span className="lp-venue-name">{v.name}</span>
            <span className="lp-venue-cap">{v.cap} cap.</span>
            <span className={`lp-venue-status ${v.status === 'free' ? 'lp-status-free' : 'lp-status-booked'}`}>
              {v.status}
            </span>
          </div>
        ))}
      </div>
      <div className="lp-canvas-badge">AI copilot enabled</div>
    </div>
  );
}

// ── Main LoginPage ─────────────────────────────────────────────────────────
interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
  error?: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, error }) => {
  const [selectedRole, setSelectedRole] = useState<RoleKey>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const selected = ROLES.find((r) => r.key === selectedRole)!;

  const handleSelectRole = (role: RoleConfig) => {
    setSelectedRole(role.key);
    setLocalError(null);
    // Keep email and password empty so user enters credentials
  };

  const handleFillDemo = () => {
    setEmail(selected.email);
    setPassword(selected.password);
    setLocalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLocalError('Please enter both your institutional email and password');
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    try {
      await onLogin(email.trim(), password.trim());
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="lp-root">
      {/* Left: animated role canvas */}
      <div className="lp-left" aria-hidden="true">
        {/* CIT wordmark */}
        <div className="lp-wordmark">
          <div className="lp-wordmark-badge">CIT</div>
          <div className="lp-wordmark-text">
            <span className="lp-wordmark-name">Chilika Institute of Technology</span>
            <span className="lp-wordmark-sub">Campus Scheduling & Venue Engine</span>
          </div>
        </div>

        {/* Animated visualisation swap */}
        <div className="lp-canvas-area">
          <AdminCanvas active={selectedRole === 'admin'} />
          <CoordCanvas active={selectedRole === 'department_coordinator'} />
          <FacultyCanvas active={selectedRole === 'faculty'} />
          <ClubCanvas active={selectedRole === 'club'} />
        </div>

        {/* Bottom left meta */}
        <div className="lp-left-footer">
          <span className="lp-footer-item">SHA-256 auth</span>
          <span className="lp-footer-sep" aria-hidden="true" />
          <span className="lp-footer-item">CP-SAT v9.15 solver</span>
          <span className="lp-footer-sep" aria-hidden="true" />
          <span className="lp-footer-item">0 hard violations guaranteed</span>
        </div>
      </div>

      {/* Right: credential panel */}
      <div className="lp-right">
        <form className="lp-form" onSubmit={handleSubmit} noValidate>
          {/* Header */}
          <div className="lp-form-header">
            <h1 className="lp-form-title">Portal authentication</h1>
            <p className="lp-form-subtitle">
              Automated conflict resolution & verified timetable access
            </p>
          </div>

          {/* Role selector */}
          <div className="lp-section">
            <label className="lp-section-label">Select institutional role</label>
            <div className="lp-role-grid">
              {ROLES.map((role) => {
                const isActive = selectedRole === role.key;
                return (
                  <button
                    key={role.key}
                    type="button"
                    className={`lp-role-card ${isActive ? 'lp-role-card--active' : ''}`}
                    onClick={() => handleSelectRole(role)}
                  >
                    <span className={`lp-role-icon ${isActive ? 'lp-role-icon--active' : ''}`}>
                      {role.icon}
                    </span>
                    <span className="lp-role-name">{role.label}</span>
                    <span className="lp-role-sub">{role.subLabel}</span>
                    {isActive && (
                      <span className="lp-role-check" aria-label="selected">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Role description strip with demo credentials guide */}
            <div className="lp-role-strip">
              <span className="lp-strip-icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M7 6v4M7 4.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </span>
              <span className="lp-strip-text">
                {selected.description} · <span className="font-mono text-slate-700">Demo: {selected.email} / {selected.password}</span>
              </span>
              <span className="lp-strip-tier">{selected.accessNote}</span>
            </div>
          </div>

          {/* Email (empty by default, user fills demo credentials) */}
          <div className="lp-section">
            <div className="lp-field-row">
              <label className="lp-field-label" htmlFor="lp-email">
                Institutional email
              </label>
              <button
                type="button"
                className="lp-forgot-link"
                onClick={handleFillDemo}
                tabIndex={-1}
                title={`Quick-fill ${selected.label} demo credentials`}
              >
                Fill demo credentials
              </button>
            </div>
            <div className="lp-field-with-icon">
              <span className="lp-field-icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M1 4.5l6 4 6-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </span>
              <input
                id="lp-email"
                type="email"
                className="lp-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`e.g. ${selected.email}`}
                autoComplete="username"
                required
              />
            </div>
          </div>

          {/* Password (empty by default, user fills demo credentials) */}
          <div className="lp-section">
            <div className="lp-field-row">
              <label className="lp-field-label" htmlFor="lp-password">
                Terminal password
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                Demo: {selected.password}
              </span>
            </div>
            <div className="lp-field-with-icon">
              <span className="lp-field-icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="2.5" y="6" width="9" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M4.5 6V4a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </span>
              <input
                ref={passwordRef}
                id="lp-password"
                type="password"
                className="lp-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`Enter password (e.g. ${selected.password})`}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {/* Error state */}
          {displayError && (
            <div className="lp-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M7 4v4M7 9.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {displayError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="lp-submit"
            disabled={submitting}
          >
            {submitting ? (
              <span className="lp-submit-spinner" aria-hidden="true" />
            ) : null}
            <span>{submitting ? 'Authenticating...' : `Sign in as ${selected.label} →`}</span>
          </button>

          {/* Footer note */}
          <p className="lp-form-note">
            All schedules, bookings, disruptions and decisions are stored live in the Supabase PostgreSQL database.
          </p>
        </form>
      </div>
    </div>
  );
};
