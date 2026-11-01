'use client';

import React, { useState } from 'react';
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
  Store,
  UtensilsCrossed,
} from 'lucide-react';
import { useWorkspace } from '@/components/WorkspaceContext';

export default function WorkspaceSelectionPage() {
  const router = useRouter();
  const {
    customerUser,
    customerAuthReady,
    adminUser,
    adminAuthReady,
    revalidateWorkspace,
  } = useWorkspace();

  const [checkingWorkspace, setCheckingWorkspace] = useState<'customer' | 'admin' | null>(null);

  const handleContinueCustomer = async () => {
    setCheckingWorkspace('customer');
    try {
      const check = await revalidateWorkspace('customer');
      if (
        check.authenticated &&
        check.user &&
        check.user.allowedWorkspaces?.includes('customer')
      ) {
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
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col justify-between relative overflow-hidden">
      {/* Subtle Ambient Warm Culinary Glow */}
      <div className="pointer-events-none absolute -top-36 -left-36 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-36 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />

      {/* Top Brand Header */}
      <header className="relative z-10 border-b border-stone-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-600 to-red-600 text-white shadow-md shadow-orange-600/20">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xl font-extrabold tracking-tight text-stone-900">
                  FoodHub
                </span>
                <span className="rounded-md bg-orange-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-orange-700">
                  Platform v2.5
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Unified Two-Workspace Culinary Ordering &amp; Operations Platform
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs font-semibold text-stone-600">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Role-Isolated RBAC &amp; TOTP MFA
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace Selection Content */}
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 lg:px-8 flex flex-col justify-center">
        <div className="mx-auto max-w-2xl text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50/90 px-3.5 py-1.5 text-xs font-bold text-orange-700 mb-4 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-orange-600" />
            TWO-WORKSPACE ARCHITECTURE
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-950">
            Welcome to FoodHub
          </h1>
          <p className="mt-3 text-base sm:text-lg font-medium text-stone-600">
            Choose your workspace to continue.
          </p>
        </div>

        {/* Split-Card Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
          {/* Workspace 1 – Customer App */}
          <div className="group relative flex flex-col justify-between rounded-3xl border-2 border-stone-200/90 bg-white p-7 sm:p-9 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-orange-500 hover:shadow-2xl hover:shadow-orange-950/10">
            <div>
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg shadow-orange-600/25 transition-transform duration-300 group-hover:scale-105">
                  <UtensilsCrossed className="h-7 w-7" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-orange-50 border border-orange-200/80 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-orange-700">
                    Workspace 1
                  </span>
                  {customerAuthReady && customerUser && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Session Active
                    </span>
                  )}
                </div>
              </div>

              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-stone-950 group-hover:text-orange-600 transition-colors">
                Customer App
              </h2>
              <p className="mt-2.5 text-sm sm:text-base text-stone-600 leading-relaxed">
                Discover restaurants, explore delicious food, order your favorites and track deliveries.
              </p>

              <div className="mt-7 pt-6 border-t border-stone-100">
                <div className="text-xs font-extrabold uppercase tracking-wider text-stone-400 mb-4">
                  Customer Workspace Capabilities
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <li className="flex items-center gap-2.5 text-sm font-semibold text-stone-800">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                      <Compass className="h-4 w-4" />
                    </span>
                    Discover Restaurants.
                  </li>
                  <li className="flex items-center gap-2.5 text-sm font-semibold text-stone-800">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                      <Layers className="h-4 w-4" />
                    </span>
                    Explore Food Categories.
                  </li>
                  <li className="flex items-center gap-2.5 text-sm font-semibold text-stone-800">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                      <ShoppingBag className="h-4 w-4" />
                    </span>
                    Order Food Easily.
                  </li>
                  <li className="flex items-center gap-2.5 text-sm font-semibold text-stone-800">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                      <MapPin className="h-4 w-4" />
                    </span>
                    Track Live Orders.
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-4">
              <button
                type="button"
                onClick={handleContinueCustomer}
                disabled={checkingWorkspace !== null}
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-orange-600 to-red-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-orange-600/20 hover:from-orange-700 hover:to-red-700 transition-all cursor-pointer disabled:opacity-60"
              >
                <span>
                  {checkingWorkspace === 'customer'
                    ? 'Verifying Customer Session...'
                    : 'Continue as Customer'}
                </span>
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
              <div className="mt-3 flex items-center justify-between text-xs text-stone-500 px-1">
                <span>
                  {customerAuthReady && customerUser
                    ? `Signed in as ${customerUser.name}`
                    : 'Public registration & customer sign-in available'}
                </span>
                <Link
                  href="/customer/register"
                  className="font-bold text-orange-600 hover:text-orange-700 underline underline-offset-2"
                >
                  Create Customer Account
                </Link>
              </div>
            </div>
          </div>

          {/* Workspace 2 – Admin Console */}
          <div className="group relative flex flex-col justify-between rounded-3xl border-2 border-stone-200/90 bg-white p-7 sm:p-9 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-stone-900 hover:shadow-2xl hover:shadow-stone-950/10">
            <div>
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-stone-900 to-stone-700 text-white shadow-lg shadow-stone-900/25 transition-transform duration-300 group-hover:scale-105">
                  <ShieldCheck className="h-7 w-7 text-amber-400" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-stone-100 border border-stone-300/80 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-stone-800">
                    Workspace 2
                  </span>
                  {adminAuthReady && adminUser && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Admin MFA Active
                    </span>
                  )}
                </div>
              </div>

              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-stone-950 group-hover:text-stone-800 transition-colors">
                Admin Console
              </h2>
              <p className="mt-2.5 text-sm sm:text-base text-stone-600 leading-relaxed">
                Manage restaurants, menus, food categories, customer orders, platform activity and operations.
              </p>

              <div className="mt-7 pt-6 border-t border-stone-100">
                <div className="text-xs font-extrabold uppercase tracking-wider text-stone-400 mb-4">
                  Administrative Operations Suite
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <li className="flex items-center gap-2.5 text-sm font-semibold text-stone-800">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-800">
                      <Store className="h-4 w-4" />
                    </span>
                    Manage Restaurants.
                  </li>
                  <li className="flex items-center gap-2.5 text-sm font-semibold text-stone-800">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-800">
                      <Layers className="h-4 w-4" />
                    </span>
                    Manage Menus &amp; Categories.
                  </li>
                  <li className="flex items-center gap-2.5 text-sm font-semibold text-stone-800">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-800">
                      <ClipboardList className="h-4 w-4" />
                    </span>
                    Monitor Customer Orders.
                  </li>
                  <li className="flex items-center gap-2.5 text-sm font-semibold text-stone-800">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-800">
                      <BarChart3 className="h-4 w-4" />
                    </span>
                    View Platform Analytics.
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-4">
              <button
                type="button"
                onClick={handleContinueAdmin}
                disabled={checkingWorkspace !== null}
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-stone-900 px-6 py-4 text-base font-bold text-white shadow-lg shadow-stone-900/20 hover:bg-stone-800 transition-all cursor-pointer disabled:opacity-60"
              >
                <span>
                  {checkingWorkspace === 'admin'
                    ? 'Verifying Admin Authorization...'
                    : 'Continue as Admin'}
                </span>
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
              <div className="mt-3 flex items-center justify-between text-xs text-stone-500 px-1">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-stone-400" />
                  Authorized Administrator Access &amp; MFA Required
                </span>
                <span className="font-semibold text-stone-400">No Public Signup</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-stone-200/80 bg-white/70 py-5">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-3 px-4 text-xs text-stone-500 sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} FoodHub Platform. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>Workspace 1: Customer App (/customer/*)</span>
            <span>•</span>
            <span>Workspace 2: Admin Console (/admin/*)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
