import React, { useState, useRef } from 'react';
import './LoginPage.css';

export type RoleKey = 'admin' | 'department_coordinator' | 'faculty' | 'club';

interface RoleConfig {
  key: RoleKey;
  label: string;
  subLabel: string;
  tier: string;
  email: string;
  password: string;
  exhibitTitle: string;
  exhibitBadge: string;
  description: string;
  telemetry: string;
}

const ROLES: RoleConfig[] = [
  {
    key: 'admin',
    label: 'Dean and Admin',
    subLabel: "Dean's Office",
    tier: 'Tier 1 authority',
    email: 'admin@cit.edu.in',
    password: 'Admin@123',
    exhibitTitle: 'Exhibit 01: Deterministic Solver Matrix',
    exhibitBadge: '0 hard violations',
    description: 'Full authority over the 4-stage Google OR-Tools CP-SAT solver, campus disruption approvals, and live PostgreSQL state synchronization.',
    telemetry: 'CP-SAT v9.15 solver · Stage 1-4 active · Mon-Fri teaching periods 1-9'
  },
  {
    key: 'department_coordinator',
    label: 'Dept Coordinator',
    subLabel: 'CSE and Departments',
    tier: 'Tier 2 review',
    email: 'coord.cse@cit.edu.in',
    password: 'Coord@123',
    exhibitTitle: 'Exhibit 02: Venue Approval and No Self-Approval Gate',
    exhibitBadge: 'Audit verified',
    description: 'Departmental venue queue administration. Strictly enforces the no self-approval protocol where requesters cannot approve their own submissions.',
    telemetry: 'Spectra Week 7 Queue · Category caps enforced · 0 priority inversions'
  },
  {
    key: 'faculty',
    label: 'Faculty Scholar',
    subLabel: 'Dr. Amit Behera (F12)',
    tier: 'Tier 3 academic',
    email: 'f12@cit.edu.in',
    password: 'Faculty@123',
    exhibitTitle: 'Exhibit 03: Faculty Schedule and Feasibility Engine',
    exhibitBadge: 'Constraint check',
    description: 'View academic lecture and lab commitments, evaluate slot rescheduling feasibility against lunch hour (P5) and double-booking constraints.',
    telemetry: 'Faculty ID F12 · 4 active courses · 8 teaching hours'
  },
  {
    key: 'club',
    label: 'Club Representative',
    subLabel: 'Dramatics and Cultural',
    tier: 'Tier 4 booking',
    email: 'dramatics@cit.edu.in',
    password: 'Club@123',
    exhibitTitle: 'Exhibit 04: Spectra Fest Cultural Venue Queue',
    exhibitBadge: 'AI copilot enabled',
    description: 'Plain-language booking submissions in English and Hinglish via the AI copilot with automatic wheelchair accessibility conflict detection.',
    telemetry: 'Venues: AUD (800 cap), SH-1 (200 cap), SH-2 (180 cap), OAT (500 cap)'
  }
];

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

  const selected = ROLES.find((r) => r.key === selectedRole) || ROLES[0];

  const handleSelectRole = (role: RoleConfig) => {
    setSelectedRole(role.key);
    setLocalError(null);
  };

  const handleFillDemo = () => {
    setEmail(selected.email);
    setPassword(selected.password);
    setLocalError(null);
    if (passwordRef.current) {
      passwordRef.current.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLocalError('Please enter both your institutional email and terminal password');
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
      {/* ── Museum of Motion Kinetic Marquee Header ── */}
      <div className="lp-marquee-banner" aria-label="Live Institutional Telemetry">
        <div className="lp-marquee-inner">
          <div className="lp-marquee-segment">
            <span className="lp-marquee-highlight">Chilika Institute of Technology</span>
            <span className="lp-marquee-sep">✦</span>
            <span>Deterministic Campus Scheduling & Venue Engine</span>
            <span className="lp-marquee-sep">✦</span>
            <span>Google OR-Tools CP-SAT v9.15</span>
            <span className="lp-marquee-sep">✦</span>
            <span className="lp-marquee-highlight">0 Hard Violations Guaranteed</span>
            <span className="lp-marquee-sep">✦</span>
            <span>27 Campus Venues</span>
            <span className="lp-marquee-sep">✦</span>
            <span>189 Academic Sessions</span>
            <span className="lp-marquee-sep">✦</span>
            <span>41 Midsem Exams</span>
            <span className="lp-marquee-sep">✦</span>
            <span className="lp-marquee-highlight">Spectra Fest Week 7 Priority Resolution</span>
            <span className="lp-marquee-sep">✦</span>
            <span>Live PostgreSQL State Persistence</span>
            <span className="lp-marquee-sep">✦</span>
          </div>
          <div className="lp-marquee-segment">
            <span className="lp-marquee-highlight">Chilika Institute of Technology</span>
            <span className="lp-marquee-sep">✦</span>
            <span>Deterministic Campus Scheduling & Venue Engine</span>
            <span className="lp-marquee-sep">✦</span>
            <span>Google OR-Tools CP-SAT v9.15</span>
            <span className="lp-marquee-sep">✦</span>
            <span className="lp-marquee-highlight">0 Hard Violations Guaranteed</span>
            <span className="lp-marquee-sep">✦</span>
            <span>27 Campus Venues</span>
            <span className="lp-marquee-sep">✦</span>
            <span>189 Academic Sessions</span>
            <span className="lp-marquee-sep">✦</span>
            <span>41 Midsem Exams</span>
            <span className="lp-marquee-sep">✦</span>
            <span className="lp-marquee-highlight">Spectra Fest Week 7 Priority Resolution</span>
            <span className="lp-marquee-sep">✦</span>
            <span>Live PostgreSQL State Persistence</span>
            <span className="lp-marquee-sep">✦</span>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Exhibit Stage ── */}
      <div className="lp-stage">
        {/* Left: Architectural Exhibit Showcase */}
        <div className="lp-left-column">
          <div className="lp-institution-brand">
            <div className="lp-brand-emblem">CIT</div>
            <div className="lp-brand-titles">
              <span className="lp-brand-name">Chilika Institute of Technology</span>
              <span className="lp-brand-sub">Campus Scheduling & Venue Governance</span>
            </div>
          </div>

          <div className="lp-exhibit-display">
            <div className="lp-exhibit-frame mom-card-interactive">
              <div className="lp-exhibit-header">
                <span className="lp-exhibit-label">{selected.tier}</span>
                <span className="lp-exhibit-badge">{selected.exhibitBadge}</span>
              </div>

              <div className="lp-exhibit-content">
                <h2 className="lp-exhibit-title">{selected.exhibitTitle}</h2>
                <p className="lp-exhibit-desc">{selected.description}</p>

                {/* Exhibit Visualizer depending on role */}
                {selected.key === 'admin' && (
                  <div className="lp-visualizer-grid">
                    {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((d, i) => (
                      <div key={d} className="lp-grid-cell">
                        <span className="lp-cell-day">{d}</span>
                        <div className="lp-cell-block" />
                        <div className="lp-cell-block lp-cell-block-lab" />
                        {i % 2 === 0 && <div className="lp-cell-block lp-cell-block-tut" />}
                      </div>
                    ))}
                  </div>
                )}

                {selected.key === 'department_coordinator' && (
                  <div className="space-y-1.5 pt-2 text-xs">
                    <div className="flex justify-between text-slate-300 font-mono text-[11px]">
                      <span>CSE Venues (SH-1, SH-2)</span>
                      <span className="text-emerald-400">92% Utilized</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded overflow-hidden">
                      <div className="h-full bg-blue-600 rounded" style={{ width: '92%' }} />
                    </div>
                    <div className="flex justify-between text-slate-300 font-mono text-[11px] pt-1">
                      <span>Mech Venues (WS-1, WS-2)</span>
                      <span className="text-emerald-400">84% Utilized</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded overflow-hidden">
                      <div className="h-full bg-amber-500 rounded" style={{ width: '84%' }} />
                    </div>
                  </div>
                )}

                {selected.key === 'faculty' && (
                  <div className="space-y-1 pt-1 text-xs font-mono text-slate-300">
                    <div className="bg-slate-900/80 p-2 rounded border border-slate-700/60">
                      <div className="text-blue-400 font-semibold">CS101-A-L1 (Lecture)</div>
                      <div className="text-[11px] text-slate-400">Mon P2 · LH-1 (Seats 120) · Feasible</div>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded border border-slate-700/60">
                      <div className="text-amber-400 font-semibold">PH191-A-P1 (Physics Lab)</div>
                      <div className="text-[11px] text-slate-400">Wed P6-P8 · Lab-1 (Seats 40) · Feasible</div>
                    </div>
                  </div>
                )}

                {selected.key === 'club' && (
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono text-slate-300">
                    <div className="bg-slate-900/80 p-1.5 rounded border border-slate-700/60">
                      <div className="text-purple-400 font-semibold">AUD (800)</div>
                      <div className="text-[10px] text-emerald-400">Wed P10-P11 Free</div>
                    </div>
                    <div className="bg-slate-900/80 p-1.5 rounded border border-slate-700/60">
                      <div className="text-purple-400 font-semibold">SH-1 (200)</div>
                      <div className="text-[10px] text-emerald-400">Wheelchair Accessible</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="lp-exhibit-footer-meta">
                <span>{selected.telemetry}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Chilika Institute of Technology</span>
            <span>Dataset: cit-public-v1</span>
          </div>
        </div>

        {/* Right: Credential Authentication Console */}
        <div className="lp-right-column">
          <form className="lp-form-box" onSubmit={handleSubmit} noValidate>
            <div className="lp-head-group">
              <h1 className="lp-head-title">Institutional portal access</h1>
              <p className="lp-head-lede">
                Select your role passport or enter institutional credentials to access the verified scheduling workspace.
              </p>
            </div>

            {/* Role Passport Selector */}
            <div className="lp-role-section">
              <label className="lp-role-label">Role passports</label>
              <div className="lp-role-passes">
                {ROLES.map((role) => {
                  const isActive = selectedRole === role.key;
                  return (
                    <button
                      key={role.key}
                      type="button"
                      className={`lp-role-card ${isActive ? 'lp-role-card--active' : ''}`}
                      onClick={() => handleSelectRole(role)}
                    >
                      <div className="lp-role-card-top">
                        <span className="lp-role-card-title">{role.label}</span>
                        <span className="lp-role-card-tier">{role.tier}</span>
                      </div>
                      <span className="lp-role-card-sub">{role.subLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Role Demo Fill Strip */}
            <div className="lp-demo-strip">
              <div className="lp-demo-text">
                Demo account: <span className="lp-demo-creds">{selected.email}</span>
              </div>
              <button
                type="button"
                className="lp-fill-btn"
                onClick={handleFillDemo}
              >
                Fill credentials
              </button>
            </div>

            {/* Email Field */}
            <div className="lp-field">
              <label className="lp-field-label" htmlFor="lp-email">Institutional email</label>
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

            {/* Password Field */}
            <div className="lp-field">
              <div className="flex items-center justify-between">
                <label className="lp-field-label" htmlFor="lp-password">Terminal password</label>
                <span className="text-[11px] text-slate-500 font-mono">Demo: {selected.password}</span>
              </div>
              <input
                ref={passwordRef}
                id="lp-password"
                type="password"
                className="lp-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </div>

            {/* Error Message */}
            {displayError && (
              <div className="lp-error-alert" role="alert">
                {displayError}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="lp-submit-button"
              disabled={submitting}
            >
              {submitting && <span className="lp-submit-spinner" aria-hidden="true" />}
              <span>{submitting ? 'Authenticating…' : `Sign in as ${selected.label}`}</span>
            </button>

            <p className="lp-form-foot">
              Audit-verified session. All changes persist to the live Supabase PostgreSQL engine.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
