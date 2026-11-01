'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useWorkspace } from '@/components/WorkspaceContext';

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAdminSession, showToast } = useWorkspace();

  const [identifier, setIdentifier] = useState('admin@gmail.com');
  const [password, setPassword] = useState('admin@123');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 2 TOTP MFA State
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [mfaAccountEmail, setMfaAccountEmail] = useState<string>('');
  const [mfaCode, setMfaCode] = useState('');

  const handlePrimaryLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim() || !password) {
      setErrorMessage('Administrator email/username and password are required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          workspace: 'admin',
          email: identifier.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(
          data.error || 'Access denied. Verify your administrator credentials and workspace permissions.'
        );
        return;
      }

      if (data.mfaRequired && data.mfaChallengeToken) {
        setMfaChallengeToken(data.mfaChallengeToken);
        setMfaAccountEmail(data.email || identifier.trim());
        setMfaCode('');
        return;
      }

      if (data.token && data.user) {
        setAdminSession(data.token, data.user);
        showToast(`Admin session verified for ${data.user.name}.`);
        router.push('/admin/dashboard');
      }
    } catch {
      setErrorMessage('Network error connecting to administrative authentication service.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!mfaChallengeToken || !mfaCode.trim()) {
      setErrorMessage('Please enter your 6-digit authenticator code or backup recovery code.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_mfa',
          mfaChallengeToken,
          code: mfaCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'MFA verification failed.');
        return;
      }

      if (data.token && data.user) {
        setAdminSession(data.token, data.user);
        showToast('Administrator MFA verified. Welcome to FoodSpot Admin Console.');
        router.push('/admin/dashboard');
      }
    } catch {
      setErrorMessage('Network error during MFA verification.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-800 border border-stone-700 text-amber-400 shadow-sm">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <span className="font-display text-lg font-extrabold text-white">FoodSpot</span>
              <span className="ml-2 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                Admin Console
              </span>
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-900 px-3.5 py-2 text-xs font-bold text-stone-300 hover:bg-stone-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Workspace Selection
          </Link>
        </div>
      </header>

      {/* Main Admin Login Box */}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="rounded-3xl border border-stone-800 bg-stone-900 p-7 sm:p-9 shadow-2xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-white">
                {mfaChallengeToken ? 'Authenticator MFA' : 'Admin Sign In'}
              </h1>
              <p className="text-xs text-stone-400">
                {mfaChallengeToken
                  ? `Step 2 of 2 • Verify identity for ${mfaAccountEmail}`
                  : 'FoodSpot Operations & Platform Governance'}
              </p>
            </div>
          </div>

          {/* Mandatory Security Notice & Default Admin Credentials */}
          <div className="mb-6 space-y-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-200">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Authorized administrator access only (Email &amp; Password).</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-500/20 pt-2 text-[11px] text-amber-100/90">
              <span>
                Default Admin ID: <strong className="font-mono text-amber-300">admin@gmail.com</strong> • Password:{' '}
                <strong className="font-mono text-amber-300">admin@123</strong>
              </span>
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs font-semibold text-red-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!mfaChallengeToken ? (
            <form onSubmit={handlePrimaryLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-identifier"
                  className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-1.5"
                >
                  Admin Email or Username
                </label>
                <div className="relative">
                  <UserCheck className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500" />
                  <input
                    id="admin-identifier"
                    type="text"
                    required
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter admin email or username"
                    className="w-full rounded-xl border border-stone-700 bg-stone-950 pl-10 pr-4 py-3 text-sm text-white placeholder:text-stone-600 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500" />
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter administrator password"
                    className="w-full rounded-xl border border-stone-700 bg-stone-950 pl-10 pr-11 py-3 text-sm text-white placeholder:text-stone-600 focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-amber-500 px-5 py-3.5 text-sm font-extrabold text-stone-950 shadow-lg shadow-amber-500/15 hover:bg-amber-400 transition-all cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Signing In to Admin Console...' : 'Sign In to Admin Console'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyMfa} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-mfa-code"
                  className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-1.5"
                >
                  6-Digit Authenticator Code or Recovery Code
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500" />
                  <input
                    id="admin-mfa-code"
                    type="text"
                    required
                    autoFocus
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="e.g. 123456 or FH-RECOVERY-XXXX"
                    className="w-full rounded-xl border border-stone-700 bg-stone-950 pl-10 pr-4 py-3 text-sm font-mono tracking-wider text-white placeholder:text-stone-600 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <p className="mt-2 text-[11px] text-stone-400 leading-relaxed">
                  Open your authenticator app (RFC 6238 TOTP) or enter one of your single-use
                  recovery codes provisioned for this administrator account.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-amber-500 px-5 py-3.5 text-sm font-extrabold text-stone-950 shadow-lg shadow-amber-500/15 hover:bg-amber-400 transition-all cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Verifying MFA Code...' : 'Verify & Enter Admin Console'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMfaChallengeToken(null);
                  setMfaCode('');
                  setErrorMessage(null);
                }}
                className="w-full text-center text-xs font-bold text-stone-400 hover:text-white pt-1 cursor-pointer"
              >
                ← Back to Primary Sign In
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-stone-800 text-center text-[11px] text-stone-500">
            Public administrator registration is disabled. New administrator accounts must be
            provisioned through an existing authorized administrator session.
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-stone-600">
        FoodSpot Admin Console • Role-Isolated RBAC &amp; RFC 6238 TOTP Security
      </footer>
    </div>
  );
}
