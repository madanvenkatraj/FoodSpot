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
        showToast(`Signed in with Google as ${data.user.name}!`);
        router.push('/customer/home');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/popup-closed-by-user') || msg.includes('auth/cancelled-popup-request')) {
        setErrorMessage('Google sign-in popup was closed before completing authentication.');
      } else {
        setErrorMessage(msg || 'Firebase Google authentication failed. Please try again.');
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
        showToast(`Welcome back, ${data.user.name}!`);
        router.push('/customer/home');
      }
    } catch {
      setErrorMessage('Network error while connecting to authentication service.');
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
        body: JSON.stringify({
          action: 'forgot_password',
          email: recoveryEmail.trim(),
        }),
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
      showToast('Password updated! You can now sign in.');
      setForgotMode(false);
      setIssuedTokenHint(null);
      setIdentifier(recoveryEmail.trim());
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col justify-between">
      {/* Top Bar */}
      <header className="border-b border-stone-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-600 to-red-600 text-white shadow-sm">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <span className="font-display text-lg font-extrabold text-stone-900">FoodHub</span>
              <span className="ml-2 rounded-md bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-700">
                Customer App
              </span>
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Workspace Selection
          </Link>
        </div>
      </header>

      {/* Main Auth Card */}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="rounded-3xl border border-stone-200/90 bg-white p-7 sm:p-9 shadow-xl shadow-stone-900/5">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-stone-950">
                {forgotMode ? 'Reset Customer Password' : 'Customer Sign In'}
              </h1>
              <p className="text-xs text-stone-500">
                {forgotMode
                  ? 'Recover access to your FoodHub customer account'
                  : 'Sign in to discover restaurants, order food & track deliveries'}
              </p>
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {recoveryNotice && (
            <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <p>{recoveryNotice}</p>
                {issuedTokenHint && (
                  <p className="mt-1 font-mono text-xs font-bold text-emerald-900">
                    Verification Code: {issuedTokenHint}
                  </p>
                )}
              </div>
            </div>
          )}

          {!forgotMode ? (
            <div className="space-y-4">
              {/* Firebase Google Auth — Customer App Workspace Only */}
              <button
                type="button"
                disabled={googleSubmitting || submitting}
                onClick={() => void handleGoogleSignIn()}
                className="w-full flex items-center justify-center gap-3 rounded-2xl border-2 border-stone-200 bg-white px-5 py-3.5 text-sm font-extrabold text-stone-900 shadow-xs hover:border-orange-300 hover:bg-orange-50/40 transition-all cursor-pointer disabled:opacity-60"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 via-red-500 to-amber-400 text-[11px] font-black text-white">
                  G
                </span>
                <span>
                  {googleSubmitting
                    ? 'Connecting to Firebase Google Auth...'
                    : 'Continue with Google (Customer App)'}
                </span>
              </button>

              <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-stone-400">
                <div className="h-px flex-1 bg-stone-200" />
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Or Email &amp; Password
                </span>
                <div className="h-px flex-1 bg-stone-200" />
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="customer-identifier"
                  className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5"
                >
                  Email or Phone Number
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
                    placeholder="Enter your email or phone number"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/70 pl-10 pr-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-orange-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="customer-password"
                    className="block text-xs font-bold uppercase tracking-wider text-stone-600"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(true);
                      setErrorMessage(null);
                      setRecoveryEmail(identifier);
                    }}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
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
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/70 pl-10 pr-11 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-orange-500 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
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
                className="w-full rounded-2xl bg-gradient-to-r from-orange-600 to-red-600 px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-orange-600/20 hover:from-orange-700 hover:to-red-700 transition-all cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Signing in to Customer App...' : 'Sign In to Customer App'}
              </button>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleRequestPasswordReset} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Registered Customer Email
                  </label>
                  <input
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm focus:border-orange-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-xs font-bold text-orange-700 hover:bg-orange-100 cursor-pointer"
                >
                  Generate Password Reset Code
                </button>
              </form>

              {issuedTokenHint && (
                <form onSubmit={handleCompletePasswordReset} className="space-y-3 pt-3 border-t border-stone-100">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                      Reset Verification Code
                    </label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                      <input
                        type="text"
                        required
                        value={resetTokenInput}
                        onChange={(e) => setResetTokenInput(e.target.value)}
                        placeholder="RST-XXXXXX"
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 pl-9 pr-3.5 py-2.5 text-sm font-mono focus:border-orange-500 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                      New Password (min 8 characters)
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Enter new strong password"
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm focus:border-orange-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-stone-900 px-4 py-3 text-xs font-bold text-white hover:bg-stone-800 cursor-pointer"
                  >
                    Confirm New Password
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setErrorMessage(null);
                  setRecoveryNotice(null);
                }}
                className="w-full text-center text-xs font-bold text-stone-500 hover:text-stone-800 pt-2 cursor-pointer"
              >
                ← Back to Customer Sign In
              </button>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-stone-100 text-center text-xs text-stone-600">
            New to FoodHub?{' '}
            <Link
              href="/customer/register"
              className="font-bold text-orange-600 hover:text-orange-700 underline underline-offset-2"
            >
              Create a Customer Account
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-stone-400">
        FoodHub Customer Workspace • Protected Session Authentication
      </footer>
    </div>
  );
}
