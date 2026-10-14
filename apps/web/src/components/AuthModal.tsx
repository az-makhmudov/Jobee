import React, { useState, useEffect } from 'react';
import { authClient, verifyPilotInvite } from '../api/auth-client.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>(
    'idle',
  );
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const storedInvite = sessionStorage.getItem('jobee_invite_code');
      if (storedInvite && storedInvite.trim().length > 0) {
        setInvitationCode(storedInvite.trim());
        setMode('signup');
        handleVerifyInvite(storedInvite.trim());
      }
    } catch {
      // safe fallback
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleVerifyInvite = async (codeToVerify: string) => {
    if (!codeToVerify.trim()) {
      setInviteStatus('idle');
      setInviteFeedback(null);
      return;
    }
    setInviteStatus('checking');
    setInviteFeedback(null);
    try {
      const res = await verifyPilotInvite(codeToVerify.trim(), email || undefined);
      if (res.valid) {
        setInviteStatus('valid');
        setInviteFeedback(
          res.invitedEmail ? `Reserved for ${res.invitedEmail}` : 'Valid invitation code',
        );
      } else {
        setInviteStatus('invalid');
        setInviteFeedback('Invalid invitation code');
      }
    } catch (err: any) {
      setInviteStatus('invalid');
      setInviteFeedback(err.message || 'Invalid or expired invitation code');
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message || 'Failed to sign in. Please check your credentials.');
      } else {
        if (onClose) onClose();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!invitationCode.trim()) {
      setError('Private pilot registration requires a valid invitation code.');
      setLoading(false);
      return;
    }

    try {
      const { error: signUpError } = await authClient.signUp.email({
        email,
        password,
        name,
        invitationCode: invitationCode.trim(),
      } as any);

      if (signUpError) {
        setError(signUpError.message || 'Failed to register account');
      } else {
        setSuccessMessage('Account created successfully! You are now logged in.');
        setTimeout(() => {
          if (onClose) onClose();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to register account');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await authClient.signIn.social({
        provider: 'google',
        callbackURL: window.location.origin,
      });
      if (res?.error) {
        setError(res.error.message || 'Failed to initialize Google Sign-In');
        setLoading(false);
      } else if (res?.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize Google Sign-In');
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address to reset password');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if ((authClient as any).forgetPassword) {
        await (authClient as any).forgetPassword({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        });
      }
      setSuccessMessage('Password reset instructions have been sent to your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => onClose?.()} role="presentation">
      <div
        className="modal-dialog modal-dialog-sm modal-dialog-clean"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-content">
            <span className="modal-icon" aria-hidden="true">
              🐝
            </span>
            <div>
              <h3 id="auth-modal-title" className="modal-title">
                {mode === 'signin' && 'Welcome to Jobee'}
                {mode === 'signup' && 'Join Private Pilot'}
                {mode === 'forgot' && 'Reset Password'}
              </h3>
              <p className="modal-subtitle">
                {mode === 'signin' && 'Autonomous AI Job Search Agent'}
                {mode === 'signup' && 'Invitation-only pilot onboarding'}
                {mode === 'forgot' && 'Enter email for reset link'}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="modal-close-btn"
              aria-label="Close dialog"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tab Switcher (if not in forgot mode) */}
        {mode !== 'forgot' && (
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--surface-border)',
              backgroundColor: 'rgba(15, 23, 42, 0.3)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`btn btn-ghost ${mode === 'signin' ? 'btn-primary' : ''}`}
              style={{
                flex: 1,
                borderRadius: 0,
                borderBottom:
                  mode === 'signin' ? '2px solid var(--accent)' : '2px solid transparent',
                padding: '0.75rem',
                fontSize: '0.85rem',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`btn btn-ghost ${mode === 'signup' ? 'btn-primary' : ''}`}
              style={{
                flex: 1,
                borderRadius: 0,
                borderBottom:
                  mode === 'signup' ? '2px solid var(--accent)' : '2px solid transparent',
                padding: '0.75rem',
                fontSize: '0.85rem',
              }}
            >
              Sign Up (Invite Only)
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="modal-body">
          {error && (
            <div className="alert alert-error" role="alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="alert alert-success" role="status">
              <span>✓</span>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Social Sign-in (Google) */}
          {mode !== 'forgot' && (
            <div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="btn btn-outline"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 1rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{loading ? 'Connecting to Google...' : 'Sign in with Google'}</span>
              </button>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '1.25rem 0',
                  color: 'var(--text-secondary)',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--surface-border)' }} />
                <span
                  style={{
                    padding: '0 0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  or continue with email
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--surface-border)' }} />
              </div>
            </div>
          )}

          {/* Sign In Form */}
          {mode === 'signin' && (
            <form
              onSubmit={handleEmailSignIn}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="signin-email">
                  Email Address
                </label>
                <input
                  id="signin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <label className="form-label" htmlFor="signin-password">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="signin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.65rem' }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Sign Up Form (Invite Only) */}
          {mode === 'signup' && (
            <form
              onSubmit={handleEmailSignUp}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="signup-invite">
                  Invitation Code <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="signup-invite"
                    type="text"
                    required
                    value={invitationCode}
                    onChange={(e) => {
                      setInvitationCode(e.target.value);
                      if (inviteStatus !== 'idle') setInviteStatus('idle');
                    }}
                    onBlur={() => handleVerifyInvite(invitationCode)}
                    placeholder="pilot_..."
                    className="form-input table-mono"
                    style={{
                      borderColor:
                        inviteStatus === 'valid'
                          ? 'var(--success)'
                          : inviteStatus === 'invalid'
                            ? 'var(--danger)'
                            : undefined,
                    }}
                  />
                  {inviteStatus === 'checking' && (
                    <span
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '10px',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Checking...
                    </span>
                  )}
                  {inviteStatus === 'valid' && (
                    <span
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '10px',
                        fontSize: '0.75rem',
                        color: 'var(--success)',
                        fontWeight: 600,
                      }}
                    >
                      ✓ Valid
                    </span>
                  )}
                  {inviteStatus === 'invalid' && (
                    <span
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '10px',
                        fontSize: '0.75rem',
                        color: 'var(--danger)',
                        fontWeight: 600,
                      }}
                    >
                      ✕ Invalid
                    </span>
                  )}
                </div>
                {inviteFeedback && (
                  <p
                    style={{
                      fontSize: '0.75rem',
                      marginTop: '0.25rem',
                      color: inviteStatus === 'valid' ? 'var(--success)' : 'var(--danger)',
                    }}
                  >
                    {inviteFeedback}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signup-name">
                  Full Name
                </label>
                <input
                  id="signup-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Asadbek Makhmudov"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signup-email">
                  Email Address
                </label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signup-password">
                  Password
                </label>
                <input
                  id="signup-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.65rem' }}
              >
                {loading ? 'Creating Account...' : 'Complete Pilot Registration'}
              </button>
            </form>
          )}

          {/* Forgot Password Form */}
          {mode === 'forgot' && (
            <form
              onSubmit={handleForgotPassword}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="forgot-email">
                  Email Address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="form-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.65rem' }}
              >
                {loading ? 'Sending Instructions...' : 'Send Password Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: 'center' }}
              >
                ← Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
