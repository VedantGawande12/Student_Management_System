import React, { useState, useRef } from 'react';
import './LoginPage.css';

export type RoleKey = 'admin' | 'department_coordinator' | 'faculty' | 'club';

interface AccountIdentity {
  key: RoleKey;
  roleTitle: string;
  department: string;
  email: string;
  password: string;
  scopeSummary: string;
}

const CIT_ACCOUNTS: AccountIdentity[] = [
  {
    key: 'admin',
    roleTitle: 'Dean of Academic Affairs',
    department: "Dean's Office",
    email: 'admin@cit.edu.in',
    password: 'Admin@123',
    scopeSummary: 'Academic calendar control, timetable generation, and disruption reschedule approvals.'
  },
  {
    key: 'department_coordinator',
    roleTitle: 'Department Coordinator',
    department: 'Computer Science and Engineering',
    email: 'coord.cse@cit.edu.in',
    password: 'Coord@123',
    scopeSummary: 'CSE venue queue management, conflict verification, and non-self-approval enforcement.'
  },
  {
    key: 'faculty',
    roleTitle: 'Faculty Instructor',
    department: 'Dr. Amit Behera (F12)',
    email: 'f12@cit.edu.in',
    password: 'Faculty@123',
    scopeSummary: 'Course lecture commitments, physics lab supervision, and slot feasibility review.'
  },
  {
    key: 'club',
    roleTitle: 'Student Activity Lead',
    department: 'Dramatics and Cultural Society',
    email: 'dramatics@cit.edu.in',
    password: 'Club@123',
    scopeSummary: 'Spectra Fest venue slot requests, Copilot submissions, and equipment requirements.'
  }
];

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
  error?: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, error }) => {
  const [selectedKey, setSelectedKey] = useState<RoleKey>('admin');
  const [email, setEmail] = useState('admin@cit.edu.in');
  const [password, setPassword] = useState('Admin@123');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const selectedAccount = CIT_ACCOUNTS.find((a) => a.key === selectedKey) || CIT_ACCOUNTS[0];

  const handleSelectAccount = (account: AccountIdentity) => {
    setSelectedKey(account.key);
    setEmail(account.email);
    setPassword(account.password);
    setLocalError(null);
  };

  const handleFillSelected = () => {
    setEmail(selectedAccount.email);
    setPassword(selectedAccount.password);
    setLocalError(null);
    if (passwordRef.current) {
      passwordRef.current.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLocalError('Please enter both your institutional email and password.');
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    try {
      await onLogin(email.trim(), password.trim());
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="cit-login-shell">
      {/* ── Official Institutional Masthead ── */}
      <header className="cit-masthead">
        <div className="cit-masthead-inner">
          <div className="cit-brand-cluster">
            <div className="cit-crest" aria-hidden="true">CIT</div>
            <div className="cit-brand-titles">
              <span className="cit-brand-name">Chilika Institute of Technology</span>
              <span className="cit-brand-department">Academic Scheduling and Facilities Governance</span>
            </div>
          </div>
          <div className="cit-masthead-meta">
            <span>Authentication Gateway</span>
          </div>
        </div>
      </header>

      {/* ── Main Two-Column Working Desk ── */}
      <main className="cit-desk-wrap">
        <div className="cit-desk">
          {/* Left: Accounts Directory */}
          <section className="cit-directory-panel" aria-labelledby="cit-dir-heading">
            <div className="cit-directory-header">
              <h2 id="cit-dir-heading" className="cit-directory-title">
                Campus accounts directory
              </h2>
              <p className="cit-directory-lede">
                Select an institutional role to populate authorized test credentials.
              </p>
            </div>

            <div className="cit-account-list" role="radiogroup" aria-label="Available campus accounts">
              {CIT_ACCOUNTS.map((account) => {
                const isSelected = selectedKey === account.key;
                return (
                  <button
                    key={account.key}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`cit-account-card ${isSelected ? 'cit-account-card--selected' : ''}`}
                    onClick={() => handleSelectAccount(account)}
                  >
                    <div className="cit-account-card-header">
                      <span className="cit-account-role">{account.roleTitle}</span>
                      <span className="cit-account-email">{account.email}</span>
                    </div>
                    <span className="cit-account-scope">{account.scopeSummary}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Right: Focused Sign-in Desk */}
          <section className="cit-form-card" aria-labelledby="cit-form-heading">
            <div className="cit-form-header">
              <h1 id="cit-form-heading" className="cit-form-title">
                Account sign in
              </h1>
              <p className="cit-form-lede">
                Enter your institutional email and password to open the scheduling workspace.
              </p>
            </div>

            <div className="cit-active-role-strip">
              <div className="cit-active-role-text">
                Active profile: <span className="cit-active-role-name">{selectedAccount.roleTitle}</span>
              </div>
              <button
                type="button"
                className="cit-quickfill-btn"
                onClick={handleFillSelected}
              >
                Use credentials
              </button>
            </div>

            <form className="cit-form-body" onSubmit={handleSubmit} noValidate>
              <div className="cit-form-field">
                <label className="cit-form-label" htmlFor="cit-email">
                  Institutional email
                </label>
                <input
                  id="cit-email"
                  type="email"
                  className="cit-form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. admin@cit.edu.in"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="cit-form-field">
                <label className="cit-form-label" htmlFor="cit-password">
                  Password
                </label>
                <input
                  ref={passwordRef}
                  id="cit-password"
                  type="password"
                  className="cit-form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />
                <span className="cit-form-hint">
                  Password: {selectedAccount.password}
                </span>
              </div>

              {displayError && (
                <div className="cit-error-banner" role="alert">
                  {displayError}
                </div>
              )}

              <button
                type="submit"
                className="cit-submit-btn"
                disabled={submitting}
              >
                {submitting ? 'Authenticating…' : `Sign in as ${selectedAccount.roleTitle}`}
              </button>

              <p className="cit-form-footer-note">
                Authorized access only for Chilika Institute of Technology faculty, staff, and student leads.
              </p>
            </form>
          </section>
        </div>
      </main>

      {/* ── Official Institutional Colophon ── */}
      <footer className="cit-colophon">
        <div className="cit-colophon-inner">
          <span>Chilika Institute of Technology · Department of Computer Science & Engineering</span>
          <span>CIT Schedule Dataset cit-public-v1</span>
        </div>
      </footer>
    </div>
  );
};
