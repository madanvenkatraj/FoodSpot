'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  UtensilsCrossed,
} from 'lucide-react';
import { useWorkspace } from '@/components/WorkspaceContext';
import { signInCustomerWithGoogle } from '@/lib/firebase/client';

/** Official Google "G" logo SVG */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function CustomerLoginPage() {
  const router = useRouter();
  const { setCustomerSession, showToast } = useWorkspace();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot Password flow state
  const [forgotMode, setForgotMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [issuedTokenHint, setIssuedTokenHint] = useState<string | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setGoogleSubmitting(true);
    try {
      const googleUser = await signInCustomerWithGoogle();
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'firebase_google_login',
          workspace: 'customer',
          uid: googleUser.uid,
          email: googleUser.email,
          name: googleUser.displayName,
          photoURL: googleUser.photoURL,
          emailVerified: googleUser.emailVerified,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Unable to complete Google sign-in for Customer App.');
        return;
      }
      if (data.token && data.user) {
        setCustomerSession(data.token, data.user);
        showToast(`Welcome, ${data.user.name}! 🎉`);
        router.push('/customer/home');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/popup-closed-by-user') || msg.includes('auth/cancelled-popup-request')) {
        setErrorMessage('Sign-in popup was closed. Please try again.');
      } else if (msg.includes('auth/popup-blocked')) {
        setErrorMessage('Popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (msg.includes('auth/unauthorized-domain')) {
        setErrorMessage('This domain is not authorized in Firebase. Please contact the administrator.');
      } else {
        setErrorMessage('Google sign-in failed. Please try again or use email/password below.');
      }
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!identifier.trim() || !password) {
      setErrorMessage('Please enter both your email/phone and password.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          workspace: 'customer',
          email: identifier.trim(),
          password,
          rememberMe,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Authentication failed. Please check your credentials.');
        return;
      }
      if (data.token && data.user) {
        setCustomerSession(data.token, data.user);
        showToast(`Welcome back, ${data.user.name}! 🍔`);
        router.push('/customer/home');
      }
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setRecoveryNotice(null);
    if (!recoveryEmail.trim()) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'forgot_password', email: recoveryEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Unable to initiate password recovery.');
        return;
      }
      setIssuedTokenHint(data.resetTokenIssued || null);
      setRecoveryNotice(data.message || 'Recovery code generated. Enter it below to set a new password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompletePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!recoveryEmail.trim() || !resetTokenInput.trim() || newPasswordInput.length < 8) {
      setErrorMessage('Please provide your email, reset code, and a new password (min 8 characters).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          email: recoveryEmail.trim(),
          resetToken: resetTokenInput.trim(),
          newPassword: newPasswordInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Password reset failed.');
        return;
      }
      showToast('Password updated! You can now sign in. ✅');
      setForgotMode(false);
      setIssuedTokenHint(null);
      setIdentifier(recoveryEmail.trim());
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #FFF8F3 0%, #FFF3EA 60%, #FFF8F3 100%)' }}>
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.5) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.4) 0%, transparent 70%)' }} />
      </div>

      {/* Top Bar */}
      <header className="relative z-10 border-b border-orange-100/60 glass">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md shadow-orange-600/20 group-hover:scale-105 transition-transform" style={{ background: 'linear-gradient(135deg, #ea580c, #dc2626)' }}>
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <span className="font-display text-lg font-extrabold text-stone-900">
                Food<span className="gradient-text-orange">Spot</span>
              </span>
              <span className="ml-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase text-white" style={{ background: 'linear-gradient(90deg, #ea580c, #dc2626)' }}>
                Customer
              </span>
            </div>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white/80 px-3.5 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors backdrop-blur-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
      </header>

      {/* Auth Card */}
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="rounded-3xl border border-orange-100/80 bg-white shadow-2xl shadow-orange-900/8 overflow-hidden animate-scale-in">
          {/* Card top accent */}
          <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #ea580c, #dc2626, #ea580c)' }} />

          <div className="p-7 sm:p-9">
            {/* Header */}
            <div className="mb-7 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 border border-orange-100">
                <UtensilsCrossed className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-extrabold text-stone-950">
                  {forgotMode ? 'Reset Password' : 'Welcome back'}
                </h1>
                <p className="text-xs text-stone-400 mt-0.5">
                  {forgotMode
                    ? 'Recover access to your FoodSpot account'
                    : 'Sign in to order delicious food 🍕'}
                </p>
              </div>
            </div>

            {/* Error */}
            {errorMessage && (
              <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700 animate-fade-in-down">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Recovery Notice */}
            {recoveryNotice && (
              <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 animate-fade-in-down">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <p>{recoveryNotice}</p>
                  {issuedTokenHint && (
                    <p className="mt-1.5 font-mono text-xs font-bold text-emerald-900 bg-emerald-100 rounded-lg px-2 py-1">
                      Code: {issuedTokenHint}
                    </p>
                  )}
                </div>
              </div>
            )}

            {!forgotMode ? (
              <div className="space-y-5">
                {/* Google Sign-In */}
                <button
                  id="btn-google-signin"
                  type="button"
                  disabled={googleSubmitting || submitting}
                  onClick={() => void handleGoogleSignIn()}
                  className="w-full flex items-center justify-center gap-3 rounded-2xl border-2 border-stone-200 bg-white px-5 py-3.5 text-sm font-bold text-stone-800 shadow-sm hover:border-stone-300 hover:shadow-md hover:bg-stone-50/80 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {googleSubmitting ? (
                    <svg className="h-5 w-5 animate-spin text-stone-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <GoogleIcon className="h-5 w-5 shrink-0" />
                  )}
                  <span>
                    {googleSubmitting ? 'Connecting to Google…' : 'Continue with Google'}
                  </span>
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-stone-400">
                  <div className="h-px flex-1 bg-stone-200" />
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-emerald-500" />
                    or email & password
                  </span>
                  <div className="h-px flex-1 bg-stone-200" />
                </div>

                {/* Email/Password Form */}
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="customer-identifier" className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                      Email or Phone
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                      <input
                        id="customer-identifier"
                        type="text"
                        required
                        autoComplete="username"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-stone-200 bg-stone-50/60 pl-10 pr-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-orange-500 focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="customer-password" className="block text-xs font-bold uppercase tracking-wider text-stone-500">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => { setForgotMode(true); setErrorMessage(null); setRecoveryEmail(identifier); }}
                        className="text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer transition-colors"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                      <input
                        id="customer-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full rounded-xl border border-stone-200 bg-stone-50/60 pl-10 pr-11 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-orange-500 focus:bg-white focus:outline-none transition-colors"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-stone-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                      />
                      Remember me for 14 days
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || googleSubmitting}
                    className="btn-premium w-full rounded-2xl px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-orange-600/20 hover:shadow-orange-600/30 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #ea580c, #dc2626)' }}
                  >
                    {submitting ? 'Signing in…' : 'Sign In to FoodSpot'}
                  </button>
                </form>
              </div>
            ) : (
              /* Forgot Password Flow */
              <div className="space-y-4 animate-fade-in-up">
                <form onSubmit={handleRequestPasswordReset} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                      Registered Email
                    </label>
                    <input
                      type="email"
                      required
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-orange-500 focus:bg-white focus:outline-none transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-xs font-bold text-orange-700 hover:bg-orange-100 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {submitting ? 'Generating code…' : 'Generate Reset Code'}
                  </button>
                </form>

                {issuedTokenHint && (
                  <form onSubmit={handleCompletePasswordReset} className="space-y-3 pt-3 border-t border-stone-100 animate-fade-in-up">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
                        Reset Code
                      </label>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                        <input
                          type="text"
                          required
                          value={resetTokenInput}
                          onChange={(e) => setResetTokenInput(e.target.value)}
                          placeholder="RST-XXXXXX"
                          className="w-full rounded-xl border border-stone-200 bg-stone-50 pl-9 pr-3.5 py-2.5 text-sm font-mono text-stone-900 focus:border-orange-500 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
                        New Password (min 8 chars)
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        placeholder="Enter a strong new password"
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-xl bg-stone-900 px-4 py-3 text-xs font-bold text-white hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {submitting ? 'Updating password…' : 'Set New Password'}
                    </button>
                  </form>
                )}

                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setErrorMessage(null); setRecoveryNotice(null); }}
                  className="w-full text-center text-xs font-bold text-stone-400 hover:text-stone-700 pt-2 cursor-pointer transition-colors"
                >
                  ← Back to Sign In
                </button>
              </div>
            )}

            {/* Sign Up Link */}
            <div className="mt-6 pt-5 border-t border-stone-100 text-center text-xs text-stone-500">
              New to FoodSpot?{' '}
              <Link href="/customer/register" className="font-bold text-orange-600 hover:text-orange-700 underline underline-offset-2">
                Create a free account →
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-4 text-center text-xs text-stone-400">
        FoodSpot Customer App • Secure Authentication
      </footer>
    </div>
  );
}
