'use client';

import React, { useMemo, useState } from 'react';
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
        showToast(`Welcome to FoodHub, ${data.user.name}!`);
        router.push('/customer/home');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/popup-closed-by-user') || msg.includes('auth/cancelled-popup-request')) {
        setErrorMessage('Google sign-in popup was closed before completing registration.');
      } else {
        setErrorMessage(msg || 'Firebase Google authentication failed.');
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
        showToast(`Account created! Welcome to FoodHub, ${data.user.name}.`);
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
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-600 to-red-600 text-white shadow-sm">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <span className="font-display text-lg font-extrabold text-stone-900">FoodHub</span>
              <span className="ml-2 rounded-md bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-700">
                Customer Signup
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

      {/* Main Registration Form */}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="rounded-3xl border border-stone-200/90 bg-white p-7 sm:p-9 shadow-xl shadow-stone-900/5">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <UserPlus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-stone-950">
                Create Customer Account
              </h1>
              <p className="text-xs text-stone-500">
                Join FoodHub to order from top local restaurants
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
              className="w-full flex items-center justify-center gap-3 rounded-2xl border-2 border-stone-200 bg-white px-5 py-3 text-sm font-extrabold text-stone-900 shadow-xs hover:border-orange-300 hover:bg-orange-50/40 transition-all cursor-pointer disabled:opacity-60"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 via-red-500 to-amber-400 text-[11px] font-black text-white">
                G
              </span>
              <span>
                {googleSubmitting
                  ? 'Connecting to Firebase Google Auth...'
                  : 'Sign Up with Google (Customer App)'}
              </span>
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
                I agree to the FoodHub <strong>Terms of Service</strong> and{' '}
                <strong>Privacy Policy</strong>. Customer accounts are provisioned strictly for the
                Customer App workspace.
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-gradient-to-r from-orange-600 to-red-600 px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-orange-600/20 hover:from-orange-700 hover:to-red-700 transition-all cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Creating Customer Account...' : 'Create Customer Account'}
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
        FoodHub Customer Workspace • Public Customer Registration
      </footer>
    </div>
  );
}
