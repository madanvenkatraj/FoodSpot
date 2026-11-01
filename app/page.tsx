'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Compass,
  Flame,
  Layers,
  Lock,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Timer,
  UtensilsCrossed,
  Zap,
} from 'lucide-react';
import { useWorkspace } from '@/components/WorkspaceContext';

const FOOD_EMOJIS = ['🍕', '🍔', '🌮', '🍜', '🍱', '🥗', '🍣', '🍛', '🥙', '🧆'];
const STATS = [
  { value: '500+', label: 'Restaurants', icon: Store },
  { value: '50K+', label: 'Happy Customers', icon: Star },
  { value: '30 min', label: 'Avg. Delivery', icon: Timer },
  { value: '4.8★', label: 'Avg. Rating', icon: Zap },
];

export default function WorkspaceSelectionPage() {
  const router = useRouter();
  const { customerUser, customerAuthReady, adminUser, adminAuthReady, revalidateWorkspace } =
    useWorkspace();

  const [checkingWorkspace, setCheckingWorkspace] = useState<'customer' | 'admin' | null>(null);
  const [emojiIndex, setEmojiIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setEmojiIndex((i) => (i + 1) % FOOD_EMOJIS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const handleContinueCustomer = async () => {
    setCheckingWorkspace('customer');
    try {
      const check = await revalidateWorkspace('customer');
      if (check.authenticated && check.user && check.user.allowedWorkspaces?.includes('customer')) {
        router.push('/customer/home');
      } else {
        router.push('/customer/login');
      }
    } finally {
      setCheckingWorkspace(null);
    }
  };

  const handleContinueAdmin = async () => {
    setCheckingWorkspace('admin');
    try {
      const check = await revalidateWorkspace('admin');
      if (
        check.authenticated &&
        check.user &&
        check.user.role === 'admin' &&
        check.user.allowedWorkspaces?.includes('admin')
      ) {
        router.push('/admin/dashboard');
      } else {
        router.push('/admin/login');
      }
    } finally {
      setCheckingWorkspace(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(135deg, #FFF8F3 0%, #FFF3EA 40%, #FFF8F3 100%)' }}>
      {/* Ambient Background Orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-30 animate-spin-slow" style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.3) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-20 animate-spin-slow" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, transparent 70%)', animationDirection: 'reverse' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-10" style={{ background: 'radial-gradient(circle, rgba(234,88,12,0.2) 0%, transparent 70%)' }} />
      </div>

      {/* Top Nav */}
      <header className="relative z-20 glass border-b border-orange-100/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg shadow-orange-600/30 animate-pulse-glow" style={{ background: 'linear-gradient(135deg, #ea580c, #dc2626)' }}>
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xl font-extrabold tracking-tight text-stone-900">
                  Food<span className="gradient-text-orange">Spot</span>
                </span>
                <span className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white" style={{ background: 'linear-gradient(90deg, #ea580c, #dc2626)' }}>
                  v2.5
                </span>
              </div>
              <p className="text-[11px] text-stone-400 font-medium">Premium Food Ordering Platform</p>
            </div>
          </div>
          {/* Nav badges */}
          <div className="hidden sm:flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Orders Active
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-stone-600">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              RBAC Secured
            </span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col">
        {/* Hero */}
        <section className="mx-auto w-full max-w-7xl px-4 pt-14 pb-10 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">
            {/* Pill badge */}
            <div className={`inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-xs font-bold text-orange-700 mb-6 shadow-sm ${mounted ? 'animate-fade-in-down' : ''}`}>
              <Sparkles className="h-3.5 w-3.5 text-orange-500" />
              MULTI-WORKSPACE FOOD DELIVERY PLATFORM
            </div>

            {/* Headline */}
            <h1 className={`font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-stone-950 leading-[1.05] mb-4 ${mounted ? 'animate-fade-in-up stagger-1' : ''}`}>
              Food you love,{' '}
              <span className="gradient-text-orange">delivered fast</span>
              <br />
              <span className="inline-flex items-center gap-3">
                with a pinch of{' '}
                <span className="inline-block transition-all duration-500 text-5xl sm:text-6xl animate-float" style={{ lineHeight: 1 }}>
                  {mounted ? FOOD_EMOJIS[emojiIndex] : '🍕'}
                </span>
              </span>
            </h1>

            <p className={`mt-3 max-w-2xl text-lg text-stone-500 font-medium leading-relaxed ${mounted ? 'animate-fade-in-up stagger-2' : ''}`}>
              Order from hundreds of restaurants, track your delivery live, and manage your food business — all in one premium platform.
            </p>

            {/* Stats Row */}
            <div className={`mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-2xl ${mounted ? 'animate-fade-in-up stagger-3' : ''}`}>
              {STATS.map(({ value, label, icon: Icon }, i) => (
                <div key={label} className="flex flex-col items-center gap-1.5 rounded-2xl border border-stone-200/70 bg-white/80 p-4 shadow-sm backdrop-blur-sm" style={{ animationDelay: `${0.1 * i}s` }}>
                  <Icon className="h-5 w-5 text-orange-500" />
                  <span className="font-display text-2xl font-extrabold text-stone-900">{value}</span>
                  <span className="text-xs font-semibold text-stone-500">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Workspace Cards */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">

            {/* Customer Workspace */}
            <div className={`group relative flex flex-col justify-between rounded-3xl border border-orange-100 bg-white p-7 sm:p-9 shadow-xl shadow-orange-900/5 overflow-hidden card-hover ${mounted ? 'animate-fade-in-up stagger-4' : ''}`}>
              {/* Decorative corner blob */}
              <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full opacity-20 group-hover:opacity-30 transition-opacity duration-500" style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }} />

              <div>
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-xl shadow-orange-600/30 transition-transform duration-300 group-hover:scale-110" style={{ background: 'linear-gradient(135deg, #ea580c, #dc2626)' }}>
                    <UtensilsCrossed className="h-8 w-8" />
                    <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500 flex items-center justify-center">
                      <span className="text-[6px] font-black text-white">●</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-orange-700">
                      Workspace 1
                    </span>
                    {customerAuthReady && customerUser && (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Active Session
                      </span>
                    )}
                  </div>
                </div>

                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-stone-950 group-hover:text-orange-600 transition-colors duration-300">
                  Customer App
                </h2>
                <p className="mt-2.5 text-sm sm:text-base text-stone-500 leading-relaxed">
                  Discover restaurants nearby, explore curated food categories, order your favourites and track live deliveries in real time.
                </p>

                <div className="mt-6 pt-5 border-t border-stone-100">
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-stone-400 mb-4">What you can do</p>
                  <ul className="grid grid-cols-2 gap-3">
                    {[
                      { icon: Compass, text: 'Discover Restaurants' },
                      { icon: Layers, text: 'Browse Categories' },
                      { icon: ShoppingBag, text: 'Order Instantly' },
                      { icon: MapPin, text: 'Live Order Tracking' },
                    ].map(({ icon: Icon, text }) => (
                      <li key={text} className="flex items-center gap-2.5 text-sm font-semibold text-stone-700">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8">
                <button
                  id="btn-continue-customer"
                  type="button"
                  onClick={handleContinueCustomer}
                  disabled={checkingWorkspace !== null}
                  className="btn-premium w-full flex items-center justify-center gap-2.5 rounded-2xl px-6 py-4 text-base font-bold text-white shadow-lg shadow-orange-600/25 hover:shadow-orange-600/40 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #ea580c, #dc2626)' }}
                >
                  <span>
                    {checkingWorkspace === 'customer' ? 'Verifying Session…' : 'Order Food Now'}
                  </span>
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </button>
                <div className="mt-3 flex items-center justify-between text-xs text-stone-400 px-1">
                  <span>
                    {customerAuthReady && customerUser
                      ? `👋 Signed in as ${customerUser.name}`
                      : 'Free registration • No credit card needed'}
                  </span>
                  <Link
                    href="/customer/register"
                    className="font-bold text-orange-600 hover:text-orange-700 underline underline-offset-2"
                  >
                    Create Account →
                  </Link>
                </div>
              </div>
            </div>

            {/* Admin Workspace */}
            <div className={`group relative flex flex-col justify-between rounded-3xl border border-stone-200 bg-gradient-to-br from-stone-950 to-stone-800 p-7 sm:p-9 shadow-xl shadow-stone-900/30 overflow-hidden card-hover ${mounted ? 'animate-fade-in-up stagger-5' : ''}`}>
              {/* Decorative shimmer */}
              <div className="pointer-events-none absolute inset-0 opacity-10" style={{ background: 'radial-gradient(ellipse at top right, rgba(251,191,36,0.4) 0%, transparent 60%)' }} />
              <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)' }} />

              <div>
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 shadow-xl transition-transform duration-300 group-hover:scale-110">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className="rounded-xl border border-white/10 bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-stone-300">
                      Workspace 2
                    </span>
                    {adminAuthReady && adminUser && (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-900/40 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        MFA Active
                      </span>
                    )}
                  </div>
                </div>

                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white group-hover:text-amber-300 transition-colors duration-300">
                  Admin Console
                </h2>
                <p className="mt-2.5 text-sm sm:text-base text-stone-400 leading-relaxed">
                  Manage restaurants, menus, food categories, customer orders, platform analytics and operations from a central hub.
                </p>

                <div className="mt-6 pt-5 border-t border-white/10">
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-stone-500 mb-4">Admin capabilities</p>
                  <ul className="grid grid-cols-2 gap-3">
                    {[
                      { icon: Store, text: 'Manage Restaurants' },
                      { icon: Layers, text: 'Menus & Categories' },
                      { icon: ClipboardList, text: 'Monitor Orders' },
                      { icon: BarChart3, text: 'Platform Analytics' },
                    ].map(({ icon: Icon, text }) => (
                      <li key={text} className="flex items-center gap-2.5 text-sm font-semibold text-stone-400">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-amber-400">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8">
                <button
                  id="btn-continue-admin"
                  type="button"
                  onClick={handleContinueAdmin}
                  disabled={checkingWorkspace !== null}
                  className="w-full flex items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-white/10 hover:bg-white/20 px-6 py-4 text-base font-bold text-white transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  <span>
                    {checkingWorkspace === 'admin' ? 'Verifying Authorization…' : 'Admin Sign In'}
                  </span>
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </button>
                <div className="mt-3 flex items-center justify-between text-xs text-stone-500 px-1">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    MFA required • Invite-only access
                  </span>
                  <span className="font-semibold text-stone-600">No public signup</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Strip */}
        <section className="relative border-y border-stone-200/60 bg-white/60 backdrop-blur-md py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
              {[
                { emoji: '⚡', title: 'Real-time Tracking', desc: 'Live GPS order updates' },
                { emoji: '🔒', title: 'Secure Auth', desc: 'TOTP MFA + RBAC' },
                { emoji: '🤖', title: 'Yantra AI Support', desc: 'AI-powered ticketing' },
                { emoji: '📱', title: 'Multi-device', desc: 'Works everywhere' },
              ].map(({ emoji, title, desc }, i) => (
                <div key={title} className={`flex flex-col items-center gap-2 ${mounted ? `animate-fade-in-up stagger-${i + 1}` : ''}`}>
                  <span className="text-3xl">{emoji}</span>
                  <p className="text-sm font-bold text-stone-800">{title}</p>
                  <p className="text-xs text-stone-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-stone-200/60 bg-white/70 backdrop-blur-md py-5">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-3 px-4 text-xs text-stone-400 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <span>© {new Date().getFullYear()} FoodSpot Platform. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-medium">Powered by Yantra AI Ticketing</span>
            <span>•</span>
            <span>Customer App (/customer/*)</span>
            <span>•</span>
            <span>Admin Console (/admin/*)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
