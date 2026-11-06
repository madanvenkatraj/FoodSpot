'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Flame,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
import { useWorkspace } from '@/components/WorkspaceContext';
import { signInCustomerWithGoogle } from '@/lib/firebase/client';

function computePasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const labels = ['Too Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = [
    'bg-stone-200',
    'bg-red-500',
    'bg-amber-500',
    'bg-lime-500',
    'bg-emerald-600',
  ];
  return {
    score,
    label: password ? labels[score] : 'Enter min 8 chars',
    color: colors[score],
  };
}

export default function CustomerRegisterPage() {
  const router = useRouter();
  const { setCustomerSession, showToast } = useWorkspace();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const strength = useMemo(() => computePasswordStrength(password), [password]);

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get('email');
    if (preset) setEmail(preset);
  }, []);

  const handleGoogleSignUp = async () => {
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
        setErrorMessage(data.error || 'Could not complete Google registration.');
        return;
      }
      if (data.token && data.user) {
        setCustomerSession(data.token, data.user);
        showToast(`Welcome to FoodSpot, ${data.user.name}! 🎉`);
        router.push('/customer/home');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/popup-closed-by-user') || msg.includes('auth/cancelled-popup-request')) {
        setErrorMessage('Sign-in popup was closed. Please try again.');
      } else if (msg.includes('auth/popup-blocked')) {
        setErrorMessage('Popup was blocked. Please allow popups for this site.');
      } else if (msg.includes('auth/unauthorized-domain')) {
        setErrorMessage('This domain is not authorized in Firebase. Contact the administrator.');
      } else {
        setErrorMessage('Google sign-up failed. Please try again or use email below.');
      }
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      setErrorMessage('All fields are required to create a customer account.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Password and Confirm Password do not match.');
      return;
    }

    if (!acceptedTerms) {
      setErrorMessage('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Could not complete registration.');
        return;
      }

      if (data.token && data.user) {
      setCustomerSession(data.token, data.user);
        showToast(`Account created! Welcome to FoodSpot, ${data.user.name}. 🍔`);
        router.push('/customer/home');
      }
    } catch {
      setErrorMessage('Network error while creating your account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-stone-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md shadow-orange-600/20 group-hover:scale-105 transition-transform" style={{ background: 'linear-gradient(135deg, #ea580c, #dc2626)' }}>
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <span className="font-display text-lg font-extrabold text-stone-900">Food<span className="gradient-text-orange">Spot</span></span>
              <span className="ml-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase text-white" style={{ background: 'linear-gradient(90deg, #ea580c, #dc2626)' }}>Sign Up</span>
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

      {/* Main Registration Form */}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="rounded-3xl border border-stone-200/90 bg-white p-7 sm:p-9 shadow-xl shadow-stone-900/5">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <UserPlus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-stone-950">
                Create your account
              </h1>
              <p className="text-xs text-stone-400 mt-0.5">
                Join FoodSpot and order from top local restaurants 🍕
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

          <div className="mb-4 space-y-3">
            <button
              type="button"
              disabled={googleSubmitting || submitting}
              onClick={() => void handleGoogleSignUp()}
              className="w-full flex items-center justify-center gap-3 rounded-2xl border-2 border-stone-200 bg-white px-5 py-3.5 text-sm font-bold text-stone-800 shadow-sm hover:border-stone-300 hover:shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {googleSubmitting ? (
                <svg className="h-5 w-5 animate-spin text-stone-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              <span>{googleSubmitting ? 'Connecting to Google…' : 'Sign Up with Google'}</span>
            </button>

            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-stone-400">
              <div className="h-px flex-1 bg-stone-200" />
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Or Register with Email
              </span>
              <div className="h-px flex-1 bg-stone-200" />
            </div>
          </div>

          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="reg-name"
                className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5"
              >
                Full Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 pl-10 pr-4 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="reg-email"
                className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 pl-10 pr-4 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="reg-phone"
                className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5"
              >
                Phone Number
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  id="reg-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (415) 555-0199"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 pl-10 pr-4 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="reg-password"
                  className="block text-xs font-bold uppercase tracking-wider text-stone-600"
                >
                  Password
                </label>
                <span className="text-[11px] font-bold text-stone-500">{strength.label}</span>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 pl-10 pr-11 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:bg-white focus:outline-none"
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
              {/* 4-Bar Password Strength Meter */}
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((bar) => (
                  <div
                    key={bar}
                    className={`h-1.5 rounded-full transition-colors ${
                      strength.score >= bar ? strength.color : 'bg-stone-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="reg-confirm-password"
                className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  id="reg-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 pl-10 pr-4 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 pt-1 text-xs text-stone-600 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
              />
              <span>
                I agree to the FoodSpot <strong>Terms of Service</strong> and{' '}
                <strong>Privacy Policy</strong>. Customer accounts are provisioned strictly for the
                Customer App workspace.
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting || googleSubmitting}
              className="btn-premium w-full rounded-2xl px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-orange-600/20 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #ea580c, #dc2626)' }}
            >
              {submitting ? 'Creating your account…' : 'Create Free Account'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-stone-100 text-center text-xs text-stone-600">
            Already have a customer account?{' '}
            <Link
              href="/customer/login"
              className="font-bold text-orange-600 hover:text-orange-700 underline underline-offset-2"
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-stone-400">
        FoodSpot Customer App • Free Registration
      </footer>
    </div>
  );
}
